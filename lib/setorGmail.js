// Stor Gmail (freelance): pengguna membuat akun Gmail PERSIS sesuai daftar yang di-generate penyedia (SetoranGmail),
// menyetorkannya ke room, dan dibayar ke DOMPET TERPISAH ("saldo Stor") — tidak bercampur dengan saldo nokos / poin game.
//
// Cara kerja
//   • Situs ini memakai SATU API key pemilik (SETORGMAIL_APIKEY, diisi lewat Admin → Konfigurasi; terenkripsi).
//     Tiap pengguna menjadi "worker" di penyedia dengan id SAMAR (bukan kode akun!) — lihat `pekerjaDari`.
//   • Harga room dari penyedia (mis. Rp4.000) dikurangi UNTUNG pemilik (mis. Rp1.000) = upah pengguna (Rp3.000).
//     Upah dikunci saat setoran dikirim dan dikirim ke penyedia sebagai `workerRatePerEmail`, sehingga laporan
//     penyedia dan saldo di sini selalu sama.
//   • Room dibaca langsung dari penyedia (cache 30 dtk). Penyedia menutup room / mati / key salah → di sini ikut tutup.
//
// URUTAN YANG MENJAGA UANG
//   email: digenerate → dikirim (diklaim atomik; satu email tak bisa dikirim dua kali) → diterima (penyedia menerimanya
//   untuk diperiksa) → mengkredit → dibayar.  Upah HANYA dikreditkan setelah penyedia menyatakan setoran diterima
//   (status masuk SETORGMAIL_STATUS_OK) atau admin menyetujui manual. Kredit memakai kunci idempotensi per email
//   (`setorRef`), jadi proses yang mati di tengah jalan bisa diulang tanpa membayar dua kali.
//   Hasil pengiriman yang TIDAK PASTI (timeout) tidak dilepas begitu saja: penyapu mencocokkannya ke daftar setoran penyedia.
import { randomUUID } from "node:crypto";
import { usersCol, setorGmailCol, setorJobCol, setorRoomCol, userNotificationsCol } from "@/lib/db";
import { cfg, cfgAngka } from "@/lib/config";
import { logBalance } from "@/lib/ledger";
import { umumkan } from "@/lib/notifyHub";
import { kirimPush } from "@/lib/webPush";

export const SYARAT_VERSI = "2026-10-01";
const rp = (n) => `Rp${Number(n || 0).toLocaleString("id-ID")}`;
const esc = (x) => String(x ?? "").replace(/[<>&]/g, "");
const MENIT = 60_000;
const RE_GMAIL = /[a-z0-9][a-z0-9.]{4,28}[a-z0-9]@gmail\.com/gi;
// Kiriman "dikirim" yang tak kunjung dikonfirmasi dianggap basi setelah ini (menit; bisa dipercepat lewat env untuk uji).
const BASI_MS = () => Math.max(0.02, Number(process.env.SETORGMAIL_BASI_MENIT) || 12) * MENIT;
const AKTIF_KREDIT = ["diterima", "dikirim", "menunggu-admin"];

export const SYARAT = [
  "Layanan ini adalah pekerjaan lepas (freelance): kamu membuat akun Gmail lalu menyetorkannya, dan dibayar per akun yang DITERIMA.",
  "Akun WAJIB dibuat PERSIS sesuai daftar email & kata sandi yang di-generate di halaman ini. Email atau sandi yang berbeda, atau email yang bukan hasil generate-mu, ditolak dan tidak dibayar.",
  "Setelah akun dibuat, jangan mengubah sandi, nomor pemulihan, atau data akun, jangan login ulang dari banyak perangkat, dan jangan menjual / menyetorkan akun yang sama ke tempat lain.",
  "Hanya akun buatan sendiri yang boleh disetor. Akun curian, hasil peretasan, atau milik orang lain dilarang — akun pelaku dibekukan, saldo Stor ditahan, dan IP-nya diblokir dari situs.",
  "Upah per email = harga room dikurangi biaya layanan, tertera di halaman sebelum kamu menyetor. Yang berlaku adalah upah saat setoran dikirim; perubahan harga setelahnya tidak memengaruhi setoran itu.",
  "Upah masuk ke saldo Stor setelah akun diperiksa dan diterima. Setoran yang ditolak, ganda, atau tidak sesuai tidak dibayar. Pemeriksaan bisa memakan waktu.",
  "Saldo Stor TERPISAH dari saldo nokos dan poin game. Saldo Stor hanya bisa ditarik ke e-wallet (sesuai batas minimal & biaya yang tertera), tidak bisa dipakai membeli nokos.",
  "Bila room ditutup atau layanan sedang tidak tersedia, setoran dan pembuatan email ikut ditutup otomatis. Setoran yang sudah diterima sebelum penutupan tetap dibayar.",
  "Admin berhak membekukan akun dan menahan saldo bila ada indikasi kecurangan: akun ganda, pola setoran tidak wajar, atau pelanggaran poin di atas.",
  "Dengan menekan 'Saya setuju', kamu menyatakan sudah membaca dan menerima syarat ini."
];

// ───────────────────────── KONFIGURASI ─────────────────────────
const nyala = async (nama, bawaan = "1") => String((await cfg(nama)) ?? bawaan) !== "0";
const daftarKoma = (s) => String(s || "").toLowerCase().split(/[,\s;]+/).map((x) => x.trim()).filter(Boolean);
const awalHariWib = () => {
  const w = new Date(Date.now() + 7 * 3600_000);
  return new Date(Date.UTC(w.getUTCFullYear(), w.getUTCMonth(), w.getUTCDate()) - 7 * 3600_000);
};

async function kunci() { return String((await cfg("SETORGMAIL_APIKEY")) || "").trim(); }
async function dasar() { return String((await cfg("SETORGMAIL_BASE_URL")) || "https://setorangmail.web.id").trim().replace(/\/+$/, ""); }
export async function setorTerkonfigurasi() { return !!(await kunci()); }

export class SetorError extends Error {
  constructor(pesan, status = 500, ambigu = false) { super(pesan); this.name = "SetorError"; this.status = status; this.ambigu = ambigu; }
}

/** Satu pintu ke penyedia. `ambigu` = tak ada jawaban HTTP sama sekali (hasil di penyedia tidak diketahui). */
async function panggil(path, { method = "GET", body, query, timeout = 15000 } = {}) {
  const k = await kunci();
  if (!k) throw new SetorError("API key SetoranGmail belum diisi.", 503);
  const qs = query ? "?" + new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== "")).toString() : "";
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeout);
  let r;
  try {
    r = await fetch(`${await dasar()}${path}${qs}`, {
      method, cache: "no-store", signal: ac.signal,
      headers: { "x-api-key": k, Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
  } catch (e) {
    throw new SetorError(e?.name === "AbortError" ? "Penyedia tidak menjawab (timeout)." : `Tidak bisa menghubungi penyedia: ${e?.message || "jaringan"}`, 0, true);
  } finally { clearTimeout(t); }
  const teks = await r.text().catch(() => "");
  let data = {};
  try { data = teks ? JSON.parse(teks) : {}; } catch { data = { error: teks.slice(0, 200) }; }
  if (!r.ok || data?.ok === false || (data?.error && !data?.ok)) {
    const pesan = String(data?.error || data?.message || `HTTP ${r.status}`).slice(0, 200);
    if (r.status === 401 || r.status === 403) await peringatKunci(pesan);
    throw new SetorError(pesan, r.status || 500, r.status >= 500);
  }
  return data;
}

let kunciDikabari = 0;
async function peringatKunci(pesan) {
  if (Date.now() - kunciDikabari < 3 * 3600_000) return;
  kunciDikabari = Date.now();
  umumkan({ admin: `🚨 <b>STOR GMAIL — API KEY DITOLAK PENYEDIA</b>\n📝 ${esc(pesan)}\nMenu Stor Gmail ditutup untuk pengguna sampai key benar. Periksa Admin → Konfigurasi → Stor Gmail.` });
}

// ───────────────────────── PEKERJA ─────────────────────────
/** Identitas pekerja di penyedia: id acak samar, TIDAK PERNAH kode akun pengguna (itu kunci masuk akunnya). */
async function pekerjaDari(token) {
  const kol = await usersCol();
  const u = await kol.findOne({ token }, { projection: { setorPekerja: 1 } });
  if (u?.setorPekerja?.id) return u.setorPekerja;
  const id = "ap" + randomUUID().replace(/-/g, "").slice(0, 14);
  const baru = { source: "artapedia", id, name: `artapedia_${id.slice(2, 8)}` };
  await kol.updateOne({ token, "setorPekerja.id": { $exists: false } }, { $set: { setorPekerja: baru } });
  return (await kol.findOne({ token }, { projection: { setorPekerja: 1 } }))?.setorPekerja || baru;
}
const qPekerja = (w) => ({ workerSource: w.source, workerId: w.id, workerName: w.name });

// ───────────────────────── ROOM ─────────────────────────
let cacheRoom = { t: 0, rooms: null, galat: "" };
const normEmail = (x) => String(x || "").trim().toLowerCase();

/** Upah pengguna per email untuk satu room (harga − untung; lantai 0). */
export function hitungUpah(harga, untung) {
  const h = Math.floor(Number(harga) || 0);
  const u = Math.max(0, Math.floor(Number(untung) || 0));
  return Math.max(0, h - u);
}

async function untungDefault() { return Math.max(0, Math.round(await cfgAngka("SETORGMAIL_UNTUNG_RP", 1000))); }

/**
 * Daftar room dari penyedia + upah pengguna. `segar` = abaikan cache (dipakai tepat sebelum setoran).
 * Mengembalikan { rooms, galat }. Galat penyedia = tidak ada room (tertutup), bukan menebak.
 */
export async function ambilRoom({ segar = false } = {}) {
  if (!segar && cacheRoom.rooms && Date.now() - cacheRoom.t < 30_000) return { rooms: cacheRoom.rooms, galat: cacheRoom.galat };
  let mentah = [], galat = "";
  try {
    const d = await panggil("/api/external/rooms");
    mentah = Array.isArray(d.rooms) ? d.rooms : [];
  } catch (e) { galat = e?.message || "gagal"; }
  const kol = await setorRoomCol();
  const lokal = new Map((await kol.find({}).toArray()).map((x) => [x._id, x]));
  const untung0 = await untungDefault();
  const rooms = mentah.filter((r) => !r.roomType || String(r.roomType).toLowerCase() === "normal").map((r) => {
    const id = String(r.id ?? r.roomId ?? "");
    const harga = Math.floor(Number(r.price) || 0);
    const l = lokal.get(id);
    const untung = l && l.untung !== null && l.untung !== undefined ? Math.max(0, Math.floor(Number(l.untung) || 0)) : untung0;
    const bukaDiPenyedia = (!r.status || String(r.status).toLowerCase() === "active") && !r.closedAt && (!r.roomType || String(r.roomType).toLowerCase() === "normal");
    const upah = hitungUpah(harga, untung);
    const tutupLokal = !!l?.tutup;
    return {
      id, nama: String(r.name || id).slice(0, 80), harga, untung, upah,
      buka: !!id && bukaDiPenyedia && !tutupLokal && upah > 0,
      alasanTutup: !bukaDiPenyedia ? "Ditutup penyedia" : tutupLokal ? "Ditutup admin" : upah <= 0 ? "Harga room terlalu rendah" : ""
    };
  }).filter((r) => r.id);
  cacheRoom = { t: Date.now(), rooms, galat };
  return { rooms, galat };
}
export const lupakanCacheRoom = () => { cacheRoom = { t: 0, rooms: null, galat: "" }; };

// ───────────────────────── STATUS UMUM ─────────────────────────
export async function statusLayanan({ segar = false } = {}) {
  if (!(await nyala("SETORGMAIL_AKTIF"))) return { buka: false, alasan: "Stor Gmail sedang ditutup admin.", rooms: [] };
  if (!(await setorTerkonfigurasi())) return { buka: false, alasan: "Stor Gmail belum tersedia.", rooms: [] };
  const { rooms, galat } = await ambilRoom({ segar });
  if (galat) return { buka: false, alasan: "Stor Gmail ditutup sementara (penyedia tidak bisa dihubungi).", rooms: [] };
  if (!rooms.some((r) => r.buka)) return { buka: false, alasan: "Semua room sedang ditutup. Cek lagi nanti.", rooms };
  return { buka: true, alasan: "", rooms };
}

// ───────────────────────── PENGGUNA ─────────────────────────
const publikEmail = (d) => ({
  email: d.email, status: d.status, room: d.roomNama || null, upah: d.bayarPer || null,
  alasan: ["ditolak"].includes(d.status) ? d.alasan || "" : "", dibuat: d.createdAt, diperbarui: d.updatedAt || d.createdAt
});

export async function infoPengguna(token) {
  const kolU = await usersCol();
  const u = await kolU.findOne({ token }, { projection: { saldoSetor: 1, setorTotal: 1, setorSetuju: 1, suspended: 1, wdSetorTotal: 1 } });
  if (!u) return null;
  const st = await statusLayanan();
  const kol = await setorGmailCol();
  const riwayat = await kol.find({ token }).sort({ createdAt: -1 }).limit(60).toArray();
  const hitung = (s) => riwayat.filter((x) => s.includes(x.status)).length;
  return {
    setuju: u.setorSetuju?.versi === SYARAT_VERSI,
    syaratVersi: SYARAT_VERSI, syarat: SYARAT,
    saldo: u.saldoSetor || 0, totalMasuk: u.setorTotal || 0, totalTarik: u.wdSetorTotal || 0,
    buka: st.buka, alasanTutup: st.alasan,
    rooms: st.rooms.map((r) => ({ id: r.id, nama: r.nama, harga: r.harga, upah: r.upah, buka: r.buka, alasanTutup: r.alasanTutup })),
    ringkas: { belumDisetor: hitung(["digenerate"]), diproses: hitung(["dikirim", "diterima", "menunggu-admin", "mengkredit"]), dibayar: hitung(["dibayar"]), ditolak: hitung(["ditolak"]) },
    riwayat: riwayat.map(publikEmail),
    maks: { generate: Math.min(50, Math.max(1, Math.round(await cfgAngka("SETORGMAIL_MAKS_GENERATE", 20)))) }
  };
}

export async function setujuiSyarat(token, ip = null) {
  const r = await (await usersCol()).updateOne({ token, suspended: { $ne: true } }, { $set: { setorSetuju: { versi: SYARAT_VERSI, at: new Date(), ip } } });
  return r.matchedCount ? { ok: true } : { ok: false, alasan: "Akun tidak ditemukan atau ditangguhkan." };
}

async function pastikanBolehPakai(token) {
  const u = await (await usersCol()).findOne({ token }, { projection: { suspended: 1, setorSetuju: 1 } });
  if (!u) return { ok: false, alasan: "Akun tidak ditemukan." };
  if (u.suspended) return { ok: false, alasan: "Akun ditangguhkan." };
  if (u.setorSetuju?.versi !== SYARAT_VERSI) return { ok: false, alasan: "Baca dan setujui Syarat & Ketentuan dulu." };
  return { ok: true };
}

/** Meminta penyedia membuat email baru. Sandi hanya ditampilkan ke pengguna (tidak disimpan di sini). */
export async function generateEmail(token, jumlah) {
  const izin = await pastikanBolehPakai(token);
  if (!izin.ok) return izin;
  const st = await statusLayanan({ segar: true });
  if (!st.buka) return { ok: false, alasan: st.alasan };
  const maks = Math.min(50, Math.max(1, Math.round(await cfgAngka("SETORGMAIL_MAKS_GENERATE", 20))));
  const n = Math.floor(Number(jumlah));
  if (!Number.isFinite(n) || n < 1) return { ok: false, alasan: "Jumlah email minimal 1." };
  if (n > maks) return { ok: false, alasan: `Maksimal ${maks} email sekali generate.` };
  const kol = await setorGmailCol();
  const maksHari = Math.round(await cfgAngka("SETORGMAIL_MAKS_HARI", 100));
  const hariIni = await kol.countDocuments({ token, createdAt: { $gte: awalHariWib() } });
  if (hariIni + n > maksHari) return { ok: false, alasan: `Batas generate ${maksHari} email per hari. Sisa hari ini ${Math.max(0, maksHari - hariIni)}.` };
  const maksMenunggu = Math.round(await cfgAngka("SETORGMAIL_MAKS_MENUNGGU", 60));
  const menunggu = await kol.countDocuments({ token, status: "digenerate" });
  if (menunggu + n > maksMenunggu) return { ok: false, alasan: `Selesaikan dulu ${menunggu} email yang belum disetor (maks ${maksMenunggu} sekaligus).` };

  const w = await pekerjaDari(token);
  let d;
  try { d = await panggil("/api/external/generate-emails", { method: "POST", body: { count: n, worker: w }, timeout: 25000 }); }
  catch (e) { return { ok: false, alasan: e.ambigu ? "Penyedia tidak menjawab. Coba lagi sebentar." : `Gagal membuat email: ${e.message}` }; }
  const daftar = (Array.isArray(d.emails) ? d.emails : []).map((x) => ({ email: normEmail(typeof x === "string" ? x : x.email), password: typeof x === "string" ? "" : String(x.password || "") })).filter((x) => x.email);
  if (!daftar.length) return { ok: false, alasan: "Penyedia tidak mengembalikan email. Coba lagi." };
  const now = new Date();
  for (const x of daftar) {
    try { await kol.insertOne({ _id: x.email, email: x.email, token, status: "digenerate", createdAt: now, updatedAt: now }); }
    catch (err) { if (err?.code !== 11000) throw err; }
  }
  return { ok: true, emails: daftar };
}

/** Email yang sudah di-generate tapi belum disetor, lengkap dengan sandinya (diambil ulang dari penyedia). */
export async function emailBelumDisetor(token) {
  const izin = await pastikanBolehPakai(token);
  if (!izin.ok) return izin;
  const kol = await setorGmailCol();
  const lokal = await kol.find({ token, status: "digenerate" }).sort({ createdAt: 1 }).limit(200).toArray();
  if (!lokal.length) return { ok: true, emails: [] };
  let sandi = new Map();
  try {
    const d = await panggil("/api/external/generated-emails", { query: qPekerja(await pekerjaDari(token)) });
    for (const x of Array.isArray(d.emails) ? d.emails : []) if (x && x.email) sandi.set(normEmail(x.email), String(x.password || ""));
  } catch {}
  return { ok: true, emails: lokal.map((x) => ({ email: x.email, password: sandi.get(x.email) || "" })), sandiTidakAda: sandi.size === 0 };
}

const ekstrakEmail = (teks) => [...new Set((String(teks || "").match(RE_GMAIL) || []).map(normEmail))];

/** Menyetorkan email ke room. Hanya email hasil generate pengguna itu sendiri & belum pernah dikirim. */
export async function setorkan(token, { roomId, teks, emails }) {
  const izin = await pastikanBolehPakai(token);
  if (!izin.ok) return izin;
  const daftar = Array.isArray(emails) && emails.length ? emails.map(normEmail) : ekstrakEmail(teks);
  if (!daftar.length) return { ok: false, alasan: "Tidak ada alamat Gmail yang valid. Tempel email hasil generate (satu per baris)." };
  if (daftar.length > 50) return { ok: false, alasan: "Maksimal 50 email sekali setor." };
  const st = await statusLayanan({ segar: true });
  if (!st.buka) return { ok: false, alasan: st.alasan };
  // Room dibaca SEGAR tepat sebelum kirim: penyedia menutup room → setoran ikut ditolak di sini.
  const { rooms, galat } = await ambilRoom({ segar: true });
  if (galat) return { ok: false, alasan: "Penyedia tidak bisa dihubungi. Coba lagi sebentar." };
  const room = rooms.find((r) => r.id === String(roomId));
  if (!room) return { ok: false, alasan: "Room tidak ditemukan." };
  if (!room.buka) return { ok: false, alasan: `Room "${room.nama}" tidak menerima setoran (${room.alasanTutup || "tutup"}).` };

  const kol = await setorGmailCol();
  const jobRef = `J${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
  const diklaim = [], tertolak = [];
  for (const e of daftar) {
    const h = await kol.findOneAndUpdate(
      { _id: e, token, status: "digenerate" },
      { $set: { status: "dikirim", jobRef, roomId: room.id, roomNama: room.nama, hargaRoom: room.harga, untung: room.untung, bayarPer: room.upah, dikirimAt: new Date(), updatedAt: new Date() } },
      { returnDocument: "after" }
    );
    if (h) diklaim.push(e); else tertolak.push(e);
  }
  if (!diklaim.length) return { ok: false, alasan: "Email itu bukan hasil generate akunmu, atau sudah pernah disetor." };

  const w = await pekerjaDari(token);
  const job = { jobRef, token, roomId: room.id, emails: diklaim, status: "mengirim", jobId: null, createdAt: new Date(), updatedAt: new Date() };
  const kolJ = await setorJobCol();
  await kolJ.insertOne(job);
  const bank = String((await cfg("SETORGMAIL_BANK")) || "DANA").trim();
  const rek = String((await cfg("SETORGMAIL_REKENING")) || "").trim() || w.id;
  try {
    const d = await panggil("/api/external/deposit", {
      method: "POST", timeout: 30000,
      body: { roomId: room.id, listText: diklaim.join("\n"), withdrawalBank: bank, withdrawalAccount: rek, worker: w, workerRatePerEmail: room.upah }
    });
    await kolJ.updateOne({ jobRef }, { $set: { jobId: d.jobId || null, status: d.processing === false && !d.jobId ? "selesai-langsung" : "proses", updatedAt: new Date(), langsung: d.processing === false ? d : undefined } });
    if (!d.jobId && d.processing === false) await terapkanHasilJob(jobRef, d);
  } catch (e) {
    if (e.ambigu) {
      // Tak tahu sampai mana: JANGAN dilepas. Penyapu mencocokkan ke daftar setoran penyedia.
      await kolJ.updateOne({ jobRef }, { $set: { status: "tidak-pasti", pesan: e.message, updatedAt: new Date() } });
      return { ok: true, jobRef, tertolak, diproses: diklaim.length, tidakPasti: true };
    }
    await kolJ.updateOne({ jobRef }, { $set: { status: "gagal", pesan: e.message, updatedAt: new Date() } });
    await kol.updateMany({ jobRef, status: "dikirim" }, { $set: { status: "digenerate", updatedAt: new Date() }, $unset: { jobRef: "", roomId: "", roomNama: "", hargaRoom: "", untung: "", bayarPer: "", dikirimAt: "" } });
    return { ok: false, alasan: `Penyedia menolak setoran: ${e.message}` };
  }
  return { ok: true, jobRef, tertolak, diproses: diklaim.length, room: room.nama, upah: room.upah };
}

// ───────────────────────── HASIL SETORAN ─────────────────────────
const emailDariItem = (x) => normEmail(typeof x === "string" ? x : x?.email || x?.gmail || "");
const alasanDariItem = (x) => (typeof x === "string" ? "" : String(x?.reason || x?.error || x?.message || "").slice(0, 160));

/** Menerapkan jawaban job (accepted/duplicates/errors) ke email lokal. */
async function terapkanHasilJob(jobRef, d) {
  const kol = await setorGmailCol();
  const now = new Date();
  for (const x of Array.isArray(d.accepted) ? d.accepted : []) {
    const e = emailDariItem(x);
    if (e) await kol.updateOne({ _id: e, jobRef, status: "dikirim" }, { $set: { status: "diterima", diterimaAt: now, updatedAt: now } });
  }
  for (const [kunciArr, teks] of [["duplicates", "Email ganda / sudah pernah disetor"], ["errors", "Ditolak penyedia"]]) {
    for (const x of Array.isArray(d[kunciArr]) ? d[kunciArr] : []) {
      const e = emailDariItem(x);
      if (e) await kol.updateOne({ _id: e, jobRef, status: "dikirim" }, { $set: { status: "ditolak", alasan: alasanDariItem(x) || teks, updatedAt: now } });
    }
  }
  await (await setorJobCol()).updateOne({ jobRef }, { $set: { status: "selesai", selesaiAt: now, updatedAt: now, hasil: { diterima: (d.accepted || []).length, ganda: (d.duplicates || []).length, galat: (d.errors || []).length } } });
  // Email di job yang tidak disebut sama sekali di jawaban akhir: biarkan "dikirim"; penyapu mencocokkan ke daftar setoran.
}

async function sinkronJob(job) {
  if (!job.jobId) return false;
  let d;
  try { d = await panggil(`/api/external/deposit-job/${encodeURIComponent(job.jobId)}`); } catch { return false; }
  if (d.processing || String(d.status).toLowerCase() === "processing") return false;
  if (String(d.status || "").toLowerCase() === "done" || d.accepted || d.duplicates || d.errors) { await terapkanHasilJob(job.jobRef, d); return true; }
  return false;
}

const klasifikasi = async (status) => {
  const s = String(status || "").toLowerCase().trim();
  if (daftarKoma(await cfg("SETORGMAIL_STATUS_TOLAK") ?? "rejected,denied,declined,failed,invalid,refunded,ditolak,gagal,expired,canceled,cancelled").includes(s)) return "tolak";
  if (daftarKoma((await cfg("SETORGMAIL_STATUS_OK")) ?? "approved,accepted,success,paid,done,verified,completed,selesai,diterima,berhasil").includes(s)) return "ok";
  return "tunggu";
};

/** Mencocokkan status setoran dari penyedia ke email lokal milik satu pekerja; kredit / tolak sesuai statusnya. */
async function sinkronPekerja(token) {
  const w = await pekerjaDari(token);
  let d;
  try { d = await panggil("/api/external/worker/deposits", { query: qPekerja(w), timeout: 20000 }); } catch { return { dikredit: 0, jumlah: 0 }; }
  const kol = await setorGmailCol();
  const lokal = await kol.find({ token, status: { $in: ["diterima", "dikirim"] } }).limit(300).toArray();
  const peta = new Map(lokal.map((x) => [x._id, x]));
  const otomatis = await nyala("SETORGMAIL_KREDIT_OTOMATIS");
  const statusKolom = await setorGmailCol();
  let dikredit = 0, jumlah = 0;
  for (const p of Array.isArray(d.deposits) ? d.deposits : []) {
    const e = normEmail(p.gmail || p.email);
    const doc = peta.get(e);
    if (!doc) continue;
    const st = String(p.status || "").toLowerCase();
    await statusKolom.updateOne({ _id: e }, { $set: { statusPenyedia: st, depId: p.id || null, alasanPenyedia: String(p.reason || "").slice(0, 160), updatedAt: new Date() } });
    const k = await klasifikasi(st);
    if (k === "tolak") {
      await statusKolom.updateOne({ _id: e, status: { $in: ["diterima", "dikirim"] } }, { $set: { status: "ditolak", alasan: String(p.reason || "").slice(0, 160) || "Ditolak setelah pemeriksaan", updatedAt: new Date() } });
    } else if (k === "ok") {
      if (!otomatis) { await statusKolom.updateOne({ _id: e, status: { $in: ["diterima", "dikirim"] } }, { $set: { status: "menunggu-admin", updatedAt: new Date() } }); continue; }
      const jml = await kreditkan(doc._id);
      if (jml) { dikredit++; jumlah += jml; }
    } else if (doc.status === "dikirim") {
      // Penyedia sudah mencatat setoran ini (status menunggu): pindahkan ke "diterima" agar tidak dianggap hilang.
      await statusKolom.updateOne({ _id: e, status: "dikirim" }, { $set: { status: "diterima", diterimaAt: new Date(), updatedAt: new Date() } });
    }
  }
  if (dikredit) await kabariUpah(token, dikredit, jumlah);
  return { dikredit, jumlah };
}

/** Kredit upah SATU email, idempoten. Mengembalikan nominal yang dikreditkan sekarang (0 bila sudah/ tidak bisa). */
async function kreditkan(id) {
  const kol = await setorGmailCol();
  const d = await kol.findOneAndUpdate({ _id: id, status: { $in: AKTIF_KREDIT } }, { $set: { status: "mengkredit", kreditAt: new Date(), updatedAt: new Date() } }, { returnDocument: "after" });
  if (!d) return 0;
  return terapkanKredit(d);
}
async function terapkanKredit(d) {
  const kolU = await usersCol();
  const ref = `setor:${d._id}`;
  const upah = Math.max(0, Math.floor(d.bayarPer || 0));
  let dikredit = 0;
  if (upah > 0) {
    const h = await kolU.findOneAndUpdate(
      { token: d.token, setorRef: { $ne: ref } },
      { $inc: { saldoSetor: upah, setorTotal: upah }, $push: { setorRef: { $each: [ref], $slice: -500 } } },
      { returnDocument: "after" }
    );
    if (h) { dikredit = upah; await logBalance({ token: d.token, type: "setor_masuk", amount: upah, balanceAfter: h.saldoSetor, title: `Upah Stor Gmail ${d.email}`, ref, wallet: "setor" }); }
  }
  await (await setorGmailCol()).updateOne({ _id: d._id, status: "mengkredit" }, { $set: { status: "dibayar", dibayarAt: new Date(), updatedAt: new Date() } });
  return dikredit;
}

async function kabariUpah(token, n, jumlah) {
  try { await (await userNotificationsCol()).insertOne({ token, type: "setor_gmail", title: "💰 Upah Stor Gmail masuk", body: `${n} akun Gmail-mu diterima. Saldo Stor +${rp(jumlah)}.`, read: false, createdAt: new Date(), url: "/setor-gmail" }); } catch {}
  await kirimPush(token, { judul: "💰 Upah Stor Gmail masuk", isi: `${n} akun diterima · +${rp(jumlah)}`, url: "/setor-gmail", tag: "setor-upah" }).catch(() => {});
}

const sinkronTerakhir = new Map(); // token → waktu
/** Dipanggil saat pengguna membuka halaman / menekan Segarkan: perbarui job & status miliknya (maks 1× per 8 dtk). */
export async function segarkanPengguna(token) {
  if (Date.now() - (sinkronTerakhir.get(token) || 0) < 8000) return { dilewati: true };
  sinkronTerakhir.set(token, Date.now());
  if (sinkronTerakhir.size > 3000) sinkronTerakhir.clear();
  if (!(await setorTerkonfigurasi())) return { dilewati: true };
  const kolJ = await setorJobCol();
  for (const j of await kolJ.find({ token, status: "proses" }).limit(5).toArray()) await sinkronJob(j);
  return sinkronPekerja(token);
}

// ───────────────────────── PENYAPU ─────────────────────────
let sapuTerakhir = 0;
/** Memulihkan yang macet: job yang belum dibaca, setoran menunggu, kiriman yang tidak pasti, kredit setengah jalan. */
export async function sapuSetorGmail({ maks = 20, jeda = 20_000 } = {}) {
  if (Date.now() - sapuTerakhir < jeda) return { dilewati: true };
  sapuTerakhir = Date.now();
  if (!(await setorTerkonfigurasi())) return { dilewati: true };
  const kolJ = await setorJobCol();
  const kol = await setorGmailCol();
  let n = 0;
  // 1) kredit yang terhenti di tengah jalan → ulangi (idempoten)
  for (const d of await kol.find({ status: "mengkredit", kreditAt: { $lt: new Date(Date.now() - 2 * MENIT) } }).limit(maks).toArray()) { await terapkanKredit(d); n++; }
  // 2) job yang berjalan
  for (const j of await kolJ.find({ status: "proses", createdAt: { $lt: new Date(Date.now() - 3_000) } }).limit(maks).toArray()) { await sinkronJob(j); n++; }
  // 3) email yang "dikirim" lebih dari 12 menit (hasil tak pasti / job tak melaporkannya): cocokkan ke daftar setoran penyedia.
  //    Ada jejaknya → "diterima"; tidak ada → dilepas supaya bisa disetor ulang. Job yang masih "proses" < 60 menit ditunggu.
  const basi = await kol.find({ status: "dikirim", dikirimAt: { $lt: new Date(Date.now() - BASI_MS()) } }).limit(200).toArray();
  if (basi.length) {
    const jobs = new Map((await kolJ.find({ jobRef: { $in: [...new Set(basi.map((x) => x.jobRef))] } }).toArray()).map((j) => [j.jobRef, j]));
    const perToken = new Map();
    for (const d of basi) {
      const j = jobs.get(d.jobRef);
      if (j && j.status === "proses" && Date.now() - new Date(j.createdAt).getTime() < 60 * MENIT) continue;
      (perToken.get(d.token) || perToken.set(d.token, []).get(d.token)).push(d);
    }
    for (const [token, docs] of perToken) {
      let ada;
      try { ada = new Set(((await panggil("/api/external/worker/deposits", { query: qPekerja(await pekerjaDari(token)), timeout: 20000 })).deposits || []).map((p) => normEmail(p.gmail || p.email))); } catch { continue; }
      for (const d of docs) {
        if (ada.has(d._id)) await kol.updateOne({ _id: d._id, status: "dikirim" }, { $set: { status: "diterima", diterimaAt: new Date(), updatedAt: new Date() } });
        else await kol.updateOne({ _id: d._id, status: "dikirim" }, { $set: { status: "digenerate", updatedAt: new Date() }, $unset: { jobRef: "", roomId: "", roomNama: "", hargaRoom: "", untung: "", bayarPer: "", dikirimAt: "" } });
        n++;
      }
    }
    await kolJ.updateMany({ jobRef: { $in: [...jobs.keys()] }, status: { $in: ["mengirim", "tidak-pasti"] } }, { $set: { status: "selesai", dicocokkan: true, selesaiAt: new Date() } });
  }
  // 4) setoran yang menunggu putusan penyedia: per pekerja, paling lama dulu
  const menunggu = await kol.aggregate([{ $match: { status: { $in: ["diterima", "dikirim"] }, updatedAt: { $lt: new Date(Date.now() - 5_000) } } }, { $group: { _id: "$token", t: { $min: "$updatedAt" } } }, { $sort: { t: 1 } }, { $limit: 8 }]).toArray();
  for (const m of menunggu) { await sinkronPekerja(m._id); n++; }
  return { diproses: n };
}

// ───────────────────────── ADMIN ─────────────────────────
export async function ringkasAdmin() {
  const kol = await setorGmailCol();
  const [semua, saldoAgg, statusAgg, penyediaAgg] = await Promise.all([
    kol.countDocuments({}),
    (await usersCol()).aggregate([{ $group: { _id: null, saldo: { $sum: "$saldoSetor" }, total: { $sum: "$setorTotal" }, tarik: { $sum: "$wdSetorTotal" } } }]).toArray(),
    kol.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]).toArray(),
    kol.aggregate([{ $match: { statusPenyedia: { $exists: true } } }, { $group: { _id: "$statusPenyedia", n: { $sum: 1 } } }]).toArray()
  ]);
  const per = Object.fromEntries(statusAgg.map((x) => [x._id, x.n]));
  const untung = (await kol.aggregate([{ $match: { status: "dibayar" } }, { $group: { _id: null, u: { $sum: "$untung" } } }]).toArray())[0]?.u || 0;
  return {
    totalEmail: semua, perStatus: per,
    saldoPengguna: saldoAgg[0]?.saldo || 0, upahDibayar: saldoAgg[0]?.total || 0, sudahDitarik: saldoAgg[0]?.tarik || 0,
    untungTercatat: untung,
    statusPenyedia: penyediaAgg.map((x) => ({ status: x._id, jumlah: x.n }))
  };
}

export async function daftarAdmin({ status = "semua", limit = 60 } = {}) {
  const kol = await setorGmailCol();
  const f = status === "semua" ? {} : { status };
  const items = await kol.find(f).sort({ updatedAt: -1 }).limit(Math.min(150, limit)).toArray();
  return items.map((d) => ({ email: d.email, token: `${d.token.slice(0, 4)}••••${d.token.slice(-4)}`, status: d.status, statusPenyedia: d.statusPenyedia || null, room: d.roomNama || null, harga: d.hargaRoom || null, untung: d.untung ?? null, upah: d.bayarPer || null, alasan: d.alasan || d.alasanPenyedia || "", at: d.updatedAt || d.createdAt }));
}

/** Putusan manual admin: "setuju" (bayar upah) atau "tolak". Idempoten. */
export async function putusanManual(email, aksi, alasan = "") {
  const e = normEmail(email);
  const kol = await setorGmailCol();
  const d = await kol.findOne({ _id: e });
  if (!d) return { ok: false, alasan: "Email tidak ditemukan." };
  if (aksi === "tolak") {
    const r = await kol.updateOne({ _id: e, status: { $in: ["diterima", "dikirim", "menunggu-admin", "digenerate"] } }, { $set: { status: "ditolak", alasan: String(alasan || "Ditolak admin").slice(0, 160), updatedAt: new Date() } });
    return r.modifiedCount ? { ok: true } : { ok: false, alasan: `Status "${d.status}" tidak bisa ditolak.` };
  }
  if (aksi === "setuju") {
    if (!d.bayarPer) return { ok: false, alasan: "Email ini belum pernah dikirim ke room (tidak ada upah terkunci)." };
    const jml = await kreditkan(e);
    if (!jml) return { ok: false, alasan: `Status "${d.status}" tidak bisa disetujui (sudah dibayar / ditolak).` };
    await kabariUpah(d.token, 1, jml);
    return { ok: true, dibayar: jml };
  }
  return { ok: false, alasan: "Aksi tidak dikenal." };
}

export async function aturRoom(roomId, { untung, tutup }) {
  const kol = await setorRoomCol();
  const set = { updatedAt: new Date() };
  if (untung !== undefined) {
    if (untung === null || untung === "") set.untung = null;
    else { const u = Math.floor(Number(untung)); if (!Number.isFinite(u) || u < 0) return { ok: false, alasan: "Untung harus angka ≥ 0." }; set.untung = u; }
  }
  if (tutup !== undefined) set.tutup = !!tutup;
  await kol.updateOne({ _id: String(roomId) }, { $set: set }, { upsert: true });
  lupakanCacheRoom();
  return { ok: true };
}

export async function tesKoneksi() {
  if (!(await setorTerkonfigurasi())) return { ok: false, alasan: "API key belum diisi (Admin → Konfigurasi → Stor Gmail)." };
  lupakanCacheRoom();
  const { rooms, galat } = await ambilRoom({ segar: true });
  if (galat) return { ok: false, alasan: galat };
  return { ok: true, rooms };
}
