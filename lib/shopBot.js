// Helper API Telegram untuk BOT TOKO (pembeli), terpisah dari:
//   - lib/telegram.js     : notifikasi satu arah ke channel/grup
//   - lib/telegramBot.js  : bot khusus owner (kontrol saldo & statistik)
//
// Token bot WAJIB disimpan di environment variable SHOP_BOT_TOKEN (server only).
// Jangan pernah ditulis langsung di kode atau dikirim ke browser — siapa pun yang
// memegangnya bisa mengambil alih bot dan membaca seluruh percakapan pembeli.
import { botSessionsCol } from "@/lib/db";

const API = "https://api.telegram.org";

export function shopBotToken() {
  return (process.env.SHOP_BOT_TOKEN || "").trim();
}

export function shopBotConfigured() {
  return shopBotToken().length > 0;
}

// Owner bot — hanya id di daftar ini yang bisa broadcast & lihat statistik.
export function shopBotOwners() {
  return (process.env.SHOP_BOT_OWNER_IDS || process.env.TELEGRAM_OWNER_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isShopBotOwner(id) {
  return shopBotOwners().includes(String(id));
}

export const rupiah = (n) => `Rp${Number(n || 0).toLocaleString("id-ID")}`;

// parse_mode HTML: karakter < & > wajib di-escape supaya pesan tidak ditolak.
export function esc(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function call(method, body) {
  const token = shopBotToken();
  if (!token) {
    console.warn("[shopBot] SHOP_BOT_TOKEN belum diset.");
    return null;
  }
  try {
    const res = await fetch(`${API}/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => null);
    if (!data?.ok) {
      // description dari Telegram aman dicetak; body tidak ikut supaya token
      // tidak pernah bocor lewat log.
      console.error(`[shopBot] ${method} gagal:`, data?.description || res.status);
    }
    return data;
  } catch (err) {
    console.error(`[shopBot] ${method} error:`, err?.message || err);
    return null;
  }
}

export function sendMessage(chatId, text, keyboard) {
  return call("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {})
  });
}

// Mengubah pesan yang sudah ada — dipakai saat user menekan tombol inline,
// supaya chat tidak penuh pesan baru setiap kali pindah menu.
export async function editMessage(chatId, messageId, text, keyboard) {
  const r = await call("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {})
  });
  // Telegram menolak kalau isinya sama persis; itu bukan kegagalan nyata.
  if (!r?.ok && !/message is not modified/i.test(r?.description || "")) {
    return sendMessage(chatId, text, keyboard);
  }
  return r;
}

export function answerCallback(id, text = "", alert = false) {
  return call("answerCallbackQuery", { callback_query_id: id, text, show_alert: alert });
}

export function sendPhoto(chatId, photo, caption, keyboard) {
  return call("sendPhoto", {
    chat_id: chatId,
    photo,
    caption,
    parse_mode: "HTML",
    ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {})
  });
}

// QRIS dari provider kadang berupa data URL base64, yang tidak bisa dikirim
// lewat sendPhoto biasa. Dalam kasus itu diunggah sebagai file.
export async function sendQrPhoto(chatId, imageSrc, caption, keyboard) {
  const token = shopBotToken();
  if (!token) return null;

  if (typeof imageSrc === "string" && imageSrc.startsWith("http")) {
    return sendPhoto(chatId, imageSrc, caption, keyboard);
  }
  const m = typeof imageSrc === "string" && imageSrc.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!m) return sendMessage(chatId, caption, keyboard);

  try {
    const form = new FormData();
    form.append("chat_id", String(chatId));
    form.append("caption", caption);
    form.append("parse_mode", "HTML");
    if (keyboard) form.append("reply_markup", JSON.stringify({ inline_keyboard: keyboard }));
    form.append("photo", new Blob([Buffer.from(m[2], "base64")], { type: m[1] }), "qris.png");
    const res = await fetch(`${API}/bot${token}/sendPhoto`, { method: "POST", body: form });
    const data = await res.json().catch(() => null);
    if (!data?.ok) {
      console.error("[shopBot] kirim QRIS gagal:", data?.description || res.status);
      return sendMessage(chatId, caption, keyboard);
    }
    return data;
  } catch (err) {
    console.error("[shopBot] kirim QRIS error:", err?.message || err);
    return sendMessage(chatId, caption, keyboard);
  }
}

// ─────────────────────── SESI PERCAKAPAN ───────────────────────
//
// Satu dokumen per chat: kode akun yang tertaut + langkah yang sedang berjalan.
// Daftar layanan/negara hasil pencarian ikut disimpan supaya tombol inline cukup
// mengirim nomor urut — data callback Telegram dibatasi 64 byte.

export async function getSession(chatId) {
  const col = await botSessionsCol();
  return (await col.findOne({ chatId: String(chatId) })) || { chatId: String(chatId) };
}

export async function setSession(chatId, patch) {
  const col = await botSessionsCol();
  await col.updateOne(
    { chatId: String(chatId) },
    { $set: { ...patch, chatId: String(chatId), updatedAt: new Date() } },
    { upsert: true }
  );
}

export async function clearStep(chatId) {
  const col = await botSessionsCol();
  await col.updateOne({ chatId: String(chatId) }, { $unset: { step: "" } });
}

// ─────────────────── NOTIFIKASI KE PEMBELI DI BOT ───────────────────
//
// Dipanggil dari alur web (lib/orderReconcile.js & lib/depositService.js) supaya
// user yang datang dari bot tetap dapat kabar walau transaksinya dilakukan di
// web, dan sebaliknya. Kegagalan kirim tidak pernah menggagalkan transaksi.

import { usersCol } from "@/lib/db";

async function chatIdOf(token) {
  try {
    const users = await usersCol();
    const u = await users.findOne({ token }, { projection: { telegramChatId: 1 } });
    return u?.telegramChatId || null;
  } catch {
    return null;
  }
}

export async function notifyBotUser(token, text, keyboard) {
  if (!shopBotConfigured()) return;
  const chatId = await chatIdOf(token);
  if (!chatId) return;
  try {
    await sendMessage(chatId, text, keyboard);
  } catch (err) {
    console.error("[shopBot] notif user gagal:", err?.message || err);
  }
}

export function otpArrivedText({ serviceName, countryName, phoneNumber, otpCode }) {
  return (
    `🎉 <b>KODE OTP MASUK!</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `📱 Aplikasi ╸ <b>${esc(serviceName)}</b>\n` +
    `🌍 Negara   ╸ ${esc(countryName)}\n` +
    `☎️ Nomor    ╸ <code>${esc(phoneNumber)}</code>\n\n` +
    `🔐 <b>KODE OTP</b>\n<code>${esc(otpCode)}</code>\n\n` +
    `<i>Ketuk kode untuk menyalin.</i>`
  );
}

export function depositDoneText({ amount, balance }) {
  return (
    `🎉 <b>DEPOSIT BERHASIL</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `💵 Saldo masuk    ╸ <b>${rupiah(amount)}</b>\n` +
    `💰 Saldo sekarang ╸ <b>${rupiah(balance)}</b>\n\n` +
    `Saldo ini bisa dipakai di bot maupun di website.`
  );
}

export function refundText({ serviceName, price, balance }) {
  return (
    `↩️ <b>SALDO DIKEMBALIKAN</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `📱 ${esc(serviceName)}\n` +
    `💵 Refund ╸ <b>${rupiah(price)}</b>\n` +
    `💰 Saldo  ╸ <b>${rupiah(balance)}</b>\n\n` +
    `OTP tidak masuk sampai masa aktif habis, jadi saldomu kembali otomatis.`
  );
}
