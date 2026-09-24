// Notifikasi khusus QRIS Gateway.
//
// SENGAJA terpisah dari notif toko. Dua alasan.
//
// Pertama, isinya beda jenis: ini uang MILIK MERCHANT yang dititipkan
// pembelinya, bukan pendapatan toko. Mencampurnya di satu aliran membuat
// pemilik web salah membaca omzetnya sendiri.
//
// Kedua, dan lebih penting: notif toko ikut diumumkan ke channel publik.
// Tagihan gateway tidak boleh ikut ke sana — nominal dan nomor tagihan itu
// urusan merchant dengan pembelinya, bukan tontonan. Karena itu berkas ini
// tidak pernah menyentuh lib/notifyHub.js sama sekali, dan tidak bisa
// tidak sengaja bocor lewat sakelar yang salah dinyalakan admin.
import { sendTelegramNotif } from "@/lib/telegram";
import { notifyBotUser } from "@/lib/shopBot";

const rp = (n) => `Rp${Number(n || 0).toLocaleString("id-ID")}`;
const HDR = "━━━━━━━━━━━━━━━━━━━━━━━━";
const TIPIS = "┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄";

const esc = (v) =>
  String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function samarkan(token) {
  const t = String(token || "");
  if (t.length <= 8) return t;
  return `${t.slice(0, 3)}••••${t.slice(-4)}`;
}

function jamWIB() {
  return new Date().toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta", day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  }).replace(/\./g, ":") + " WIB";
}

/** Tagihan baru dibuat — menunggu dibayar. */
export function gwTagihanDibuatNotif({ invoiceId, token, amount, sumber, merchantRef }) {
  return (
    `🧾  <b>QRIS GATEWAY — TAGIHAN DIBUAT</b>\n` +
    `${HDR}\n\n` +
    `<b>${rp(amount)}</b>\n` +
    `<i>Menunggu dibayar pembeli</i>\n\n` +
    `🆔  Tagihan   ╸ <code>${esc(invoiceId)}</code>\n` +
    `👤  Merchant  ╸ <code>${samarkan(token)}</code>\n` +
    `🔌  Lewat     ╸ ${sumber === "api" ? "API merchant" : "Dasbor"}\n` +
    (merchantRef ? `🏷️  Ref       ╸ <code>${esc(merchantRef)}</code>\n` : ``) +
    `\n${TIPIS}\n🕒 ${jamWIB()}`
  );
}

/** Tagihan dibayar — saldo merchant bertambah. */
export function gwTagihanDibayarNotif({ invoiceId, token, amount, biaya, diterima, merchantRef }) {
  return (
    `💰  <b>QRIS GATEWAY — PEMBAYARAN MASUK</b>\n` +
    `${HDR}\n\n` +
    `<b>${rp(diterima)}</b>\n` +
    `<i>Masuk ke saldo gateway merchant</i>\n\n` +
    `💵  Dibayar   ╸ ${rp(amount)}\n` +
    `🧮  Biaya     ╸ ${rp(biaya)}\n` +
    `🆔  Tagihan   ╸ <code>${esc(invoiceId)}</code>\n` +
    `👤  Merchant  ╸ <code>${samarkan(token)}</code>\n` +
    (merchantRef ? `🏷️  Ref       ╸ <code>${esc(merchantRef)}</code>\n` : ``) +
    `\n${TIPIS}\n🕒 ${jamWIB()}`
  );
}

/** Merchant minta tarik ke e-wallet — perlu diproses admin. */
export function gwPenarikanNotif({ wdId, token, amount, biaya, diterima, ewalletNama, nomor, atasNama }) {
  return (
    `🏦  <b>QRIS GATEWAY — PERMINTAAN PENARIKAN</b>\n` +
    `${HDR}\n\n` +
    `<b>${rp(diterima)}</b>\n` +
    `<i>Kirim ke e-wallet di bawah</i>\n\n` +
    `💵  Ditarik   ╸ ${rp(amount)}\n` +
    `🧮  Biaya     ╸ ${rp(biaya)}\n` +
    `📲  Tujuan    ╸ <b>${esc(ewalletNama)}</b>\n` +
    `☎️  Nomor     ╸ <code>${esc(nomor)}</code>\n` +
    `🙍  Atas nama ╸ ${esc(atasNama)}\n` +
    `🆔  Kode      ╸ <code>${esc(wdId)}</code>\n` +
    `👤  Merchant  ╸ <code>${samarkan(token)}</code>\n` +
    `\n${TIPIS}\n🕒 ${jamWIB()}\n` +
    `<i>Proses di panel admin → QRIS Gateway.</i>`
  );
}

// ── Pengirim ──────────────────────────────────────────────────────────
//
// Semuanya fire-and-forget: notif yang gagal terkirim tidak boleh menggagalkan
// pembayaran yang sudah masuk.

export async function kabariAdmin(teks) {
  try {
    await sendTelegramNotif(teks);
  } catch (err) {
    console.error("[gateway/notif] admin:", err?.message || err);
  }
}

/** Kabar ke merchantnya sendiri, di chat botnya — bukan ke channel publik. */
export async function kabariMerchant(token, invoice) {
  try {
    await notifyBotUser(
      token,
      `💰  <b>PEMBAYARAN MASUK</b>\n` +
        `${HDR}\n\n` +
        `<b>${rp(invoice.diterima)}</b>\n` +
        `<i>Masuk ke saldo QRIS Gateway kamu</i>\n\n` +
        `💵  Dibayar ╸ ${rp(invoice.amount)}\n` +
        `🧮  Biaya   ╸ ${rp(invoice.biaya)}\n` +
        `🆔  Tagihan ╸ <code>${esc(invoice.invoiceId)}</code>\n` +
        (invoice.merchantRef ? `🏷️  Ref     ╸ <code>${esc(invoice.merchantRef)}</code>\n` : ``) +
        `\n${TIPIS}\n🕒 ${jamWIB()}`
    );
  } catch (err) {
    console.error("[gateway/notif] merchant:", err?.message || err);
  }
}
