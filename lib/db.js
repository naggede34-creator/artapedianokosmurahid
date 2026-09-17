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

// Pesanan Suntik Sosmed (SMM via Simuru).
export async function smmOrdersCol() {
  return (await getDb()).collection("smm_orders");
}

// Cache layanan SMM yang pernah ditampilkan ke user — dipakai server untuk
// memverifikasi harga saat order, supaya harga tidak bisa dimanipulasi dari browser.
export async function smmServicesCol() {
  return (await getDb()).collection("smm_services");
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
