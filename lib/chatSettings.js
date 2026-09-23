// Pengaturan Room Chat, dipakai bersama oleh:
//   - app/api/chat/group-settings  (baca & ubah oleh admin)
//   - app/api/chat/messages        (menolak pesan saat grup ditutup)
//   - app/api/admin/chat           (tombol buka/tutup di dasbor admin)
//
// Sebelumnya nilai bawaannya ditulis ulang di tiap tempat, dan status "closed"
// hanya dipakai untuk mematikan kolom ketik DI BROWSER. Itu bukan penutupan:
// siapa pun yang mengirim permintaan langsung ke /api/chat/messages tetap bisa
// menulis di grup yang katanya sudah ditutup.
import { chatGroupSettingsCol } from "@/lib/db";

export const CHAT_SETTINGS_ID = "config";

export const CHAT_DEFAULTS = {
  name: "Artapedia Community",
  desc: "Komunitas deposit saldo & beli nomor OTP 🚀",
  photo: null,
  closed: false,
  // Pesan yang ditampilkan saat grup ditutup. Kosong = pakai kalimat bawaan.
  closedMsg: "",
  pinnedMsgId: null
};

export async function getChatSettings() {
  try {
    const col = await chatGroupSettingsCol();
    const doc = await col.findOne({ _id: CHAT_SETTINGS_ID });
    return { ...CHAT_DEFAULTS, ...(doc || {}) };
  } catch (err) {
    console.error("[chatSettings]", err?.message || err);
    // Grup dianggap TERBUKA kalau pengaturannya gagal dibaca. Menutup grup
    // karena database sedang bermasalah menghukum semua orang untuk sesuatu
    // yang bukan salah mereka.
    return { ...CHAT_DEFAULTS };
  }
}

export function chatClosedMessage(settings) {
  return (
    String(settings?.closedMsg || "").trim() ||
    "Room Chat sedang ditutup admin. Coba lagi nanti ya."
  );
}
