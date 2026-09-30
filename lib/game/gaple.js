// Domino Gaple untuk dua pemain (28 kartu domino, 0-0 … 6-6).
//
// • Tiap pemain 7 kartu; 14 sisanya "tidur" (tidak dipakai, tidak bisa diambil).
// • Pembuka: pemilik balak (kartu kembar) tertinggi, atau — bila tak ada balak — kartu dengan jumlah titik tertinggi.
//   Kartu pembuka dipasang otomatis; lawannya yang jalan lebih dulu.
// • Tiap giliran pasang SATU kartu yang angkanya sama dengan salah satu ujung rantai (kiri/kanan).
//   Tak punya kartu yang cocok = otomatis LEWAT (tidak ada tumpukan untuk diambil).
// • Menang: kartu habis duluan. Bila kedua pemain sama-sama buntu (TUTUP), jumlah titik tersisa paling kecil menang;
//   sama besar = seri.
import { kocok } from "./acak.js";

export const info = { kode: "gaple", nama: "Domino Gaple", ikon: "⚃", ringkas: "habiskan kartu domino duluan", batasGilirMs: 45_000, pemain: 2 };

const kunci = (a, b) => (a <= b ? `${a}-${b}` : `${b}-${a}`);
const pisah = (k) => k.split("-").map(Number);
const jumlah = (k) => { const [a, b] = pisah(k); return a + b; };
const lain = (s, pid) => (s.pemain[0] === pid ? s.pemain[1] : s.pemain[0]);

function semuaKartu() {
  const d = [];
  for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) d.push(`${a}-${b}`);
  return d;
}

/** Sisi yang mungkin untuk kartu `k` terhadap ujung rantai: { kiri, kanan }. */
function sisiBisa(s, k) {
  if (!s.ujung) return { kiri: true, kanan: true };
  const [a, b] = pisah(k);
  const [L, R] = s.ujung;
  return { kiri: a === L || b === L, kanan: a === R || b === R };
}
const bisaApaSaja = (s, pid) => s.tangan[pid].some((k) => { const x = sisiBisa(s, k); return x.kiri || x.kanan; });

function pasang(s, k, sisi) {
  const [a, b] = pisah(k);
  if (!s.rantai.length) { s.rantai.push([a, b]); s.ujung = [a, b]; return; }
  if (sisi === "kiri") {
    const L = s.ujung[0];
    const ubin = b === L ? [a, b] : [b, a]; // sisi luar di kiri
    s.rantai.unshift(ubin);
    s.ujung[0] = ubin[0];
  } else {
    const R = s.ujung[1];
    const ubin = a === R ? [a, b] : [b, a];
    s.rantai.push(ubin);
    s.ujung[1] = ubin[1];
  }
}

function catat(s, teks) {
  s.log.push(teks);
  if (s.log.length > 12) s.log.shift();
}

export function baru(pids, rng = Math.random) {
  const pemain = [pids[0], pids[1]];
  const dek = kocok(semuaKartu(), rng);
  const tangan = { [pemain[0]]: dek.slice(0, 7), [pemain[1]]: dek.slice(7, 14) };
  const s = { jenis: "gaple", pemain, tangan, tidur: dek.slice(14), rantai: [], ujung: null, giliran: pemain[0], lewatBerturut: 0, log: [], selesai: null };
  // Pembuka: balak tertinggi, selain itu jumlah titik tertinggi.
  let terbaik = null, pembuka = null;
  for (const pid of pemain) {
    for (const k of tangan[pid]) {
      const [a, b] = pisah(k);
      const nilai = (a === b ? 100 : 0) + a + b;
      if (terbaik === null || nilai > terbaik) { terbaik = nilai; pembuka = { pid, k }; }
    }
  }
  pasang(s, pembuka.k);
  tangan[pembuka.pid].splice(tangan[pembuka.pid].indexOf(pembuka.k), 1);
  s.pembuka = { pid: pembuka.pid, ubin: pembuka.k };
  catat(s, `buka ${pembuka.k}`);
  s.giliran = lain(s, pembuka.pid);
  lanjut(s);
  return s;
}

/** Setelah sebuah langkah: pindahkan giliran, lewati otomatis pemain yang buntu, dan tentukan akhir permainan. */
function lanjut(s) {
  if (s.selesai) return;
  for (let i = 0; i < 2; i++) {
    if (bisaApaSaja(s, s.giliran)) { s.lewatBerturut = 0; return; }
    catat(s, "lewat");
    s.lewatBerturut++;
    if (s.lewatBerturut >= 2) {
      const skor = Object.fromEntries(s.pemain.map((p) => [p, s.tangan[p].reduce((a, k) => a + jumlah(k), 0)]));
      const [p1, p2] = s.pemain;
      if (skor[p1] === skor[p2]) s.selesai = { pemenang: null, seri: true, alasan: `Buntu — skor sama (${skor[p1]})`, skor };
      else {
        const menang = skor[p1] < skor[p2] ? p1 : p2;
        s.selesai = { pemenang: menang, seri: false, alasan: `Buntu — sisa titik ${skor[menang]} lawan ${skor[lain(s, menang)]}`, skor };
      }
      return;
    }
    s.giliran = lain(s, s.giliran);
  }
}

/** aksi: { tipe: "main", ubin: "3-5", sisi?: "kiri" | "kanan" } */
export function aksi(s, pid, a) {
  if (s.selesai) return { ok: false, alasan: "Permainan sudah selesai." };
  if (!s.pemain.includes(pid)) return { ok: false, alasan: "Kamu bukan pemain di permainan ini." };
  if (s.giliran !== pid) return { ok: false, alasan: "Bukan giliranmu." };
  if (a?.tipe !== "main") return { ok: false, alasan: "Aksi tidak dikenal." };
  const k = String(a.ubin || "");
  if (!s.tangan[pid].includes(k)) return { ok: false, alasan: "Kartu itu tidak ada di tanganmu." };
  const bisa = sisiBisa(s, k);
  if (!bisa.kiri && !bisa.kanan) return { ok: false, alasan: "Kartu itu tidak cocok dengan ujung rantai." };
  let sisi = String(a.sisi || "");
  if (sisi !== "kiri" && sisi !== "kanan") sisi = bisa.kiri && bisa.kanan ? "" : bisa.kiri ? "kiri" : "kanan";
  if (!sisi) return { ok: false, alasan: "Pilih sisi kiri atau kanan." };
  if (!bisa[sisi]) return { ok: false, alasan: `Kartu itu tidak cocok di sisi ${sisi}.` };

  pasang(s, k, sisi);
  s.tangan[pid].splice(s.tangan[pid].indexOf(k), 1);
  catat(s, `${k} ${sisi}`);
  if (!s.tangan[pid].length) {
    s.selesai = { pemenang: pid, seri: false, alasan: "Kartu habis", skor: Object.fromEntries(s.pemain.map((p) => [p, s.tangan[p].reduce((x, y) => x + jumlah(y), 0)])) };
    return { ok: true, state: s };
  }
  s.giliran = lain(s, pid);
  lanjut(s);
  return { ok: true, state: s };
}

export const giliran = (s) => (s.selesai ? null : s.giliran);

export function tampil(s, pid) {
  const musuh = lain(s, pid);
  const saya = s.giliran === pid && !s.selesai;
  return {
    jenis: "gaple",
    tangan: [...s.tangan[pid]].sort((x, y) => jumlah(y) - jumlah(x) || (x < y ? -1 : 1)),
    jumlahLawan: s.tangan[musuh].length,
    rantai: s.rantai.map((u) => [...u]),
    ujung: s.ujung ? [...s.ujung] : null,
    giliranSaya: saya,
    bisa: saya ? s.tangan[pid].map((k) => ({ ubin: k, ...sisiBisa(s, k) })).filter((x) => x.kiri || x.kanan) : [],
    tidur: s.tidur.length,
    pembuka: s.pembuka,
    titikSaya: s.tangan[pid].reduce((a, k) => a + jumlah(k), 0),
    log: s.log.slice(-6),
    selesai: s.selesai ? { ...s.selesai, tanganLawan: [...s.tangan[musuh]] } : null
  };
}
