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

    // ── Giveaway ─────────────────────────────────────────────────────
    // Satu orang satu tiket. Ini yang membuat "ikut dua kali" tidak mungkin
    // terjadi, termasuk lewat dua permintaan yang datang bersamaan —
    // pemeriksaan di kode bisa dilewati keduanya, indeks unik tidak bisa.
    await buat(db, "giveaway_peserta", { giveawayId: 1, token: 1 }, { unique: true });
    await buat(db, "giveaways", { giveawayId: 1 }, { unique: true });
    await buat(db, "giveaways", { status: 1, selesaiAt: 1 });

    // ── Komisi reseller ──────────────────────────────────────────────
    // Satu pesanan = satu komisi. Ini yang membuat "komisi dihitung dua kali"
    // tidak mungkin terjadi lewat jalur mana pun, termasuk yang ditambahkan
    // setahun lagi oleh orang yang tidak membaca komentarnya.
    await buat(db, "reseller_komisi", { orderId: 1 }, { unique: true });
    await buat(db, "reseller_komisi", { botId: 1, createdAt: -1 });
    await buat(db, "reseller_withdrawals", { wdId: 1 }, { unique: true });
    await buat(db, "reseller_withdrawals", { status: 1, createdAt: -1 });
    await buat(db, "reseller_withdrawals", { pemilikToken: 1, createdAt: -1 });

    // ── Penahanan saldo ──────────────────────────────────────────────
    // holdId unik: satu hold tidak boleh punya dua dokumen, karena
    // pengembaliannya mengklaim lewat status di dalam filter — dua dokumen
    // berarti dua klaim berhasil dan saldonya dikembalikan dua kali.
    await buat(db, "saldo_holds", { holdId: 1 }, { unique: true });
    // Penyapu mencari yang masih "held" dan sudah lama. Tanpa indeks ini ia
    // memindai seluruh koleksi tiap kali cron jalan.
    await buat(db, "saldo_holds", { status: 1, createdAt: 1 });
    await buat(db, "saldo_holds", { token: 1, status: 1 });
    // Penyapu memeriksa apakah pesanannya sempat tersimpan sebelum
    // mengembalikan saldo. Tanpa indeks ini, pemeriksaan itu memindai seluruh
    // riwayat pesanan untuk SETIAP hold yang disapu.
    await buat(db, "otp_orders", { holdId: 1 }, { sparse: true });

    // ── Room Chat ────────────────────────────────────────────────────
    await buat(db, "wa_profil", { pid: 1 }, { unique: true });
    await buat(db, "wa_profil", { token: 1 }, { unique: true });
    await buat(db, "wa_profil", { lencana: 1 }, { sparse: true });
    await buat(db, "wa_room", { roomId: 1 }, { unique: true });
    await buat(db, "wa_room", { anggota: 1, lastAt: -1 });
    await buat(db, "wa_room", { kodeUndang: 1 }, { unique: true, sparse: true });
    await buat(db, "wa_pesan", { msgId: 1 }, { unique: true });
    await buat(db, "wa_pesan", { roomId: 1, createdAt: -1 });
    // Pesan sementara: MongoDB menghapus sendiri dokumen yang expireAt-nya lewat (yang null/tanpa expireAt tak tersentuh).
    await buat(db, "wa_pesan", { expireAt: 1 }, { expireAfterSeconds: 0 });
    await buat(db, "wa_pref", { pid: 1, roomId: 1 }, { unique: true });
    // Status hilang sendiri 24 jam sesudah dibuat (TTL pada expireAt).
    await buat(db, "wa_status", { expireAt: 1 }, { expireAfterSeconds: 0 });
    await buat(db, "wa_status", { pid: 1, createdAt: -1 });
    await buat(db, "wa_call", { callId: 1 }, { unique: true });
    await buat(db, "wa_call", { ke: 1, status: 1, createdAt: -1 });
    await buat(db, "wa_call", { dari: 1, createdAt: -1 });

    // ── Duel permainan ───────────────────────────────────────────────
    await buat(db, "game_match", { gameId: 1 }, { unique: true });
    await buat(db, "game_match", { status: 1, createdAt: -1 });
    await buat(db, "game_match", { "pemain.pid": 1, createdAt: -1 });
    await buat(db, "game_match", { bayarStatus: 1 });
    // Season Arena & klan
    await buat(db, "arena_skor", { jenis: 1, periode: 1, rating: -1 });
    await buat(db, "arena_skor", { jenis: 1, periode: 1, poin: -1 });
    await buat(db, "arena_catat", { pasangan: 1, hari: 1 });
    await buat(db, "klan", { klanId: 1 }, { unique: true });
    await buat(db, "klan", { kunciNama: 1 }, { unique: true });
    await buat(db, "klan", { tag: 1 }, { unique: true });
    await buat(db, "klan_anggota", { pid: 1 }, { unique: true });
    await buat(db, "klan_anggota", { token: 1 });
    await buat(db, "klan_anggota", { klanId: 1, joinedAt: 1 });
    await buat(db, "klan_misi", { minggu: 1, skor: -1 });
    // Penanda bukti transfer terpakai: unik per hash gambar / nomor referensi.
    await buat(db, "bukti_terpakai", { kunci: 1 }, { unique: true });
    await buat(db, "tarik_poin", { tid: 1 }, { unique: true });
    await buat(db, "tarik_poin", { token: 1, createdAt: -1 });
    await buat(db, "tarik_poin", { status: 1, createdAt: 1 });
    await buat(db, "wd_instan", { wid: 1 }, { unique: true });
    await buat(db, "wd_instan", { token: 1, createdAt: -1 });
    await buat(db, "wd_instan", { status: 1, createdAt: 1 });
    await buat(db, "wd_instan", { nomor: 1, token: 1 });
    await buat(db, "wd_instan", { providerId: 1 }, { sparse: true });
    // Jejak perangkat: unik per akun+perangkat (kunci), dicari lewat perangkat & IP.
    await buat(db, "perangkat_akun", { kunci: 1 }, { unique: true });
    await buat(db, "perangkat_akun", { dev: 1 });
    await buat(db, "perangkat_akun", { ips: 1 });
    await buat(db, "perangkat_akun", { token: 1 });
    await buat(db, "anti_curang", { at: -1 });
    await buat(db, "anti_curang", { token: 1, at: -1 });
    await buat(db, "security_events", { at: 1 }, { name: "keamanan_ttl_30hari", expireAfterSeconds: 30 * 24 * 3600 });
    await buat(db, "security_events", { jenis: 1, at: -1 });
    await buat(db, "game_solo", { rid: 1 }, { unique: true });
    await buat(db, "game_solo", { token: 1, createdAt: -1 });
    await buat(db, "game_solo", { status: 1, createdAt: 1 });

    // ── Program kreator ──────────────────────────────────────────────
    // Satu pengajuan per akun; satu komisi per pesanan (dicatat DULU, saldo
    // ditambah SESUDAH — indeks unik ini yang mencegah komisi ganda).
    await buat(db, "afiliasi_pengajuan", { token: 1 }, { unique: true });
    await buat(db, "afiliasi_pengajuan", { status: 1, createdAt: -1 });
    await buat(db, "afiliasi_komisi", { orderId: 1 }, { unique: true });
    await buat(db, "afiliasi_komisi", { kreatorToken: 1, createdAt: -1 });

    // ── Bonus target reseller ────────────────────────────────────────
    // Satu bonus per (pemilik, bulan, level): indeks unik ini yang membuat
    // bonus tidak bisa dibayar dua kali walau dua pesanan selesai bersamaan.
    await buat(db, "reseller_bonus", { kunci: 1 }, { unique: true });
    await buat(db, "reseller_bonus", { pemilikToken: 1, bulan: 1 });
    await buat(db, "reseller_komisi", { pemilikToken: 1, selesai: 1, createdAt: -1 });

    // ── Pantau stok ──────────────────────────────────────────────────
    // Satu dokumen per (akun, server, layanan); meminta lagi menghidupkan
    // dokumen yang sama, bukan menambah baris.
    await buat(db, "stok_watch", { kunci: 1 }, { unique: true });
    await buat(db, "stok_watch", { aktif: 1, server: 1, serviceId: 1 });
    await buat(db, "stok_watch", { token: 1, aktif: 1 });

    // ── Push web ─────────────────────────────────────────────────────
    // endpoint unik: satu perangkat = satu langganan, mendaftar ulang menimpa.
    await buat(db, "push_langganan", { endpoint: 1 }, { unique: true });
    await buat(db, "push_langganan", { token: 1 });

    // ── Bonus referral tertahan ──────────────────────────────────────
    // Satu deposit = paling banyak satu catatan tertahan, jadi deposit yang
    // diproses ulang tidak menggandakan antrean tinjauan (dan tidak bisa
    // disetujui dua kali).
    await buat(db, "referral_tertahan", { depositOrderId: 1 }, { unique: true });
    await buat(db, "referral_tertahan", { status: 1, createdAt: -1 });
    // Pemeriksaan "akun undangan dari IP yang sama" dan batas harian.
    await buat(db, "users", { referredBy: 1, signupIpHash: 1 }, { sparse: true });
    await buat(db, "balance_logs", { token: 1, type: 1, createdAt: -1 });

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
