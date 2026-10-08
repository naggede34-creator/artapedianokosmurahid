// Daftar & login di website.
//
// Dua mode, dipilih admin lewat WEB_LOGIN_WAJIB (Konfigurasi → Website):
//   MATI  : seperti dulu — pengunjung baru otomatis dibuatkan akun tanpa daftar.
//   NYALA : pengunjung harus DAFTAR (cukup nama; kode akun dibuat sistem) atau
//           MASUK dengan kode akun. Tidak ada akun yang dibuat diam-diam.
//
// Kode akun tetap satu-satunya kredensial (tanpa email/password), sama dengan
// bot Telegram, jadi satu kode masuk di web maupun di bot.
import { usersCol } from "@/lib/db";
import { cfg } from "@/lib/config";
import { generateUserToken } from "@/lib/token";
import { sidikJari } from "@/lib/referralGuard";
import { newUserNotif } from "@/lib/telegram";
import { umumkan } from "@/lib/notifyHub";
import { sendMonitorLog, userLoginLog } from "@/lib/monitor";

export const NAMA_MIN = 2;
export const NAMA_MAKS = 24; // sama dengan batas di /api/user/name

export async function loginWajib() {
  return String((await cfg("WEB_LOGIN_WAJIB")) || "").trim() === "1";
}

/**
 * Nama yang sah: 2–24 karakter, huruf/angka/spasi dan tanda baca sederhana.
 * Karakter kontrol dibuang dan spasi ganda dirapikan; tautan ditolak karena
 * nama tampil di leaderboard, chat, dan notifikasi.
 * @returns {{ok:true, nama:string} | {ok:false, alasan:string}}
 */
export function periksaNama(mentah) {
  const nama = String(mentah ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (nama.length < NAMA_MIN) return { ok: false, alasan: `Nama minimal ${NAMA_MIN} karakter.` };
  if (nama.length > NAMA_MAKS) return { ok: false, alasan: `Nama maksimal ${NAMA_MAKS} karakter.` };
  if (/https?:\/\/|www\.|@|<|>|\.(com|net|org|id|io|me|xyz)\b/i.test(nama)) {
    return { ok: false, alasan: "Nama tidak boleh berisi tautan atau tanda < > @." };
  }
  if (!/^[\p{L}\p{N} .,'_\-]+$/u.test(nama)) {
    return { ok: false, alasan: "Nama hanya boleh huruf, angka, spasi, dan . , ' _ -" };
  }
  return { ok: true, nama };
}

/**
 * Membuat akun baru (dipakai pendaftaran manual dan pembuatan otomatis saat
 * login tidak diwajibkan). Tanpa pengecekan rate limit — itu urusan rute.
 * @returns {{token, name, createdAt}}
 */
export async function buatAkunBaru({ req, nama = null, ref = null, sumber = "Website", rwSlug = null }) {
  const users = await usersCol();

  let token;
  for (let i = 0; i < 5; i++) {
    const kandidat = generateUserToken();
    if (!(await users.findOne({ token: kandidat }, { projection: { _id: 1 } }))) {
      token = kandidat;
      break;
    }
  }
  if (!token) throw new Error("Gagal membuat kode akun, coba lagi.");

  // Undangan teman (?ref=KODE): bonusnya cair saat teman ini deposit pertama.
  let referredBy = null;
  const kandidatRef = typeof ref === "string" ? ref.trim() : "";
  if (kandidatRef && kandidatRef !== token) {
    const pengundang = await users.findOne({ token: kandidatRef }, { projection: { token: 1 } });
    if (pengundang) referredBy = pengundang.token;
  }

  const createdAt = new Date();
  await users.insertOne({
    token,
    // Akun web reseller TERPISAH dari web utama (dan dari web reseller lain): hanya bisa masuk di webnya sendiri.
    ...(rwSlug ? { rwSlug } : {}),
    ...(nama ? { name: nama } : {}),
    balance: 0,
    referredBy,
    referralCount: 0,
    referralEarnings: 0,
    referralBonusGiven: false,
    // Hash IP + User-Agent saat daftar, untuk penjaga anti-farming referral.
    ...sidikJari(req),
    points: 0,
    totalSpent: 0,
    cashbackTotal: 0,
    createdAt
  });

  const userCount = await users.countDocuments();
  const pengundangDoc = referredBy ? await users.findOne({ token: referredBy }, { projection: { name: 1 } }) : null;
  // Teks yang sama untuk admin dan channel: kode akun ditulis sebagai penanda,
  // utuh di chat admin dan otomatis tersamar di channel.
  const notif = newUserNotif({ token, referredBy, userCount, sumber, name: nama, referrerName: pengundangDoc?.name || null });
  umumkan({ jenis: "user_baru", admin: notif, publik: notif });
  sendMonitorLog(userLoginLog({ token, isNew: true }));

  return { token, name: nama, createdAt };
}
