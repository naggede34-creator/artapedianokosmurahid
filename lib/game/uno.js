// UNO untuk dua pemain (108 kartu).
//
// Kartu ditulis warna+isi: R/Y/G/B + 0-9, S (lewati), V (balik), D (ambil 2);
// kartu liar: "W" (pilih warna) dan "F" (pilih warna + lawan ambil 4).
// Aturan dua pemain: Lewati dan Balik sama-sama membuat lawan kehilangan giliran.
// Kartu "F" hanya boleh dimainkan bila tidak ada kartu berwarna sama di tangan.
// Pemenang: yang duluan menghabiskan kartu. Panggilan "UNO!" otomatis.
import { kocok } from "./acak.js";

export const info = { kode: "uno", nama: "UNO", ikon: "🃏", batasGilirMs: 60_000, pemain: 2 };

const WARNA = ["R", "Y", "G", "B"];

function buatDek() {
  const dek = [];
  for (const w of WARNA) {
    dek.push(w + "0");
    for (let n = 1; n <= 9; n++) dek.push(w + n, w + n);
    for (const k of ["S", "V", "D"]) dek.push(w + k, w + k);
  }
  for (let i = 0; i < 4; i++) dek.push("W", "F");
  return dek;
}

const liar = (k) => k === "W" || k === "F";
const warnaKartu = (k) => (liar(k) ? null : k[0]);
const isiKartu = (k) => (liar(k) ? k : k[1]);
const lain = (s, pid) => (s.pemain[0] === pid ? s.pemain[1] : s.pemain[0]);

function ambilKartu(s, pid, n, rng) {
  let diambil = 0;
  for (let i = 0; i < n; i++) {
    if (!s.tumpukan.length) {
      // Kocok ulang buangan (kecuali kartu teratas).
      const atas = s.buangan.pop();
      s.tumpukan = kocok(s.buangan, rng);
      s.buangan = [atas];
    }
    if (!s.tumpukan.length) break;
    s.tangan[pid].push(s.tumpukan.pop());
    diambil++;
  }
  return diambil;
}

export function bisaMain(s, pid, kartu) {
  const atas = s.buangan[s.buangan.length - 1];
  if (!s.tangan[pid].includes(kartu)) return false;
  if (kartu === "W") return true;
  if (kartu === "F") return !s.tangan[pid].some((k) => warnaKartu(k) === s.warna);
  return warnaKartu(kartu) === s.warna || isiKartu(kartu) === isiKartu(atas);
}

export function baru(pids, rng = Math.random) {
  const pemain = [pids[0], pids[1]];
  let dek = kocok(buatDek(), rng);
  const s = {
    jenis: "uno",
    pemain,
    tangan: { [pemain[0]]: [], [pemain[1]]: [] },
    tumpukan: [],
    buangan: [],
    warna: null,
    giliran: pemain[0],
    sudahAmbil: false,
    log: [],
    selesai: null
  };
  for (let i = 0; i < 7; i++) { s.tangan[pemain[0]].push(dek.pop()); s.tangan[pemain[1]].push(dek.pop()); }
  // Kartu pembuka harus kartu angka.
  let idx = dek.length - 1;
  while (idx >= 0 && !/^[RYGB][0-9]$/.test(dek[idx])) idx--;
  const buka = dek.splice(idx, 1)[0];
  s.buangan = [buka];
  s.warna = buka[0];
  s.tumpukan = dek;
  return s;
}

function catat(s, teks) {
  s.log.push(teks);
  if (s.log.length > 12) s.log.shift();
}

/**
 * aksi: { tipe: "main", kartu, warna? } | { tipe: "ambil" } | { tipe: "lewat" }
 */
export function aksi(s, pid, a, rng = Math.random) {
  if (s.selesai) return { ok: false, alasan: "Permainan sudah selesai." };
  if (!s.pemain.includes(pid)) return { ok: false, alasan: "Kamu bukan pemain di permainan ini." };
  if (s.giliran !== pid) return { ok: false, alasan: "Bukan giliranmu." };
  const musuh = lain(s, pid);

  if (a?.tipe === "ambil") {
    if (s.sudahAmbil) return { ok: false, alasan: "Kamu sudah mengambil kartu di giliran ini." };
    // Boleh ambil hanya kalau memang tidak punya kartu yang bisa dimainkan? Aturan resmi
    // membolehkan mengambil kapan saja; kita ikuti aturan resmi.
    const n = ambilKartu(s, pid, 1, rng);
    s.sudahAmbil = true;
    catat(s, "ambil");
    if (!n) { s.giliran = musuh; s.sudahAmbil = false; }
    return { ok: true, state: s };
  }
  if (a?.tipe === "lewat") {
    if (!s.sudahAmbil) return { ok: false, alasan: "Ambil kartu dulu sebelum melewati giliran." };
    s.giliran = musuh;
    s.sudahAmbil = false;
    catat(s, "lewat");
    return { ok: true, state: s };
  }
  if (a?.tipe !== "main") return { ok: false, alasan: "Aksi tidak dikenal." };

  const kartu = String(a.kartu || "");
  if (!bisaMain(s, pid, kartu)) return { ok: false, alasan: "Kartu itu tidak bisa dimainkan sekarang." };
  let warnaPilih = null;
  if (liar(kartu)) {
    warnaPilih = String(a.warna || "").toUpperCase();
    if (!WARNA.includes(warnaPilih)) return { ok: false, alasan: "Pilih warna dulu." };
  }
  const tangan = s.tangan[pid];
  tangan.splice(tangan.indexOf(kartu), 1);
  s.buangan.push(kartu);
  s.warna = warnaPilih || kartu[0];
  s.sudahAmbil = false;
  catat(s, kartu);

  if (!tangan.length) {
    s.selesai = { pemenang: pid, seri: false, alasan: "Kartu habis" };
    return { ok: true, state: s };
  }
  const isi = isiKartu(kartu);
  if (isi === "S" || isi === "V") {
    s.giliran = pid; // lawan dilewati
  } else if (isi === "D") {
    ambilKartu(s, musuh, 2, rng);
    s.giliran = pid;
  } else if (isi === "F") {
    ambilKartu(s, musuh, 4, rng);
    s.giliran = pid;
  } else {
    s.giliran = musuh;
  }
  return { ok: true, state: s };
}

export const giliran = (s) => (s.selesai ? null : s.giliran);

export function tampil(s, pid) {
  const musuh = lain(s, pid);
  const saya = s.giliran === pid && !s.selesai;
  return {
    jenis: "uno",
    tangan: [...s.tangan[pid]],
    jumlahLawan: s.tangan[musuh].length,
    atas: s.buangan[s.buangan.length - 1],
    warna: s.warna,
    sisaTumpukan: s.tumpukan.length,
    giliranSaya: saya,
    sudahAmbil: saya && s.sudahAmbil,
    bisa: saya ? s.tangan[pid].filter((k) => bisaMain(s, pid, k)) : [],
    riwayat: s.buangan.slice(-6),
    log: s.log.slice(-6),
    unoLawan: s.tangan[musuh].length === 1,
    unoSaya: s.tangan[pid].length === 1,
    selesai: s.selesai ? { ...s.selesai, tanganLawan: [...s.tangan[musuh]] } : null
  };
}
