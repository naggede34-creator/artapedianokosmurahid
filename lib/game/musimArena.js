// SEASON ARENA PENDEKAR — peringkat musiman, turnamen mingguan, dan hadiah otomatis.
//
//  • MUSIM   = 1 bulan kalender (WIB), id "2026-10". Peringkat memakai rating ELO (mulai 1000) dari duel Arena Pendekar
//              antar pemain. Akhir musim: pemain teratas yang cukup bermain dapat hadiah saldo game.
//  • MINGGU  = Senin–Minggu (WIB), id = tanggal Senin-nya. Turnamen mingguan: tiap kemenangan sah +3 poin turnamen;
//              pemain teratas mendapat hadiah saldo game saat pekan berganti.
//
// ANTI-FARMING: hanya duel yang (1) ada pemenang, (2) berlangsung ≥ ARENA_MIN_DETIK, (3) melibatkan dua akun yang lolos
// anti-curang (satu perangkat/IP tidak bisa saling duel), (4) tidak melewati batas ARENA_MAKS_PASANGAN duel yang
// dihitung antara pasangan yang sama per hari, dan (5) tidak melewati ARENA_MAKS_HARI duel yang dihitung per pemain per hari. Tiap duel hanya dicatat sekali (_id = gameId).
//
// UANG: hadiah dikredit lewat kreditIdem() (atomik + tanda idempotensi `arena:<periode>:<pid>`), jadi proses yang
// diulang/crash tidak pernah membayar dua kali. Dokumen klaim periode (`arena_hadiah`) dibuat dengan insert unik.
import { getDb } from "@/lib/db";
import { cfg, cfgAngka } from "@/lib/config";
import { logBalance } from "@/lib/ledger";
import { petaProfil } from "@/lib/wa/inti";
import { tanggalWib } from "@/lib/musim";

const HARI = 86_400_000;
const WIB = 7 * 3600_000;
const RATING_AWAL = 1000;
const RATING_MIN = 100;
const K = 24;
const POIN_MENANG = 3;

const skor = async () => (await getDb()).collection("arena_skor");
const catatCol = async () => (await getDb()).collection("arena_catat");
const hadiahCol = async () => (await getDb()).collection("arena_hadiah");

// ───────────────────────── PERIODE ─────────────────────────
const keMs = (ymd) => Date.parse(`${ymd}T00:00:00Z`);
const tambah = (ymd, n) => new Date(keMs(ymd) + n * HARI).toISOString().slice(0, 10);
export const idMusim = (ymd = tanggalWib()) => ymd.slice(0, 7);
export const idMinggu = (ymd = tanggalWib()) => tambah(ymd, -((new Date(`${ymd}T00:00:00Z`).getUTCDay() + 6) % 7));
const awalBulanDepan = (m) => { const [y, b] = m.split("-").map(Number); return b === 12 ? `${y + 1}-01-01` : `${y}-${String(b + 1).padStart(2, "0")}-01`; };
const bulanLalu = (m) => { const [y, b] = m.split("-").map(Number); return b === 1 ? `${y - 1}-12` : `${y}-${String(b - 1).padStart(2, "0")}`; };
export const akhirMusimMs = (m = idMusim()) => keMs(awalBulanDepan(m)) - WIB;
export const akhirMingguMs = (w = idMinggu()) => keMs(tambah(w, 7)) - WIB;

export const TINGKAT = [
  { min: 1400, nama: "Legenda", ikon: "🐉" },
  { min: 1250, nama: "Platinum", ikon: "💎" },
  { min: 1100, nama: "Emas", ikon: "🥇" },
  { min: 950, nama: "Perak", ikon: "🥈" },
  { min: 0, nama: "Perunggu", ikon: "🥉" }
];
export const tingkatDari = (r) => TINGKAT.find((t) => r >= t.min) || TINGKAT[TINGKAT.length - 1];

// ───────────────────────── KONFIGURASI ─────────────────────────
const daftarRp = (teks, bawaan) => {
  const arr = String(teks ?? "").split(/[,;\s]+/).map((x) => Math.round(Number(x))).filter((n) => Number.isFinite(n) && n > 0).slice(0, 10);
  return arr.length ? arr : bawaan;
};
export async function konfigArena() {
  return {
    aktif: String((await cfg("ARENA_MUSIM_AKTIF")) ?? "1") !== "0",
    hadiahMusim: daftarRp(await cfg("ARENA_HADIAH_MUSIM"), [50000, 25000, 10000]),
    hadiahMinggu: daftarRp(await cfg("ARENA_HADIAH_MINGGU"), [20000, 10000, 5000]),
    minMainMusim: Math.max(1, Math.round(await cfgAngka("ARENA_MIN_MAIN_MUSIM", 8))),
    minMainMinggu: Math.max(1, Math.round(await cfgAngka("ARENA_MIN_MAIN_MINGGU", 3))),
    minDetik: Math.max(0, Math.round(await cfgAngka("ARENA_MIN_DETIK", 25))),
    maksPasangan: Math.max(1, Math.round(await cfgAngka("ARENA_MAKS_PASANGAN", 3))),
    maksHari: Math.max(1, Math.round(await cfgAngka("ARENA_MAKS_HARI", 15)))
  };
}

// ───────────────────────── PENCATATAN HASIL DUEL ─────────────────────────
/** Dipanggil setelah duel Arena Pendekar ditutup. Tidak pernah melempar. Mengembalikan alasan teks (untuk uji) atau "dicatat". */
export async function catatArena(g) {
  try {
    if (!g || g.jenis !== "tarung") return "bukan-arena";
    const k = await konfigArena();
    if (!k.aktif) return "mati";
    const h = g.hasil || {};
    const [a, b] = g.pemain || [];
    if (!h.pemenang || h.seri || !a?.pid || !b?.pid || !a?.token || !b?.token) return "tanpa-pemenang";
    const durasi = g.mulaiAt && g.selesaiAt ? new Date(g.selesaiAt) - new Date(g.mulaiAt) : 0;
    const menang = h.pemenang === a.pid ? a : b;
    const kalah = menang === a ? b : a;
    const hari = tanggalWib();
    const pasangan = [a.pid, b.pid].sort().join("|");

    const cc = await catatCol();
    try { await cc.insertOne({ _id: g.gameId, pasangan, hari, at: new Date(), dihitung: false }); } catch (e) { if (e?.code === 11000) return "sudah"; throw e; }
    if (durasi < k.minDetik * 1000) return "terlalu-cepat";
    if ((await cc.countDocuments({ pasangan, hari, dihitung: true })) >= k.maksPasangan) return "batas-pasangan";
    // Batas total per pemain per hari: memperlambat peternakan peringkat lewat banyak akun boneka.
    for (const p of [menang, kalah]) {
      if ((await cc.countDocuments({ hari, dihitung: true, $or: [{ menang: p.pid }, { kalah: p.pid }] })) >= k.maksHari) return "batas-harian";
    }
    await cc.updateOne({ _id: g.gameId }, { $set: { dihitung: true, menang: menang.pid, kalah: kalah.pid } });

    const sk = await skor();
    const musim = idMusim(hari), minggu = idMinggu(hari);
    const [rm, rk] = await Promise.all([sk.findOne({ _id: `m:${musim}:${menang.pid}` }), sk.findOne({ _id: `m:${musim}:${kalah.pid}` })]);
    const r1 = rm?.rating ?? RATING_AWAL, r2 = rk?.rating ?? RATING_AWAL;
    const harap = 1 / (1 + 10 ** ((r2 - r1) / 400));
    const delta = Math.max(4, Math.round(K * (1 - harap)));
    const turun = Math.min(delta, Math.max(0, r2 - RATING_MIN));
    const awal = (p) => ({ pid: p.pid, token: p.token, nama: p.nama, jenis: "musim", periode: musim });
    const awalM = (p) => ({ pid: p.pid, token: p.token, nama: p.nama, jenis: "minggu", periode: minggu });
    await Promise.all([
      sk.updateOne({ _id: `m:${musim}:${menang.pid}` }, { $set: awal(menang), $setOnInsert: { rating0: RATING_AWAL }, $inc: { rating: delta + (rm ? 0 : RATING_AWAL), main: 1, menang: 1 } }, { upsert: true }),
      sk.updateOne({ _id: `m:${musim}:${kalah.pid}` }, { $set: awal(kalah), $setOnInsert: { rating0: RATING_AWAL }, $inc: { rating: -turun + (rk ? 0 : RATING_AWAL), main: 1, kalah: 1 } }, { upsert: true }),
      sk.updateOne({ _id: `w:${minggu}:${menang.pid}` }, { $set: awalM(menang), $inc: { poin: POIN_MENANG, main: 1, menang: 1 } }, { upsert: true }),
      sk.updateOne({ _id: `w:${minggu}:${kalah.pid}` }, { $set: awalM(kalah), $inc: { poin: 0, main: 1 } }, { upsert: true })
    ]);
    try { const { sumbangKlan } = await import("@/lib/klan"); await sumbangKlan(menang.token, "menang", 1); await sumbangKlan(kalah.token, "main", 1); } catch {}
    return "dicatat";
  } catch (err) {
    console.error("[arena-musim] catat:", err?.message || err);
    return "galat";
  }
}

// ───────────────────────── PAPAN ─────────────────────────
const urutMusim = { rating: -1, menang: -1, main: 1, pid: 1 };
const urutMinggu = { poin: -1, menang: -1, main: 1, pid: 1 };

async function papan(jenis, periode, batas, min, me) {
  const sk = await skor();
  const saring = { jenis, periode };
  const urut = jenis === "musim" ? urutMusim : urutMinggu;
  const baris = await sk.find({ ...saring, main: { $gte: 1 } }).sort(urut).limit(batas).toArray();
  const profil = await petaProfil(baris.map((r) => r.pid));
  const daftar = baris.map((r, i) => ({
    peringkat: i + 1, pid: r.pid, nama: profil[r.pid]?.nama || r.nama || "Pemain", fotoV: profil[r.pid]?.fotoV || 0,
    main: r.main || 0, menang: r.menang || 0, ...(jenis === "musim" ? { rating: r.rating ?? RATING_AWAL, tingkat: tingkatDari(r.rating ?? RATING_AWAL) } : { poin: r.poin || 0 }),
    layak: (r.main || 0) >= min, saya: r.pid === me?.pid
  }));
  let saya = null;
  if (me?.pid) {
    const d = await sk.findOne({ _id: `${jenis === "musim" ? "m" : "w"}:${periode}:${me.pid}` });
    if (d) {
      const lebih = jenis === "musim"
        ? await sk.countDocuments({ ...saring, main: { $gte: 1 }, $or: [{ rating: { $gt: d.rating } }, { rating: d.rating, menang: { $gt: d.menang || 0 } }] })
        : await sk.countDocuments({ ...saring, main: { $gte: 1 }, $or: [{ poin: { $gt: d.poin || 0 } }, { poin: d.poin || 0, menang: { $gt: d.menang || 0 } }] });
      saya = { peringkat: lebih + 1, main: d.main || 0, menang: d.menang || 0, kalah: d.kalah || 0, layak: (d.main || 0) >= min, ...(jenis === "musim" ? { rating: d.rating ?? RATING_AWAL, tingkat: tingkatDari(d.rating ?? RATING_AWAL) } : { poin: d.poin || 0 }) };
    } else saya = jenis === "musim" ? { peringkat: null, main: 0, menang: 0, kalah: 0, rating: RATING_AWAL, tingkat: tingkatDari(RATING_AWAL), layak: false } : { peringkat: null, main: 0, menang: 0, poin: 0, layak: false };
  }
  return { daftar, saya };
}

/** Juara periode lalu (dari klaim hadiah) untuk "Hall of Fame" singkat. */
async function juaraLalu(jenis) {
  const baris = await (await hadiahCol()).find({ jenis, status: { $in: ["proses", "lunas"] } }).sort({ periode: -1 }).limit(1).toArray();
  const r = baris[0];
  if (!r) return null;
  return { periode: r.periode, pemenang: (r.pemenang || []).slice(0, 3).map((p) => ({ nama: p.nama, peringkat: p.peringkat, hadiah: p.hadiah })) };
}

export async function ringkasanArena(me) {
  const k = await konfigArena();
  const musim = idMusim(), minggu = idMinggu();
  const [m, w, jm, jw] = await Promise.all([papan("musim", musim, 20, k.minMainMusim, me), papan("minggu", minggu, 20, k.minMainMinggu, me), juaraLalu("musim"), juaraLalu("minggu")]);
  return {
    aktif: k.aktif,
    musim: { id: musim, sisaMs: Math.max(0, akhirMusimMs(musim) - Date.now()), hadiah: k.hadiahMusim, minMain: k.minMainMusim, papan: m.daftar, saya: m.saya, juaraLalu: jm },
    minggu: { id: minggu, sisaMs: Math.max(0, akhirMingguMs(minggu) - Date.now()), hadiah: k.hadiahMinggu, minMain: k.minMainMinggu, papan: w.daftar, saya: w.saya, juaraLalu: jw },
    aturan: { poinMenang: POIN_MENANG, ratingAwal: RATING_AWAL, minDetik: k.minDetik, maksPasangan: k.maksPasangan },
    tingkat: TINGKAT.slice().reverse()
  };
}

// ───────────────────────── HADIAH AKHIR PERIODE ─────────────────────────
async function susunPemenang(jenis, periode, k) {
  const sk = await skor();
  const hadiah = jenis === "musim" ? k.hadiahMusim : k.hadiahMinggu;
  const min = jenis === "musim" ? k.minMainMusim : k.minMainMinggu;
  const urut = jenis === "musim" ? urutMusim : urutMinggu;
  const kolUser = (await getDb()).collection("users");
  const calon = await sk.find({ jenis, periode, main: { $gte: min } }).sort(urut).limit(hadiah.length + 15).toArray();
  const hasil = [];
  for (const c of calon) {
    if (hasil.length >= hadiah.length) break;
    // Skor nol (mingguan tanpa kemenangan) tidak berhak hadiah; akun yang dibekukan dilewati.
    if (jenis === "minggu" && !(c.poin > 0)) continue;
    const u = await kolUser.findOne({ token: c.token }, { projection: { suspended: 1 } });
    if (!u || u.suspended) continue;
    hasil.push({ peringkat: hasil.length + 1, pid: c.pid, token: c.token, nama: c.nama || "Pemain", hadiah: hadiah[hasil.length], ref: `arena:${jenis}:${periode}:${c.pid}`, lunas: false, ...(jenis === "musim" ? { rating: c.rating } : { poin: c.poin }) });
  }
  return hasil;
}

async function bayarKlaim(klaim) {
  const { kreditIdem, kabari } = await import("@/lib/game/inti");
  const col = await hadiahCol();
  let semua = true;
  for (const p of klaim.pemenang || []) {
    if (p.lunas) continue;
    const r = await kreditIdem(p.token, p.hadiah, p.ref, "saldoGame");
    if (!r.ok) { semua = false; continue; }
    if (r.baru) {
      await logBalance({ token: p.token, type: "arena_hadiah", amount: p.hadiah, balanceAfter: r.saldo, title: `Hadiah ${klaim.jenis === "musim" ? "Season" : "Turnamen Mingguan"} Arena — peringkat ${p.peringkat}`, ref: p.ref, wallet: "game" });
      await kabari(p.token, {
        judul: `🏆 Peringkat ${p.peringkat} ${klaim.jenis === "musim" ? "Season Arena" : "Turnamen Mingguan"}!`,
        isi: `Selamat! Kamu juara ke-${p.peringkat} di Arena Pendekar (${klaim.periode}). Hadiah Rp${p.hadiah.toLocaleString("id-ID")} sudah masuk Saldo Game.`,
        url: "/chat?game=tarung", tipe: "arena_hadiah", meta: { peringkat: p.peringkat, hadiah: p.hadiah, periode: klaim.periode, jenis: klaim.jenis }
      });
    }
    await col.updateOne({ _id: klaim._id, "pemenang.ref": p.ref }, { $set: { "pemenang.$.lunas": true } });
  }
  if (semua) await col.updateOne({ _id: klaim._id }, { $set: { status: "lunas", lunasAt: new Date() } });
  return semua;
}

/** Menutup musim & pekan yang sudah lewat dan membayar hadiahnya. Aman dipanggil berulang (cron / saat papan dibuka). */
export async function selesaikanPeriode() {
  let diproses = 0;
  try {
    const k = await konfigArena();
    if (!k.aktif) return { diproses };
    const col = await hadiahCol();
    const sk = await skor();
    const hariIni = tanggalWib();
    const kandidat = [];
    let m = bulanLalu(idMusim(hariIni));
    for (let i = 0; i < 2; i++, m = bulanLalu(m)) kandidat.push(["musim", m]);
    let w = tambah(idMinggu(hariIni), -7);
    for (let i = 0; i < 4; i++, w = tambah(w, -7)) kandidat.push(["minggu", w]);
    for (const [jenis, periode] of kandidat) {
      const id = `${jenis}:${periode}`;
      if (await col.findOne({ _id: id }, { projection: { _id: 1 } })) continue;
      if (!(await sk.findOne({ jenis, periode, main: { $gte: 1 } }, { projection: { _id: 1 } }))) continue;
      try { await col.insertOne({ _id: id, jenis, periode, status: "menyusun", at: new Date() }); } catch (e) { if (e?.code === 11000) continue; throw e; }
      const pemenang = await susunPemenang(jenis, periode, k);
      await col.updateOne({ _id: id }, { $set: { pemenang, status: "proses", disusunAt: new Date() } });
      diproses++;
    }
    // Bayar / lanjutkan yang belum lunas. "menyusun" yang macet >5 menit disusun ulang.
    for (const kl of await col.find({ status: "proses" }).limit(20).toArray()) { await bayarKlaim(kl); diproses++; }
    for (const kl of await col.find({ status: "menyusun", at: { $lt: new Date(Date.now() - 5 * 60_000) } }).limit(5).toArray()) {
      const pemenang = await susunPemenang(kl.jenis, kl.periode, k);
      await col.updateOne({ _id: kl._id, status: "menyusun" }, { $set: { pemenang, status: "proses", disusunAt: new Date() } });
      diproses++;
    }
  } catch (err) {
    console.error("[arena-musim] selesaikan:", err?.message || err);
  }
  return { diproses };
}

// ───────────────────────── ADMIN ─────────────────────────
export async function ringkasanAdminArena() {
  const col = await hadiahCol();
  const klaim = await col.find({}).sort({ at: -1 }).limit(12).toArray();
  return { riwayat: klaim.map((x) => ({ id: x._id, jenis: x.jenis, periode: x.periode, status: x.status, total: (x.pemenang || []).reduce((s, p) => s + p.hadiah, 0), pemenang: (x.pemenang || []).map((p) => ({ peringkat: p.peringkat, nama: p.nama, hadiah: p.hadiah, lunas: !!p.lunas })) })) };
}
