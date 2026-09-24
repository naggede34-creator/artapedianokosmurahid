// Indeks database, termasuk beberapa indeks UNIK yang bukan sekadar soal
// kecepatan — ia jaring pengaman terakhir untuk uang.
//
// Penjagaan di kode (findOneAndUpdate dengan syarat di dalam filternya) sudah
// benar dan sudah diuji. Tapi ia hanya menjaga jalur yang sudah kita ketahui.
// Indeks unik menjaga SEMUA jalur sekaligus, termasuk yang ditambahkan
// setahun lagi oleh orang yang tidak membaca komentar ini: kalau ada yang
// mencoba mencatat kredit kedua untuk deposit yang sama, database menolaknya
// dan kita mendapat error yang keras — bukan saldo yang diam-diam berlipat.
import { getDb } from "@/lib/db";

let sudahJalan = null;

async function buat(db, koleksi, spec, opsi) {
  try {
    await db.collection(koleksi).createIndex(spec, opsi);
  } catch (err) {
    // Indeks unik GAGAL dibuat kalau datanya sudah terlanjur punya duplikat.
    // Itu justru temuan penting: berarti kerusakannya sudah ada. Dicatat
    // dengan jelas, tanpa menjatuhkan aplikasinya.
    const pesan = String(err?.message || err);
    if (err?.code === 11000 || /duplicate key/i.test(pesan)) {
      console.error(
        `[indeks] TIDAK BISA membuat indeks unik ${koleksi}.${JSON.stringify(spec)} — ada data duplikat. ` +
          `Jalankan audit saldo di panel admin untuk melihat mana yang rangkap. Rincian: ${pesan.slice(0, 200)}`
      );
    } else {
      console.error(`[indeks] ${koleksi}:`, pesan.slice(0, 200));
    }
  }
}

export async function ensureIndexes() {
  if (sudahJalan) return sudahJalan;
  sudahJalan = (async () => {
    const db = await getDb();

    // ── Kunci uang ───────────────────────────────────────────────────
    // Satu kredit deposit per transaksi, per akun. Ini yang membuat "deposit
    // 5.000 masuk 10.000" tidak mungkin terjadi lagi lewat jalur mana pun.
    await buat(db, "balance_logs", { token: 1, type: 1, ref: 1 }, {
      name: "kredit_deposit_sekali",
      unique: true,
      partialFilterExpression: { type: "deposit", ref: { $type: "string" } }
    });

    // Dua dokumen deposit dengan orderId sama berarti dua kali kredit yang
    // masing-masing lolos penjagaannya sendiri.
    await buat(db, "deposits", { orderId: 1 }, { name: "order_deposit_unik", unique: true });
    await buat(db, "otp_orders", { orderId: 1 }, { name: "order_otp_unik", unique: true });
    await buat(db, "users", { token: 1 }, { name: "kode_akun_unik", unique: true });
    // Satu pet per akun. Dua dokumen pet untuk satu orang berarti dua sumber
    // level yang berbeda, dan bonus cashback yang berubah-ubah tergantung mana
    // yang kebetulan terbaca lebih dulu.
    await buat(db, "pets", { token: 1 }, { name: "pet_satu_per_akun", unique: true });

    // ── Kecepatan ────────────────────────────────────────────────────
    await buat(db, "deposits", { token: 1, createdAt: -1 });
    await buat(db, "deposits", { status: 1, createdAt: -1 });
    await buat(db, "otp_orders", { token: 1, createdAt: -1 });
    await buat(db, "otp_orders", { status: 1, createdAt: -1 });
    await buat(db, "balance_logs", { token: 1, createdAt: -1 });
    await buat(db, "chat_messages", { createdAt: -1 });

    // ── QRIS Gateway ─────────────────────────────────────────────────
    // Saldo gateway adalah uang titipan pembeli orang lain, jadi penjagaannya
    // sama kerasnya dengan deposit.
    //
    // Yang ini yang paling penting: satu tagihan hanya boleh menambah saldo
    // SEKALI. Pakasir bisa mengirim callback yang sama berkali-kali (itu wajar
    // dan memang dirancang begitu — pengirim webhook mengulang sampai dapat
    // 200), dan tanpa indeks ini, satu pembayaran Rp500.000 yang callback-nya
    // terkirim tiga kali akan jadi Rp1.500.000 di saldo merchant.
    await buat(
      db,
      "gateway_ledger",
      { invoiceId: 1 },
      { unique: true, partialFilterExpression: { jenis: "masuk" }, name: "kredit_invoice_sekali" }
    );
    await buat(db, "gateway_invoices", { invoiceId: 1 }, { unique: true });
    await buat(db, "gateway_accounts", { token: 1 }, { unique: true });
    // API key harus unik: dua akun dengan kunci sama berarti pembayaran masuk
    // ke saldo yang salah, dan tidak ada cara memulihkannya.
    await buat(
      db,
      "gateway_accounts",
      { apiKey: 1 },
      { unique: true, partialFilterExpression: { apiKey: { $type: "string" } } }
    );
    await buat(db, "gateway_withdrawals", { wdId: 1 }, { unique: true });
    await buat(db, "gateway_invoices", { token: 1, createdAt: -1 });
    await buat(db, "gateway_invoices", { status: 1, createdAt: -1 });
    await buat(db, "gateway_withdrawals", { token: 1, createdAt: -1 });
    await buat(db, "gateway_withdrawals", { status: 1, createdAt: -1 });
    await buat(db, "gateway_ledger", { token: 1, createdAt: -1 });

    // ── Bot toko tambahan ────────────────────────────────────────────
    // Satu dokumen per bot. botId unik supaya bot yang sama tidak bisa
    // terdaftar dua kali dengan secret webhook berbeda — kalau itu terjadi,
    // satu dari dua dokumennya akan menolak SEMUA update botnya dengan 401
    // dan tidak ada yang tahu mana yang sedang dipakai.
    await buat(db, "bots", { botId: 1 }, { unique: true });
    // Token unik: dua bot dengan token sama berarti satu bot dilayani dua
    // dokumen, dan mematikan salah satunya tidak mematikan botnya.
    await buat(db, "bots", { token: 1 }, { unique: true });

    // Sesi bot dikunci per (bot, chat), BUKAN per chat.
    //
    // Id chat Telegram melekat pada orangnya dan sama persis di semua bot.
    // Tanpa botId di kuncinya, langkah yang sedang berjalan di bot A terbaca
    // oleh bot B — termasuk kode akun yang tertaut dan deposit yang sedang
    // berjalan. Tidak unik: dokumen lama (sebelum ada bot kedua) belum punya
    // botId, dan memaksanya unik sekarang akan menggagalkan pembuatan indeks
    // di database yang sudah berjalan.
    await buat(db, "bot_sessions", { chatId: 1, botId: 1 });
  })().catch((err) => {
    console.error("[indeks] gagal:", err?.message || err);
  });
  return sudahJalan;
}
