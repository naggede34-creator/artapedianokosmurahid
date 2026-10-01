// Ruang obrolan: chat pribadi, grup buatan pengguna, dan Grup Umum komunitas.
import { randomBytes, randomUUID } from "node:crypto";
import { waRoomCol, waPesanCol, waPrefCol, waProfilCol, waMediaCol } from "@/lib/db";
import { getChatSettings } from "@/lib/chatSettings";
import { pastikanRoomAi } from "@/lib/wa/asisten";
import { BATAS, ALASAN_NAMA, perluNama, bersihTeks, idPrivate, profilPid, petaProfil, publik, simpanMedia, terblokir } from "@/lib/wa/inti";

export const ROOM_UMUM = "umum";

// ─────────────────────────── AKSES ───────────────────────────
export async function ambilRoom(roomId) {
  if (roomId === ROOM_UMUM) return pastikanUmum();
  return (await waRoomCol()).findOne({ roomId: String(roomId) });
}

/** Grup Umum ada untuk semua orang; namanya/fotonya mengikuti pengaturan admin lama. */
export async function pastikanUmum() {
  const kol = await waRoomCol();
  let r = await kol.findOne({ roomId: ROOM_UMUM });
  if (!r) {
    try {
      await kol.insertOne({ roomId: ROOM_UMUM, jenis: "umum", anggota: [], admin: [], nama: "Artapedia Community", deskripsi: "", createdAt: new Date(), lastAt: new Date(0) });
      await imporRiwayatLama();
    } catch (err) {
      if (err?.code !== 11000) throw err;
    }
    r = await kol.findOne({ roomId: ROOM_UMUM });
  }
  return r;
}

/**
 * Sekali saja, saat Grup Umum pertama dibuat: bawa pesan teks & stiker dari
 * Room Chat lama supaya riwayat komunitas tidak lenyap. Media lama (suara/foto
 * berupa data URL besar) tidak dibawa. Tak pernah menggagalkan pembuatan grup.
 */
async function imporRiwayatLama() {
  try {
    const { chatMessagesCol } = await import("@/lib/db");
    const lama = await (await chatMessagesCol()).find({ deleted: { $ne: true }, type: { $in: ["text", "sticker"] } }).sort({ createdAt: -1 }).limit(200).toArray();
    if (!lama.length) return;
    const pesan = await waPesanCol();
    const baru = lama.reverse().map((m) => ({
      msgId: `lama-${m.msgId}`, roomId: ROOM_UMUM, dari: null, namaDari: String(m.displayName || "Pengguna").slice(0, 24),
      jenis: m.type === "sticker" ? "stiker" : "teks", teks: m.type === "text" ? String(m.message || "").slice(0, 2000) : "",
      stiker: m.type === "sticker" ? String(m.stickerCode || "").slice(0, 16) : null,
      isAI: !!m.isAI, aiPersona: m.aiPersona || null, reaksi: {}, dihapusUntuk: [], readBy: [], deliveredTo: [], bintang: [], createdAt: new Date(m.createdAt || Date.now())
    })).filter((m) => (m.jenis === "teks" ? m.teks : m.stiker));
    if (!baru.length) return;
    await pesan.insertMany(baru, { ordered: false }).catch(() => {});
    const akhir = baru[baru.length - 1];
    await (await waRoomCol()).updateOne({ roomId: ROOM_UMUM }, { $set: { lastAt: akhir.createdAt, lastPreview: { dari: null, jenis: akhir.jenis, teks: `${akhir.namaDari}: ${akhir.teks || akhir.stiker}`.slice(0, 80), at: akhir.createdAt } } });
  } catch (err) {
    console.error("[wa] impor riwayat lama gagal:", err?.message || err);
  }
}

export const anggotaRoom = (r, pid) => r.jenis === "umum" || (r.anggota || []).includes(pid);
export const adminRoom = (r, pid) => (r.admin || []).includes(pid);

// ─────────────────────────── PRIBADI ───────────────────────────
export async function bukaPrivate(me, pidLawan) {
  if (perluNama(me)) return { ok: false, alasan: ALASAN_NAMA };
  if (!pidLawan || pidLawan === me.pid) return { ok: false, alasan: "Pilih pengguna lain." };
  const lawan = await profilPid(pidLawan);
  if (!lawan) return { ok: false, alasan: "Pengguna tidak ditemukan." };
  const roomId = idPrivate(me.pid, lawan.pid);
  const kol = await waRoomCol();
  try {
    await kol.insertOne({ roomId, jenis: "private", anggota: [me.pid, lawan.pid].sort(), admin: [], createdAt: new Date(), lastAt: new Date(0) });
  } catch (err) {
    if (err?.code !== 11000) throw err;
  }
  return { ok: true, roomId };
}

// ─────────────────────────── GRUP ───────────────────────────
const kodeUndangBaru = () => randomBytes(8).toString("base64url").replace(/[-_]/g, "z").slice(0, 10);

export async function buatGrup(me, { nama, anggota = [], foto = null, deskripsi = "" }) {
  if (perluNama(me)) return { ok: false, alasan: ALASAN_NAMA };
  const n = bersihTeks(nama, BATAS.grupNamaMaks);
  if (n.length < 2) return { ok: false, alasan: "Nama grup minimal 2 karakter." };
  const daftar = [...new Set([me.pid, ...(Array.isArray(anggota) ? anggota.map(String) : [])])].slice(0, BATAS.grupAnggotaMaks);
  if (daftar.length < 2) return { ok: false, alasan: "Pilih minimal satu anggota." };
  // Hanya pid yang benar-benar ada. Yang memblokir pembuat dibuang diam-diam.
  const ada = await (await waProfilCol()).find({ pid: { $in: daftar } }, { projection: { pid: 1, blokir: 1 } }).toArray();
  const sah = ada.filter((p) => p.pid === me.pid || !(p.blokir || []).includes(me.pid)).map((p) => p.pid);
  if (sah.length < 2) return { ok: false, alasan: "Anggota yang dipilih tidak tersedia." };

  const roomId = "g_" + randomUUID().replace(/-/g, "").slice(0, 16);
  const doc = {
    roomId, jenis: "grup", nama: n, deskripsi: bersihTeks(deskripsi, BATAS.grupDeskripsiMaks), fotoV: 0,
    anggota: sah, admin: [me.pid], pembuat: me.pid, hanyaAdminKirim: false, kodeUndang: kodeUndangBaru(),
    createdAt: new Date(), lastAt: new Date()
  };
  if (foto) {
    const r = await simpanMedia(foto, { id: `foto:${roomId}`, jenis: "gambar", maks: BATAS.fotoBytes });
    if (!r.ok) return r;
    doc.fotoV = Date.now();
  }
  await (await waRoomCol()).insertOne(doc);
  return { ok: true, roomId };
}

/** Ubah info grup: hanya admin grup. */
export async function ubahGrup(me, roomId, { nama, deskripsi, foto, hapusFoto, hanyaAdminKirim }) {
  const r = await ambilRoom(roomId);
  if (!r || r.jenis !== "grup") return { ok: false, alasan: "Grup tidak ditemukan." };
  if (!adminRoom(r, me.pid)) return { ok: false, alasan: "Hanya admin grup yang boleh mengubah info grup." };
  const set = {};
  const catatan = [];
  if (nama !== undefined) {
    const n = bersihTeks(nama, BATAS.grupNamaMaks);
    if (n.length < 2) return { ok: false, alasan: "Nama grup minimal 2 karakter." };
    if (n !== r.nama) { set.nama = n; catatan.push(`${me.nama} mengubah nama grup menjadi “${n}”`); }
  }
  if (deskripsi !== undefined) { set.deskripsi = bersihTeks(deskripsi, BATAS.grupDeskripsiMaks); catatan.push(`${me.nama} mengubah deskripsi grup`); }
  if (hanyaAdminKirim !== undefined) {
    set.hanyaAdminKirim = !!hanyaAdminKirim;
    catatan.push(hanyaAdminKirim ? `${me.nama} membatasi pesan: hanya admin yang bisa mengirim` : `${me.nama} mengizinkan semua anggota mengirim pesan`);
  }
  if (foto) {
    const m = await simpanMedia(foto, { id: `foto:${roomId}`, jenis: "gambar", maks: BATAS.fotoBytes });
    if (!m.ok) return m;
    set.fotoV = Date.now();
    catatan.push(`${me.nama} mengubah foto grup`);
  } else if (hapusFoto) {
    await (await waMediaCol()).deleteOne({ _id: `foto:${roomId}` });
    set.fotoV = 0;
    catatan.push(`${me.nama} menghapus foto grup`);
  }
  if (!Object.keys(set).length) return { ok: true };
  await (await waRoomCol()).updateOne({ roomId }, { $set: set });
  for (const c of catatan) await pesanSistem(roomId, c);
  return { ok: true };
}

export async function tambahAnggota(me, roomId, pids) {
  const r = await ambilRoom(roomId);
  if (!r || r.jenis !== "grup") return { ok: false, alasan: "Grup tidak ditemukan." };
  if (!adminRoom(r, me.pid)) return { ok: false, alasan: "Hanya admin grup yang boleh menambah anggota." };
  const baru = [...new Set((pids || []).map(String))].filter((p) => !r.anggota.includes(p));
  if (!baru.length) return { ok: true, ditambah: 0 };
  if (r.anggota.length + baru.length > BATAS.grupAnggotaMaks) return { ok: false, alasan: `Maksimal ${BATAS.grupAnggotaMaks} anggota.` };
  const profil = await waProfilCol().then((k) => k.find({ pid: { $in: baru } }, { projection: { pid: 1, nama: 1, blokir: 1 } }).toArray());
  const sah = profil.filter((p) => !(p.blokir || []).includes(me.pid));
  if (!sah.length) return { ok: false, alasan: "Pengguna tidak tersedia." };
  await (await waRoomCol()).updateOne({ roomId }, { $addToSet: { anggota: { $each: sah.map((p) => p.pid) } } });
  for (const p of sah) await pesanSistem(roomId, `${me.nama} menambahkan ${p.nama}`);
  return { ok: true, ditambah: sah.length };
}

export async function keluarkanAnggota(me, roomId, pid) {
  const r = await ambilRoom(roomId);
  if (!r || r.jenis !== "grup") return { ok: false, alasan: "Grup tidak ditemukan." };
  if (!adminRoom(r, me.pid)) return { ok: false, alasan: "Hanya admin grup yang boleh mengeluarkan anggota." };
  if (pid === me.pid) return { ok: false, alasan: "Gunakan Keluar Grup." };
  if (!r.anggota.includes(pid)) return { ok: false, alasan: "Bukan anggota grup." };
  // Pembuat grup tidak bisa dikeluarkan admin lain.
  if (pid === r.pembuat && me.pid !== r.pembuat) return { ok: false, alasan: "Pembuat grup tidak bisa dikeluarkan." };
  const target = await profilPid(pid);
  await (await waRoomCol()).updateOne({ roomId }, { $pull: { anggota: pid, admin: pid } });
  await pesanSistem(roomId, `${me.nama} mengeluarkan ${target?.nama || "anggota"}`);
  return { ok: true };
}

export async function aturAdmin(me, roomId, pid, jadikan) {
  const r = await ambilRoom(roomId);
  if (!r || r.jenis !== "grup") return { ok: false, alasan: "Grup tidak ditemukan." };
  if (!adminRoom(r, me.pid)) return { ok: false, alasan: "Hanya admin grup yang boleh mengatur admin." };
  if (!r.anggota.includes(pid)) return { ok: false, alasan: "Bukan anggota grup." };
  if (!jadikan && pid === r.pembuat) return { ok: false, alasan: "Admin pembuat grup tidak bisa dicabut." };
  const target = await profilPid(pid);
  await (await waRoomCol()).updateOne({ roomId }, jadikan ? { $addToSet: { admin: pid } } : { $pull: { admin: pid } });
  await pesanSistem(roomId, jadikan ? `${target?.nama || "Anggota"} kini menjadi admin` : `${target?.nama || "Anggota"} bukan admin lagi`);
  return { ok: true };
}

export async function keluarGrup(me, roomId) {
  const r = await ambilRoom(roomId);
  if (!r || r.jenis !== "grup" || !r.anggota.includes(me.pid)) return { ok: false, alasan: "Grup tidak ditemukan." };
  const sisa = r.anggota.filter((p) => p !== me.pid);
  const kol = await waRoomCol();
  if (!sisa.length) {
    // Anggota terakhir keluar: grup dihapus beserta pesannya.
    await kol.deleteOne({ roomId });
    await (await waPesanCol()).deleteMany({ roomId });
    await (await waMediaCol()).deleteOne({ _id: `foto:${roomId}` });
    return { ok: true, dihapus: true };
  }
  const admin = (r.admin || []).filter((p) => p !== me.pid);
  // Tanpa admin, anggota tertua diangkat supaya grup tidak yatim.
  const set = { $pull: { anggota: me.pid, admin: me.pid } };
  await kol.updateOne({ roomId }, set);
  if (!admin.length) await kol.updateOne({ roomId }, { $addToSet: { admin: sisa[0] } });
  await pesanSistem(roomId, `${me.nama} keluar`);
  return { ok: true };
}

export async function gabungDenganKode(me, kode) {
  if (perluNama(me)) return { ok: false, alasan: ALASAN_NAMA };
  const kol = await waRoomCol();
  const r = await kol.findOne({ kodeUndang: String(kode || "") });
  if (!r) return { ok: false, alasan: "Tautan undangan tidak berlaku." };
  if (r.anggota.includes(me.pid)) return { ok: true, roomId: r.roomId, sudah: true };
  if (r.anggota.length >= BATAS.grupAnggotaMaks) return { ok: false, alasan: "Grup sudah penuh." };
  await kol.updateOne({ roomId: r.roomId }, { $addToSet: { anggota: me.pid } });
  await pesanSistem(r.roomId, `${me.nama} bergabung lewat tautan undangan`);
  return { ok: true, roomId: r.roomId };
}

export async function resetKodeUndang(me, roomId) {
  const r = await ambilRoom(roomId);
  if (!r || r.jenis !== "grup" || !adminRoom(r, me.pid)) return { ok: false, alasan: "Hanya admin grup." };
  const kode = kodeUndangBaru();
  await (await waRoomCol()).updateOne({ roomId }, { $set: { kodeUndang: kode } });
  return { ok: true, kode };
}

// ─────────────────────────── PESAN SEMENTARA ───────────────────────────
export const SEMENTARA_OK = [0, 24 * 3600_000, 7 * 24 * 3600_000, 90 * 24 * 3600_000];
const namaSementara = (ms) => (ms === 24 * 3600_000 ? "24 jam" : ms === 7 * 24 * 3600_000 ? "7 hari" : "90 hari");

/** Pesan baru di room ini menghilang sendiri setelah `ms` (0 = mati). Pribadi: kedua pihak; grup: admin. */
export async function aturSementara(me, roomId, ms) {
  const r = await ambilRoom(roomId);
  if (!r || r.jenis === "umum" || !anggotaRoom(r, me.pid)) return { ok: false, alasan: "Obrolan tidak ditemukan." };
  const nilai = Number(ms) || 0;
  if (!SEMENTARA_OK.includes(nilai)) return { ok: false, alasan: "Pilihan waktu tidak dikenal." };
  if (r.jenis === "grup" && !adminRoom(r, me.pid)) return { ok: false, alasan: "Hanya admin grup yang boleh mengatur pesan sementara." };
  await (await waRoomCol()).updateOne({ roomId }, { $set: { sementara: nilai } });
  await pesanSistem(roomId, nilai ? `${me.nama} mengaktifkan pesan sementara: pesan baru hilang dalam ${namaSementara(nilai)}` : `${me.nama} mematikan pesan sementara`);
  return { ok: true, sementara: nilai };
}

// ─────────────────────────── PESAN SISTEM ───────────────────────────
export async function pesanSistem(roomId, teks, ekstra = {}) {
  const sekarang = new Date();
  await (await waPesanCol()).insertOne({
    msgId: randomUUID(), roomId, dari: null, namaDari: "", jenis: "sistem", teks: String(teks).slice(0, 300),
    reaksi: {}, dihapusUntuk: [], readBy: [], deliveredTo: [], createdAt: sekarang, ...ekstra
  });
  await (await waRoomCol()).updateOne({ roomId }, { $set: { lastAt: sekarang, lastPreview: { jenis: "sistem", teks: String(teks).slice(0, 80), at: sekarang, dari: null } } });
}

// ─────────────────────────── PREFERENSI PER PENGGUNA ───────────────────────────
export async function aturPref(me, roomId, { pinned, muted, archived }) {
  const r = await ambilRoom(roomId);
  if (!r || !anggotaRoom(r, me.pid)) return { ok: false, alasan: "Obrolan tidak ditemukan." };
  const set = {};
  if (pinned !== undefined) set.pinned = !!pinned;
  if (muted !== undefined) set.muted = !!muted;
  if (archived !== undefined) set.archived = !!archived;
  if (!Object.keys(set).length) return { ok: true };
  await (await waPrefCol()).updateOne({ pid: me.pid, roomId }, { $set: set, $setOnInsert: { pid: me.pid, roomId } }, { upsert: true });
  return { ok: true };
}

export async function prefMap(pid, roomIds) {
  const rows = await (await waPrefCol()).find({ pid, roomId: { $in: roomIds } }).toArray();
  return Object.fromEntries(rows.map((p) => [p.roomId, p]));
}

// ─────────────────────────── DAFTAR OBROLAN ───────────────────────────
/** Nama/foto/subjudul sebuah room menurut sudut pandang `me`. */
export function tampilRoom(r, me, profil, umum) {
  if (r.jenis === "private") {
    const lawan = profil[(r.anggota || []).find((p) => p !== me.pid)];
    return {
      nama: lawan?.nama || "Pengguna",
      foto: lawan ? `/api/wa/foto/${lawan.pid}?v=${lawan.fotoV}` : null,
      fotoAda: !!lawan?.fotoV,
      lencana: lawan?.lencana || null,
      lawan: lawan || null
    };
  }
  if (r.jenis === "ai") {
    return { nama: "WEARTA AI", foto: null, fotoAda: false, lencana: null, deskripsi: "Asisten pintar WEARTA CHAT", ai: true };
  }
  if (r.jenis === "umum") {
    return { nama: umum?.name || r.nama, foto: umum?.photo ? `/api/wa/foto/umum?v=${umum.photoV || 1}` : null, fotoAda: !!umum?.photo, lencana: null, deskripsi: umum?.desc || "" };
  }
  return { nama: r.nama, foto: r.fotoV ? `/api/wa/foto/g_${r.roomId}?v=${r.fotoV}` : null, fotoAda: !!r.fotoV, lencana: null, deskripsi: r.deskripsi || "" };
}

function ringkasPreview(r, me) {
  const p = r.lastPreview;
  if (!p) return null;
  return { jenis: p.jenis, teks: p.teks || "", saya: p.dari === me.pid, at: p.at };
}

/**
 * Daftar obrolan untuk layar utama. Sengaja ringan (dipanggil tiap beberapa
 * detik): tanpa foto mentah, tanpa isi pesan lengkap.
 */
export async function daftarRoom(me) {
  const kol = await waRoomCol();
  const umum = await pastikanUmum();
  const rows = await kol.find({ anggota: me.pid, jenis: { $in: ["private", "grup"] } }).sort({ lastAt: -1 }).limit(200).toArray();
  const ai = await pastikanRoomAi(me);
  const semua = [umum, ai, ...rows.filter((r) => r.lastPreview || r.jenis === "grup")];
  const ids = semua.map((r) => r.roomId);
  const prefs = await prefMap(me.pid, ids);
  const pids = new Set();
  for (const r of semua) for (const p of r.anggota || []) if (r.jenis === "private") pids.add(p);
  const profil = await petaProfil([...pids]);
  const setelanUmum = await getChatSettings();
  const pesan = await waPesanCol();
  const sekarang = Date.now();

  const hasil = [];
  for (const r of semua) {
    const pref = prefs[r.roomId] || {};
    const sejak = pref.lastRead ? new Date(pref.lastRead) : new Date(0);
    const bersih = pref.bersihSampai ? new Date(pref.bersihSampai) : null;
    const batasAwal = bersih && bersih > sejak ? bersih : sejak;
    const belumBaca = await pesan.countDocuments({
      roomId: r.roomId, dari: { $nin: [me.pid, null] }, createdAt: { $gt: batasAwal }, dihapusUntuk: { $ne: me.pid }, jenis: { $ne: "sistem" }
    });
    if (belumBaca > 0) {
      // Pesan yang sudah sampai ke perangkat ini: centang dua abu-abu di pengirim.
      await pesan.updateMany(
        { roomId: r.roomId, dari: { $nin: [me.pid, null] }, deliveredTo: { $ne: me.pid }, createdAt: { $gt: batasAwal } },
        { $addToSet: { deliveredTo: me.pid } }
      );
    }
    const tampil = tampilRoom(r, me, profil, { ...setelanUmum, photoV: 1 });
    const mengetik = Object.entries(r.typing || {}).filter(([pid, t]) => pid !== me.pid && sekarang - Number(t) < 5000).map(([pid]) => pid);
    hasil.push({
      roomId: r.roomId,
      jenis: r.jenis,
      ...tampil,
      anggotaJumlah: r.jenis === "grup" ? (r.anggota || []).length : undefined,
      preview: ringkasPreview(r, me),
      lastAt: r.lastAt || null,
      belumBaca: Math.min(belumBaca, 99),
      pinned: r.jenis === "ai" ? true : !!pref.pinned,
      muted: !!pref.muted,
      archived: !!pref.archived,
      mengetik: mengetik.length > 0,
      tutup: r.jenis === "umum" ? !!setelanUmum.closed : false
    });
  }
  hasil.sort((a, b) => Number(b.pinned) - Number(a.pinned) || new Date(b.lastAt || 0) - new Date(a.lastAt || 0));
  return hasil;
}

/** Info lengkap satu room untuk layar percakapan / info grup. */
export async function infoRoom(me, roomId) {
  const r = await ambilRoom(roomId);
  if (!r || !anggotaRoom(r, me.pid)) return null;
  const umum = r.jenis === "umum" ? await getChatSettings() : null;
  const anggotaPid = r.jenis === "umum" ? [] : r.anggota || [];
  const profil = await petaProfil(anggotaPid);
  const pref = (await prefMap(me.pid, [roomId]))[roomId] || {};
  const tampil = tampilRoom(r, me, profil, umum ? { ...umum, photoV: 1 } : null);
  return {
    roomId,
    jenis: r.jenis,
    ...tampil,
    deskripsi: tampil.deskripsi ?? "",
    anggota: anggotaPid.map((pid) => ({ ...(profil[pid] || { pid, nama: "Pengguna" }), admin: (r.admin || []).includes(pid) })),
    saya: { admin: adminRoom(r, me.pid), pembuat: r.pembuat === me.pid },
    hanyaAdminKirim: !!r.hanyaAdminKirim,
    sementara: r.sementara || 0,
    kodeUndang: r.jenis === "grup" && adminRoom(r, me.pid) ? r.kodeUndang : null,
    pinnedMsgId: r.jenis === "umum" ? umum?.pinnedMsgId || null : r.pinnedMsgId || null,
    tutup: r.jenis === "umum" ? !!umum?.closed : false,
    pref: { pinned: !!pref.pinned, muted: !!pref.muted, archived: !!pref.archived },
    dibuat: r.createdAt
  };
}

/** Kontak untuk daftar pengguna (dan pilihan anggota grup). */
export async function cariKontak(me, { q = "", hal = 0, ukuran = 40 } = {}) {
  const kol = await waProfilCol();
  const filter = { pid: { $ne: me.pid } };
  const kata = bersihTeks(q, 30);
  if (kata) filter.nama = { $regex: kata.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
  const rows = await kol.find(filter, { projection: { foto: 0, token: 0 } }).sort({ lastSeen: -1 }).skip(hal * ukuran).limit(ukuran + 1).toArray();
  const sekarang = Date.now();
  const punya = rows.slice(0, ukuran);
  return {
    items: punya.map((p) => ({ ...publik(p, sekarang), diblokir: (me.blokir || []).includes(p.pid) })),
    adaLagi: rows.length > ukuran
  };
}
