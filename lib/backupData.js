// Pembuat kedua berkas backup, dipakai BERSAMA oleh tombol di dasbor admin
// dan oleh backup otomatis lewat bot.
//
// Dipakai bersama bukan demi kerapian: kalau keduanya punya kode sendiri,
// suatu saat yang satu ikut menyertakan kolom yang di satu lagi sengaja
// dibuang — dan yang dibuang di sini adalah NOMOR TELEPON dan KODE OTP orang.
// Perbedaan seperti itu tidak menimbulkan error, jadi tidak ada yang tahu
// sampai berkasnya terlanjur tersebar.
import {
  usersCol,
  depositsCol,
  otpOrdersCol,
  balanceLogsCol,
  adminBalanceLogsCol,
  settingsCol,
  vouchersCol,
  userNotificationsCol,
  otpFavoritesCol,
  userTelegramCol,
  productOrdersCol,
  jobSubmissionsCol,
  warrantyClaimsCol,
  ticketsCol,
  botSessionsCol,
  kagetCol,
  kagetKlaimCol
} from "@/lib/db";

/** Batas baris per koleksi untuk backup penuh. */
export const BATAS_BACKUP = 50000;

/** Batas baris bawaan untuk ekspor database akun. */
export const BATAS_AKUN = 200000;

/**
 * Satu baris database akun.
 *
 * Kolomnya PERSIS: token, nama, saldo. Riwayat pembelian sengaja tidak ada —
 * di sana ada nomor telepon dan kode OTP orang, dan yang tidak ada di dalam
 * berkas tidak bisa bocor dari berkas itu.
 */
export function barisAkun(u) {
  return { token: u.token, nama: u.name || "", saldo: u.balance || 0 };
}

/** Bidang user yang dibaca untuk database akun. Sengaja sesempit mungkin. */
export const PROYEKSI_AKUN = { _id: 0, token: 1, name: 1, balance: 1 };

export const KETERANGAN_AKUN = {
  isi: "token, nama, saldo",
  tidakDisertakan: "riwayat pembelian, deposit, mutasi, nomor telepon, kode OTP",
  peringatan:
    "token adalah kredensial akun. Siapa pun yang memegang berkas ini bisa membuka akun mana pun di dalamnya."
};

/**
 * Database akun sebagai satu teks JSON.
 *
 * Berbeda dengan rute ekspor admin yang MENGALIRKANNYA: di sini berkasnya
 * memang harus utuh untuk diunggah ke Telegram. Karena itu batasnya lebih
 * kecil, dan kalau kena batas itu ditulis di dalam berkasnya sendiri.
 */
export async function bangunDatabaseAkun({ batas = BATAS_AKUN } = {}) {
  const users = await usersCol();
  const total = await users.countDocuments({});

  const rows = await users.find({}).project(PROYEKSI_AKUN).limit(batas).toArray();
  const daftar = rows.map((u) => barisAkun(u));

  const isi = {
    exportedAt: new Date().toISOString(),
    batasBaris: batas,
    totalDiDatabase: total,
    terpotong: total > batas,
    ...KETERANGAN_AKUN,
    users: daftar,
    jumlah: daftar.length
  };
  return { teks: JSON.stringify(isi, null, 2), jumlah: daftar.length, total, terpotong: total > batas };
}

const KOLEKSI_PENUH = [
  ["users", usersCol],
  ["deposits", depositsCol],
  ["otp_orders", otpOrdersCol],
  ["balance_logs", balanceLogsCol],
  ["admin_balance_logs", adminBalanceLogsCol],
  ["settings", settingsCol],
  ["vouchers", vouchersCol],
  ["user_notifications", userNotificationsCol],
  ["otp_favorites", otpFavoritesCol],
  ["user_telegram", userTelegramCol],
  ["product_orders", productOrdersCol],
  ["job_submissions", jobSubmissionsCol],
  ["warranty_claims", warrantyClaimsCol],
  ["tickets", ticketsCol],
  ["bot_sessions", botSessionsCol],
  ["kaget", kagetCol],
  ["kaget_klaim", kagetKlaimCol]
];

/**
 * Backup penuh: semua koleksi.
 *
 * Tiap koleksi dibatasi, dan kalau kena batas itu NAMANYA DITULIS di dalam
 * berkasnya. Backup yang diam-diam terpotong lebih berbahaya daripada backup
 * yang gagal: yang gagal ketahuan sekarang, yang terpotong baru ketahuan saat
 * datanya dicari dan ternyata tidak ada.
 */
export async function bangunBackupPenuh({ batas = BATAS_BACKUP } = {}) {
  const data = {};
  const ringkasan = {};
  const terpotong = [];
  let users = [];

  for (const [nama, ambil] of KOLEKSI_PENUH) {
    try {
      const col = await ambil();
      const total = await col.countDocuments({});
      const rows = await col.find({}).limit(batas).toArray();
      const bersih = rows.map(({ _id, ...sisa }) => ({ _id: _id?.toString(), ...sisa }));
      if (nama === "users") users = bersih;
      else data[nama] = bersih;
      ringkasan[nama] = { disimpan: rows.length, totalDiDatabase: total };
      if (total > rows.length) terpotong.push(nama);
    } catch (e) {
      // Satu koleksi yang gagal dibaca tidak boleh menggagalkan seluruh
      // backup — sisanya tetap jauh lebih berharga daripada tidak ada.
      console.error(`[backup] koleksi ${nama} gagal:`, e?.message || e);
      if (nama !== "users") data[nama] = [];
      ringkasan[nama] = { disimpan: 0, totalDiDatabase: null, gagal: String(e?.message || e) };
    }
  }

  const isi = {
    version: 2,
    exportedAt: new Date().toISOString(),
    batasPerKoleksi: batas,
    koleksiTerpotong: terpotong,
    ringkasan,
    // users SENGAJA di tingkat atas, bukan di dalam `data`: /api/admin/import
    // membacanya dari sana, jadi berkas ini tetap bisa di-restore alat yang
    // sudah ada. Dan karena tidak disalin dua kali, koleksi terbesar tidak
    // menggandakan ukuran berkasnya.
    count: users.length,
    users,
    data
  };

  return {
    teks: JSON.stringify(isi, null, 2),
    jumlahUser: users.length,
    ringkasan,
    terpotong
  };
}
