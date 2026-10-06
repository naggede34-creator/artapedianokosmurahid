// Koreksi saldo MASSAL lewat CSV: "kode_akun,jumlah,alasan[,dompet]" (jumlah negatif = kurangi; dompet "game" = saldo game, selain itu nokos).
// Dua langkah: PRATINJAU (tidak mengubah apa pun, mengembalikan kunci) → TERAPKAN (wajib kunci yang sama + alasan umum).
// Kunci = hash isi baris; satu kunci hanya bisa diterapkan SEKALI (indeks unik) sehingga klik ganda / kirim ulang tidak menggandakan.
import { createHash } from "node:crypto";
import { usersCol, adminBalanceLogsCol, koreksiBatchCol } from "@/lib/db";
import { logBalance } from "@/lib/ledger";
import { rapatkanDeposit } from "@/lib/saldoDeposit";

export const MAKS_BARIS = 500;
const MAKS_NOMINAL = 50_000_000;

export function uraiCsv(teks) {
  const baris = String(teks || "").replace(/^﻿/, "").split(/\r?\n/).map((b) => b.trim()).filter(Boolean);
  const out = [];
  for (const [i, b] of baris.entries()) {
    const c = b.split(/[,;\t]/).map((x) => x.trim().replace(/^"|"$/g, ""));
    const jumlah = Number(String(c[1] ?? "").replace(/[.\s]/g, "").replace(",", "."));
    if (i === 0 && !Number.isFinite(jumlah)) continue; // baris judul
    out.push({ no: out.length + 1, token: String(c[0] || "").toUpperCase(), jumlah, alasan: String(c[2] || "").slice(0, 100), dompet: /game/i.test(c[3] || "") ? "game" : "nokos" });
  }
  return out;
}

/** Memeriksa baris terhadap data sekarang. Tidak mengubah apa pun. */
export async function pratinjauKoreksi(teks) {
  const rows = uraiCsv(teks);
  if (!rows.length) return { ok: false, alasan: "Tidak ada baris data. Format: kode_akun,jumlah,alasan" };
  if (rows.length > MAKS_BARIS) return { ok: false, alasan: `Maksimal ${MAKS_BARIS} baris per batch.` };
  const users = await usersCol();
  const tokens = [...new Set(rows.map((r) => r.token).filter(Boolean))];
  const ada = new Map((await users.find({ token: { $in: tokens } }, { projection: { token: 1, name: 1, balance: 1, saldoGame: 1 } }).toArray()).map((u) => [u.token, u]));
  const sisa = new Map(); // simulasi saldo berjalan bila satu akun muncul berkali-kali
  const hasil = rows.map((r) => {
    const u = ada.get(r.token);
    const e = [];
    if (!u) e.push("akun tidak ditemukan");
    if (!Number.isInteger(r.jumlah) || r.jumlah === 0) e.push("jumlah harus bilangan bulat ≠ 0");
    else if (Math.abs(r.jumlah) > MAKS_NOMINAL) e.push("nominal terlalu besar");
    if (r.jumlah < 0 && r.alasan.length < 3) e.push("alasan wajib untuk pengurangan");
    let sebelum = null, sesudah = null;
    if (u && !e.length) {
      const k = `${r.token}|${r.dompet}`;
      sebelum = sisa.has(k) ? sisa.get(k) : (r.dompet === "game" ? u.saldoGame : u.balance) || 0;
      sesudah = sebelum + r.jumlah;
      if (sesudah < 0) e.push(`saldo tidak cukup (${sebelum})`);
      else sisa.set(k, sesudah);
    }
    return { ...r, nama: u?.name || null, sebelum, sesudah, valid: e.length === 0, galat: e.join("; ") };
  });
  const valid = hasil.filter((h) => h.valid);
  const kunci = createHash("sha256").update(JSON.stringify(valid.map((h) => [h.token, h.jumlah, h.dompet, h.alasan]))).digest("hex").slice(0, 32);
  return { ok: true, baris: hasil, ringkas: { total: hasil.length, valid: valid.length, salah: hasil.length - valid.length, tambah: valid.filter((h) => h.jumlah > 0).reduce((a, h) => a + h.jumlah, 0), kurang: valid.filter((h) => h.jumlah < 0).reduce((a, h) => a + -h.jumlah, 0) }, kunci };
}

/** Menerapkan baris yang valid (baris salah dilewati). Atomik per baris; satu kunci hanya sekali. */
export async function terapkanKoreksi(teks, { kunci, alasanUmum }) {
  const p = await pratinjauKoreksi(teks);
  if (!p.ok) return p;
  if (!kunci || kunci !== p.kunci) return { ok: false, alasan: "Kunci pratinjau tidak cocok — isi CSV berubah. Lakukan pratinjau ulang." };
  const alasan = String(alasanUmum || "").trim().slice(0, 100);
  if (alasan.length < 3) return { ok: false, alasan: "Alasan umum wajib diisi (min 3 huruf)." };
  if (!p.ringkas.valid) return { ok: false, alasan: "Tidak ada baris valid untuk diterapkan." };
  // Klaim atomik: hanya satu penerapan per kunci (upsert $setOnInsert; indeks unik jadi pengaman tambahan).
  try {
    const kl = await (await koreksiBatchCol()).updateOne({ kunci }, { $setOnInsert: { kunci, at: new Date(), alasan, baris: p.ringkas.valid } }, { upsert: true });
    if (!kl.upsertedCount && !kl.upsertedId) return { ok: false, alasan: "Batch ini sudah pernah diterapkan." };
  } catch (e) {
    if (e?.code === 11000) return { ok: false, alasan: "Batch ini sudah pernah diterapkan." };
    throw e;
  }
  const users = await usersCol(), logs = await adminBalanceLogsCol();
  let berhasil = 0; const gagal = [];
  for (const r of p.baris.filter((x) => x.valid)) {
    const medan = r.dompet === "game" ? "saldoGame" : "balance";
    const nominal = Math.abs(r.jumlah);
    const u = await users.findOneAndUpdate(r.jumlah < 0 ? { token: r.token, [medan]: { $gte: nominal } } : { token: r.token }, { $inc: { [medan]: r.jumlah } }, { returnDocument: "after" });
    if (!u) { gagal.push({ token: r.token, galat: "saldo berubah / akun hilang" }); continue; }
    if (r.jumlah < 0 && medan === "balance") await rapatkanDeposit(r.token, u.balance);
    const cat = `${alasan}${r.alasan ? ` — ${r.alasan}` : ""}`.slice(0, 120);
    await logs.insertOne({ token: r.token, amount: nominal, action: r.jumlah > 0 ? "add" : "sub", note: `[CSV ${kunci.slice(0, 8)}] ${cat}`, balanceAfter: u[medan], ...(medan === "saldoGame" ? { wallet: "game" } : {}), createdAt: new Date() });
    await logBalance({ token: r.token, type: r.jumlah > 0 ? "admin_add" : "admin_sub", amount: r.jumlah, balanceAfter: u[medan], ...(medan === "saldoGame" ? { wallet: "game" } : {}), title: `Admin: ${cat}` });
    berhasil++;
  }
  return { ok: true, berhasil, gagal, dilewati: p.ringkas.salah };
}
