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
  })().catch((err) => {
    console.error("[indeks] gagal:", err?.message || err);
  });
  return sudahJalan;
}
