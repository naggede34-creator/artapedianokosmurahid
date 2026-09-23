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

// Telegram hanya menerima A-Z a-z 0-9 _ - untuk secret_token, panjang 1-256.
// Nilai di luar itu membuat setWebhook DITOLAK, dan webhook tidak pernah
// terpasang. Karena itu secret yang tidak sah diperlakukan seperti tidak ada —
// satu-satunya sumber kebenaran, supaya pemasang webhook dan penerima update
// tidak pernah berbeda pendapat soal dipakai atau tidaknya secret.
const SECRET_OK = /^[A-Za-z0-9_-]{1,256}$/;

export function rawWebhookSecret() {
  return (process.env.SHOP_BOT_WEBHOOK_SECRET || "").trim();
}

export function webhookSecretValid() {
  const v = rawWebhookSecret();
  return v.length > 0 && SECRET_OK.test(v);
}

// Secret yang benar-benar dipakai. Kosong = tidak memakai secret sama sekali.
export function webhookSecret() {
  return webhookSecretValid() ? rawWebhookSecret() : "";
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
      // Tanpa batas waktu, satu panggilan yang menggantung bisa menahan seluruh
      // fungsi serverless sampai kehabisan waktu.
      signal: AbortSignal.timeout(20000),
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

// Unduh foto yang dikirim user di chat, jadikan data URL — bentuk yang sama
// dengan bukti bayar yang diunggah lewat web, supaya admin melihat keduanya
// dengan cara yang persis sama.
//
// Dibatasi ukurannya: Telegram membolehkan berkas sampai 20 MB, dan
// menyimpannya apa adanya ke dokumen deposit akan membuat satu dokumen lebih
// besar daripada seluruh riwayat transaksi user itu.
const MAX_UNDUH_BYTE = 700 * 1024;

export async function downloadPhotoAsDataUrl(fileId) {
  const token = shopBotToken();
  if (!token || !fileId) return null;
  try {
    const info = await call("getFile", { file_id: fileId });
    const path = info?.result?.file_path;
    if (!path) return null;

    const res = await fetch(`${API}/file/bot${token}/${path}`, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) return null;

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_UNDUH_BYTE) return { tooBig: true };

    const ext = String(path).split(".").pop()?.toLowerCase();
    const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
    return { dataUrl: `data:${mime};base64,${buf.toString("base64")}` };
  } catch (err) {
    console.error("[shopBot] unduh foto gagal:", err?.message || err);
    return null;
  }
}

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

// Ketiga teks di bawah ini dikirim sebagai pesan BARU ke chat user, bukan
// sebagai jawaban atas ketukan tombol. Karena itu bentuknya dibuat sama persis
// dengan layar yang bersangkutan di dalam bot — kalau berbeda, pesan yang
// muncul tiba-tiba terbaca seperti datang dari tempat lain.
//
// Angka atau kode yang dicari ditaruh paling atas dan berdiri sendiri; sisanya
// masuk panel. Yang perlu disalin — kode OTP, nomor — ditaruh DI LUAR panel:
// di dalam blok monospace, ketukan menyalin seluruh bloknya, bukan satu nilai.

export function otpArrivedText({ serviceName, countryName, phoneNumber, otpCode }) {
  return (
    head("\u{1F389}", "KODE OTP MASUK", `${esc(serviceName || "-")} \u00b7 ${esc(countryName || "-")}`) +
    `\n<code>${esc(otpCode)}</code>\n` +
    `<i>Ketuk kode untuk menyalin.</i>\n\n` +
    `\u260e\ufe0f  <code>${esc(phoneNumber)}</code>\n\n` +
    panel([panelRow("Layanan", serviceName || "-"), panelRow("Negara", countryName || "-")]) +
    `\n` +
    foot("Kode ini hanya berlaku sekali. Jangan dibagikan ke siapa pun.")
  );
}

export function depositDoneText({ amount, balance }) {
  return (
    head("\u{1F389}", "DEPOSIT BERHASIL") +
    `\n\u{1F4B0}  <b>${rupiah(balance)}</b>\n\n` +
    panel([panelRow("Saldo masuk", rupiah(amount)), panelRow("Saldo sekarang", rupiah(balance))]) +
    `\n` +
    foot("Saldo ini bisa dipakai di bot maupun di website. Potongannya satu.")
  );
}

export function refundText({ serviceName, price, balance }) {
  return (
    head("\u21a9\ufe0f", "SALDO DIKEMBALIKAN", esc(serviceName || "-")) +
    `\n\u{1F4B0}  <b>${rupiah(balance)}</b>\n\n` +
    panel([panelRow("Refund", rupiah(price)), panelRow("Saldo sekarang", rupiah(balance))]) +
    `\n` +
    foot("OTP tidak masuk sampai masa aktif habis, jadi saldomu kembali otomatis.")
  );
}

// ───────────────────── TAMPILAN: FOTO, ANIMASI, AKSI ─────────────────────

export function deleteMessage(chatId, messageId) {
  if (!messageId) return null;
  return call("deleteMessage", { chat_id: chatId, message_id: messageId });
}

// "sedang mengetik…" / "sedang mengirim foto…" di header chat. Murah, dan
// membuat jeda saat memanggil provider terasa seperti sesuatu sedang berjalan
// alih-alih bot yang diam.
export function sendChatAction(chatId, action = "typing") {
  return call("sendChatAction", { chat_id: chatId, action });
}

// Kirim gambar dari berkas lokal. Tidak memakai URL sama sekali, jadi tidak
// bergantung pada Site URL yang bisa kosong atau salah isi.
//
// file_id hasil kiriman pertama disimpan di memori proses: selama instance
// serverless-nya masih hidup, kiriman berikutnya cukup menyebut id itu dan
// gambarnya tidak perlu diunggah ulang.
const photoIdCache = new Map();

export async function sendLocalPhoto(chatId, filePath, caption, keyboard) {
  const token = shopBotToken();
  if (!token) return null;

  const cached = photoIdCache.get(filePath);
  if (cached) {
    const r = await sendPhoto(chatId, cached, caption, keyboard);
    if (r?.ok) return r;
    // file_id bisa kedaluwarsa kalau bot-nya diganti token; unggah ulang.
    photoIdCache.delete(filePath);
  }

  let bytes;
  try {
    const { readFile } = await import("node:fs/promises");
    const path = await import("node:path");
    bytes = await readFile(path.join(process.cwd(), filePath));
  } catch (err) {
    console.error("[shopBot] banner tidak terbaca:", err?.message || err);
    return caption ? sendMessage(chatId, caption, keyboard) : null;
  }

  try {
    const form = new FormData();
    form.append("chat_id", String(chatId));
    if (caption) {
      form.append("caption", caption);
      form.append("parse_mode", "HTML");
    }
    if (keyboard) form.append("reply_markup", JSON.stringify({ inline_keyboard: keyboard }));
    form.append("photo", new Blob([bytes], { type: "image/jpeg" }), "welcome.jpg");

    const res = await fetch(`${API}/bot${token}/sendPhoto`, { method: "POST", body: form });
    const data = await res.json().catch(() => null);
    if (!data?.ok) {
      console.error("[shopBot] kirim banner gagal:", data?.description || res.status);
      return caption ? sendMessage(chatId, caption, keyboard) : null;
    }
    const sizes = data.result?.photo || [];
    const best = sizes[sizes.length - 1];
    if (best?.file_id) photoIdCache.set(filePath, best.file_id);
    return data;
  } catch (err) {
    console.error("[shopBot] kirim banner error:", err?.message || err);
    return caption ? sendMessage(chatId, caption, keyboard) : null;
  }
}

// Animasi tunggu: satu pesan yang diubah beberapa kali, bukan pesan baru
// bertubi-tubi. Dipakai saat memanggil provider, yang memang butuh beberapa
// detik — tanpa ini layarnya diam dan user menekan tombolnya berkali-kali.
//
// Bergerak sendiri di latar belakang; pemanggil tidak perlu menunggunya dan
// berhenti sendiri begitu stop() dipanggil, jadi tidak pernah menahan handler.
const BAR_FRAMES = ["▰▱▱▱▱", "▰▰▱▱▱", "▰▰▰▱▱", "▰▰▰▰▱", "▰▰▰▰▰"];

// Edit mentah: tidak jatuh ke sendMessage kalau gagal. Animasi yang gagal harus
// diam saja — bukan mengirim pesan baru untuk tiap frame.
function rawEdit(chatId, messageId, text) {
  return call("editMessageText", { chat_id: chatId, message_id: messageId, text, parse_mode: "HTML" });
}

export async function startLoading(chatId, judul, messageId = null) {
  const frame = (i) => `${judul}\n\n<code>${BAR_FRAMES[i % BAR_FRAMES.length]}</code>`;

  let msgId = messageId;
  if (msgId) {
    await rawEdit(chatId, msgId, frame(0));
  } else {
    const r = await sendMessage(chatId, frame(0));
    msgId = r?.result?.message_id || null;
  }
  if (!msgId) return { messageId: null, stop: async () => {} };

  let berhenti = false;
  // stop() menunggu putaran ini selesai. Tanpa itu, satu edit yang sudah
  // terlanjur terbang bisa mendarat SESUDAH hasil akhirnya ditulis, dan yang
  // dilihat user adalah bar progres menimpa kode OTP-nya.
  const putaran = (async () => {
    for (let i = 1; i < BAR_FRAMES.length; i++) {
      await new Promise((r) => setTimeout(r, 420));
      if (berhenti) return;
      await rawEdit(chatId, msgId, frame(i));
      if (berhenti) return;
    }
  })().catch(() => {});

  return {
    messageId: msgId,
    stop: async () => {
      berhenti = true;
      await putaran;
    }
  };
}

// ───────────────────────── TATA LETAK PESAN ─────────────────────────
//
// Telegram memakai huruf proporsional, jadi kolom yang diratakan dengan spasi
// PASTI bergeser-geser — "Aplikasi     WhatsApp" tidak akan pernah lurus.
// Karena itu tata letaknya memakai ikon sebagai pengganti kata labelnya, dan
// nilainya langsung di sebelahnya. Hasilnya rapi tanpa bergantung pada lebar
// huruf, dan barisnya jadi jauh lebih pendek.
//
// Satu tempat untuk semua layar: kalau tiap layar menyusun garis dan jaraknya
// sendiri-sendiri, lama-lama tidak ada dua layar yang terlihat dari toko yang
// sama.

// Selebar panel (30), supaya garis kepala, panel, dan garis penutup berdiri
// di batas yang sama. Garis yang lebarnya beda-beda membuat satu layar
// terlihat seperti tempelan beberapa layar.
export const RULE = "─".repeat(30);
export const RULE_THIN = "┄".repeat(30);

/** Kepala layar: ikon, judul, dan satu baris keterangan opsional. */
export function head(icon, title, sub = "") {
  return `${icon}  <b>${title}</b>\n` + (sub ? `<i>${sub}</i>\n` : "") + `${RULE}\n`;
}

/** Satu baris data. Ikonnya yang jadi label, jadi tidak ada kolom untuk miring. */
export function row(icon, value) {
  return `${icon}  ${value}\n`;
}


// ───────────────────── PANEL DATA YANG BENAR-BENAR LURUS ─────────────────────
//
// Catatan di atas benar untuk teks biasa: di huruf proporsional, kolom yang
// diratakan dengan spasi pasti bergeser. Tapi ada satu tempat di Telegram yang
// hurufnya PASTI selebar sama: isi <code> dan <pre>. Di dalamnya, spasi bisa
// dipakai meratakan kolom dan hasilnya sama di semua peranti.
//
// Jadi data bertabel — rincian pesanan, rincian bayar, rincian akun — disusun
// sebagai satu blok <code>, bukan baris-baris terpisah. Yang didapat: label di
// kiri, nilai rata di kanan, dan bingkai yang benar-benar menutup di kedua
// sisi. Yang dikorbankan: tidak ada tebal/miring di dalam blok itu, karena
// Telegram tidak menerapkan gaya lain di dalam <code>. Untuk angka yang perlu
// menonjol, taruh di luar panelnya.
//
// Lebar dikunci 30 supaya muat di layar telepon paling sempit tanpa dipotong
// atau dibungkus ke baris berikutnya — teks terbungkus di dalam panel merusak
// seluruh kerapiannya sekaligus.

const LEBAR_PANEL = 30;

// Telegram menampilkan emoji selebar kira-kira dua huruf di dalam blok
// monospace, jadi lebarnya dihitung, bukan sekadar String.length.
function lebarTampil(s) {
  let n = 0;
  for (const ch of String(s)) {
    const cp = ch.codePointAt(0);
    if (cp === 0xfe0f || cp === 0x200d) continue; // penanda gaya & perekat emoji
    n += cp > 0x1f000 || (cp >= 0x2600 && cp <= 0x27bf) ? 2 : 1;
  }
  return n;
}

function potong(s, maks) {
  let hasil = "";
  let n = 0;
  for (const ch of String(s)) {
    const w = lebarTampil(ch);
    if (n + w > maks) return hasil.trimEnd() + "…";
    hasil += ch;
    n += w;
  }
  return hasil;
}

/**
 * Satu baris di dalam panel: label kiri, nilai rata kanan, titik-titik di
 * antaranya supaya mata bisa menelusuri dari label ke nilainya.
 */
export function panelRow(label, value) {
  const kiri = String(label);
  const kanan = String(value);
  const sisa = LEBAR_PANEL - lebarTampil(kiri) - lebarTampil(kanan) - 2;
  if (sisa < 1) {
    // Terlalu panjang untuk satu baris: nilainya dipotong, bukan dibiarkan
    // membungkus. Baris yang membungkus merusak kelurusan seluruh panel.
    const maksKanan = Math.max(4, LEBAR_PANEL - lebarTampil(kiri) - 3);
    return `${kiri}  ${potong(kanan, maksKanan)}`;
  }
  return `${kiri} ${"·".repeat(sisa)} ${kanan}`;
}

/** Garis pemisah di dalam panel. */
export const PANEL_SEP = "─".repeat(LEBAR_PANEL);

/**
 * Bungkus baris-baris jadi satu blok monospace.
 * Baris null/undefined dibuang, jadi baris bersyarat cukup ditulis `x ? … : null`.
 */
export function panel(rows) {
  const isi = rows.filter((r) => r !== null && r !== undefined && r !== false);
  if (!isi.length) return "";
  return `<code>${esc(isi.join("\n"))}</code>\n`;
}

/**
 * Meteran isi, untuk hal yang punya "sampai penuh": level pet, progres,
 * sisa masa aktif. Angka mentah tidak memberi rasa sejauh apa; batangnya iya.
 */
export function bar(nilai, total, panjang = 12) {
  const t = Number(total) > 0 ? Number(total) : 1;
  const isi = Math.max(0, Math.min(panjang, Math.round((Number(nilai) / t) * panjang)));
  return "█".repeat(isi) + "░".repeat(panjang - isi);
}

/** Label status kecil. Dipakai supaya "aktif"/"tutup" terbaca sekali lihat. */
export function badge(text, kind = "netral") {
  const ikon = { ok: "🟢", tunggu: "🟡", mati: "🔴", info: "🔵", netral: "⚪" };
  return `${ikon[kind] || ikon.netral} <b>${esc(text)}</b>`;
}

/**
 * Penutup layar: satu baris keterangan yang tidak perlu ditekan.
 * Dipisah dari isi supaya tiap layar punya akhir yang sama bentuknya.
 */
export function foot(text) {
  return `${RULE_THIN}\n<i>${text}</i>`;
}
