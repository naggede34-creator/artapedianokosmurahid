// Pesan: kirim, baca, balas, reaksi, hapus, ubah, bintang, teruskan, jajak pendapat.
import { randomUUID } from "node:crypto";
import { waPesanCol, waRoomCol, waPrefCol, waProfilCol, waMediaCol, chatGroupSettingsCol } from "@/lib/db";
import { getChatSettings, chatClosedMessage } from "@/lib/chatSettings";
import { kirimPush } from "@/lib/webPush";
import { BATAS, ALASAN_NAMA, perluNama, bersihTeks, escRegex, petaProfil, simpanMedia, terblokir, profilPid } from "@/lib/wa/inti";
import { ambilRoom, anggotaRoom, adminRoom, ROOM_UMUM, prefMap } from "@/lib/wa/room";
import { adminSahWa } from "@/lib/wa/admin";

const JENIS = ["teks", "gambar", "suara", "stiker", "poll"];
const BATAS_UBAH_MS = 15 * 60_000;
const REAKSI_OK = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🔥", "💯"];

const preview = (m) =>
  m.jenis === "teks" ? m.teks
  : m.jenis === "gambar" ? "📷 Foto" + (m.teks ? ` · ${m.teks}` : "")
  : m.jenis === "suara" ? "🎤 Pesan suara"
  : m.jenis === "stiker" ? `${m.stiker || "🙂"} Stiker`
  : m.jenis === "poll" ? `📊 ${m.poll?.pertanyaan || "Jajak pendapat"}`
  : m.jenis === "call" ? m.teks
  : m.teks || "";

// ─────────────────────────── SERIALISASI ───────────────────────────
/** Bentuk pesan untuk klien. Tidak memuat token; pengirim dirujuk lewat pid. */
export function serialisasi(m, me, jumlahPenerima = 1) {
  const mine = m.dari === me.pid;
  if (m.dihapusSemua) {
    return { id: m.msgId, jenis: "dihapus", dari: m.dari, mine, createdAt: m.createdAt };
  }
  const anggotaBaca = (m.readBy || []).length;
  const anggotaSampai = (m.deliveredTo || []).length;
  // Centang: 1 = terkirim, 2 = sampai, 2 biru = dibaca (semua penerima bila grup).
  const status = !mine ? null : anggotaBaca >= jumlahPenerima && jumlahPenerima > 0 ? "baca" : anggotaSampai > 0 || anggotaBaca > 0 ? "sampai" : "kirim";
  return {
    id: m.msgId,
    jenis: m.jenis,
    dari: m.dari,
    namaDari: m.namaDari || "",
    mine,
    teks: m.teks || "",
    media: m.mediaId ? `/api/wa/media/${m.mediaId}` : null,
    stiker: m.stiker || null,
    poll: m.poll ? { pertanyaan: m.poll.pertanyaan, opsi: m.poll.opsi.map((o) => ({ id: o.id, teks: o.teks, suara: o.voters.length, saya: o.voters.includes(me.pid) })) } : null,
    balas: m.balas || null,
    reaksi: Object.fromEntries(Object.entries(m.reaksi || {}).filter(([, v]) => v.length).map(([e, v]) => [e, { n: v.length, saya: v.includes(me.pid) }])),
    diedit: !!m.diedit,
    diteruskan: !!m.diteruskan,
    bintang: (m.bintang || []).includes(me.pid),
    pinned: !!m.pinned,
    isAI: !!m.isAI,
    aiPersona: m.aiPersona || null,
    status,
    durasi: m.durasi || null,
    createdAt: m.createdAt
  };
}

// ─────────────────────────── KIRIM ───────────────────────────
export async function kirim(me, roomId, data, { req = null } = {}) {
  if (perluNama(me)) return { ok: false, status: 403, alasan: ALASAN_NAMA, perluNama: true };
  const r = await ambilRoom(roomId);
  if (!r || !anggotaRoom(r, me.pid)) return { ok: false, status: 404, alasan: "Obrolan tidak ditemukan." };

  if (r.jenis === "umum") {
    const set = await getChatSettings();
    if (set.closed && !(req && (await adminSahWa(req)))) return { ok: false, status: 403, alasan: chatClosedMessage(set), tutup: true };
  }
  if (r.jenis === "grup" && r.hanyaAdminKirim && !adminRoom(r, me.pid)) {
    return { ok: false, status: 403, alasan: "Hanya admin yang bisa mengirim pesan di grup ini." };
  }
  if (r.jenis === "private") {
    const lawanPid = r.anggota.find((p) => p !== me.pid);
    if (await terblokir(me, lawanPid)) return { ok: false, status: 403, alasan: "Pesan tidak bisa dikirim ke kontak ini." };
  }

  const jenis = JENIS.includes(data.jenis) ? data.jenis : "teks";
  const msg = {
    msgId: randomUUID(), roomId, dari: me.pid, namaDari: me.nama, jenis, teks: "", reaksi: {},
    dihapusUntuk: [], readBy: [], deliveredTo: [], bintang: [], createdAt: new Date()
  };

  if (jenis === "teks") {
    msg.teks = bersihTeks(data.teks, BATAS.pesanMaks);
    if (!msg.teks) return { ok: false, status: 400, alasan: "Pesan tidak boleh kosong." };
  } else if (jenis === "gambar") {
    const m = await simpanMedia(data.media, { jenis: "gambar", maks: BATAS.gambarBytes });
    if (!m.ok) return { ok: false, status: 400, alasan: m.alasan };
    msg.mediaId = m.id;
    msg.teks = bersihTeks(data.teks, 500); // keterangan foto
  } else if (jenis === "suara") {
    const m = await simpanMedia(data.media, { jenis: "suara", maks: BATAS.suaraBytes });
    if (!m.ok) return { ok: false, status: 400, alasan: m.alasan };
    msg.mediaId = m.id;
    msg.durasi = Math.min(600, Math.max(0, Math.round(Number(data.durasi) || 0)));
  } else if (jenis === "stiker") {
    const s = String(data.stiker || "").trim();
    if (!s || [...s].length > 8) return { ok: false, status: 400, alasan: "Stiker tidak valid." };
    msg.stiker = s;
  } else if (jenis === "poll") {
    const tanya = bersihTeks(data.pertanyaan, 200);
    const opsi = (Array.isArray(data.opsi) ? data.opsi : []).map((o) => bersihTeks(o, 60)).filter(Boolean).slice(0, 6);
    if (!tanya || opsi.length < 2) return { ok: false, status: 400, alasan: "Jajak pendapat butuh pertanyaan dan minimal 2 pilihan." };
    msg.poll = { pertanyaan: tanya, opsi: opsi.map((teks, i) => ({ id: String(i), teks, voters: [] })) };
  }

  // Balasan: dirujuk dari pesan yang ADA di room ini, bukan dari teks kiriman klien.
  if (data.balasId) {
    const asal = await (await waPesanCol()).findOne({ msgId: String(data.balasId), roomId });
    if (asal && !asal.dihapusSemua) msg.balas = { msgId: asal.msgId, nama: asal.namaDari || "", preview: String(preview(asal) || "").slice(0, 80) };
  }
  if (r.sementara) msg.expireAt = new Date(Date.now() + r.sementara);
  if (data.diteruskan) msg.diteruskan = true;
  if (data.isAI) { msg.isAI = true; msg.aiPersona = data.aiPersona || null; }

  await (await waPesanCol()).insertOne(msg);
  await (await waRoomCol()).updateOne(
    { roomId },
    { $set: { lastAt: msg.createdAt, lastPreview: { dari: me.pid, jenis, teks: String(preview(msg) || "").slice(0, 80), at: msg.createdAt }, [`typing.${me.pid}`]: 0 } }
  );
  await (await waPrefCol()).updateOne({ pid: me.pid, roomId }, { $set: { lastRead: msg.createdAt }, $setOnInsert: { pid: me.pid, roomId } }, { upsert: true });

  kabariPenerima(me, r, msg).catch(() => {});
  return { ok: true, pesan: serialisasi(msg, me, Math.max(1, penerimaJumlah(r))) };
}

const penerimaJumlah = (r) => (r.jenis === "umum" ? 0 : Math.max(0, (r.anggota || []).length - 1));

/** Push ke anggota yang sedang tidak membuka aplikasi. Tidak pernah melempar. */
async function kabariPenerima(me, r, msg) {
  if (r.jenis === "umum") return; // grup terbuka: push tiap pesan = spam
  const lain = (r.anggota || []).filter((p) => p !== me.pid);
  if (!lain.length || lain.length > 50) return;
  const profil = await (await waProfilCol()).find({ pid: { $in: lain } }, { projection: { pid: 1, token: 1, lastSeen: 1, blokir: 1 } }).toArray();
  const sekarang = Date.now();
  const judul = r.jenis === "grup" ? `${me.nama} @ ${r.nama}` : me.nama;
  for (const p of profil) {
    if ((p.blokir || []).includes(me.pid)) continue;
    if (sekarang - new Date(p.lastSeen || 0).getTime() < 60_000) continue; // sedang online: tak perlu push
    const pref = await (await waPrefCol()).findOne({ pid: p.pid, roomId: r.roomId });
    if (pref?.muted) continue;
    await kirimPush(p.token, { judul, isi: String(preview(msg) || "Pesan baru").slice(0, 100), url: `/chat?room=${encodeURIComponent(r.roomId)}`, tag: `wa-${r.roomId}` });
  }
}

// ─────────────────────────── BACA ───────────────────────────
/**
 * Pesan sebuah room. `after` = ISO waktu (polling), `sebelum` = ISO waktu
 * (muat riwayat lebih lama), `q` = cari, `bintang` = hanya yang berbintang.
 */
export async function ambil(me, roomId, { after = null, sebelum = null, limit = 50, q = "", bintang = false } = {}) {
  const r = await ambilRoom(roomId);
  if (!r || !anggotaRoom(r, me.pid)) return null;
  const pref = (await prefMap(me.pid, [roomId]))[roomId] || {};
  const filter = { roomId, dihapusUntuk: { $ne: me.pid }, $or: [{ expireAt: null }, { expireAt: { $gt: new Date() } }] };
  const waktu = {};
  if (pref.bersihSampai) waktu.$gt = new Date(pref.bersihSampai);
  if (after && !Number.isNaN(new Date(after).getTime())) waktu.$gt = new Date(Math.max(new Date(after).getTime(), waktu.$gt ? waktu.$gt.getTime() : 0));
  if (sebelum && !Number.isNaN(new Date(sebelum).getTime())) waktu.$lt = new Date(sebelum);
  if (Object.keys(waktu).length) filter.createdAt = waktu;
  const kata = bersihTeks(q, 60);
  if (kata) { filter.teks = { $regex: escRegex(kata), $options: "i" }; filter.jenis = { $in: ["teks", "gambar"] }; filter.dihapusSemua = { $ne: true }; }
  if (bintang) filter.bintang = me.pid;

  const n = Math.min(100, Math.max(1, Number(limit) || 50));
  const kol = await waPesanCol();
  const rows = await kol.find(filter).sort({ createdAt: after ? 1 : -1 }).limit(n).toArray();
  const urut = after ? rows : [...rows].reverse();
  const jml = Math.max(1, penerimaJumlah(r));
  const pesan = urut.map((m) => serialisasi(m, me, jml));

  const pengirim = await petaProfil(urut.map((m) => m.dari));
  const sekarang = Date.now();
  const mengetikPid = Object.entries(r.typing || {}).filter(([pid, t]) => pid !== me.pid && sekarang - Number(t) < 5000).map(([pid]) => pid);
  const mengetik = mengetikPid.length ? Object.values(await petaProfil(mengetikPid)).map((p) => p.nama) : [];
  return { pesan, pengirim, mengetik, adaLagi: !after && rows.length === n };
}

/** Menandai semua pesan orang lain di room ini sebagai dibaca. */
export async function tandaiBaca(me, roomId) {
  const r = await ambilRoom(roomId);
  if (!r || !anggotaRoom(r, me.pid)) return { ok: false };
  const sekarang = new Date();
  await (await waPrefCol()).updateOne({ pid: me.pid, roomId }, { $set: { lastRead: sekarang }, $setOnInsert: { pid: me.pid, roomId } }, { upsert: true });
  if (r.jenis !== "umum") {
    await (await waPesanCol()).updateMany(
      { roomId, dari: { $nin: [me.pid, null] }, readBy: { $ne: me.pid } },
      { $addToSet: { readBy: me.pid, deliveredTo: me.pid } }
    );
  }
  return { ok: true };
}

export async function ketik(me, roomId) {
  const r = await ambilRoom(roomId);
  if (!r || !anggotaRoom(r, me.pid)) return { ok: false };
  await (await waRoomCol()).updateOne({ roomId }, { $set: { [`typing.${me.pid}`]: Date.now() } });
  return { ok: true };
}

// ─────────────────────────── AKSI PADA PESAN ───────────────────────────
async function pesanDiRoom(me, roomId, msgId) {
  const r = await ambilRoom(roomId);
  if (!r || !anggotaRoom(r, me.pid)) return {};
  const m = await (await waPesanCol()).findOne({ msgId: String(msgId), roomId });
  return { r, m };
}

export async function reaksi(me, roomId, msgId, emoji) {
  if (!REAKSI_OK.includes(emoji)) return { ok: false, alasan: "Reaksi tidak dikenal." };
  const { m } = await pesanDiRoom(me, roomId, msgId);
  if (!m || m.dihapusSemua) return { ok: false, alasan: "Pesan tidak ditemukan." };
  const kol = await waPesanCol();
  const sudah = (m.reaksi?.[emoji] || []).includes(me.pid);
  // Satu reaksi per orang per pesan (seperti WhatsApp): memilih emoji lain menggantikan.
  const unset = {};
  for (const e of Object.keys(m.reaksi || {})) if (e !== emoji && (m.reaksi[e] || []).includes(me.pid)) unset[`reaksi.${e}`] = me.pid;
  for (const [k, v] of Object.entries(unset)) await kol.updateOne({ msgId: m.msgId }, { $pull: { [k]: v } });
  await kol.updateOne({ msgId: m.msgId }, sudah ? { $pull: { [`reaksi.${emoji}`]: me.pid } } : { $addToSet: { [`reaksi.${emoji}`]: me.pid } });
  const baru = await kol.findOne({ msgId: m.msgId });
  return { ok: true, pesan: serialisasi(baru, me, Math.max(1, penerimaJumlah(await ambilRoom(roomId)))) };
}

/** scope "saya" = sembunyikan untuk diri sendiri; "semua" = pengirim (atau admin grup) menghapus untuk semua. */
export async function hapus(me, roomId, msgId, scope, { req = null } = {}) {
  const { r, m } = await pesanDiRoom(me, roomId, msgId);
  if (!m) return { ok: false, alasan: "Pesan tidak ditemukan." };
  const kol = await waPesanCol();
  if (scope === "semua") {
    const adminPesan = r.jenis === "umum" ? !!(req && (await adminSahWa(req))) : r.jenis === "grup" && adminRoom(r, me.pid);
    if (m.dari !== me.pid && !adminPesan) return { ok: false, alasan: "Hanya pengirim atau admin yang bisa menghapus untuk semua." };
    await kol.updateOne({ msgId: m.msgId }, { $set: { dihapusSemua: true, teks: "", mediaId: null, stiker: null, poll: null, balas: null, reaksi: {} } });
    // Media yang dipakai bersama pesan teruskan dibiarkan; hanya dihapus bila tak ada pemakai lain.
    if (m.mediaId && !(await kol.findOne({ mediaId: m.mediaId, msgId: { $ne: m.msgId }, dihapusSemua: { $ne: true } }))) {
      await (await waMediaCol()).deleteOne({ _id: m.mediaId });
    }
  } else {
    await kol.updateOne({ msgId: m.msgId }, { $addToSet: { dihapusUntuk: me.pid } });
  }
  return { ok: true };
}

export async function ubah(me, roomId, msgId, teksBaru) {
  const { m } = await pesanDiRoom(me, roomId, msgId);
  if (!m || m.dihapusSemua) return { ok: false, alasan: "Pesan tidak ditemukan." };
  if (m.dari !== me.pid) return { ok: false, alasan: "Hanya pesanmu sendiri yang bisa diubah." };
  if (m.jenis !== "teks" && m.jenis !== "gambar") return { ok: false, alasan: "Jenis pesan ini tidak bisa diubah." };
  if (Date.now() - new Date(m.createdAt).getTime() > BATAS_UBAH_MS) return { ok: false, alasan: "Pesan hanya bisa diubah dalam 15 menit." };
  const t = bersihTeks(teksBaru, m.jenis === "teks" ? BATAS.pesanMaks : 500);
  if (m.jenis === "teks" && !t) return { ok: false, alasan: "Pesan tidak boleh kosong." };
  await (await waPesanCol()).updateOne({ msgId: m.msgId }, { $set: { teks: t, diedit: true } });
  return { ok: true };
}

export async function bintang(me, roomId, msgId, nyalakan) {
  const { m } = await pesanDiRoom(me, roomId, msgId);
  if (!m || m.dihapusSemua) return { ok: false, alasan: "Pesan tidak ditemukan." };
  await (await waPesanCol()).updateOne({ msgId: m.msgId }, nyalakan ? { $addToSet: { bintang: me.pid } } : { $pull: { bintang: me.pid } });
  return { ok: true };
}

export async function sematkan(me, roomId, msgId, nyalakan, { req = null } = {}) {
  const { r, m } = await pesanDiRoom(me, roomId, msgId);
  if (!m || m.dihapusSemua) return { ok: false, alasan: "Pesan tidak ditemukan." };
  const boleh = r.jenis === "private" || (r.jenis === "grup" && adminRoom(r, me.pid)) || (r.jenis === "umum" && req && (await adminSahWa(req)));
  if (!boleh) return { ok: false, alasan: "Hanya admin yang bisa menyematkan pesan di sini." };
  if (r.jenis === "umum") {
    const kol = await chatGroupSettingsCol();
    await kol.updateOne({ _id: "config" }, { $set: { pinnedMsgId: nyalakan ? m.msgId : null } }, { upsert: true });
  } else {
    await (await waRoomCol()).updateOne({ roomId }, { $set: { pinnedMsgId: nyalakan ? m.msgId : null } });
  }
  await (await waPesanCol()).updateMany({ roomId, pinned: true }, { $set: { pinned: false } });
  if (nyalakan) await (await waPesanCol()).updateOne({ msgId: m.msgId }, { $set: { pinned: true } });
  return { ok: true };
}

export async function pilihPoll(me, roomId, msgId, opsiId) {
  const { m } = await pesanDiRoom(me, roomId, msgId);
  if (!m?.poll || m.dihapusSemua) return { ok: false, alasan: "Jajak pendapat tidak ditemukan." };
  if (!m.poll.opsi.some((o) => o.id === String(opsiId))) return { ok: false, alasan: "Pilihan tidak ada." };
  const kol = await waPesanCol();
  const sudah = m.poll.opsi.find((o) => o.id === String(opsiId))?.voters.includes(me.pid);
  // Satu suara per orang: memilih opsi lain memindahkan suaranya.
  const opsi = m.poll.opsi.map((o) => ({ ...o, voters: o.voters.filter((v) => v !== me.pid) }));
  if (!sudah) opsi.find((o) => o.id === String(opsiId)).voters.push(me.pid);
  await kol.updateOne({ msgId: m.msgId }, { $set: { "poll.opsi": opsi } });
  const baru = await kol.findOne({ msgId: m.msgId });
  return { ok: true, pesan: serialisasi(baru, me, 1) };
}

export async function teruskan(me, roomId, msgId, keRooms) {
  const { m } = await pesanDiRoom(me, roomId, msgId);
  if (!m || m.dihapusSemua) return { ok: false, alasan: "Pesan tidak ditemukan." };
  if (!["teks", "gambar", "stiker", "suara"].includes(m.jenis)) return { ok: false, alasan: "Jenis pesan ini tidak bisa diteruskan." };
  const tujuan = [...new Set((keRooms || []).map(String))].slice(0, 5);
  let terkirim = 0;
  for (const tujuanId of tujuan) {
    const data = { jenis: m.jenis, diteruskan: true, teks: m.teks, stiker: m.stiker };
    if (m.mediaId) {
      // Media dipakai bersama (id yang sama), tidak disalin.
      const r = await ambilRoom(tujuanId);
      if (!r || !anggotaRoom(r, me.pid)) continue;
      const salinan = { msgId: randomUUID(), roomId: tujuanId, dari: me.pid, namaDari: me.nama, jenis: m.jenis, teks: m.jenis === "gambar" ? m.teks || "" : "", mediaId: m.mediaId, durasi: m.durasi || null, diteruskan: true, reaksi: {}, dihapusUntuk: [], readBy: [], deliveredTo: [], bintang: [], createdAt: new Date() };
      await (await waPesanCol()).insertOne(salinan);
      await (await waRoomCol()).updateOne({ roomId: tujuanId }, { $set: { lastAt: salinan.createdAt, lastPreview: { dari: me.pid, jenis: m.jenis, teks: String(preview(salinan)).slice(0, 80), at: salinan.createdAt } } });
      terkirim++;
      continue;
    }
    const r = await kirim(me, tujuanId, data);
    if (r.ok) terkirim++;
  }
  return { ok: true, terkirim };
}

/** "Kosongkan chat": pesan lama disembunyikan untuk diri sendiri saja. */
export async function kosongkan(me, roomId) {
  const r = await ambilRoom(roomId);
  if (!r || !anggotaRoom(r, me.pid)) return { ok: false };
  await (await waPrefCol()).updateOne({ pid: me.pid, roomId }, { $set: { bersihSampai: new Date(), lastRead: new Date() }, $setOnInsert: { pid: me.pid, roomId } }, { upsert: true });
  return { ok: true };
}
