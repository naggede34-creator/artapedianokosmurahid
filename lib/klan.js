// KLAN / TIM — grup WEARTA CHAT bersama, misi mingguan bersama, dan papan peringkat klan.
//
//  • Satu akun = satu klan (maks KLAN_MAKS_ANGGOTA). Klan otomatis punya GRUP WEARTA CHAT (kamu masuk/keluar grup ikut klan).
//  • Misi mingguan bersama (reset Senin WIB): menang duel Arena, beli nomor OTP, deposit. Target naik sesuai jumlah anggota
//    (maks ×5). Misi selesai → semua anggota yang ikut menyumbang mendapat POIN TOKO (bukan uang tunai), sekali saja per misi.
//  • Peringkat klan: skor aktivitas mingguan & sepanjang masa. Sumbangan hanya dari aktivitas yang sudah lolos pemeriksaan
//    (duel Arena yang sah, pembelian OTP sukses, deposit yang benar-benar dikreditkan).
import { randomUUID } from "node:crypto";
import { getDb, usersCol, userNotificationsCol, waRoomCol } from "@/lib/db";
import { cfg, cfgAngka } from "@/lib/config";
import { tanggalWib } from "@/lib/musim";
import { idMinggu, akhirMingguMs } from "@/lib/game/musimArena";
import { petaProfil, perluNama, ALASAN_NAMA, bersihTeks } from "@/lib/wa/inti";
import { pesanSistem } from "@/lib/wa/room";

const klanCol = async () => (await getDb()).collection("klan");
const anggotaCol = async () => (await getDb()).collection("klan_anggota");
const misiCol = async () => (await getDb()).collection("klan_misi");

export const MISI = [
  { id: "menang", ikon: "⚔️", judul: "Menangkan duel Arena Pendekar", dasar: 3, poin: 40, skor: 3 },
  { id: "otp", ikon: "📱", judul: "Beli nomor OTP (sukses)", dasar: 3, poin: 40, skor: 2 },
  { id: "deposit", ikon: "💳", judul: "Deposit saldo", dasar: 1, poin: 30, skor: 3 }
];
const SKOR_LAIN = { main: 1 }; // dihitung ke skor klan walau bukan misi
const aman = (pid) => String(pid).replace(/[^A-Za-z0-9_-]/g, "");

export async function konfigKlan() {
  return {
    aktif: String((await cfg("KLAN_AKTIF")) ?? "1") !== "0",
    maks: Math.max(2, Math.min(100, Math.round(await cfgAngka("KLAN_MAKS_ANGGOTA", 20))))
  };
}

const targetMisi = (m, jumlah) => m.dasar * Math.min(5, Math.max(1, jumlah));

// ───────────────────────── SUMBANGAN AKTIVITAS ─────────────────────────
/** Dipanggil dari tempat aktivitas sah terjadi. Tidak pernah melempar & murah bila pengguna tak punya klan. */
export async function sumbangKlan(token, jenis, n = 1) {
  try {
    if (!token) return;
    const a = await (await anggotaCol()).findOne({ token }, { projection: { pid: 1, klanId: 1 } });
    if (!a) return;
    const m = MISI.find((x) => x.id === jenis);
    const skorTambah = (m ? m.skor : SKOR_LAIN[jenis] || 0) * n;
    const minggu = idMinggu(tanggalWib());
    const id = `${a.klanId}:${minggu}`;
    const kol = await misiCol();
    const dok = await kol.findOneAndUpdate(
      { _id: id },
      { $setOnInsert: { klanId: a.klanId, minggu }, $inc: { [`progres.${jenis}`]: n, skor: skorTambah, [`kontrib.${aman(a.pid)}.${jenis}`]: n } },
      { upsert: true, returnDocument: "after" }
    );
    if (skorTambah) await (await klanCol()).updateOne({ klanId: a.klanId }, { $inc: { skorTotal: skorTambah } });
    if (m && dok) await periksaSelesai(dok, m);
  } catch (err) {
    if (err?.code !== 11000) console.error("[klan] sumbang:", err?.message || err);
  }
}

async function periksaSelesai(dok, m) {
  const klan = await (await klanCol()).findOne({ klanId: dok.klanId });
  if (!klan) return;
  const target = targetMisi(m, klan.jumlah || 1);
  if ((dok.progres?.[m.id] || 0) < target) return;
  const kol = await misiCol();
  const klaim = await kol.findOneAndUpdate({ _id: dok._id, [`selesai.${m.id}`]: { $ne: true } }, { $set: { [`selesai.${m.id}`]: true } }, { returnDocument: "after" });
  if (!klaim) return; // sudah dibayar
  // Hadiah poin toko untuk anggota yang menyumbang misi ini.
  const penyumbang = Object.entries(klaim.kontrib || {}).filter(([, v]) => (v?.[m.id] || 0) > 0).map(([pid]) => pid);
  const anggota = await (await anggotaCol()).find({ klanId: dok.klanId }).toArray();
  const user = await usersCol();
  let n = 0;
  for (const a of anggota) {
    if (!penyumbang.includes(aman(a.pid))) continue;
    await user.updateOne({ token: a.token }, { $inc: { points: m.poin } });
    try { await (await userNotificationsCol()).insertOne({ token: a.token, type: "klan_misi", title: `🎯 Misi klan selesai: ${m.judul}`, body: `Klan ${klan.nama} menuntaskan misi mingguan. Kamu dapat +${m.poin} poin toko!`, read: false, createdAt: new Date(), url: "/klan" }); } catch {}
    n++;
  }
  if (klan.roomId) await pesanSistem(klan.roomId, `🎯 Misi klan selesai: ${m.judul}! ${n} penyumbang mendapat +${m.poin} poin toko.`).catch(() => {});
}

// ───────────────────────── BACA ─────────────────────────
async function ringkasKlan(k, minggu) {
  const [dokMisi, anggota] = await Promise.all([(await misiCol()).findOne({ _id: `${k.klanId}:${minggu}` }), (await anggotaCol()).find({ klanId: k.klanId }).sort({ joinedAt: 1 }).toArray()]);
  const profil = await petaProfil(anggota.map((a) => a.pid));
  const jumlah = anggota.length;
  return {
    klanId: k.klanId, nama: k.nama, tag: k.tag, deskripsi: k.deskripsi || "", jumlah, ketuaPid: k.ketuaPid, roomId: k.roomId, skorTotal: k.skorTotal || 0,
    skorMinggu: dokMisi?.skor || 0,
    misi: MISI.map((m) => ({ id: m.id, ikon: m.ikon, judul: m.judul, poin: m.poin, target: targetMisi(m, jumlah), progres: Math.min(dokMisi?.progres?.[m.id] || 0, 9999), selesai: !!dokMisi?.selesai?.[m.id] })),
    anggota: anggota.map((a) => ({ pid: a.pid, nama: profil[a.pid]?.nama || a.nama, ketua: a.pid === k.ketuaPid, sumbangan: Object.values(dokMisi?.kontrib?.[aman(a.pid)] || {}).reduce((s, v) => s + v, 0) }))
  };
}

export async function ringkasanKlan(me) {
  const k = await konfigKlan();
  const minggu = idMinggu(tanggalWib());
  const kolK = await klanCol();
  const a = await (await anggotaCol()).findOne({ pid: me.pid });
  let saya = null;
  if (a) {
    const dok = await kolK.findOne({ klanId: a.klanId });
    if (dok) {
      saya = await ringkasKlan(dok, minggu);
      saya.peran = a.pid === dok.ketuaPid ? "ketua" : "anggota";
      // Pastikan masih tergabung di grup chat klan (mis. sempat keluar dari grup).
      if (dok.roomId) (await waRoomCol()).updateOne({ roomId: dok.roomId }, { $addToSet: { anggota: me.pid } }).catch(() => {});
    }
  }
  const [mingguIni, sepanjang] = await Promise.all([
    (await misiCol()).find({ minggu, skor: { $gt: 0 } }).sort({ skor: -1 }).limit(10).toArray(),
    kolK.find({ skorTotal: { $gt: 0 } }).sort({ skorTotal: -1 }).limit(10).toArray()
  ]);
  const idKlan = [...new Set([...mingguIni.map((x) => x.klanId), ...sepanjang.map((x) => x.klanId)])];
  const info = Object.fromEntries((await kolK.find({ klanId: { $in: idKlan } }).toArray()).map((x) => [x.klanId, x]));
  const bentuk = (x, skor) => ({ klanId: x.klanId, nama: info[x.klanId]?.nama || "?", tag: info[x.klanId]?.tag || "", jumlah: info[x.klanId]?.jumlah || 0, skor, saya: x.klanId === saya?.klanId });
  const bukaGabung = saya ? [] : (await kolK.find({ jumlah: { $lt: k.maks } }).sort({ skorTotal: -1, createdAt: -1 }).limit(12).toArray()).map((x) => ({ klanId: x.klanId, nama: x.nama, tag: x.tag, jumlah: x.jumlah || 0, deskripsi: x.deskripsi || "", skorTotal: x.skorTotal || 0 }));
  return {
    aktif: k.aktif, maks: k.maks, saya,
    papanMinggu: mingguIni.map((x, i) => ({ peringkat: i + 1, ...bentuk(x, x.skor) })),
    papanTotal: sepanjang.map((x, i) => ({ peringkat: i + 1, ...bentuk(x, x.skorTotal) })),
    bukaGabung, minggu: { id: minggu, sisaMs: Math.max(0, akhirMingguMs(minggu) - Date.now()) }
  };
}

// ───────────────────────── AKSI ─────────────────────────
const bersihNama = (s) => bersihTeks(s, 24).replace(/[<>]/g, "");

export async function buatKlan(me, { nama, tag, deskripsi }) {
  const k = await konfigKlan();
  if (!k.aktif) return { ok: false, alasan: "Fitur klan sedang dinonaktifkan." };
  if (perluNama(me)) return { ok: false, alasan: ALASAN_NAMA };
  const n = bersihNama(nama);
  const t = String(tag || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
  if (n.length < 3) return { ok: false, alasan: "Nama klan minimal 3 karakter." };
  if (/https?:\/\/|www\./i.test(n)) return { ok: false, alasan: "Nama klan tidak boleh berisi tautan." };
  if (t.length < 2) return { ok: false, alasan: "Tag klan 2–5 huruf/angka." };
  const aCol = await anggotaCol();
  if (await aCol.findOne({ pid: me.pid })) return { ok: false, alasan: "Kamu sudah punya klan. Keluar dulu untuk membuat yang baru." };
  const kCol = await klanCol();
  const klanId = "k_" + randomUUID().replace(/-/g, "").slice(0, 12);
  const roomId = "g_" + randomUUID().replace(/-/g, "").slice(0, 16);
  const sekarang = new Date();
  try {
    await kCol.insertOne({ klanId, nama: n, kunciNama: n.toLowerCase(), tag: t, deskripsi: bersihTeks(deskripsi, 120), ketuaPid: me.pid, roomId, jumlah: 1, skorTotal: 0, createdAt: sekarang });
  } catch (e) {
    if (e?.code === 11000) return { ok: false, alasan: "Nama atau tag klan sudah dipakai." };
    throw e;
  }
  try {
    await aCol.insertOne({ pid: me.pid, token: me.token, klanId, nama: me.nama, peran: "ketua", joinedAt: sekarang });
  } catch (e) {
    await kCol.deleteOne({ klanId });
    if (e?.code === 11000) return { ok: false, alasan: "Kamu sudah punya klan." };
    throw e;
  }
  await (await waRoomCol()).insertOne({ roomId, jenis: "grup", nama: `🛡 [${t}] ${n}`, deskripsi: `Grup klan ${n}`, fotoV: 0, anggota: [me.pid], admin: [me.pid], pembuat: me.pid, hanyaAdminKirim: false, kodeUndang: null, klanId, createdAt: sekarang, lastAt: sekarang });
  await pesanSistem(roomId, `🛡 Klan ${n} [${t}] dibentuk oleh ${me.nama}. Selamat bertarung!`).catch(() => {});
  return { ok: true, klanId, roomId };
}

export async function gabungKlan(me, klanId) {
  const k = await konfigKlan();
  if (!k.aktif) return { ok: false, alasan: "Fitur klan sedang dinonaktifkan." };
  if (perluNama(me)) return { ok: false, alasan: ALASAN_NAMA };
  const kCol = await klanCol();
  const aCol = await anggotaCol();
  if (await aCol.findOne({ pid: me.pid })) return { ok: false, alasan: "Kamu sudah punya klan." };
  // Tempat dipesan atomik (jumlah < maks), lalu keanggotaan dicatat; gagal → tempat dikembalikan.
  const dok = await kCol.findOneAndUpdate({ klanId: String(klanId || ""), jumlah: { $lt: k.maks } }, { $inc: { jumlah: 1 } }, { returnDocument: "after" });
  if (!dok) return { ok: false, alasan: "Klan tidak ditemukan atau sudah penuh." };
  try {
    await aCol.insertOne({ pid: me.pid, token: me.token, klanId: dok.klanId, nama: me.nama, peran: "anggota", joinedAt: new Date() });
  } catch (e) {
    await kCol.updateOne({ klanId: dok.klanId }, { $inc: { jumlah: -1 } });
    if (e?.code === 11000) return { ok: false, alasan: "Kamu sudah punya klan." };
    throw e;
  }
  await (await waRoomCol()).updateOne({ roomId: dok.roomId }, { $addToSet: { anggota: me.pid } });
  await pesanSistem(dok.roomId, `${me.nama} bergabung ke klan`).catch(() => {});
  return { ok: true, klanId: dok.klanId, roomId: dok.roomId };
}

async function lepas(pid, klan, alasanTeks) {
  const aCol = await anggotaCol();
  const hapus = await aCol.findOneAndDelete({ pid, klanId: klan.klanId });
  if (!hapus) return false;
  const kCol = await klanCol();
  const sisa = await aCol.find({ klanId: klan.klanId }).sort({ joinedAt: 1 }).toArray();
  const rooms = await waRoomCol();
  if (!sisa.length) {
    await kCol.deleteOne({ klanId: klan.klanId });
    await rooms.deleteOne({ roomId: klan.roomId });
    return true;
  }
  const set = { jumlah: sisa.length };
  if (klan.ketuaPid === pid) { set.ketuaPid = sisa[0].pid; await aCol.updateOne({ pid: sisa[0].pid }, { $set: { peran: "ketua" } }); await rooms.updateOne({ roomId: klan.roomId }, { $addToSet: { admin: sisa[0].pid } }); }
  await kCol.updateOne({ klanId: klan.klanId }, { $set: set });
  await rooms.updateOne({ roomId: klan.roomId }, { $pull: { anggota: pid, admin: pid } });
  await pesanSistem(klan.roomId, alasanTeks).catch(() => {});
  return true;
}

export async function keluarKlan(me) {
  const a = await (await anggotaCol()).findOne({ pid: me.pid });
  if (!a) return { ok: false, alasan: "Kamu belum punya klan." };
  const klan = await (await klanCol()).findOne({ klanId: a.klanId });
  if (!klan) { await (await anggotaCol()).deleteOne({ pid: me.pid }); return { ok: true }; }
  await lepas(me.pid, klan, `${me.nama} keluar dari klan`);
  return { ok: true };
}

export async function keluarkanDariKlan(me, pidTarget) {
  const klan = await (await klanCol()).findOne({ klanId: (await (await anggotaCol()).findOne({ pid: me.pid }))?.klanId || "-" });
  if (!klan || klan.ketuaPid !== me.pid) return { ok: false, alasan: "Hanya ketua klan yang boleh mengeluarkan anggota." };
  if (pidTarget === me.pid) return { ok: false, alasan: "Gunakan Keluar Klan." };
  const target = await (await anggotaCol()).findOne({ pid: String(pidTarget), klanId: klan.klanId });
  if (!target) return { ok: false, alasan: "Bukan anggota klan." };
  await lepas(target.pid, klan, `${target.nama} dikeluarkan dari klan`);
  return { ok: true };
}
