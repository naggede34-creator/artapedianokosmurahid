import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
let clientPromise;

if (!uri) {
  console.warn("[db] MONGODB_URI belum diset di environment variables.");
}

if (!global._mongoClientPromise) {
  const client = new MongoClient(uri || "mongodb://localhost:27017/artapedia");
  global._mongoClientPromise = client.connect();
}
clientPromise = global._mongoClientPromise;

export async function getDb() {
  const client = await clientPromise;
  return client.db();
}

// Indeks dipasang sekali per proses, dan TIDAK ditunggu: memasang indeks bisa
// makan waktu pada koleksi besar, dan permintaan pertama tidak perlu menunggu
// itu selesai. Kegagalannya dicatat di log, bukan menjatuhkan permintaan.
if (uri) {
  import("@/lib/indexes")
    .then((m) => m.ensureIndexes())
    .catch((err) => console.error("[db] gagal memasang indeks:", err?.message || err));
}

export async function usersCol() {
  return (await getDb()).collection("users");
}

export async function depositsCol() {
  return (await getDb()).collection("deposits");
}

export async function otpOrdersCol() {
  return (await getDb()).collection("otp_orders");
}

export async function settingsCol() {
  return (await getDb()).collection("settings");
}

export async function adminBalanceLogsCol() {
  return (await getDb()).collection("admin_balance_logs");
}

export async function vouchersCol() {
  return (await getDb()).collection("vouchers");
}

export async function broadcastsCol() {
  return (await getDb()).collection("broadcasts");
}

export async function announcementsCol() {
  return (await getDb()).collection("announcements");
}

// Buku besar semua perubahan saldo (sumber data halaman Mutasi Saldo).
export async function balanceLogsCol() {
  return (await getDb()).collection("balance_logs");
}

// Klaim garansi nokos bermasalah.
export async function warrantyClaimsCol() {
  return (await getDb()).collection("warranty_claims");
}

// Aktivitas harian: check-in, spin wheel (satu record per token per type per hari).
export async function dailyActivitiesCol() {
  return (await getDb()).collection("daily_activities");
}

// Misi harian/mingguan pengguna.
export async function missionsCol() {
  return (await getDb()).collection("missions");
}

// Flash sale — diskon terbatas waktu dari admin.
export async function flashSalesCol() {
  return (await getDb()).collection("flash_sales");
}

// Mystery box — hadiah kejutan setelah transaksi.
export async function mysteryBoxCol() {
  return (await getDb()).collection("mystery_boxes");
}

// Tantangan mingguan.
export async function weeklyChallengesCol() {
  return (await getDb()).collection("weekly_challenges");
}

// Notifikasi in-app per user.
export async function userNotificationsCol() {
  return (await getDb()).collection("user_notifications");
}

// Lucky hour — jam diskon yang diatur admin.
export async function luckyHoursCol() {
  return (await getDb()).collection("lucky_hours");
}

// Kartu gores digital setelah deposit.
export async function scratchCardsCol() {
  return (await getDb()).collection("scratch_cards");
}

// Leaderboard pembeli terbanyak mingguan.
export async function weeklyBuyerLeaderboardCol() {
  return (await getDb()).collection("weekly_buyer_leaderboard");
}

// Statistik gamifikasi agregat.
export async function gamificationStatsCol() {
  return (await getDb()).collection("gamification_stats");
}

// Markup kustom per platform OTP.
export async function platformMarkupCol() {
  return (await getDb()).collection("platform_markup");
}

// Favorit OTP user (kombinasi service + server yang sering dipakai).
export async function otpFavoritesCol() {
  return (await getDb()).collection("otp_favorites");
}

// Link Telegram user (chatId ↔ token).
export async function userTelegramCol() {
  return (await getDb()).collection("user_telegram");
}

// Produk digital yang dijual admin (foto, file, teks).
export async function productsCol() {
  return (await getDb()).collection("products");
}

// Riwayat pembelian produk digital per user.
export async function productOrdersCol() {
  return (await getDb()).collection("product_orders");
}

// Job / tugas dari admin — user selesaikan untuk dapat saldo gratis.
export async function jobsCol() {
  return (await getDb()).collection("jobs");
}

// Pengajuan penyelesaian job dari user (menunggu review admin).
export async function jobSubmissionsCol() {
  return (await getDb()).collection("job_submissions");
}

// Banner / iklan berbayar — tampil di homepage, halaman order, atau dashboard.
export async function bannersCol() {
  return (await getDb()).collection("banners");
}

// Tiket dukungan user (embedded messages array).
export async function ticketsCol() {
  return (await getDb()).collection("support_tickets");
}

// Pesan grup chat komunitas.
export async function chatMessagesCol() {
  return (await getDb()).collection("chat_messages");
}

// Pengaturan grup chat (nama, deskripsi, foto, status buka/tutup).
export async function chatGroupSettingsCol() {
  return (await getDb()).collection("chat_group_settings");
}

// Sesi bot Telegram toko: menghubungkan chat Telegram dengan kode akun web,
// sekaligus menyimpan langkah percakapan yang sedang berjalan.
export async function botSessionsCol() {
  return (await getDb()).collection("bot_sessions");
}

// Penarikan saldo Atlantic ke rekening/e-wallet pemilik web. Hanya admin yang
// bisa membuatnya; catatannya disimpan supaya ada riwayat di luar dasbor Atlantic.
export async function withdrawalsCol() {
  return (await getDb()).collection("withdrawals");
}

// Penarikan INSTANT via AustinPay: penarikan saldo nokos & poin game pengguna, serta penarikan admin.
// Satu dokumen = satu pengiriman ke penyedia (dicatat SEBELUM dikirim; lihat lib/wdInstan.js).
export async function wdInstanCol() {
  return (await getDb()).collection("wd_instan");
}

// Giveaway: event, dan tiket pesertanya.
export async function giveawayCol() {
  return (await getDb()).collection("giveaways");
}
export async function giveawayPesertaCol() {
  return (await getDb()).collection("giveaway_peserta");
}

// Komisi reseller per pesanan. Koleksi sendiri, bukan cuma $inc di dokumen
// botnya: satu $inc tidak punya cara tahu apakah ia sudah pernah dijalankan
// untuk pesanan yang sama. Lihat lib/resellerKomisi.js.
export async function resellerKomisiCol() {
  return (await getDb()).collection("reseller_komisi");
}

// Permintaan penarikan komisi reseller ke e-wallet. Diperiksa admin dulu.
export async function resellerWdCol() {
  return (await getDb()).collection("reseller_withdrawals");
}

// Penahanan saldo untuk pembelian yang bisa gagal di tengah jalan. Ditulis
// SEBELUM saldo dipotong, supaya potongan yang gagal selalu meninggalkan jejak
// walau fungsinya keburu mati. Lihat lib/saldoHold.js.
export async function saldoHoldsCol() {
  return (await getDb()).collection("saldo_holds");
}

// Program kreator (afiliasi): pengajuan dan komisi per pesanan.
export async function afiliasiPengajuanCol() {
  return (await getDb()).collection("afiliasi_pengajuan");
}
export async function afiliasiKomisiCol() {
  return (await getDb()).collection("afiliasi_komisi");
}

// Bonus target reseller yang sudah dibayar (satu per pemilik, bulan, level).
export async function resellerBonusCol() {
  return (await getDb()).collection("reseller_bonus");
}

// Permintaan "kabari saya kalau stok ada". Lihat lib/stokWatch.js.
export async function stokWatchCol() {
  return (await getDb()).collection("stok_watch");
}

// Langganan notifikasi push web (satu dokumen per perangkat) dan kunci VAPID
// yang dibuat otomatis. Lihat lib/webPush.js.
export async function pushLanggananCol() {
  return (await getDb()).collection("push_langganan");
}
export async function pushKunciCol() {
  return (await getDb()).collection("push_kunci");
}

// Bonus undang teman yang ditahan untuk ditinjau admin (dugaan farming).
// Lihat lib/referralGuard.js.
export async function referralTertahanCol() {
  return (await getDb()).collection("referral_tertahan");
}

// Bot toko tambahan yang didaftarkan admin. Bot pertama tetap dari
// SHOP_BOT_TOKEN di environment — ia tidak perlu ada di sini untuk jalan.
//
// Dokumennya memuat TOKEN BOT, dan token bot adalah kredensial penuh: siapa
// pun yang memegangnya bisa membaca seluruh percakapan pembeli dan mengirim
// pesan atas nama toko. Karena itu tokennya tidak pernah dikirim ke peramban,
// bahkan ke dasbor admin — yang dikirim hanya versi tersamarnya.
export async function botsCol() {
  return (await getDb()).collection("bots");
}

// Pet Arta Pedia — satu elang peliharaan per akun.
export async function petsCol() {
  return (await getDb()).collection("pets");
}

// ── QRIS Gateway ──────────────────────────────────────────────────────────────
// Dompet TERPISAH dari saldo Arta Pedia. Dipisah bukan karena kerapian: saldo
// gateway itu uang orang lain yang dititipkan lewat pembelinya, sedangkan saldo
// Arta Pedia adalah uang yang sudah dibelanjakan di toko ini. Mencampurnya
// berarti satu kesalahan hitung bisa memakai titipan orang untuk membayar nokos.

/** Satu akun gateway per kode akun: saldo, API key, dan statusnya. */
export async function gatewayAccountsCol() {
  return (await getDb()).collection("gateway_accounts");
}

/** Tagihan QRIS yang dibuat merchant. */
export async function gatewayInvoicesCol() {
  return (await getDb()).collection("gateway_invoices");
}

/** Permintaan penarikan saldo gateway ke e-wallet. */
export async function gatewayWithdrawalsCol() {
  return (await getDb()).collection("gateway_withdrawals");
}

/** Mutasi saldo gateway — sumber kebenaran untuk audit. */
export async function gatewayLedgerCol() {
  return (await getDb()).collection("gateway_ledger");
}


// ── Room Chat ala WhatsApp (lib/wa/*) ────────────────────────────────────────
// Profil dipisah dari dokumen users: foto profil dan bio tidak boleh ikut
// terbawa di setiap findOne({token}) yang dilakukan seluruh aplikasi.
export async function waProfilCol() {
  return (await getDb()).collection("wa_profil");
}
export async function waRoomCol() {
  return (await getDb()).collection("wa_room");
}
export async function waPesanCol() {
  return (await getDb()).collection("wa_pesan");
}
export async function waPrefCol() {
  return (await getDb()).collection("wa_pref");
}
export async function waStatusCol() {
  return (await getDb()).collection("wa_status");
}
export async function waCallCol() {
  return (await getDb()).collection("wa_call");
}
// Duel permainan (catur, UNO, remi, mahjong) beserta taruhannya.
export async function gameMatchCol() {
  return (await getDb()).collection("game_match");
}
// Pengajuan tarik POIN GAME ke e-wallet (dibayar manual oleh admin).
export async function tarikPoinCol() {
  return (await getDb()).collection("tarik_poin");
}
// Penanda bukti transfer yang sudah dipakai (hash gambar & nomor referensi). _id unik =
// pencegah ganda yang atomik: dua permintaan bersamaan tidak bisa sama-sama memasang.
export async function buktiTerpakaiCol() {
  return (await getDb()).collection("bukti_terpakai");
}
// Jejak perangkat & IP tiap akun (satu dokumen per pasangan akun+perangkat) untuk mendeteksi akun ganda.
export async function perangkatCol() {
  return (await getDb()).collection("perangkat_akun");
}
// Catatan tindakan anti-curang (ban otomatis, peringatan, pemblokiran) untuk ditinjau admin.
export async function antiCurangCol() {
  return (await getDb()).collection("anti_curang");
}
// Ronde game solo (Plinko, Mahjong Spin 1024) beserta hasil & pembayarannya.
export async function gameSoloCol() {
  return (await getDb()).collection("game_solo");
}
// Berkas media (gambar, catatan suara, foto profil, gambar status). Kunci
// _id string acak = kapabilitas: siapa yang tahu id-nya boleh mengambilnya.
export async function waMediaCol() {
  return (await getDb()).collection("wa_media");
}

// Kejadian keamanan platform (login admin gagal, pemindaian otomatis, penangguhan) — dihapus otomatis setelah 30 hari.
export async function keamananCol() {
  return (await getDb()).collection("security_events");
}
