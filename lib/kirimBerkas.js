// Mengirim berkas ke chat Telegram.
//
// Dipakai backup otomatis. Dipisah dari lib/shopBot.js karena backup berjalan
// dari cron, di luar webhook bot mana pun — tidak ada "bot aktif" di konteks,
// jadi botnya ditentukan di sini secara eksplisit.
import { gzipSync } from "node:zlib";
import { cfg } from "@/lib/config";

// Telegram menolak dokumen di atas 50 MB lewat Bot API. Batas di sini lebih
// rendah supaya kegagalannya terjadi DI SINI, dengan pesan yang menjelaskan
// apa yang harus dilakukan, bukan sebagai penolakan Telegram yang tidak
// menyebut ukurannya.
export const BATAS_UNGGAH = 45 * 1024 * 1024;

/**
 * Token bot yang dipakai mengirim backup.
 *
 * Bot OWNER lebih dulu: ia memang bot untuk pemilik, dan chat-nya tidak pernah
 * dipakai pembeli. Bot toko jadi cadangan supaya backup tetap terkirim di
 * pemasangan yang cuma punya satu bot.
 */
export async function tokenPengirim(settings) {
  const owner = ((await cfg("TELEGRAM_BOT_TOKEN")) || "").trim();
  if (owner) return { token: owner, asal: "bot owner" };
  const toko = ((await cfg("SHOP_BOT_TOKEN")) || "").trim();
  if (toko) return { token: toko, asal: "bot toko" };
  return { token: "", asal: "" };
}

/**
 * Daftar chat tujuan backup.
 *
 * HANYA id dari environment, dan HANYA chat pribadi pemilik. Backup memuat
 * kode akun SEMUA pengguna — kode akun itu kredensial di situs ini — jadi satu
 * id grup atau channel yang keliru masuk daftar berarti membagikan seluruh
 * akun toko ke setiap anggotanya. Id negatif (grup/channel di Telegram selalu
 * negatif) karena itu ditolak, bukan sekadar tidak dianjurkan.
 */
export async function tujuanBackup() {
  const mentah = ((await cfg("TELEGRAM_OWNER_IDS")) || (await cfg("SHOP_BOT_OWNER_IDS")) || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const sah = [];
  const ditolak = [];
  for (const id of mentah) {
    if (/^-/.test(id)) ditolak.push(id);
    else if (/^\d+$/.test(id)) sah.push(id);
    else ditolak.push(id);
  }
  return { sah, ditolak };
}

/** Memampatkan teks jadi .gz. JSON menyusut banyak sekali, dan itu yang membuatnya muat. */
export function mampatkan(teks, namaBerkas) {
  const mentah = Buffer.from(teks, "utf8");
  const gz = gzipSync(mentah, { level: 9 });
  return {
    buffer: gz,
    nama: `${namaBerkas}.gz`,
    ukuranAsli: mentah.length,
    ukuranGz: gz.length
  };
}

export function ukuranTerbaca(byte) {
  const n = Number(byte) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(2)} MB`;
}

/** Mengirim satu dokumen. Selalu mengembalikan objek, tidak pernah melempar. */
export async function kirimDokumen({ token, chatId, buffer, namaBerkas, caption }) {
  if (!token) return { ok: false, alasan: "Token bot belum ada." };
  if (!chatId) return { ok: false, alasan: "Chat tujuan kosong." };
  if (!buffer?.length) return { ok: false, alasan: "Berkasnya kosong." };
  if (buffer.length > BATAS_UNGGAH) {
    return {
      ok: false,
      alasan: `Berkasnya ${ukuranTerbaca(buffer.length)}, di atas batas unggah Telegram (50 MB). Turunkan batas baris backup di dasbor admin, atau unduh manual dari tab Tools.`
    };
  }

  try {
    const form = new FormData();
    form.append("chat_id", String(chatId));
    form.append("document", new Blob([buffer], { type: "application/gzip" }), namaBerkas);
    if (caption) {
      form.append("caption", caption.slice(0, 1024));
      form.append("parse_mode", "HTML");
    }
    const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: "POST",
      body: form,
      // Unggahan besar butuh waktu lebih lama daripada panggilan API biasa,
      // tapi tetap harus ada batasnya: satu unggahan yang menggantung bisa
      // menahan seluruh fungsi cron sampai kehabisan waktu.
      signal: AbortSignal.timeout(110000)
    });
    const data = await res.json().catch(() => null);
    if (!data?.ok) {
      // description dari Telegram aman dicetak; body TIDAK ikut, karena di
      // sana ada tokennya dan isi backupnya.
      return { ok: false, alasan: data?.description || `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    const sebab = err?.name === "TimeoutError" ? "waktu unggah habis" : err?.message || "jaringan gagal";
    return { ok: false, alasan: String(sebab).slice(0, 200) };
  }
}

/** Pesan biasa ke chat pemilik, untuk laporan gagal. */
export async function kirimPesan(token, chatId, teks) {
  if (!token || !chatId) return { ok: false };
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({ chat_id: String(chatId), text: teks.slice(0, 4000), parse_mode: "HTML" })
    });
    return (await res.json().catch(() => null)) || { ok: false };
  } catch {
    return { ok: false };
  }
}
