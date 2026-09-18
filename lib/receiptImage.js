// Generate PNG receipt images for Telegram notifications.
// Uses satori (JSX → SVG) + @resvg/resvg-js (SVG → PNG).
// Fonts are loaded from node_modules/@fontsource/inter (latin subset woff).
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { readFileSync } from "fs";
import { join } from "path";

let fontRegular = null;
let fontBold = null;

function loadFonts() {
  if (fontRegular && fontBold) return;
  const base = join(process.cwd(), "node_modules", "@fontsource", "inter", "files");
  fontRegular = readFileSync(join(base, "inter-latin-400-normal.woff"));
  fontBold = readFileSync(join(base, "inter-latin-700-normal.woff"));
}

function fmtRp(n) {
  return `Rp${Number(n || 0).toLocaleString("id-ID")}`;
}

function maskToken(t = "") {
  if (!t) return "-";
  if (t.length <= 8) return t;
  return `${t.slice(0, 4)}••••${t.slice(-4)}`;
}

function nowWIB() {
  return (
    new Date().toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }) + " WIB"
  );
}

function fmtWIB(d) {
  if (!d) return "-";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "-";
  return (
    date.toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }) + " WIB"
  );
}

const PROVIDER_LABEL = {
  simuru: "QRIS Simuru",
  pakasir: "QRIS Pakasir",
  rumahotp: "QRIS RumahOTP",
};
function provLabel(p) {
  return PROVIDER_LABEL[p] || p || "-";
}

// Build the satori element tree for one receipt
function buildReceipt({ icon, title, headerBg, headerColor, rows, statusText, statusColor }) {
  const ROW_H = 44;
  const totalHeight = 120 + rows.length * ROW_H + 52;

  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        width: "400px",
        height: `${totalHeight}px`,
        backgroundColor: "#ffffff",
        fontFamily: "Inter",
      },
      children: [
        // ── Header ──────────────────────────────────────────────────────
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "18px 20px 16px",
              backgroundColor: headerBg,
              gap: "4px",
            },
            children: [
              { type: "div", props: { style: { fontSize: "26px", lineHeight: "1" }, children: icon } },
              { type: "div", props: { style: { fontSize: "15px", fontWeight: "700", color: headerColor, marginTop: "6px", letterSpacing: "0.5px" }, children: title } },
              { type: "div", props: { style: { fontSize: "10px", color: headerColor, opacity: 0.65, letterSpacing: "2px" }, children: "ARTAPEDIA OTP" } },
            ],
          },
        },
        // ── Rows ─────────────────────────────────────────────────────────
        {
          type: "div",
          props: {
            style: { display: "flex", flexDirection: "column", flex: "1" },
            children: rows.map((row, i) => ({
              type: "div",
              props: {
                key: String(i),
                style: {
                  display: "flex",
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0 20px",
                  height: `${ROW_H}px`,
                  borderBottom: "1px solid #f3f4f6",
                  backgroundColor: i % 2 === 0 ? "#ffffff" : "#fafafa",
                },
                children: [
                  { type: "div", props: { style: { fontSize: "12px", color: "#9ca3af", flex: "0 0 auto" }, children: row.label } },
                  { type: "div", props: { style: { fontSize: "13px", fontWeight: "700", color: row.color || "#1f2937", maxWidth: "230px", textAlign: "right", overflow: "hidden" }, children: String(row.value ?? "-") } },
                ],
              },
            })),
          },
        },
        // ── Footer ───────────────────────────────────────────────────────
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "0 20px",
              height: "52px",
              backgroundColor: "#f9fafb",
              borderTop: "2px dashed #e5e7eb",
            },
            children: [
              { type: "div", props: { style: { fontSize: "10px", color: "#9ca3af" }, children: "artapedianokosmurahid.vercel.app" } },
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    fontSize: "11px",
                    fontWeight: "700",
                    color: statusColor || "#10b981",
                    backgroundColor: (statusColor || "#10b981") + "22",
                    padding: "4px 10px",
                    borderRadius: "6px",
                  },
                  children: statusText,
                },
              },
            ],
          },
        },
      ],
    },
  };
}

export async function generateReceiptPng(params) {
  loadFonts();
  const element = buildReceipt(params);
  const ROW_H = 44;
  const height = 120 + params.rows.length * ROW_H + 52;

  const svg = await satori(element, {
    width: 400,
    height,
    fonts: [
      { name: "Inter", data: fontRegular, weight: 400, style: "normal" },
      { name: "Inter", data: fontBold, weight: 700, style: "normal" },
    ],
  });

  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: 400 } });
  const rendered = resvg.render();
  return rendered.asPng();
}

// ── Receipt factory functions ──────────────────────────────────────────────

export function depositPendingParams({ orderId, token, name, provider, amount, fee, total, expiredAt }) {
  return {
    icon: "⏳",
    title: "DEPOSIT MENUNGGU PEMBAYARAN",
    headerBg: "#fef9c3",
    headerColor: "#854d0e",
    rows: [
      { label: "ID Deposit", value: orderId },
      { label: "Akun", value: maskToken(token) + (name ? ` (${name})` : "") },
      { label: "Metode", value: provLabel(provider) },
      { label: "Nominal", value: fmtRp(amount) },
      ...(fee ? [{ label: "Biaya Admin", value: fmtRp(fee) }] : []),
      ...(total && Number(total) !== Number(amount) ? [{ label: "Total Bayar", value: fmtRp(total), color: "#dc2626" }] : []),
      { label: "Berlaku s/d", value: fmtWIB(expiredAt) },
      { label: "Waktu", value: nowWIB() },
    ],
    statusText: "PENDING",
    statusColor: "#d97706",
  };
}

export function depositSuccessParams({ orderId, token, name, provider, amount, fee, cashback, balance, depositCount }) {
  return {
    icon: "✅",
    title: "DEPOSIT BERHASIL",
    headerBg: "#dcfce7",
    headerColor: "#14532d",
    rows: [
      { label: "ID Deposit", value: orderId },
      { label: "Akun", value: maskToken(token) + (name ? ` (${name})` : "") },
      { label: "Metode", value: provLabel(provider) },
      { label: "Nominal Masuk", value: fmtRp(amount), color: "#16a34a" },
      ...(fee ? [{ label: "Biaya Admin", value: fmtRp(fee) }] : []),
      ...(cashback > 0 ? [{ label: "Cashback", value: `+${fmtRp(cashback)}`, color: "#16a34a" }] : []),
      { label: "Saldo Sekarang", value: fmtRp(balance), color: "#1d4ed8" },
      ...(depositCount ? [{ label: "Deposit ke-", value: `#${depositCount}` }] : []),
      { label: "Waktu", value: nowWIB() },
    ],
    statusText: "SUKSES",
    statusColor: "#16a34a",
  };
}

export function otpPurchaseParams({ orderId, token, name, serviceName, countryName, phoneNumber, price, balance, operator }) {
  return {
    icon: "📱",
    title: "NOMOR OTP TERJUAL",
    headerBg: "#dbeafe",
    headerColor: "#1e3a8a",
    rows: [
      { label: "Order ID", value: orderId },
      { label: "Akun", value: maskToken(token) + (name ? ` (${name})` : "") },
      { label: "Layanan", value: serviceName || "-" },
      { label: "Negara", value: countryName || "-" },
      ...(operator ? [{ label: "Operator", value: operator }] : []),
      { label: "Nomor", value: phoneNumber || "-" },
      { label: "Harga", value: fmtRp(price), color: "#dc2626" },
      ...(balance !== undefined ? [{ label: "Sisa Saldo", value: fmtRp(balance), color: "#1d4ed8" }] : []),
      { label: "Waktu", value: nowWIB() },
    ],
    statusText: "DIPROSES",
    statusColor: "#2563eb",
  };
}

export function otpReceivedParams({ orderId, token, serviceName, countryName, phoneNumber, otpCode, waited }) {
  return {
    icon: "🔓",
    title: "KODE OTP DITERIMA",
    headerBg: "#ede9fe",
    headerColor: "#3b0764",
    rows: [
      { label: "Order ID", value: orderId },
      { label: "Akun", value: maskToken(token) },
      { label: "Layanan", value: serviceName || "-" },
      { label: "Negara", value: countryName || "-" },
      { label: "Nomor", value: phoneNumber || "-" },
      { label: "Kode OTP", value: otpCode || "-", color: "#7c3aed" },
      ...(waited ? [{ label: "Masuk Setelah", value: waited }] : []),
      { label: "Waktu", value: nowWIB() },
    ],
    statusText: "DITERIMA",
    statusColor: "#7c3aed",
  };
}

export function transferParams({ ref, fromToken, fromName, toToken, toName, amount, fromBalance }) {
  return {
    icon: "🔁",
    title: "TRANSFER SALDO",
    headerBg: "#fff7ed",
    headerColor: "#7c2d12",
    rows: [
      { label: "ID Transfer", value: ref || "-" },
      { label: "Dari Akun", value: maskToken(fromToken) + (fromName ? ` (${fromName})` : "") },
      { label: "Ke Akun", value: maskToken(toToken) + (toName ? ` (${toName})` : "") },
      { label: "Nominal", value: fmtRp(amount), color: "#dc2626" },
      ...(fromBalance !== undefined ? [{ label: "Sisa Saldo", value: fmtRp(fromBalance), color: "#1d4ed8" }] : []),
      { label: "Waktu", value: nowWIB() },
    ],
    statusText: "BERHASIL",
    statusColor: "#ea580c",
  };
}
