// Mahjong dua pemain (aturan sederhana, 136 ubin).
//
// Ubin: b1–b9 (bambu), c1–c9 (lingkaran), m1–m9 (karakter), z1–z4 (angin
// timur/selatan/barat/utara), z5–z7 (naga merah/hijau/putih), masing-masing 4.
//  • Tiap pemain mulai dengan 13 ubin. Giliran: AMBIL satu ubin dari dinding,
//    lalu BUANG satu ubin — atau TSUMO bila 14 ubin sudah membentuk tangan menang.
//  • Setelah lawan membuang, kamu boleh: RON (ubin itu melengkapi tangan
//    menangmu), PON (tiga ubin sama), CHI (urutan tiga ubin sejenis; angka saja),
//    atau LEWAT. PON/CHI membuka satu susunan lalu kamu wajib membuang satu ubin.
//  • Tangan menang: 4 susunan (tiga sama / urutan tiga) + 1 pasangan, atau
//    7 pasangan berbeda (hanya bila belum membuka susunan).
//  • Dinding tinggal 14 ubin (dinding mati) dan tidak ada yang menang → seri.
import { kocok } from "./acak.js";

export const info = { kode: "mahjong", nama: "Mahjong", ikon: "🀄", batasGilirMs: 60_000, pemain: 2 };

const JENIS = ["b", "c", "m", "z"];
const urutUbin = (a, b) => JENIS.indexOf(a[0]) - JENIS.indexOf(b[0]) || Number(a[1]) - Number(b[1]);
const angka = (u) => Number(u[1]);
const punyaUrutan = (u) => u[0] !== "z";
const DINDING_MATI = 14;

function buatDinding() {
  const d = [];
  for (const j of JENIS) {
    const maks = j === "z" ? 7 : 9;
    for (let n = 1; n <= maks; n++) for (let i = 0; i < 4; i++) d.push(j + n);
  }
  return d;
}

function hitung(ubin) {
  const m = new Map();
  for (const u of ubin) m.set(u, (m.get(u) || 0) + 1);
  return m;
}

function bisaSusun(m, jumlahSusunan) {
  if (jumlahSusunan === 0) return [...m.values()].every((v) => v === 0);
  const kunci = [...m.keys()].filter((k) => m.get(k) > 0).sort(urutUbin);
  if (!kunci.length) return false;
  const u = kunci[0];
  // tiga sama
  if (m.get(u) >= 3) {
    m.set(u, m.get(u) - 3);
    if (bisaSusun(m, jumlahSusunan - 1)) { m.set(u, m.get(u) + 3); return true; }
    m.set(u, m.get(u) + 3);
  }
  // urutan
  if (punyaUrutan(u) && angka(u) <= 7) {
    const b = u[0] + (angka(u) + 1), c = u[0] + (angka(u) + 2);
    if ((m.get(b) || 0) > 0 && (m.get(c) || 0) > 0) {
      m.set(u, m.get(u) - 1); m.set(b, m.get(b) - 1); m.set(c, m.get(c) - 1);
      const ok = bisaSusun(m, jumlahSusunan - 1);
      m.set(u, m.get(u) + 1); m.set(b, m.get(b) + 1); m.set(c, m.get(c) + 1);
      if (ok) return true;
    }
  }
  return false;
}

/** Apakah `ubin` (yang belum dibuka) + `dibuka` susunan terbuka membentuk tangan menang? */
export function tanganMenang(ubin, dibuka = 0) {
  const perlu = 4 - dibuka;
  if (ubin.length !== perlu * 3 + 2) return false;
  const m = hitung(ubin);
  if (dibuka === 0 && ubin.length === 14 && m.size === 7 && [...m.values()].every((v) => v === 2)) return true;
  for (const k of [...m.keys()]) {
    if (m.get(k) >= 2) {
      m.set(k, m.get(k) - 2);
      const ok = bisaSusun(m, perlu);
      m.set(k, m.get(k) + 2);
      if (ok) return true;
    }
  }
  return false;
}

const lain = (s, pid) => (s.pemain[0] === pid ? s.pemain[1] : s.pemain[0]);

export function baru(pids, rng = Math.random) {
  const d = kocok(buatDinding(), rng);
  const pemain = [pids[0], pids[1]];
  const s = {
    jenis: "mahjong",
    pemain,
    tangan: { [pemain[0]]: [], [pemain[1]]: [] },
    susunan: { [pemain[0]]: [], [pemain[1]]: [] },
    buangan: { [pemain[0]]: [], [pemain[1]]: [] },
    dinding: d,
    giliran: pemain[0],
    fase: "ambil", // ambil | buang | klaim
    ubinBuang: null,
    ambilTerakhir: null,
    selesai: null
  };
  for (let i = 0; i < 13; i++) { s.tangan[pemain[0]].push(s.dinding.pop()); s.tangan[pemain[1]].push(s.dinding.pop()); }
  s.tangan[pemain[0]].sort(urutUbin);
  s.tangan[pemain[1]].sort(urutUbin);
  return s;
}

function urutanChi(tangan, u) {
  if (!punyaUrutan(u)) return [];
  const n = angka(u), j = u[0];
  const ada = (x) => tangan.includes(j + x);
  const hasil = [];
  if (n >= 3 && ada(n - 2) && ada(n - 1)) hasil.push([j + (n - 2), j + (n - 1)]);
  if (n >= 2 && n <= 8 && ada(n - 1) && ada(n + 1)) hasil.push([j + (n - 1), j + (n + 1)]);
  if (n <= 7 && ada(n + 1) && ada(n + 2)) hasil.push([j + (n + 1), j + (n + 2)]);
  return hasil;
}

export function klaimTersedia(s, pid) {
  if (s.fase !== "klaim" || s.giliran === pid || !s.ubinBuang) return null;
  const tangan = s.tangan[pid];
  const u = s.ubinBuang;
  return {
    ron: tanganMenang([...tangan, u], s.susunan[pid].length),
    pon: tangan.filter((x) => x === u).length >= 2,
    chi: urutanChi(tangan, u)
  };
}

const hapus1 = (arr, u) => { const i = arr.indexOf(u); if (i >= 0) arr.splice(i, 1); return i >= 0; };

/**
 * aksi: { tipe: "ambil" } | { tipe: "buang", ubin } | { tipe: "tsumo" }
 *     | { tipe: "ron" } | { tipe: "pon" } | { tipe: "chi", pasangan: [a, b] } | { tipe: "lewat" }
 */
export function aksi(s, pid, a) {
  if (s.selesai) return { ok: false, alasan: "Permainan sudah selesai." };
  if (!s.pemain.includes(pid)) return { ok: false, alasan: "Kamu bukan pemain di permainan ini." };
  const musuh = lain(s, pid);

  // Klaim: giliran-nya ada pada LAWAN dari yang membuang.
  if (s.fase === "klaim") {
    if (pid === s.giliran) return { ok: false, alasan: "Menunggu lawan memutuskan." };
    const kl = klaimTersedia(s, pid);
    const u = s.ubinBuang;
    if (a?.tipe === "lewat") {
      s.giliran = pid;
      s.fase = "ambil";
      s.ubinBuang = null;
      return { ok: true, state: s };
    }
    if (a?.tipe === "ron") {
      if (!kl.ron) return { ok: false, alasan: "Ubin itu belum melengkapi tanganmu." };
      s.tangan[pid].push(u);
      s.buangan[musuh].pop();
      s.tangan[pid].sort(urutUbin);
      s.selesai = { pemenang: pid, seri: false, alasan: "Ron!", cara: "ron", tanganMenang: { tangan: [...s.tangan[pid]], susunan: s.susunan[pid] } };
      return { ok: true, state: s };
    }
    if (a?.tipe === "pon") {
      if (!kl.pon) return { ok: false, alasan: "Kamu tidak punya dua ubin yang sama." };
      hapus1(s.tangan[pid], u); hapus1(s.tangan[pid], u);
      s.buangan[musuh].pop();
      s.susunan[pid].push({ jenis: "pon", ubin: [u, u, u] });
    } else if (a?.tipe === "chi") {
      const p = Array.isArray(a.pasangan) ? a.pasangan.map(String) : [];
      const sah = kl.chi.find((x) => x[0] === p[0] && x[1] === p[1]);
      if (!sah) return { ok: false, alasan: "Urutan itu tidak bisa dibuat." };
      hapus1(s.tangan[pid], p[0]); hapus1(s.tangan[pid], p[1]);
      s.buangan[musuh].pop();
      s.susunan[pid].push({ jenis: "chi", ubin: [p[0], p[1], u].sort(urutUbin) });
    } else return { ok: false, alasan: "Aksi tidak dikenal." };
    s.giliran = pid;
    s.fase = "buang";
    s.ubinBuang = null;
    s.ambilTerakhir = null;
    return { ok: true, state: s };
  }

  if (s.giliran !== pid) return { ok: false, alasan: "Bukan giliranmu." };

  if (a?.tipe === "ambil") {
    if (s.fase !== "ambil") return { ok: false, alasan: "Kamu sudah mengambil ubin." };
    if (s.dinding.length <= DINDING_MATI) {
      s.selesai = { pemenang: null, seri: true, alasan: "Dinding habis, tidak ada yang menang" };
      return { ok: true, state: s };
    }
    const u = s.dinding.pop();
    s.tangan[pid].push(u);
    s.tangan[pid].sort(urutUbin);
    s.ambilTerakhir = u;
    s.fase = "buang";
    return { ok: true, state: s };
  }
  if (a?.tipe === "tsumo") {
    if (s.fase !== "buang") return { ok: false, alasan: "Ambil ubin dulu." };
    if (!tanganMenang(s.tangan[pid], s.susunan[pid].length)) return { ok: false, alasan: "Tanganmu belum menang." };
    s.selesai = { pemenang: pid, seri: false, alasan: "Tsumo!", cara: "tsumo", tanganMenang: { tangan: [...s.tangan[pid]], susunan: s.susunan[pid] } };
    return { ok: true, state: s };
  }
  if (a?.tipe === "buang") {
    if (s.fase !== "buang") return { ok: false, alasan: "Ambil ubin dulu." };
    const u = String(a.ubin || "");
    if (!s.tangan[pid].includes(u)) return { ok: false, alasan: "Ubin itu tidak ada di tanganmu." };
    hapus1(s.tangan[pid], u);
    s.buangan[pid].push(u);
    s.ubinBuang = u;
    s.ambilTerakhir = null;
    s.fase = "klaim";
    // giliran tetap pada pembuang; lawan yang memutuskan klaim.
    const kl = klaimTersedia(s, musuh);
    if (!kl.ron && !kl.pon && !kl.chi.length) {
      // Tidak ada yang bisa diklaim: langsung ke giliran lawan.
      s.giliran = musuh;
      s.fase = "ambil";
      s.ubinBuang = null;
    }
    return { ok: true, state: s };
  }
  return { ok: false, alasan: "Aksi tidak dikenal." };
}

/** Siapa yang sedang ditunggu (untuk batas waktu). */
export function giliran(s) {
  if (s.selesai) return null;
  return s.fase === "klaim" ? lain(s, s.giliran) : s.giliran;
}

export function tampil(s, pid) {
  const musuh = lain(s, pid);
  const aku = giliran(s) === pid;
  const kl = aku && s.fase === "klaim" ? klaimTersedia(s, pid) : null;
  return {
    jenis: "mahjong",
    tangan: [...s.tangan[pid]],
    susunanSaya: s.susunan[pid],
    susunanLawan: s.susunan[musuh],
    jumlahLawan: s.tangan[musuh].length,
    buanganSaya: s.buangan[pid],
    buanganLawan: s.buangan[musuh],
    sisaDinding: Math.max(0, s.dinding.length - DINDING_MATI),
    giliranSaya: aku,
    fase: s.fase,
    ubinBuang: s.fase === "klaim" ? s.ubinBuang : null,
    ambilTerakhir: s.giliran === pid ? s.ambilTerakhir : null,
    bisaTsumo: aku && s.fase === "buang" && tanganMenang(s.tangan[pid], s.susunan[pid].length),
    klaim: kl,
    selesai: s.selesai ? { ...s.selesai, tanganLawan: [...s.tangan[musuh]], susunanLawan: s.susunan[musuh] } : null
  };
}
