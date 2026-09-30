// Game solo: Plinko & Mahjong Spin 1024. Server-otoritatif — hasil ditentukan di server dengan
// acak kriptografis SEBELUM taruhan dipotong; klien hanya menganimasikan.
//
// ── MODE ─────────────────────────────────────────────────────────────────────
//  demo  : memakai KOIN LATIHAN (`users.koinGame`), tanpa risiko saldo. Selalu tersedia bila game solo aktif.
//  saldo : memakai saldo sungguhan. Mati kecuali admin menyalakan GAME_KASINO_AKTIF. Ini permainan untung-
//          untungan (judi) — legalitasnya berbeda di tiap negara; admin bertanggung jawab menyalakannya.
//          Dilengkapi batas taruhan, batas rugi harian, dan batas kemenangan per putaran.
//
// ── KEAMANAN UANG ────────────────────────────────────────────────────────────
// Sama seperti duel (lihat lib/game/inti.js): tiap potong/bayar adalah SATU pembaruan atomik pada dokumen
// pengguna yang sekaligus menulis kunci idempotensi (`gameBayar`). Ronde disimpan di `game_solo` dengan hasil
// yang sudah ditetapkan; jika proses mati di tengah jalan, penyapu (`sapuSolo`) memeriksa kunci: sudah
// terpotong → bayar hadiah (sekali), belum → batalkan. Satu ronde per pengguna per waktu (kunci pendek).
import { randomBytes, randomUUID } from "node:crypto";
import { gameSoloCol, usersCol, userNotificationsCol } from "@/lib/db";
import { cfg } from "@/lib/config";
import { teksPoinRp } from "@/lib/poinGame";
import { logBalance } from "@/lib/ledger";
import { kirimPush } from "@/lib/webPush";
import { umumkan } from "@/lib/notifyHub";
import { perluNama, ALASAN_NAMA } from "@/lib/wa/inti";
import * as plinko from "@/lib/game/plinko";
import * as slot from "@/lib/game/slotmj";

const PANJANG_TANDA = 300;
const KUNCI_MS = 8000; // kunci per pengguna (dilepas begitu ronde selesai; ini pengaman bila proses mati)
const MACET_MS = 90_000;
// Semua nominal game ditampilkan sebagai poin + padanan rupiahnya (2 poin = Rp1.000).
const rupiah = (n) => teksPoinRp(n);

export const DAFTAR_SOLO = [
  { ...plinko.info, solo: true },
  { ...slot.info, kode: "slot", solo: true }
];

// Acak kriptografis, dibagi per 4 byte → [0,1) dengan 32 bit presisi.
function bikinRng() {
  let buf = randomBytes(4096), i = 0;
  return () => {
    if (i + 4 > buf.length) { buf = randomBytes(4096); i = 0; }
    const v = buf.readUInt32LE(i); i += 4;
    return v / 4294967296;
  };
}

const angkaCfg = async (nama, bawaan) => {
  const v = String((await cfg(nama)) ?? "").trim();
  if (v === "") return bawaan;
  const n = Number(v);
  return Number.isFinite(n) ? n : bawaan;
};

export async function konfigSolo() {
  const aktif = await cfg("GAME_SOLO_AKTIF");
  const kasino = await cfg("GAME_KASINO_AKTIF");
  const min = await angkaCfg("GAME_SOLO_MIN", 1000);
  const maks = await angkaCfg("GAME_SOLO_MAKS", 50000);
  const rugi = await angkaCfg("GAME_SOLO_RUGI_HARIAN", 200000);
  const menang = await angkaCfg("GAME_SOLO_MAKS_MENANG", 5_000_000);
  const koin = await angkaCfg("GAME_KOIN_AWAL", 10000);
  return {
    aktif: String(aktif ?? "1") !== "0",
    kasino: String(kasino ?? "0") === "1",
    min: Math.max(1, Math.round(min)),
    maks: Math.max(1, Math.round(maks)),
    rugiHarian: Math.max(0, Math.round(rugi)),
    maksMenang: Math.max(1, Math.round(menang)),
    koinAwal: Math.max(1000, Math.round(koin)),
    demoMin: 100,
    demoMaks: 20000
  };
}

// ───────────────────────── UANG (atomik & idempoten) ─────────────────────────
// Mode saldo memakai SALDO GAME (terpisah dari saldo nokos). Ronde lama (sebelum pemisahan) menyimpan `medan` sendiri.
const medanDari = (mode) => (mode === "demo" ? "koinGame" : "saldoGame");
const medanRonde = (r) => r.medan || (r.mode === "demo" ? "koinGame" : "balance");

async function potong(token, medan, nominal, ref) {
  const kol = await usersCol();
  const h = await kol.findOneAndUpdate(
    { token, [medan]: { $gte: nominal }, gameBayar: { $ne: ref } },
    { $inc: { [medan]: -nominal, ...(medan === "saldoGame" ? { gameTurnover: nominal } : {}) }, $push: { gameBayar: { $each: [ref], $slice: -PANJANG_TANDA } } },
    { returnDocument: "after" }
  );
  if (h) return { ok: true, baru: true, saldo: h[medan] };
  const sudah = await kol.findOne({ token, gameBayar: ref }, { projection: { [medan]: 1 } });
  return sudah ? { ok: true, baru: false, saldo: sudah[medan] } : { ok: false };
}

async function bayar(token, medan, nominal, ref) {
  const kol = await usersCol();
  const h = await kol.findOneAndUpdate(
    { token, gameBayar: { $ne: ref } },
    { $inc: { [medan]: nominal }, $push: { gameBayar: { $each: [ref], $slice: -PANJANG_TANDA } } },
    { returnDocument: "after" }
  );
  if (h) return { ok: true, baru: true, saldo: h[medan] };
  const ada = await kol.findOne({ token }, { projection: { [medan]: 1 } });
  return ada ? { ok: true, baru: false, saldo: ada[medan] } : { ok: false };
}

const sudahTerpotong = async (token, ref) => !!(await (await usersCol()).findOne({ token, gameBayar: ref }, { projection: { _id: 1 } }));

/** Koin latihan: dokumen lama belum punya `koinGame` → beri modal awal (sekali, atomik). */
async function pastikanKoin(token, awal) {
  await (await usersCol()).updateOne({ token, koinGame: { $exists: false } }, { $set: { koinGame: awal } });
}

async function ambilKunci(token) {
  const kol = await usersCol();
  const now = Date.now();
  const h = await kol.findOneAndUpdate(
    { token, $or: [{ soloKunci: { $exists: false } }, { soloKunci: { $lt: now - KUNCI_MS } }] },
    { $set: { soloKunci: now } },
    { returnDocument: "after" }
  );
  return h ? now : null;
}
const lepasKunci = async (token, now) => { try { await (await usersCol()).updateOne({ token, soloKunci: now }, { $set: { soloKunci: 0 } }); } catch {} };

// ───────────────────────── BATAS RUGI HARIAN ─────────────────────────
function awalHariWib() {
  const wib = new Date(Date.now() + 7 * 3600_000);
  return new Date(Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate()) - 7 * 3600_000);
}

async function rugiHariIni(token) {
  const kol = await gameSoloCol();
  const baris = await kol.find({ token, mode: "saldo", status: { $in: ["baru", "selesai"] }, createdAt: { $gte: awalHariWib() } }).limit(5000).toArray();
  return baris.reduce((s, r) => s + (r.bet - (r.bayar || 0)), 0);
}

// ───────────────────────── INFO UNTUK KLIEN ─────────────────────────
export async function infoSolo(me) {
  const k = await konfigSolo();
  const kol = await usersCol();
  if (k.aktif) await pastikanKoin(me.token, k.koinAwal);
  const u = await kol.findOne({ token: me.token }, { projection: { saldoGame: 1, koinGame: 1 } });
  const rugi = k.kasino ? await rugiHariIni(me.token) : 0;
  const riwayat = await (await gameSoloCol()).find({ token: me.token, status: { $in: ["baru", "selesai"] } }).sort({ createdAt: -1 }).limit(12).toArray();
  const meta = {};
  for (const r of plinko.RISIKO) { meta[r] = {}; for (const n of plinko.BARIS) meta[r][n] = { tabel: plinko.tabel(n, r), rtp: plinko.rtp(n, r) }; }
  return {
    aktif: k.aktif, kasino: k.kasino,
    min: k.min, maks: k.maks, demoMin: k.demoMin, demoMaks: k.demoMaks,
    rugiHarian: k.rugiHarian, rugiHariIni: Math.max(0, rugi), maksMenang: k.maksMenang,
    saldo: u?.saldoGame ?? 0, koin: u?.koinGame ?? k.koinAwal, koinAwal: k.koinAwal,
    rtp: plinko.RTP_TARGET,
    plinko: { baris: plinko.BARIS, risiko: plinko.RISIKO, meta },
    slot: { bayar: slot.bayarTabel(), ladderDasar: slot.LADDER_DASAR, ladderGratis: slot.LADDER_GRATIS, maksPengali: slot.MAKS_PENGALI, kolom: slot.KOLOM, baris: slot.BARIS },
    riwayat: riwayat.map((r) => ({ id: r.rid, game: r.game, mode: r.mode, bet: r.bet, bayar: r.bayar || 0, pengali: r.pengali, waktu: r.createdAt }))
  };
}

// ───────────────────────── RONDE ─────────────────────────
function hitung(game, param, bet, rng, maksMenang) {
  if (game === "plinko") {
    const baris = Number(param.baris), risiko = String(param.risiko || "");
    const h = plinko.jatuh(baris, risiko, rng);
    if (!h) return null;
    const bayarKotor = Math.floor(bet * h.pengali);
    return { pengali: h.pengali, bayar: Math.min(bayarKotor, maksMenang), hasil: { jalur: h.jalur, sel: h.sel }, ringkas: { baris, risiko, sel: h.sel }, param: { baris, risiko } };
  }
  if (game === "slot") {
    const r = slot.putar(rng);
    const bayarKotor = Math.floor(bet * r.pengali);
    return { pengali: r.pengali, bayar: Math.min(bayarKotor, maksMenang), hasil: { putaran: r.putaran, gratis: r.gratis, kenaBatas: r.kenaBatas }, ringkas: { gratis: r.gratis, putaran: r.putaran.length }, param: {} };
  }
  return null;
}

/** Memainkan satu ronde. Mengembalikan hasil lengkap untuk animasi + saldo terkini. */
export async function mainSolo(me, { game, mode, bet, ...param }) {
  const k = await konfigSolo();
  if (!k.aktif) return { ok: false, alasan: "Game solo sedang ditutup admin." };
  if (perluNama(me)) return { ok: false, alasan: ALASAN_NAMA };
  if (game !== "plinko" && game !== "slot") return { ok: false, alasan: "Permainan tidak dikenal." };
  mode = mode === "saldo" ? "saldo" : "demo";
  if (mode === "saldo" && !k.kasino) return { ok: false, alasan: "Mode saldo game sedang dimatikan admin. Main dengan koin latihan dulu." };

  const taruhan = Math.round(Number(bet));
  if (!Number.isFinite(taruhan) || taruhan <= 0) return { ok: false, alasan: "Taruhan tidak valid." };
  const min = mode === "demo" ? k.demoMin : k.min, maks = mode === "demo" ? k.demoMaks : k.maks;
  if (taruhan < min) return { ok: false, alasan: `Taruhan minimal ${mode === "demo" ? `${min} koin` : rupiah(min)}.` };
  if (taruhan > maks) return { ok: false, alasan: `Taruhan maksimal ${mode === "demo" ? `${maks} koin` : rupiah(maks)}.` };
  if (game === "plinko" && (!plinko.BARIS.includes(Number(param.baris)) || !plinko.RISIKO.includes(String(param.risiko)))) return { ok: false, alasan: "Pilihan baris/risiko tidak valid." };

  const kunci = await ambilKunci(me.token);
  if (!kunci) return { ok: false, alasan: "Tunggu putaran sebelumnya selesai dulu." };
  try {
    if (mode === "demo") await pastikanKoin(me.token, k.koinAwal);
    if (mode === "saldo" && k.rugiHarian > 0) {
      const rugi = await rugiHariIni(me.token);
      if (rugi + taruhan > k.rugiHarian) {
        const sisa = Math.max(0, k.rugiHarian - rugi);
        return { ok: false, alasan: sisa > 0 ? `Batas rugi harian tinggal ${rupiah(sisa)} — turunkan taruhan, atau lanjut besok.` : `Batas rugi harian ${rupiah(k.rugiHarian)} tercapai. Istirahat dulu, lanjut besok ya.`, batas: true };
      }
    }

    const h = hitung(game, param, taruhan, bikinRng(), mode === "demo" ? Number.MAX_SAFE_INTEGER : k.maksMenang);
    if (!h) return { ok: false, alasan: "Pilihan tidak valid." };
    const kol = await gameSoloCol();
    const rid = randomUUID().replace(/-/g, "").slice(0, 16);
    await kol.insertOne({ rid, token: me.token, pid: me.pid, game, mode, medan: medanDari(mode), bet: taruhan, param: h.param, pengali: h.pengali, bayar: h.bayar, ringkas: h.ringkas, status: "baru", createdAt: new Date() });

    const refBet = `solo:${rid}:bet`, refMenang = `solo:${rid}:win`;
    let d;
    try { d = await potong(me.token, medanDari(mode), taruhan, refBet); } catch (err) { console.error("[solo] potong gagal:", err?.message || err); d = { ok: false }; }
    if (!d.ok) {
      await kol.updateOne({ rid, status: "baru" }, { $set: { status: "batal", selesaiAt: new Date() } });
      return { ok: false, alasan: mode === "demo" ? "Koin latihan tidak cukup. Isi ulang koin dulu." : "Saldo game tidak cukup untuk taruhan ini. Isi saldo game dulu." };
    }
    if (mode === "saldo" && d.baru) await logBalance({ token: me.token, type: "game_solo_taruhan", amount: -taruhan, balanceAfter: d.saldo, title: `Taruhan ${game === "slot" ? "Mahjong Spin 1024" : "Plinko"}`, ref: refBet, wallet: "game" });

    let saldo = d.saldo;
    if (h.bayar > 0) {
      const b = await bayar(me.token, medanDari(mode), h.bayar, refMenang);
      if (b.ok) {
        saldo = b.saldo;
        if (mode === "saldo" && b.baru) await logBalance({ token: me.token, type: "game_solo_menang", amount: h.bayar, balanceAfter: b.saldo, title: `Menang ${game === "slot" ? "Mahjong Spin 1024" : "Plinko"} ×${h.pengali}`, ref: refMenang, wallet: "game" });
      } else {
        return { ok: true, tertunda: true, rid, ...bentukHasil(game, mode, taruhan, h, saldo, true) };
      }
    }
    await kol.updateOne({ rid, status: "baru" }, { $set: { status: "selesai", selesaiAt: new Date() } });
    if (mode === "saldo" && h.pengali >= 20) kabariMenang(me, game, taruhan, h).catch(() => {});
    return { ok: true, rid, ...bentukHasil(game, mode, taruhan, h, saldo, false) };
  } finally {
    await lepasKunci(me.token, kunci);
  }
}

function bentukHasil(game, mode, bet, h, saldo, tertunda) {
  return { game, mode, bet, pengali: h.pengali, bayar: h.bayar, untung: h.bayar - bet, saldo, hasil: h.hasil, tertunda };
}

async function kabariMenang(me, game, bet, h) {
  const nama = game === "slot" ? "Mahjong Spin 1024" : "Plinko";
  const judul = `🎉 Kemenangan besar di ${nama}: ×${h.pengali}!`;
  const isi = [`💰 ${rupiah(h.bayar)} dari taruhan ${rupiah(bet)}.`, game === "slot" && h.ringkas.gratis ? `🎁 Termasuk ${h.ringkas.gratis} putaran gratis.` : "", "Main dengan bijak — ingat batas rugi harianmu."].filter(Boolean).join("\n");
  try { await (await userNotificationsCol()).insertOne({ token: me.token, type: "game_solo", title: judul, body: isi, read: false, createdAt: new Date(), url: "/chat?game=1", meta: { game: nama, ikon: game === "slot" ? "🀄" : "🔮", hasil: "menang", taruhan: bet, hadiah: h.bayar, pengali: h.pengali } }); } catch {}
  await kirimPush(me.token, { judul, isi, url: "/chat?game=1", tag: "game-solo" }).catch(() => {});
  if (h.bayar >= 1_000_000) umumkan({ jenis: "solo_besar", admin: `🎰 Kemenangan besar ${nama}: ${me.nama} ${rupiah(h.bayar)} (×${h.pengali}, taruhan ${rupiah(bet)})` });
}

/** Isi ulang koin latihan bila hampir habis. */
export async function isiUlangKoin(me) {
  const k = await konfigSolo();
  if (!k.aktif) return { ok: false, alasan: "Game solo sedang ditutup admin." };
  await pastikanKoin(me.token, k.koinAwal);
  const h = await (await usersCol()).findOneAndUpdate(
    { token: me.token, koinGame: { $lt: k.demoMin * 10 } },
    { $set: { koinGame: k.koinAwal } },
    { returnDocument: "after" }
  );
  if (!h) return { ok: false, alasan: "Koin latihanmu masih cukup." };
  return { ok: true, koin: h.koinGame };
}

// ───────────────────────── PENYAPU ─────────────────────────
/** Ronde yang macet (proses mati sesudah insert / sesudah potong): selesaikan atau batalkan, tanpa bayar dobel. */
export async function sapuSolo({ batas = 40 } = {}) {
  const kol = await gameSoloCol();
  let diproses = 0;
  for (const r of await kol.find({ status: "baru", createdAt: { $lt: new Date(Date.now() - MACET_MS) } }).limit(batas).toArray()) {
    const refBet = `solo:${r.rid}:bet`;
    if (!(await sudahTerpotong(r.token, refBet))) {
      await kol.updateOne({ rid: r.rid, status: "baru" }, { $set: { status: "batal", selesaiAt: new Date() } });
      diproses++; continue;
    }
    if (r.bayar > 0) {
      const medan = medanRonde(r);
      const b = await bayar(r.token, medan, r.bayar, `solo:${r.rid}:win`);
      if (!b.ok) continue;
      if (r.mode === "saldo" && b.baru) await logBalance({ token: r.token, type: "game_solo_menang", amount: r.bayar, balanceAfter: b.saldo, title: `Menang ${r.game === "slot" ? "Mahjong Spin 1024" : "Plinko"} ×${r.pengali}`, ref: `solo:${r.rid}:win`, wallet: medan === "saldoGame" ? "game" : undefined });
    }
    await kol.updateOne({ rid: r.rid, status: "baru" }, { $set: { status: "selesai", selesaiAt: new Date() } });
    diproses++;
  }
  return { diproses };
}

// ───────────────────────── ADMIN ─────────────────────────
export async function ringkasanSolo() {
  const kol = await gameSoloCol();
  const semua = await kol.find({ status: "selesai" }).sort({ createdAt: -1 }).limit(20000).toArray();
  const peta = {};
  for (const r of semua) {
    const kunci = `${r.game}:${r.mode}`;
    const x = (peta[kunci] ||= { game: r.game, mode: r.mode, ronde: 0, taruhan: 0, bayar: 0, menangTerbesar: 0 });
    x.ronde++; x.taruhan += r.bet; x.bayar += r.bayar || 0; x.menangTerbesar = Math.max(x.menangTerbesar, r.bayar || 0);
  }
  const k = await konfigSolo();
  const baru = await kol.find({ status: "baru" }).limit(50).toArray();
  return {
    aktif: k.aktif, kasino: k.kasino,
    ringkas: Object.values(peta).map((x) => ({ ...x, rtp: x.taruhan ? x.bayar / x.taruhan : 0, untungRumah: x.taruhan - x.bayar })),
    tertunda: baru.length,
    terbaru: semua.slice(0, 15).map((r) => ({ id: r.rid, game: r.game, mode: r.mode, bet: r.bet, bayar: r.bayar || 0, pengali: r.pengali, waktu: r.createdAt, pid: r.pid }))
  };
}
