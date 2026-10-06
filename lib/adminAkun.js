// Akun admin tambahan (selain kode utama = Owner): tiap orang punya kode sendiri + peran (lihat lib/adminIzin.js).
// Kode disimpan sebagai hash scrypt. Kode tiap akun harus unik & berbeda dari kode utama — login mencari akun lewat kodenya.
import crypto from "crypto";
import { getDb } from "@/lib/db";
import { hashKode, adminCodeMatches, KODE_MIN } from "@/lib/adminAuth";
import { PERAN_DAFTAR } from "@/lib/adminIzin";

const MAKS_AKUN = 20;
const col = async () => (await getDb()).collection("admin_akun");

function cocok(kode, tersimpan) {
  try {
    const [skema, garam, h] = String(tersimpan).split("$");
    if (skema !== "scrypt") return false;
    const hit = crypto.scryptSync(String(kode ?? ""), Buffer.from(garam, "base64"), 32);
    const benar = Buffer.from(h, "base64");
    return hit.length === benar.length && crypto.timingSafeEqual(hit, benar);
  } catch { return false; }
}

const publik = ({ _id, kodeHash, ...r }) => r;

export async function daftarAkun() {
  return (await (await col()).find({}).sort({ createdAt: 1 }).limit(100).toArray()).map(publik);
}

/** Mencari akun AKTIF yang kodenya cocok. Semua dihitung (tanpa berhenti di yang pertama) agar waktunya tidak membocorkan. */
export async function cariAkunDariKode(kode) {
  const semua = await (await col()).find({ aktif: true }).limit(MAKS_AKUN + 5).toArray();
  let ketemu = null;
  for (const a of semua) if (cocok(kode, a.kodeHash) && !ketemu) ketemu = a;
  return ketemu ? publik(ketemu) : null;
}

export async function ambilAkun(id) {
  const a = await (await col()).findOne({ id: String(id) });
  return a ? publik(a) : null;
}

async function kodeSudahDipakai(kode, kecuali = null) {
  if (await adminCodeMatches(kode)) return true;
  const semua = await (await col()).find({}).limit(100).toArray();
  return semua.some((a) => a.id !== kecuali && cocok(kode, a.kodeHash));
}

export async function tambahAkun({ nama, peran, kode }) {
  const n = String(nama || "").replace(/\s+/g, " ").trim().slice(0, 40);
  if (n.length < 2) return { ok: false, alasan: "Nama minimal 2 huruf." };
  if (!PERAN_DAFTAR.includes(peran) || peran === "owner") return { ok: false, alasan: "Peran tidak valid." };
  const k = String(kode || "");
  if (k.length < KODE_MIN) return { ok: false, alasan: `Kode minimal ${KODE_MIN} karakter.` };
  if (k.length > 128) return { ok: false, alasan: "Kode terlalu panjang." };
  const c = await col();
  if ((await c.countDocuments({})) >= MAKS_AKUN) return { ok: false, alasan: `Maksimal ${MAKS_AKUN} akun admin.` };
  if (await kodeSudahDipakai(k)) return { ok: false, alasan: "Kode itu sudah dipakai (kode utama atau akun lain). Pilih kode lain." };
  const id = "adm" + crypto.randomBytes(5).toString("hex");
  await c.insertOne({ id, nama: n, peran, kodeHash: hashKode(k), aktif: true, createdAt: new Date() });
  return { ok: true, id };
}

export async function ubahAkun(id, { aktif, peran, kode, hapus }) {
  const c = await col();
  const a = await c.findOne({ id: String(id) });
  if (!a) return { ok: false, alasan: "Akun tidak ditemukan." };
  if (hapus) { await c.deleteOne({ id: a.id }); return { ok: true }; }
  const set = {};
  if (aktif !== undefined) set.aktif = !!aktif;
  if (peran !== undefined) { if (!PERAN_DAFTAR.includes(peran) || peran === "owner") return { ok: false, alasan: "Peran tidak valid." }; set.peran = peran; }
  if (kode !== undefined) {
    const k = String(kode);
    if (k.length < KODE_MIN || k.length > 128) return { ok: false, alasan: `Kode ${KODE_MIN}–128 karakter.` };
    if (await kodeSudahDipakai(k, a.id)) return { ok: false, alasan: "Kode itu sudah dipakai. Pilih kode lain." };
    set.kodeHash = hashKode(k);
    set.kodeGantiAt = new Date();
  }
  if (!Object.keys(set).length) return { ok: false, alasan: "Tidak ada perubahan." };
  await c.updateOne({ id: a.id }, { $set: set });
  return { ok: true };
}

export async function catatMasuk(id) {
  await (await col()).updateOne({ id: String(id) }, { $set: { masukAt: new Date() } }).catch(() => {});
}
