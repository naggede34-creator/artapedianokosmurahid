// Panggilan suara & video 1:1 lewat WebRTC.
//
// Server HANYA menjadi perantara sinyal (offer, answer, kandidat ICE) — media
// mengalir langsung antar peramban. Vercel tidak punya WebSocket, jadi sinyal
// dibawa lewat polling pendek yang disimpan di koleksi wa_call.
//
// Batas yang jujur: hanya STUN publik yang tersedia secara bawaan. Dua peserta
// di balik NAT yang ketat (sebagian jaringan seluler) baru bisa tersambung
// kalau admin mengisi server TURN (TURN_URL, TURN_USERNAME, TURN_CREDENTIAL di
// Konfigurasi). Grup tidak mendukung panggilan.
import { randomUUID } from "node:crypto";
import { waCallCol, waPesanCol, waRoomCol, waProfilCol } from "@/lib/db";
import { cfg } from "@/lib/config";
import { kirimPush } from "@/lib/webPush";
import { ALASAN_NAMA, perluNama, idPrivate, petaProfil, profilPid, terblokir } from "@/lib/wa/inti";
import { bukaPrivate } from "@/lib/wa/room";
import { randomUUID as uuid } from "node:crypto";

export const DERING_MS = 45_000;
const AKTIF = ["ringing", "accepted"];

export async function serverIce() {
  const daftar = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];
  const url = String((await cfg("TURN_URL")) || "").trim();
  if (url) {
    daftar.push({
      urls: url.split(/[\s,]+/).filter(Boolean),
      username: String((await cfg("TURN_USERNAME")) || ""),
      credential: String((await cfg("TURN_CREDENTIAL")) || "")
    });
  }
  return daftar;
}

/** Panggilan yang tak diangkat dalam DERING_MS ditandai tak terjawab. */
export async function bersihkanDering() {
  const kol = await waCallCol();
  const basi = await kol.find({ status: "ringing", createdAt: { $lt: new Date(Date.now() - DERING_MS) } }).limit(50).toArray();
  for (const c of basi) {
    const r = await kol.findOneAndUpdate({ callId: c.callId, status: "ringing" }, { $set: { status: "tak-terjawab", endedAt: new Date() } }, { returnDocument: "after" });
    if (r) await catatPanggilan(r);
  }
}

async function catatPanggilan(c) {
  // Baris riwayat di dalam obrolan (seperti WhatsApp).
  const roomId = idPrivate(c.dari, c.ke);
  const jenisTeks = c.jenis === "video" ? "Panggilan video" : "Panggilan suara";
  const ket =
    c.status === "selesai" ? `${jenisTeks} · ${formatDurasi(c.durasi || 0)}`
    : c.status === "ditolak" ? `${jenisTeks} ditolak`
    : c.status === "sibuk" ? `${jenisTeks} · sibuk`
    : `${jenisTeks} tak terjawab`;
  const sekarang = new Date();
  try {
    await (await waPesanCol()).insertOne({
      msgId: uuid(), roomId, dari: null, namaDari: "", jenis: "call", teks: `📞 ${ket}`, callId: c.callId, reaksi: {},
      dihapusUntuk: [], readBy: [], deliveredTo: [], bintang: [], createdAt: sekarang
    });
    await (await waRoomCol()).updateOne({ roomId }, { $set: { lastAt: sekarang, lastPreview: { dari: null, jenis: "call", teks: `📞 ${ket}`.slice(0, 80), at: sekarang } } });
  } catch {
    /* riwayat gagal ditulis: panggilannya sendiri tetap sah */
  }
}

export const formatDurasi = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** Ada panggilan aktif yang melibatkan pid ini? */
async function sedangDalamPanggilan(pid) {
  const kol = await waCallCol();
  const c = await kol.findOne({ status: { $in: AKTIF }, $or: [{ dari: pid }, { ke: pid }] });
  if (!c) return false;
  if (c.status === "ringing" && Date.now() - new Date(c.createdAt).getTime() > DERING_MS) return false;
  return true;
}

export async function mulai(me, { ke, jenis, offer }) {
  if (perluNama(me)) return { ok: false, alasan: ALASAN_NAMA };
  if (!["suara", "video"].includes(jenis)) return { ok: false, alasan: "Jenis panggilan tidak dikenal." };
  const target = await profilPid(ke);
  if (!target || target.pid === me.pid) return { ok: false, alasan: "Pengguna tidak ditemukan." };
  if (await terblokir(me, target.pid)) return { ok: false, alasan: "Panggilan tidak bisa dilakukan ke kontak ini." };
  if (typeof offer?.sdp !== "string" || offer.sdp.length > 30_000 || offer.type !== "offer") return { ok: false, alasan: "Sinyal panggilan tidak valid." };
  await bersihkanDering();
  if (await sedangDalamPanggilan(me.pid)) return { ok: false, alasan: "Kamu sedang dalam panggilan lain." };

  const kol = await waCallCol();
  const doc = {
    callId: randomUUID(), dari: me.pid, ke: target.pid, jenis, status: "ringing", offer: { type: "offer", sdp: offer.sdp },
    answer: null, candDari: [], candKe: [], createdAt: new Date()
  };
  if (await sedangDalamPanggilan(target.pid)) {
    doc.status = "sibuk";
    doc.endedAt = new Date();
    await kol.insertOne(doc);
    await catatPanggilan(doc);
    return { ok: true, callId: doc.callId, status: "sibuk" };
  }
  await bukaPrivate(me, target.pid);
  await kol.insertOne(doc);
  // Push agar deringnya sampai walau aplikasi tertutup. Tak pernah melempar.
  kirimPush(target.token, {
    judul: `${jenis === "video" ? "📹 Panggilan video" : "📞 Panggilan suara"}`,
    isi: `${me.nama} menelepon kamu`, url: `/chat?call=${doc.callId}`, tag: `call-${doc.callId}`
  }).catch(() => {});
  return { ok: true, callId: doc.callId, status: "ringing" };
}

function bentukUntuk(me, c, dariIdx) {
  const sayaPenelepon = c.dari === me.pid;
  const lawanCand = sayaPenelepon ? c.candKe : c.candDari;
  const idx = Math.max(0, Number(dariIdx) || 0);
  return {
    callId: c.callId,
    jenis: c.jenis,
    status: c.status,
    sayaPenelepon,
    offer: sayaPenelepon ? undefined : c.offer,
    answer: sayaPenelepon ? c.answer : undefined,
    kandidat: lawanCand.slice(idx),
    idx: lawanCand.length,
    durasi: c.durasi || 0,
    mulaiAt: c.answeredAt || null
  };
}

/** Status + sinyal terbaru. Dipanggil berulang oleh kedua pihak. */
export async function keadaan(me, callId, dariIdx = 0) {
  await bersihkanDering();
  const c = await (await waCallCol()).findOne({ callId: String(callId) });
  if (!c || (c.dari !== me.pid && c.ke !== me.pid)) return null;
  const lawanPid = c.dari === me.pid ? c.ke : c.dari;
  const profil = await petaProfil([lawanPid]);
  return { ...bentukUntuk(me, c, dariIdx), lawan: profil[lawanPid] || { pid: lawanPid, nama: "Pengguna" } };
}

export async function jawab(me, callId, answer) {
  if (typeof answer?.sdp !== "string" || answer.sdp.length > 30_000 || answer.type !== "answer") return { ok: false, alasan: "Sinyal tidak valid." };
  const r = await (await waCallCol()).findOneAndUpdate(
    { callId: String(callId), ke: me.pid, status: "ringing", createdAt: { $gt: new Date(Date.now() - DERING_MS) } },
    { $set: { status: "accepted", answer: { type: "answer", sdp: answer.sdp }, answeredAt: new Date() } },
    { returnDocument: "after" }
  );
  return r ? { ok: true } : { ok: false, alasan: "Panggilan sudah berakhir." };
}

export async function tolak(me, callId) {
  const kol = await waCallCol();
  const r = await kol.findOneAndUpdate({ callId: String(callId), ke: me.pid, status: "ringing" }, { $set: { status: "ditolak", endedAt: new Date() } }, { returnDocument: "after" });
  if (r) await catatPanggilan(r);
  return { ok: !!r };
}

/** Salah satu pihak menutup: sebelum dijawab = batal (tak terjawab), sesudahnya = selesai + durasi. */
export async function akhiri(me, callId) {
  const kol = await waCallCol();
  const c = await kol.findOne({ callId: String(callId) });
  if (!c || (c.dari !== me.pid && c.ke !== me.pid)) return { ok: false };
  if (!AKTIF.includes(c.status)) return { ok: true };
  const sekarang = new Date();
  const set =
    c.status === "accepted"
      ? { status: "selesai", endedAt: sekarang, durasi: Math.max(0, Math.round((sekarang - new Date(c.answeredAt)) / 1000)) }
      : { status: "tak-terjawab", endedAt: sekarang };
  const r = await kol.findOneAndUpdate({ callId: c.callId, status: { $in: AKTIF } }, { $set: set }, { returnDocument: "after" });
  if (r) await catatPanggilan(r);
  return { ok: true };
}

export async function kirimIce(me, callId, kandidat) {
  if (!kandidat || typeof kandidat !== "object" || JSON.stringify(kandidat).length > 2000) return { ok: false };
  const kol = await waCallCol();
  const c = await kol.findOne({ callId: String(callId) });
  if (!c || (c.dari !== me.pid && c.ke !== me.pid) || !AKTIF.includes(c.status)) return { ok: false };
  const kolom = c.dari === me.pid ? "candDari" : "candKe";
  if ((c[kolom] || []).length >= 200) return { ok: false };
  await kol.updateOne({ callId: c.callId }, { $push: { [kolom]: kandidat } });
  return { ok: true };
}

/** Panggilan masuk yang sedang berdering untuk pid ini (untuk polling ringan). */
export async function panggilanMasuk(me) {
  const c = await (await waCallCol()).findOne(
    { ke: me.pid, status: "ringing", createdAt: { $gt: new Date(Date.now() - DERING_MS) } },
    { sort: { createdAt: -1 } }
  );
  if (!c) return null;
  const profil = await petaProfil([c.dari]);
  return { callId: c.callId, jenis: c.jenis, dari: profil[c.dari] || { pid: c.dari, nama: "Pengguna" }, at: c.createdAt };
}

export async function riwayat(me, batas = 50) {
  const rows = await (await waCallCol()).find({ $or: [{ dari: me.pid }, { ke: me.pid }] }, { projection: { offer: 0, answer: 0, candDari: 0, candKe: 0 } }).sort({ createdAt: -1 }).limit(batas).toArray();
  const profil = await petaProfil(rows.map((c) => (c.dari === me.pid ? c.ke : c.dari)));
  return rows.map((c) => {
    const keluar = c.dari === me.pid;
    const lawan = keluar ? c.ke : c.dari;
    return { callId: c.callId, jenis: c.jenis, arah: keluar ? "keluar" : "masuk", status: c.status, durasi: c.durasi || 0, at: c.createdAt, lawan: profil[lawan] || { pid: lawan, nama: "Pengguna" } };
  });
}
