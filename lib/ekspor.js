// Ekspor CSV untuk admin: deposit, pesanan OTP, penarikan, mutasi saldo. Aman dibuka di Excel/Sheets:
//  • UTF-8 dengan BOM, pemisah koma, tanda kutip ganda di-escape;
//  • sel yang diawali = + - @ (rumus) diberi awalan ' supaya tidak dieksekusi (CSV injection dari nama/catatan buatan pengguna).
import { depositsCol, otpOrdersCol, wdInstanCol, balanceLogsCol } from "@/lib/db";

const BATAS = 50000;

const JENIS = {
  deposit: {
    col: depositsCol, tgl: "createdAt", proj: { qrImage: 0, qrString: 0 },
    kolom: [["orderId", "ID"], ["token", "Kode akun"], ["amount", "Nominal"], ["adminFee", "Fee"], ["totalAmount", "Total bayar"], ["provider", "Penyedia"], ["wallet", "Dompet"], ["status", "Status"], ["credited", "Dikreditkan"], ["createdAt", "Dibuat"], ["paidAt", "Dibayar"]]
  },
  pesanan: {
    col: otpOrdersCol, tgl: "createdAt", proj: { otpMsg: 0 },
    kolom: [["orderId", "ID"], ["token", "Kode akun"], ["server", "Server"], ["serviceName", "Layanan"], ["countryName", "Negara"], ["price", "Harga jual"], ["basePrice", "Harga modal"], ["status", "Status"], ["refunded", "Refund"], ["createdAt", "Dibuat"]],
    turunan: [["Laba kotor", (r) => (r.status === "done" ? Math.max(0, (Number(r.price) || 0) - (Number(r.basePrice) || 0)) : 0)]]
  },
  penarikan: {
    col: wdInstanCol, tgl: "createdAt", proj: {},
    kolom: [["wid", "ID"], ["token", "Kode akun"], ["jenis", "Jenis"], ["wallet", "E-wallet"], ["nominal", "Nominal"], ["fee", "Fee"], ["status", "Status"], ["createdAt", "Dibuat"]]
  },
  mutasi: {
    col: balanceLogsCol, tgl: "createdAt", proj: {},
    kolom: [["token", "Kode akun"], ["type", "Jenis"], ["amount", "Jumlah"], ["balanceAfter", "Saldo sesudah"], ["wallet", "Dompet"], ["title", "Keterangan"], ["ref", "Ref"], ["createdAt", "Waktu"]]
  }
};
export const JENIS_EKSPOR = Object.keys(JENIS);

export function selCsv(v) {
  if (v === null || v === undefined) return "";
  let s = v instanceof Date ? v.toISOString() : typeof v === "object" ? JSON.stringify(v) : String(v);
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** filter: { dari, sampai (YYYY-MM-DD, WIB), penyedia, status }. Mengembalikan { csv, baris, terpotong }. */
export async function buatCsv(jenis, { dari, sampai, penyedia, status } = {}) {
  const j = JENIS[jenis];
  if (!j) throw new Error("Jenis ekspor tidak dikenal.");
  const q = {};
  const d0 = dari && /^\d{4}-\d{2}-\d{2}$/.test(dari) ? new Date(`${dari}T00:00:00+07:00`) : null;
  const d1 = sampai && /^\d{4}-\d{2}-\d{2}$/.test(sampai) ? new Date(`${sampai}T23:59:59.999+07:00`) : null;
  if (d0 || d1) q[j.tgl] = { ...(d0 ? { $gte: d0 } : {}), ...(d1 ? { $lte: d1 } : {}) };
  if (penyedia && /^[a-z0-9_:-]{1,30}$/i.test(penyedia)) q[jenis === "pesanan" ? "server" : "provider"] = penyedia;
  if (status && /^[a-z_-]{1,20}$/i.test(status)) q.status = status;
  const rows = await (await j.col()).find(q, { projection: j.proj }).sort({ [j.tgl]: -1 }).limit(BATAS + 1).toArray();
  const terpotong = rows.length > BATAS;
  const data = terpotong ? rows.slice(0, BATAS) : rows;
  const kol = [...j.kolom.map(([, l]) => l), ...(j.turunan || []).map(([l]) => l)];
  const out = [kol.map(selCsv).join(",")];
  for (const r of data) out.push([...j.kolom.map(([k]) => selCsv(r[k])), ...(j.turunan || []).map(([, f]) => selCsv(f(r)))].join(","));
  return { csv: "﻿" + out.join("\r\n") + "\r\n", baris: data.length, terpotong };
}
