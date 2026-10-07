// Popup "Yang Baru" yang isinya diatur admin: tambah, ubah, hapus, urutkan.
// Disimpan di koleksi `pembaruan` — satu dokumen `_id:"meta"` (judul, sub,
// tampil otomatis, penanda versi) dan satu dokumen per butir (`tipe:"item"`).
// `versi` berubah setiap kali daftar aktif berubah, sehingga popup muncul lagi
// bagi pengguna yang sudah menutup versi sebelumnya.
import crypto from "crypto";
import { getDb } from "@/lib/db";
import { ITEM_BAWAAN, JUDUL_BAWAAN, SUB_BAWAAN, VERSI_BAWAAN } from "@/lib/pembaruanBawaan";

const MAKS_ITEM = 40;

async function kol() {
  return (await getDb()).collection("pembaruan");
}

function bersih(x) {
  const teks = (v, maks) => String(v ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, maks);
  const href = teks(x.href, 300);
  // Hanya tautan internal atau https — tidak menerima javascript:, data:, dsb.
  const hrefAman = !href ? "" : (/^\/(?!\/)/.test(href) || /^https:\/\//i.test(href)) ? href : null;
  return {
    ikon: teks(x.ikon, 8) || "✨",
    judul: teks(x.judul, 90),
    isi: teks(x.isi, 600),
    baru: !!x.baru,
    aktif: x.aktif !== false,
    href: hrefAman,
    tombol: teks(x.tombol, 30)
  };
}

function versiDari(aktif, meta) {
  const h = crypto.createHash("sha1");
  h.update(String(meta?.paksa || 0));
  h.update(String(meta?.judul || ""));
  for (const i of [...aktif].sort((a, b) => String(a._id).localeCompare(String(b._id)))) h.update(`${i._id}:${i.diubah || 0}|`);
  return h.digest("hex").slice(0, 10);
}

function keluar(i) {
  return { id: String(i._id), ikon: i.ikon, judul: i.judul, isi: i.isi, baru: !!i.baru, aktif: i.aktif !== false, href: i.href || "", tombol: i.tombol || "", urut: i.urut ?? 0 };
}

async function muatSemua() {
  const c = await kol();
  const meta = await c.findOne({ _id: "meta" });
  const item = await c.find({ tipe: "item" }).sort({ urut: 1, dibuat: 1 }).toArray();
  return { meta, item };
}

// Publik: hanya butir aktif. Belum pernah disunting admin → isi bawaan.
export async function pembaruanPublik() {
  const { meta, item } = await muatSemua();
  if (!meta) {
    return {
      versi: VERSI_BAWAAN, otomatis: true, judul: JUDUL_BAWAAN, sub: SUB_BAWAAN,
      item: ITEM_BAWAAN.map((x, n) => ({ id: `b${n}`, ...x, aktif: true }))
    };
  }
  const aktif = item.filter((i) => i.aktif !== false);
  return {
    versi: versiDari(aktif, meta),
    otomatis: meta.otomatis !== false && aktif.length > 0,
    judul: meta.judul || JUDUL_BAWAAN,
    sub: meta.sub ?? SUB_BAWAAN,
    item: aktif.map(keluar)
  };
}

// Admin: menanam isi bawaan sekali supaya bisa disunting.
async function pastikanBenih() {
  const c = await kol();
  const meta = await c.findOne({ _id: "meta" });
  if (meta) return;
  const now = Date.now();
  try {
    await c.insertOne({ _id: "meta", judul: JUDUL_BAWAAN, sub: SUB_BAWAAN, otomatis: true, paksa: 0, dibuat: now });
  } catch { return; } // balapan: proses lain sudah menanam
  await c.insertMany(ITEM_BAWAAN.map((x, n) => ({
    _id: crypto.randomBytes(6).toString("hex"), tipe: "item", ...bersih({ ...x, aktif: true }),
    urut: n, dibuat: now, diubah: now
  })));
}

export async function pembaruanAdmin() {
  await pastikanBenih();
  const { meta, item } = await muatSemua();
  const aktif = item.filter((i) => i.aktif !== false);
  return {
    versi: versiDari(aktif, meta),
    meta: { judul: meta.judul || "", sub: meta.sub ?? "", otomatis: meta.otomatis !== false },
    item: item.map(keluar)
  };
}

export async function ubahPembaruan(aksi, d = {}) {
  await pastikanBenih();
  const c = await kol();
  const now = Date.now();
  if (aksi === "meta") {
    const judul = String(d.judul ?? "").trim().slice(0, 80) || JUDUL_BAWAAN;
    const sub = String(d.sub ?? "").trim().slice(0, 160);
    await c.updateOne({ _id: "meta" }, { $set: { judul, sub, otomatis: !!d.otomatis } });
    return { ok: true };
  }
  if (aksi === "paksa") { // tampilkan lagi ke semua pengguna
    await c.updateOne({ _id: "meta" }, { $inc: { paksa: 1 } });
    return { ok: true };
  }
  if (aksi === "tambah") {
    const n = await c.countDocuments({ tipe: "item" });
    if (n >= MAKS_ITEM) return { ok: false, alasan: `Maksimal ${MAKS_ITEM} butir.` };
    const b = bersih(d);
    if (!b.judul) return { ok: false, alasan: "Judul wajib diisi." };
    if (b.href === null) return { ok: false, alasan: "Tautan harus diawali / atau https://" };
    const atas = await c.find({ tipe: "item" }).sort({ urut: 1 }).limit(1).toArray();
    const id = crypto.randomBytes(6).toString("hex");
    await c.insertOne({ _id: id, tipe: "item", ...b, urut: (atas[0]?.urut ?? 0) - 1, dibuat: now, diubah: now });
    return { ok: true, id };
  }
  const id = String(d.id || "");
  if (!id || id === "meta") return { ok: false, alasan: "Butir tidak ditemukan." };
  if (aksi === "ubah") {
    const b = bersih(d);
    if (!b.judul) return { ok: false, alasan: "Judul wajib diisi." };
    if (b.href === null) return { ok: false, alasan: "Tautan harus diawali / atau https://" };
    const r = await c.updateOne({ _id: id, tipe: "item" }, { $set: { ...b, diubah: now } });
    return r.matchedCount ? { ok: true } : { ok: false, alasan: "Butir tidak ditemukan." };
  }
  if (aksi === "hapus") {
    const r = await c.deleteOne({ _id: id, tipe: "item" });
    return r.deletedCount ? { ok: true } : { ok: false, alasan: "Butir tidak ditemukan." };
  }
  if (aksi === "aktif") {
    const r = await c.updateOne({ _id: id, tipe: "item" }, { $set: { aktif: !!d.aktif, diubah: now } });
    return r.matchedCount ? { ok: true } : { ok: false, alasan: "Butir tidak ditemukan." };
  }
  if (aksi === "geser") {
    const daftar = await c.find({ tipe: "item" }).sort({ urut: 1, dibuat: 1 }).toArray();
    const i = daftar.findIndex((x) => String(x._id) === id);
    const j = i + (d.arah === "atas" ? -1 : 1);
    if (i < 0) return { ok: false, alasan: "Butir tidak ditemukan." };
    if (j < 0 || j >= daftar.length) return { ok: true };
    const [x] = daftar.splice(i, 1);
    daftar.splice(j, 0, x);
    await Promise.all(daftar.map((y, n) => c.updateOne({ _id: y._id }, { $set: { urut: n } })));
    return { ok: true };
  }
  return { ok: false, alasan: "Aksi tidak dikenal." };
}
