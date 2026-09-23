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
