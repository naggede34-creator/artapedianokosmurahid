// Duel permainan antar pengguna: lobi, taruhan saldo, giliran, batas waktu,
// pembayaran pemenang, dan notifikasi.
//
// ── KEAMANAN UANG (inti dari berkas ini) ─────────────────────────────────────
// Saldo TIDAK PERNAH diubah dengan "baca lalu tulis". Setiap perubahan adalah
// SATU pembaruan atomik pada dokumen pengguna yang sekaligus mencatat kunci
// idempotensinya (`gameBayar`):
//
//   debit  : { token, balance ≥ nominal, gameBayar ∌ ref } → balance −nominal, gameBayar += ref
//   kredit : { token,                    gameBayar ∌ ref } → balance +nominal, gameBayar += ref
//
// Karena pengurangan/penambahan dan tandanya terjadi dalam satu operasi,
// mengulang operasi yang sama (setelah crash, timeout, atau dua permintaan
// bersamaan) TIDAK PERNAH memotong atau membayar dua kali — dan penyapu boleh
// menjalankannya ulang kapan saja tanpa takut. Tanpa transaksi multi-dokumen.
//
// Alur uang satu duel (S = taruhan per pemain):
//   buat   → tuan rumah dipotong S            (ref stake:<id>:<pid>)
//   gabung → penantang dipotong S             (ref stake:<id>:<pid>)
//   menang → pemenang +(2S − fee)             (ref menang:<id>)
//   seri / batal / kedaluwarsa → tiap pemain yang SUDAH dipotong +S (ref refund:<id>:<pid>)
// Pengembalian hanya untuk pemain yang benar-benar punya tanda potongan.
import { randomUUID } from "node:crypto";
import { gameMatchCol, usersCol, waProfilCol, userNotificationsCol } from "@/lib/db";
import { cfg } from "@/lib/config";
import { logBalance } from "@/lib/ledger";
import { kirimPush } from "@/lib/webPush";
import { umumkan } from "@/lib/notifyHub";
import { esc } from "@/lib/rich";
import { petaProfil, profilPid, terblokir, perluNama, ALASAN_NAMA } from "@/lib/wa/inti";
import * as catur from "@/lib/game/catur";
import * as uno from "@/lib/game/uno";
import * as remi from "@/lib/game/remi";
import * as mahjong from "@/lib/game/mahjong";

export const MESIN = { catur, uno, remi, mahjong };
export const DAFTAR_GAME = Object.values(MESIN).map((m) => m.info);

const KEDALUWARSA_TUNGGU_MS = 15 * 60_000; // tantangan tanpa penerima
const MACET_GABUNG_MS = 60_000; // kursi "gabung" yang tak kunjung selesai dibayar
const MAKS_AKTIF = 3; // duel menunggu/berjalan per pemain
// Hanya untuk pengujian: memperpendek batas waktu giliran (mis. 0.02 = 2% dari biasa).
const batasGilir = (mesin) => Math.max(200, Math.round(mesin.info.batasGilirMs * (Number(process.env.GAME_SKALA_WAKTU) || 1)));
const rupiah = (n) => `Rp${Number(n || 0).toLocaleString("id-ID")}`;

// ─────────────────────────── KONFIGURASI ───────────────────────────
const angkaCfg = async (nama, bawaan) => {
  const v = String((await cfg(nama)) ?? "").trim();
  if (v === "") return bawaan;
  const n = Number(v);
  return Number.isFinite(n) ? n : bawaan;
};

export async function konfigGame() {
  const aktif = await cfg("GAME_AKTIF");
  const taruhanAktif = await cfg("GAME_TARUHAN_AKTIF");
  const min = await angkaCfg("GAME_TARUHAN_MIN", 1000);
  const maks = await angkaCfg("GAME_TARUHAN_MAKS", 100000);
  const fee = await angkaCfg("GAME_FEE_PERSEN", 5);
  return {
    aktif: String(aktif ?? "1") !== "0",
    taruhanAktif: String(taruhanAktif ?? "1") !== "0",
    min: Math.max(1, Math.round(min)),
    maks: Math.max(1, Math.round(maks)),
    feePersen: Math.min(50, Math.max(0, fee))
  };
}

// ─────────────────────────── UANG (atomik & idempoten) ───────────────────────────
const PANJANG_TANDA = 300;

/** true = terpotong (baru atau sudah pernah); false = saldo kurang / akun tak ada. */
async function debitIdem(token, nominal, ref) {
  const kol = await usersCol();
  const hasil = await kol.findOneAndUpdate(
    { token, balance: { $gte: nominal }, gameBayar: { $ne: ref } },
    { $inc: { balance: -nominal }, $push: { gameBayar: { $each: [ref], $slice: -PANJANG_TANDA } } },
    { returnDocument: "after" }
  );
  if (hasil) return { ok: true, baru: true, saldo: hasil.balance };
  // Bisa jadi sudah terpotong sebelumnya (ulang setelah crash).
  const sudah = await kol.findOne({ token, gameBayar: ref }, { projection: { balance: 1 } });
  return sudah ? { ok: true, baru: false, saldo: sudah.balance } : { ok: false };
}

/** Menambah saldo SEKALI per ref. */
async function kreditIdem(token, nominal, ref) {
  const kol = await usersCol();
  const hasil = await kol.findOneAndUpdate(
    { token, gameBayar: { $ne: ref } },
    { $inc: { balance: nominal }, $push: { gameBayar: { $each: [ref], $slice: -PANJANG_TANDA } } },
    { returnDocument: "after" }
  );
  if (hasil) return { ok: true, baru: true, saldo: hasil.balance };
  const ada = await kol.findOne({ token }, { projection: { balance: 1 } });
  return ada ? { ok: true, baru: false, saldo: ada.balance } : { ok: false };
}

const sudahDipotong = async (token, ref) => !!(await (await usersCol()).findOne({ token, gameBayar: ref }, { projection: { _id: 1 } }));

// ─────────────────────────── BENTUK DATA ───────────────────────────
const bacaState = (g) => JSON.parse(g.stateJson);
const idKegiatan = () => randomUUID().replace(/-/g, "").slice(0, 14);
const lainDari = (g, pid) => (g.pemain[0].pid === pid ? g.pemain[1] : g.pemain[0]);
const dalamGame = (g, pid) => g.pemain.some((p) => p.pid === pid);

/** Dokumen → bentuk untuk klien (tanpa token akun, tanpa tangan lawan). */
export async function tampilGame(g, me) {
  const mesin = MESIN[g.jenis];
  const profil = await petaProfil(g.pemain.map((p) => p.pid).filter(Boolean));
  const lawan = g.pemain.find((p) => p.pid && p.pid !== me.pid);
  const bentuk = {
    id: g.gameId,
    jenis: g.jenis,
    nama: mesin.info.nama,
    ikon: mesin.info.ikon,
    status: g.status,
    taruhan: g.taruhan,
    feePersen: g.feePersen,
    hadiah: g.taruhan ? g.taruhan * 2 - Math.floor((g.taruhan * 2 * g.feePersen) / 100) : 0,
    saya: dalamGame(g, me.pid),
    tuanRumah: g.pemain[0].pid === me.pid,
    undang: g.undangPid || null,
    diundangSaya: g.undangPid === me.pid,
    pemain: g.pemain.filter((p) => p.pid).map((p) => ({ pid: p.pid, nama: profil[p.pid]?.nama || p.nama, fotoV: profil[p.pid]?.fotoV || 0, lencana: profil[p.pid]?.lencana || null, online: !!profil[p.pid]?.online })),
    lawan: lawan ? { pid: lawan.pid, nama: profil[lawan.pid]?.nama || lawan.nama, fotoV: profil[lawan.pid]?.fotoV || 0, lencana: profil[lawan.pid]?.lencana || null, online: !!profil[lawan.pid]?.online } : null,
    dibuat: g.createdAt,
    sisaMs: g.status === "main" && g.deadline ? Math.max(0, new Date(g.deadline).getTime() - Date.now()) : null,
    batasMs: batasGilir(mesin)
  };
  if (g.status === "main" || g.status === "selesai") {
    const st = bacaState(g);
    bentuk.papan = mesin.tampil(st, me.pid);
    bentuk.giliranSaya = g.status === "main" && mesin.giliran(st) === me.pid;
  }
  if (g.status === "selesai" || g.status === "batal") {
    const menang = g.hasil?.pemenang;
    bentuk.hasil = {
      pemenang: menang || null,
      seri: !!g.hasil?.seri,
      alasan: g.hasil?.alasan || "",
      saya: g.status === "batal" ? "batal" : g.hasil?.seri ? "seri" : menang === me.pid ? "menang" : dalamGame(g, me.pid) ? "kalah" : null,
      dibayar: g.hasil?.hadiah || 0,
      fee: g.hasil?.fee || 0
    };
  }
  return bentuk;
}

// ─────────────────────────── NOTIFIKASI ───────────────────────────
async function kabari(token, { judul, isi, url = "/chat?game=1", tipe = "game" }) {
  try {
    await (await userNotificationsCol()).insertOne({ token, type: tipe, title: judul, body: isi, read: false, createdAt: new Date() });
  } catch {}
  await kirimPush(token, { judul, isi, url, tag: `game-${tipe}` }).catch(() => {});
}

const namaPemain = (g, pid) => g.pemain.find((p) => p.pid === pid)?.nama || "Pemain";

// ─────────────────────────── PEMBAYARAN ───────────────────────────
/** Menjalankan antrean pembayaran sebuah duel. Aman dijalankan berulang. */
export async function bayarAntrian(gameId) {
  const kol = await gameMatchCol();
  const g = await kol.findOne({ gameId });
  if (!g || !g.pembayaran?.length || g.bayarStatus === "lunas") return { ok: true };
  let semua = true;
  for (const item of g.pembayaran) {
    if (item.status === "lunas") continue;
    const r = await kreditIdem(item.token, item.amount, item.ref);
    if (r.ok) {
      if (r.baru) {
        await logBalance({ token: item.token, type: item.tipe, amount: item.amount, balanceAfter: r.saldo, title: item.judul, ref: item.ref });
      }
      await kol.updateOne({ gameId, "pembayaran.ref": item.ref }, { $set: { "pembayaran.$.status": "lunas" } });
    } else {
      semua = false;
    }
  }
  if (semua) await kol.updateOne({ gameId }, { $set: { bayarStatus: "lunas", lunasAt: new Date() } });
  return { ok: semua };
}

function rencanaBayar(g, hasil) {
  const S = g.taruhan;
  if (!S) return { pembayaran: [], hadiah: 0, fee: 0 };
  const potongan = g.pemain.filter((p) => p.dipotong);
  if (hasil.seri || !hasil.pemenang) {
    return {
      pembayaran: potongan.map((p) => ({ ref: `refund:${g.gameId}:${p.pid}`, token: p.token, amount: S, tipe: "game_refund", judul: `Taruhan ${MESIN[g.jenis].info.nama} dikembalikan (seri)`, status: "antri" })),
      hadiah: 0, fee: 0
    };
  }
  const pot = S * potongan.length;
  const fee = Math.floor((pot * g.feePersen) / 100);
  const hadiah = pot - fee;
  const pemenang = g.pemain.find((p) => p.pid === hasil.pemenang);
  return {
    pembayaran: [{ ref: `menang:${g.gameId}`, token: pemenang.token, amount: hadiah, tipe: "game_menang", judul: `Menang duel ${MESIN[g.jenis].info.nama}`, status: "antri" }],
    hadiah, fee
  };
}

/** Menutup duel yang sedang berjalan. Klaim atomik → hanya SATU pemanggil yang menang. */
async function akhiri(g, hasil, stateJson = null, ver = null) {
  const kol = await gameMatchCol();
  const rencana = rencanaBayar(g, hasil);
  const set = {
    status: "selesai",
    hasil: { pemenang: hasil.pemenang || null, seri: !!hasil.seri, alasan: hasil.alasan || "", hadiah: rencana.hadiah, fee: rencana.fee },
    pembayaran: rencana.pembayaran,
    bayarStatus: rencana.pembayaran.length ? "antri" : "lunas",
    selesaiAt: new Date(),
    deadline: null
  };
  if (stateJson) set.stateJson = stateJson;
  const saring = { gameId: g.gameId, status: "main" };
  if (ver !== null) saring.ver = ver; // keadaan harus persis yang dihitung pemanggil
  const klaim = await kol.findOneAndUpdate(saring, { $set: set }, { returnDocument: "after" });
  if (!klaim) return false; // sudah ditutup / berubah oleh pemanggil lain
  await bayarAntrian(g.gameId);
  await umumkanHasil(klaim);
  return true;
}

async function umumkanHasil(g) {
  try {
    const m = MESIN[g.jenis].info;
    const [a, b] = g.pemain;
    const h = g.hasil;
    const taruhan = g.taruhan ? ` · taruhan ${rupiah(g.taruhan)}` : "";
    if (h.seri || !h.pemenang) {
      await Promise.all(g.pemain.map((p) => kabari(p.token, { judul: `🤝 Duel ${m.nama} seri`, isi: `${h.alasan}.${g.taruhan ? ` Taruhan ${rupiah(g.taruhan)} dikembalikan.` : ""}`, tipe: "game_hasil" })));
      umumkan({ jenis: "duel_selesai", publik: `🤝 <b>DUEL ${esc(m.nama.toUpperCase())} SERI</b>\n${esc(a.nama)} vs ${esc(b.nama)}${esc(taruhan)}`, admin: `🎮 Duel ${m.nama} seri: ${a.nama} vs ${b.nama}${taruhan}` });
      return;
    }
    const menang = g.pemain.find((p) => p.pid === h.pemenang);
    const kalah = g.pemain.find((p) => p.pid !== h.pemenang);
    await kabari(menang.token, { judul: `🏆 Kamu menang duel ${m.nama}!`, isi: `${h.alasan}.${g.taruhan ? ` ${rupiah(h.hadiah)} masuk ke saldomu.` : ""}`, tipe: "game_hasil" });
    await kabari(kalah.token, { judul: `😵 Kamu kalah duel ${m.nama}`, isi: `${h.alasan}.${g.taruhan ? ` Taruhan ${rupiah(g.taruhan)} hangus.` : ""} Coba lagi!`, tipe: "game_hasil" });
    umumkan({
      jenis: "duel_selesai",
      publik: `🏆 <b>DUEL ${esc(m.nama.toUpperCase())} SELESAI</b>\n<b>${esc(menang.nama)}</b> mengalahkan ${esc(kalah.nama)}${esc(taruhan)}${g.taruhan ? `\n💰 Hadiah ${esc(rupiah(h.hadiah))}` : ""}`,
      admin: `🎮 Duel ${m.nama}: ${menang.nama} menang vs ${kalah.nama}${taruhan}${g.taruhan ? ` · hadiah ${rupiah(h.hadiah)} · fee ${rupiah(h.fee)}` : ""} (${h.alasan})`
    });
  } catch (err) {
    console.error("[game] gagal mengumumkan hasil:", err?.message || err);
  }
}

// ─────────────────────────── PEMBATALAN / REFUND ───────────────────────────
/** Membatalkan duel yang belum berjalan dan mengembalikan taruhan yang sudah terpotong. */
async function batalkan(gameId, alasan, dariStatus = ["menunggu", "gabung"]) {
  const kol = await gameMatchCol();
  const g = await kol.findOne({ gameId });
  if (!g || !dariStatus.includes(g.status)) return false;
  // Pemain yang tanda potongannya ADA (walau bendera `dipotong` belum sempat ditulis).
  const pembayaran = [];
  for (const p of g.pemain) {
    if (!p.pid) continue;
    if (g.taruhan && (p.dipotong || (await sudahDipotong(p.token, `stake:${gameId}:${p.pid}`)))) {
      pembayaran.push({ ref: `refund:${gameId}:${p.pid}`, token: p.token, amount: g.taruhan, tipe: "game_refund", judul: `Taruhan ${MESIN[g.jenis].info.nama} dikembalikan (${alasan})`, status: "antri" });
    }
  }
  const klaim = await kol.findOneAndUpdate(
    { gameId, status: { $in: dariStatus } },
    { $set: { status: "batal", hasil: { pemenang: null, seri: false, alasan, hadiah: 0, fee: 0 }, pembayaran, bayarStatus: pembayaran.length ? "antri" : "lunas", selesaiAt: new Date(), deadline: null } },
    { returnDocument: "after" }
  );
  if (!klaim) return false;
  await bayarAntrian(gameId);
  return true;
}

// ─────────────────────────── BUAT / GABUNG ───────────────────────────
async function periksaLayak(me) {
  if (perluNama(me)) return ALASAN_NAMA;
  return null;
}

export async function buatDuel(me, { jenis, taruhan = 0, undangPid = null }) {
  const k = await konfigGame();
  if (!k.aktif) return { ok: false, alasan: "Duel permainan sedang ditutup admin." };
  if (!MESIN[jenis]) return { ok: false, alasan: "Permainan tidak dikenal." };
  const salah = await periksaLayak(me);
  if (salah) return { ok: false, alasan: salah };

  const S = Math.round(Number(taruhan) || 0);
  if (S < 0) return { ok: false, alasan: "Taruhan tidak valid." };
  if (S > 0) {
    if (!k.taruhanAktif) return { ok: false, alasan: "Taruhan saldo sedang dinonaktifkan. Kamu masih bisa main tanpa taruhan." };
    if (S < k.min) return { ok: false, alasan: `Taruhan minimal ${rupiah(k.min)}.` };
    if (S > k.maks) return { ok: false, alasan: `Taruhan maksimal ${rupiah(k.maks)}.` };
  }

  let target = null;
  if (undangPid) {
    if (undangPid === me.pid) return { ok: false, alasan: "Tidak bisa menantang diri sendiri." };
    target = await profilPid(undangPid);
    if (!target) return { ok: false, alasan: "Pengguna yang ditantang tidak ditemukan." };
    if (await terblokir(me, target.pid)) return { ok: false, alasan: "Kamu tidak bisa menantang kontak ini." };
    if (perluNama(target)) return { ok: false, alasan: "Pengguna itu belum mengatur namanya." };
  }

  const kol = await gameMatchCol();
  const aktif = await kol.countDocuments({ status: { $in: ["menunggu", "gabung", "main"] }, "pemain.pid": me.pid });
  if (aktif >= MAKS_AKTIF) return { ok: false, alasan: `Kamu sudah punya ${MAKS_AKTIF} duel aktif. Selesaikan atau batalkan dulu.` };

  const gameId = idKegiatan();
  const doc = {
    gameId, jenis, taruhan: S, feePersen: k.feePersen, status: "menunggu",
    pemain: [{ pid: me.pid, token: me.token, nama: me.nama, dipotong: false }],
    undangPid: target ? target.pid : null,
    penantangPid: null,
    stateJson: null, deadline: null, ver: 0, bayarStatus: null,
    createdAt: new Date(), kedaluwarsaAt: new Date(Date.now() + KEDALUWARSA_TUNGGU_MS)
  };
  await kol.insertOne(doc);

  if (S > 0) {
    const ref = `stake:${gameId}:${me.pid}`;
    let d;
    try { d = await debitIdem(me.token, S, ref); } catch (err) { console.error("[game] debit gagal:", err?.message || err); d = { ok: false }; }
    if (!d.ok) {
      await kol.deleteOne({ gameId });
      return { ok: false, alasan: "Saldo tidak cukup untuk taruhan ini." };
    }
    await kol.updateOne({ gameId }, { $set: { "pemain.0.dipotong": true } });
    if (d.baru) await logBalance({ token: me.token, type: "game_taruhan", amount: -S, balanceAfter: d.saldo, title: `Taruhan duel ${MESIN[jenis].info.nama}`, ref });
  }

  if (target) {
    const m = MESIN[jenis].info;
    kabari(target.token, {
      judul: `${m.ikon} ${me.nama} menantangmu main ${m.nama}!`,
      isi: S ? `Taruhan ${rupiah(S)} per pemain — pemenang dapat ${rupiah(S * 2 - Math.floor((S * 2 * k.feePersen) / 100))}.` : "Main santai tanpa taruhan.",
      tipe: "game_tantangan"
    }).catch(() => {});
  }
  return { ok: true, gameId };
}

export async function gabungDuel(me, gameId) {
  const k = await konfigGame();
  if (!k.aktif) return { ok: false, alasan: "Duel permainan sedang ditutup admin." };
  const salah = await periksaLayak(me);
  if (salah) return { ok: false, alasan: salah };
  const kol = await gameMatchCol();
  const g = await kol.findOne({ gameId: String(gameId) });
  if (!g || g.status !== "menunggu") return { ok: false, alasan: "Duel ini sudah tidak tersedia." };
  if (dalamGame(g, me.pid)) return { ok: false, alasan: "Kamu adalah tuan rumah duel ini." };
  if (g.undangPid && g.undangPid !== me.pid) return { ok: false, alasan: "Tantangan ini untuk pengguna lain." };
  if (await terblokir(me, g.pemain[0].pid)) return { ok: false, alasan: "Kamu tidak bisa bergabung ke duel ini." };
  if (g.taruhan > 0 && !k.taruhanAktif) return { ok: false, alasan: "Taruhan saldo sedang dinonaktifkan." };
  const aktif = await kol.countDocuments({ status: { $in: ["menunggu", "gabung", "main"] }, "pemain.pid": me.pid });
  if (aktif >= MAKS_AKTIF) return { ok: false, alasan: `Kamu sudah punya ${MAKS_AKTIF} duel aktif.` };

  // 1) Ambil kursi (atomik): hanya satu penantang yang berhasil.
  const kursi = await kol.findOneAndUpdate(
    { gameId: g.gameId, status: "menunggu", penantangPid: null },
    { $set: { status: "gabung", penantangPid: me.pid, gabungAt: new Date() }, $push: { pemain: { pid: me.pid, token: me.token, nama: me.nama, dipotong: false } } },
    { returnDocument: "after" }
  );
  if (!kursi) return { ok: false, alasan: "Duel ini sudah diambil orang lain." };

  // 2) Potong taruhan penantang.
  if (g.taruhan > 0) {
    const ref = `stake:${g.gameId}:${me.pid}`;
    let d;
    try { d = await debitIdem(me.token, g.taruhan, ref); } catch (err) { console.error("[game] debit gagal:", err?.message || err); d = { ok: false }; }
    if (!d.ok) {
      // Kembalikan kursi.
      await kol.updateOne({ gameId: g.gameId, status: "gabung" }, { $set: { status: "menunggu", penantangPid: null }, $pull: { pemain: { pid: me.pid } } });
      return { ok: false, alasan: "Saldo tidak cukup untuk taruhan ini." };
    }
    await kol.updateOne({ gameId: g.gameId }, { $set: { "pemain.1.dipotong": true } });
    if (d.baru) await logBalance({ token: me.token, type: "game_taruhan", amount: -g.taruhan, balanceAfter: d.saldo, title: `Taruhan duel ${MESIN[g.jenis].info.nama}`, ref });
  }

  // 3) Mulai permainan.
  const mesin = MESIN[g.jenis];
  const pids = [g.pemain[0].pid, me.pid];
  // Warna/urutan awal diacak adil (catur: siapa putih; kartu: siapa jalan dulu).
  if (Math.random() < 0.5) pids.reverse();
  const state = mesin.baru(pids);
  const mulai = await kol.findOneAndUpdate(
    { gameId: g.gameId, status: "gabung" },
    { $set: { status: "main", stateJson: JSON.stringify(state), deadline: new Date(Date.now() + batasGilir(mesin)), mulaiAt: new Date(), ver: 1 } },
    { returnDocument: "after" }
  );
  if (!mulai) return { ok: false, alasan: "Duel tidak bisa dimulai. Taruhanmu akan dikembalikan." };

  const [a, b] = mulai.pemain;
  const m = mesin.info;
  const taruhan = g.taruhan ? ` · taruhan ${rupiah(g.taruhan)}` : "";
  for (const p of mulai.pemain) {
    kabari(p.token, { judul: `${m.ikon} Duel ${m.nama} dimulai!`, isi: `${a.nama} vs ${b.nama}${taruhan}. Ayo main sekarang!`, url: `/chat?game=${g.gameId}`, tipe: "game_mulai" }).catch(() => {});
  }
  umumkan({ jenis: "duel_mulai", publik: `${m.ikon} <b>DUEL ${esc(m.nama.toUpperCase())} DIMULAI</b>\n${esc(a.nama)} vs ${esc(b.nama)}${esc(taruhan)}`, admin: `🎮 Duel ${m.nama} dimulai: ${a.nama} vs ${b.nama}${taruhan}` });
  return { ok: true, gameId: g.gameId };
}

export async function tolakDuel(me, gameId) {
  const g = await (await gameMatchCol()).findOne({ gameId: String(gameId) });
  if (!g || g.status !== "menunggu") return { ok: false, alasan: "Duel ini sudah tidak tersedia." };
  if (g.undangPid !== me.pid) return { ok: false, alasan: "Tantangan ini bukan untukmu." };
  const ok = await batalkan(g.gameId, "ditolak lawan", ["menunggu"]);
  if (ok) kabari(g.pemain[0].token, { judul: "Tantanganmu ditolak", isi: `${me.nama} menolak tantanganmu.${g.taruhan ? ` Taruhan ${rupiah(g.taruhan)} sudah dikembalikan.` : ""}`, tipe: "game_tolak" }).catch(() => {});
  return { ok };
}

export async function batalDuel(me, gameId) {
  const g = await (await gameMatchCol()).findOne({ gameId: String(gameId) });
  if (!g) return { ok: false, alasan: "Duel tidak ditemukan." };
  if (g.pemain[0].pid !== me.pid) return { ok: false, alasan: "Hanya tuan rumah yang bisa membatalkan." };
  if (g.status !== "menunggu") return { ok: false, alasan: "Duel sudah berjalan — tidak bisa dibatalkan, hanya menyerah." };
  return { ok: await batalkan(g.gameId, "dibatalkan tuan rumah", ["menunggu"]) };
}

// ─────────────────────────── BERMAIN ───────────────────────────
/** Memeriksa batas waktu; kalau lewat, pemain yang ditunggu kalah. true = duel baru saja ditutup. */
async function periksaWaktu(g) {
  if (g.status !== "main" || !g.deadline || new Date(g.deadline).getTime() > Date.now()) return false;
  const st = bacaState(g);
  const mesin = MESIN[g.jenis];
  const yangDitunggu = mesin.giliran(st);
  if (!yangDitunggu) return false;
  const pemenang = lainDari(g, yangDitunggu).pid;
  return akhiri(g, { pemenang, seri: false, alasan: `Waktu habis — ${namaPemain(g, yangDitunggu)} tidak bergerak` });
}

export async function ambilGame(me, gameId) {
  const kol = await gameMatchCol();
  let g = await kol.findOne({ gameId: String(gameId) });
  if (!g || !dalamGame(g, me.pid)) {
    // Duel terbuka (lobi) boleh dilihat ringkasannya oleh siapa pun yang berhak bergabung.
    if (g && g.status === "menunggu" && (!g.undangPid || g.undangPid === me.pid)) return { ok: true, game: await tampilGame(g, me) };
    return { ok: false, alasan: "Duel tidak ditemukan." };
  }
  if (g.status === "main" && (await periksaWaktu(g))) g = await kol.findOne({ gameId: g.gameId });
  if (g.status === "menunggu" && g.kedaluwarsaAt && new Date(g.kedaluwarsaAt) < new Date()) {
    await batalkan(g.gameId, "kedaluwarsa");
    g = await kol.findOne({ gameId: g.gameId });
  }
  if ((g.status === "selesai" || g.status === "batal") && g.bayarStatus === "antri") { await bayarAntrian(g.gameId); g = await kol.findOne({ gameId: g.gameId }); }
  // Tanda "terlihat online" di duel: dipakai untuk memutuskan perlu tidaknya push giliran.
  await kol.updateOne({ gameId: g.gameId }, { $set: { [`lihat.${me.pid}`]: Date.now() } });
  return { ok: true, game: await tampilGame(g, me) };
}

export async function mainAksi(me, gameId, a) {
  const kol = await gameMatchCol();
  const g = await kol.findOne({ gameId: String(gameId) });
  if (!g || !dalamGame(g, me.pid)) return { ok: false, alasan: "Duel tidak ditemukan." };
  if (g.status !== "main") return { ok: false, alasan: g.status === "selesai" ? "Permainan sudah selesai." : "Duel belum dimulai." };
  if (await periksaWaktu(g)) return { ok: false, alasan: "Waktu habis — duel sudah ditutup.", tutup: true };

  const mesin = MESIN[g.jenis];
  const st = bacaState(g);
  const r = mesin.aksi(st, me.pid, a || {});
  if (!r.ok) return { ok: false, alasan: r.alasan };

  const stateJson = JSON.stringify(r.state);
  if (r.state.selesai) {
    // Simpan keadaan akhir & bayar. Klaim atomik di dalam akhiri(): dua aksi bersamaan tak bisa membayar dua kali.
    const tutup = await akhiri(g, { pemenang: r.state.selesai.pemenang, seri: r.state.selesai.seri, alasan: r.state.selesai.alasan }, stateJson, g.ver);
    if (!tutup) return { ok: false, alasan: "Keadaan permainan berubah. Coba lagi." };
  } else {
    const sekarang = mesin.giliran(r.state);
    const baru = await kol.findOneAndUpdate(
      { gameId: g.gameId, status: "main", ver: g.ver },
      { $set: { stateJson, deadline: new Date(Date.now() + batasGilir(mesin)), ver: g.ver + 1, updatedAt: new Date() } },
      { returnDocument: "after" }
    );
    if (!baru) return { ok: false, alasan: "Keadaan permainan berubah. Coba lagi." };
    // Kabari lawan bila gilirannya tiba dan ia tidak sedang membuka duel ini.
    if (sekarang && sekarang !== me.pid) {
      const tujuan = g.pemain.find((p) => p.pid === sekarang);
      const terakhirLihat = Number(baru.lihat?.[sekarang] || 0);
      if (tujuan && Date.now() - terakhirLihat > 20_000) {
        kabari(tujuan.token, { judul: `${mesin.info.ikon} Giliranmu di duel ${mesin.info.nama}`, isi: `${me.nama} sudah jalan. Kamu punya ${Math.round(batasGilir(mesin) / 1000)} detik.`, url: `/chat?game=${g.gameId}`, tipe: "game_giliran" }).catch(() => {});
      }
    }
  }
  return ambilGame(me, g.gameId);
}

export async function menyerah(me, gameId) {
  const kol = await gameMatchCol();
  const g = await kol.findOne({ gameId: String(gameId) });
  if (!g || !dalamGame(g, me.pid)) return { ok: false, alasan: "Duel tidak ditemukan." };
  if (g.status !== "main") return { ok: false, alasan: "Duel tidak sedang berjalan." };
  await akhiri(g, { pemenang: lainDari(g, me.pid).pid, seri: false, alasan: `${me.nama} menyerah` });
  return ambilGame(me, g.gameId);
}

// ─────────────────────────── DAFTAR ───────────────────────────
export async function daftarGame(me) {
  const kol = await gameMatchCol();
  const sekarang = new Date();
  // Bersihkan tantangan kedaluwarsa & duel yang lewat waktu (dibatasi jumlahnya).
  const basi = await kol.find({ status: "menunggu", kedaluwarsaAt: { $lt: sekarang } }).limit(20).toArray();
  for (const g of basi) await batalkan(g.gameId, "kedaluwarsa");
  const macet = await kol.find({ status: "main", deadline: { $lt: sekarang } }).limit(20).toArray();
  for (const g of macet) await periksaWaktu(g);

  const k = await konfigGame();
  const [lobi, milik, riwayat] = await Promise.all([
    kol.find({ status: "menunggu", "pemain.pid": { $ne: me.pid }, $or: [{ undangPid: null }, { undangPid: me.pid }] }).sort({ createdAt: -1 }).limit(30).toArray(),
    kol.find({ status: { $in: ["menunggu", "gabung", "main"] }, "pemain.pid": me.pid }).sort({ createdAt: -1 }).limit(10).toArray(),
    kol.find({ status: { $in: ["selesai", "batal"] }, "pemain.pid": me.pid }).sort({ selesaiAt: -1 }).limit(15).toArray()
  ]);
  const t = (arr) => Promise.all(arr.map((g) => tampilGame(g, me)));
  const ringkas = (x) => { const { papan, ...sisa } = x; void papan; return sisa; };
  return {
    konfig: { aktif: k.aktif, taruhanAktif: k.taruhanAktif, min: k.min, maks: k.maks, feePersen: k.feePersen },
    permainan: DAFTAR_GAME,
    lobi: (await t(lobi)).map(ringkas),
    milik: (await t(milik)).map(ringkas),
    riwayat: (await t(riwayat)).map(ringkas)
  };
}

/** Ringkasan ringan untuk polling layar utama: undangan masuk & duel yang sedang berjalan. */
export async function ringkasanGame(me) {
  try {
    const kol = await gameMatchCol();
    const [undangan, berjalan] = await Promise.all([
      kol.find({ status: "menunggu", undangPid: me.pid }).sort({ createdAt: -1 }).limit(5).toArray(),
      kol.find({ status: "main", "pemain.pid": me.pid }).sort({ createdAt: -1 }).limit(5).toArray()
    ]);
    const profil = await petaProfil([...undangan.map((g) => g.pemain[0].pid), ...berjalan.flatMap((g) => g.pemain.map((p) => p.pid))]);
    return {
      undangan: undangan.map((g) => ({ id: g.gameId, jenis: g.jenis, nama: MESIN[g.jenis].info.nama, ikon: MESIN[g.jenis].info.ikon, taruhan: g.taruhan, dari: profil[g.pemain[0].pid]?.nama || g.pemain[0].nama })),
      berjalan: berjalan.map((g) => {
        const st = bacaState(g);
        const lawan = lainDari(g, me.pid);
        return { id: g.gameId, jenis: g.jenis, nama: MESIN[g.jenis].info.nama, ikon: MESIN[g.jenis].info.ikon, taruhan: g.taruhan, lawan: profil[lawan.pid]?.nama || lawan.nama, giliranSaya: MESIN[g.jenis].giliran(st) === me.pid };
      })
    };
  } catch (err) {
    console.error("[game] ringkasan:", err?.message || err);
    return { undangan: [], berjalan: [] };
  }
}

// ─────────────────────────── PENYAPU (cron / admin) ───────────────────────────
/** Menyelesaikan yang macet: waktu habis, tantangan basi, kursi gabung tak selesai, pembayaran tertunda. */
export async function sapuGame({ batas = 40 } = {}) {
  const kol = await gameMatchCol();
  const sekarang = new Date();
  let diproses = 0;
  for (const g of await kol.find({ status: "main", deadline: { $lt: sekarang } }).limit(batas).toArray()) { if (await periksaWaktu(g)) diproses++; }
  for (const g of await kol.find({ status: "menunggu", kedaluwarsaAt: { $lt: sekarang } }).limit(batas).toArray()) { if (await batalkan(g.gameId, "kedaluwarsa")) diproses++; }
  // Kursi "gabung" yang macet: penantang dipotong tapi permainan tak sempat mulai → batalkan & kembalikan.
  for (const g of await kol.find({ status: "gabung", gabungAt: { $lt: new Date(Date.now() - MACET_GABUNG_MS) } }).limit(batas).toArray()) { if (await batalkan(g.gameId, "gagal dimulai")) diproses++; }
  for (const g of await kol.find({ bayarStatus: "antri" }).limit(batas).toArray()) { await bayarAntrian(g.gameId); diproses++; }
  return { diproses };
}

/** Admin: batalkan duel yang berjalan dan kembalikan semua taruhan. */
export async function batalkanPaksa(gameId) {
  const kol = await gameMatchCol();
  const g = await kol.findOne({ gameId: String(gameId) });
  if (!g) return { ok: false, alasan: "Duel tidak ditemukan." };
  if (g.status === "main") {
    const rencana = rencanaBayar(g, { seri: true });
    const klaim = await kol.findOneAndUpdate(
      { gameId: g.gameId, status: "main" },
      { $set: { status: "batal", hasil: { pemenang: null, seri: false, alasan: "dibatalkan admin", hadiah: 0, fee: 0 }, pembayaran: rencana.pembayaran, bayarStatus: rencana.pembayaran.length ? "antri" : "lunas", selesaiAt: new Date(), deadline: null } },
      { returnDocument: "after" }
    );
    if (!klaim) return { ok: false, alasan: "Status duel berubah. Muat ulang." };
    await bayarAntrian(g.gameId);
    for (const p of g.pemain) kabari(p.token, { judul: "Duel dibatalkan admin", isi: g.taruhan ? `Taruhan ${rupiah(g.taruhan)} dikembalikan.` : "Duel dibatalkan.", tipe: "game_hasil" }).catch(() => {});
    return { ok: true };
  }
  return { ok: await batalkan(g.gameId, "dibatalkan admin") };
}

export async function ringkasanAdmin() {
  const kol = await gameMatchCol();
  const semua = await kol.find({}).sort({ createdAt: -1 }).limit(60).toArray();
  const selesai = await kol.find({ status: "selesai" }).toArray();
  return {
    aktif: await kol.countDocuments({ status: { $in: ["menunggu", "gabung", "main"] } }),
    selesai: selesai.length,
    perputaran: selesai.reduce((a, g) => a + (g.taruhan || 0) * 2, 0),
    fee: selesai.reduce((a, g) => a + (g.hasil?.fee || 0), 0),
    belumLunas: await kol.countDocuments({ bayarStatus: "antri" }),
    daftar: semua.map((g) => ({
      id: g.gameId, jenis: g.jenis, status: g.status, taruhan: g.taruhan, bayarStatus: g.bayarStatus,
      pemain: g.pemain.map((p) => p.nama), pemenang: g.hasil?.pemenang ? namaPemain(g, g.hasil.pemenang) : null, alasan: g.hasil?.alasan || "",
      fee: g.hasil?.fee || 0, dibuat: g.createdAt
    }))
  };
}

export { waProfilCol };
