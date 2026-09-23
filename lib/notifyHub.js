// Satu pintu untuk semua notifikasi.
//
// Kenapa ada: sebelumnya tiap tempat memanggil sendTelegramNotif sendiri-
// sendiri, dan yang sampai ke channel cuma dua jenis — deposit sukses dan kode
// OTP masuk. Sisanya berhenti di chat admin. Menambahkannya satu per satu di
// tiap tempat berarti jenis berikutnya yang ditambahkan orang lain akan
// terlewat lagi, karena tidak ada satu tempat pun yang bisa dibaca untuk tahu
// "apa saja yang diumumkan".
//
// Daftar jenisnya ada di lib/channelNotifTypes.js — dipisah supaya panel admin
// bisa menampilkannya tanpa menarik koneksi database ke dalam bundel peramban.
import { sendTelegramNotif, sendTelegramChannelNotif } from "@/lib/telegram";
import { getSettings } from "@/lib/settings";
import { DAFTAR_PUBLIK, channelDefaults, channelAktifUntuk } from "@/lib/channelNotifTypes";

export { DAFTAR_PUBLIK, channelDefaults, channelAktifUntuk };

/**
 * Kirim satu kejadian.
 *
 * @param jenis  kunci di DAFTAR_PUBLIK. Kosong / tidak terdaftar = admin saja.
 * @param admin  teks lengkap untuk chat admin — selalu dikirim
 * @param publik teks versi publik untuk channel — hanya dikirim kalau jenisnya
 *               terdaftar DAN dinyalakan admin
 * @param pin    paksa pin; kalau tidak diisi, ikut bawaan jenisnya
 *
 * Tidak pernah melempar: kegagalan mengirim notif tidak boleh menggagalkan
 * transaksi yang baru saja berhasil. Kegagalan kirim ke admin juga tidak boleh
 * membatalkan kiriman ke channel, dan sebaliknya — makanya keduanya dibungkus
 * try sendiri-sendiri.
 */
export async function umumkan({ jenis, admin, publik, pin }) {
  try {
    if (admin) sendTelegramNotif(admin);
  } catch (err) {
    console.error("[notif] gagal kirim ke admin:", err?.message || err);
  }

  if (!publik || !jenis || !DAFTAR_PUBLIK[jenis]) return;

  try {
    const settings = await getSettings();
    if (!channelAktifUntuk(settings, jenis)) return;
    const pinned = pin === undefined ? DAFTAR_PUBLIK[jenis].pin : Boolean(pin);
    await sendTelegramChannelNotif(publik, { pin: pinned });
  } catch (err) {
    console.error(`[notif] gagal kirim ke channel (${jenis}):`, err?.message || err);
  }
}
