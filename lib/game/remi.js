// Remi dua pemain (gaya Gin Rummy): 10 kartu per pemain.
//
// Giliran: AMBIL satu kartu (dari tumpukan tertutup atau dari kartu buangan
// teratas), lalu BUANG satu kartu — atau TUTUP: buang satu kartu dan buka tangan
// bila poin sisa (kartu yang tidak masuk susunan) ≤ 10.
//  • Susunan sah: tiga/empat kartu senilai (set) atau tiga kartu berurutan
//    sejenis (run; As hanya sebagai kartu terendah, A-2-3).
//  • Nilai sisa: As = 1, 2–9 = angkanya, 10/J/Q/K = 10.
//  • Lawan boleh "menempelkan" kartu sisanya ke susunan penutup, kecuali
//    penutup Gin (sisa 0).
//  • Poin sisa penutup lebih KECIL dari lawan → penutup menang. Sama atau
//    lebih besar → lawan menang (undercut).
//  • Tumpukan tertutup tinggal 2 kartu → seri.
import { kocok } from "./acak.js";

export const info = { kode: "remi", nama: "Remi", ikon: "🂡", ringkas: "susun set & urutan, tutup dengan gin", batasGilirMs: 90_000, pemain: 2 };

const PANGKAT = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K"];
const JENIS = ["S", "H", "D", "C"];
const nilaiRank = (k) => PANGKAT.indexOf(k[0]) + 1;
const nilaiKartu = (k) => Math.min(10, nilaiRank(k));
const jenisKartu = (k) => k[1];
export const urutKartu = (a, b) => JENIS.indexOf(a[1]) - JENIS.indexOf(b[1]) || nilaiRank(a) - nilaiRank(b);

function buatDek() {
  const d = [];
  for (const j of JENIS) for (const p of PANGKAT) d.push(p + j);
  return d;
}

/** Semua susunan yang mungkin dari sekumpulan kartu (sebagai daftar indeks). */
function kandidatSusunan(kartu) {
  const hasil = [];
  const n = kartu.length;
  // set
  for (const p of PANGKAT) {
    const idx = [];
    kartu.forEach((k, i) => { if (k[0] === p) idx.push(i); });
    if (idx.length >= 3) {
      for (let a = 0; a < idx.length; a++) for (let b = a + 1; b < idx.length; b++) for (let c = b + 1; c < idx.length; c++) {
        hasil.push([idx[a], idx[b], idx[c]]);
        for (let d = c + 1; d < idx.length; d++) hasil.push([idx[a], idx[b], idx[c], idx[d]]);
      }
    }
  }
  // run
  for (const j of JENIS) {
    const oleh = new Map();
    kartu.forEach((k, i) => { if (k[1] === j) oleh.set(nilaiRank(k), i); });
    for (let awal = 1; awal <= 11; awal++) {
      for (let akhir = awal + 2; akhir <= 13; akhir++) {
        const idx = [];
        let lengkap = true;
        for (let r = awal; r <= akhir; r++) {
          if (!oleh.has(r)) { lengkap = false; break; }
          idx.push(oleh.get(r));
        }
        if (lengkap) hasil.push(idx);
      }
    }
  }
  void n;
  return hasil;
}

/** Susunan terbaik: meminimalkan poin sisa. */
export function susunTerbaik(kartu) {
  const cand = kandidatSusunan(kartu).map((idx) => ({ idx, mask: idx.reduce((m, i) => m | (1 << i), 0), nilai: idx.reduce((a, i) => a + nilaiKartu(kartu[i]), 0) }));
  let terbaik = { nilai: 0, pilih: [] };
  function dfs(mulai, pakai, nilai, pilih) {
    if (nilai > terbaik.nilai) terbaik = { nilai, pilih: [...pilih] };
    for (let i = mulai; i < cand.length; i++) {
      if (cand[i].mask & pakai) continue;
      pilih.push(i);
      dfs(i + 1, pakai | cand[i].mask, nilai + cand[i].nilai, pilih);
      pilih.pop();
    }
  }
  dfs(0, 0, 0, []);
  const dipakai = new Set();
  const susunan = terbaik.pilih.map((i) => cand[i].idx.map((x) => { dipakai.add(x); return kartu[x]; }));
  const sisa = kartu.filter((_, i) => !dipakai.has(i));
  return { susunan, sisa, poin: sisa.reduce((a, k) => a + nilaiKartu(k), 0) };
}

const lain = (s, pid) => (s.pemain[0] === pid ? s.pemain[1] : s.pemain[0]);

export function baru(pids, rng = Math.random) {
  const d = kocok(buatDek(), rng);
  const pemain = [pids[0], pids[1]];
  const s = {
    jenis: "remi",
    pemain,
    tangan: { [pemain[0]]: [], [pemain[1]]: [] },
    tumpukan: [],
    buangan: [],
    giliran: pemain[0],
    fase: "ambil",
    dariBuangan: null,
    selesai: null
  };
  for (let i = 0; i < 10; i++) { s.tangan[pemain[0]].push(d.pop()); s.tangan[pemain[1]].push(d.pop()); }
  s.tangan[pemain[0]].sort(urutKartu);
  s.tangan[pemain[1]].sort(urutKartu);
  s.buangan = [d.pop()];
  s.tumpukan = d;
  return s;
}

/** Tempelkan kartu sisa lawan ke susunan penutup. */
function tempel(susunan, sisa) {
  const susun = susunan.map((m) => [...m]);
  let sisaBaru = [...sisa];
  let berubah = true;
  while (berubah) {
    berubah = false;
    for (const k of [...sisaBaru]) {
      for (const m of susun) {
        const set = m.every((x) => x[0] === m[0][0]);
        if (set) {
          if (k[0] === m[0][0] && m.length < 4 && !m.includes(k)) { m.push(k); sisaBaru = sisaBaru.filter((x) => x !== k); berubah = true; break; }
        } else {
          const rank = m.map(nilaiRank).sort((a, b) => a - b);
          if (k[1] === m[0][1]) {
            const r = nilaiRank(k);
            if (r === rank[0] - 1 || r === rank[rank.length - 1] + 1) { m.push(k); sisaBaru = sisaBaru.filter((x) => x !== k); berubah = true; break; }
          }
        }
      }
    }
  }
  return { susun, sisa: sisaBaru };
}

function selesaikanTutup(s, penutup) {
  const musuh = lain(s, penutup);
  const a = susunTerbaik(s.tangan[penutup]);
  const b = susunTerbaik(s.tangan[musuh]);
  const gin = a.poin === 0;
  let meldB = b.susunan, sisaB = b.sisa;
  if (!gin) {
    const t = tempel(a.susunan, b.sisa);
    // Kartu yang ditempel dilepas dari sisa lawan; susunan penutup tak diubah untuk tampilan.
    sisaB = t.sisa;
  }
  const poinB = sisaB.reduce((x, k) => x + nilaiKartu(k), 0);
  const menang = a.poin < poinB ? penutup : musuh;
  s.selesai = {
    pemenang: menang, seri: false,
    alasan: gin ? "Gin! (sisa 0)" : menang === penutup ? `Tutup: sisa ${a.poin} lawan ${poinB}` : `Undercut: sisa ${a.poin} tidak lebih kecil dari ${poinB}`,
    penutup, gin, undercut: menang !== penutup,
    tanganPenutup: { susunan: a.susunan, sisa: a.sisa, poin: a.poin },
    tanganLawan: { susunan: meldB, sisa: sisaB, poin: poinB }
  };
}

/**
 * aksi: { tipe: "ambilTumpukan" } | { tipe: "ambilBuangan" } | { tipe: "buang", kartu } | { tipe: "tutup", kartu }
 */
export function aksi(s, pid, a) {
  if (s.selesai) return { ok: false, alasan: "Permainan sudah selesai." };
  if (!s.pemain.includes(pid)) return { ok: false, alasan: "Kamu bukan pemain di permainan ini." };
  if (s.giliran !== pid) return { ok: false, alasan: "Bukan giliranmu." };
  const tangan = s.tangan[pid];

  if (a?.tipe === "ambilTumpukan" || a?.tipe === "ambilBuangan") {
    if (s.fase !== "ambil") return { ok: false, alasan: "Kamu sudah mengambil kartu. Sekarang buang satu." };
    if (a.tipe === "ambilTumpukan") {
      if (!s.tumpukan.length) return { ok: false, alasan: "Tumpukan habis." };
      tangan.push(s.tumpukan.pop());
      s.dariBuangan = null;
    } else {
      if (!s.buangan.length) return { ok: false, alasan: "Belum ada kartu buangan." };
      const k = s.buangan.pop();
      tangan.push(k);
      s.dariBuangan = k;
    }
    tangan.sort(urutKartu);
    s.fase = "buang";
    return { ok: true, state: s };
  }

  if (a?.tipe === "buang" || a?.tipe === "tutup") {
    if (s.fase !== "buang") return { ok: false, alasan: "Ambil kartu dulu." };
    const k = String(a.kartu || "");
    if (!tangan.includes(k)) return { ok: false, alasan: "Kartu itu tidak ada di tanganmu." };
    if (s.dariBuangan && k === s.dariBuangan) return { ok: false, alasan: "Kartu yang baru diambil dari buangan tidak boleh langsung dibuang lagi." };
    const sisaTangan = tangan.filter((x, i) => i !== tangan.indexOf(k));
    if (a.tipe === "tutup") {
      const poin = susunTerbaik(sisaTangan).poin;
      if (poin > 10) return { ok: false, alasan: `Poin sisamu ${poin}. Boleh menutup jika 10 atau kurang.` };
    }
    s.tangan[pid] = sisaTangan;
    s.buangan.push(k);
    s.dariBuangan = null;
    if (a.tipe === "tutup") {
      selesaikanTutup(s, pid);
      return { ok: true, state: s };
    }
    if (s.tumpukan.length <= 2) {
      s.selesai = { pemenang: null, seri: true, alasan: "Tumpukan habis tanpa ada yang menutup" };
      return { ok: true, state: s };
    }
    s.giliran = lain(s, pid);
    s.fase = "ambil";
    return { ok: true, state: s };
  }
  return { ok: false, alasan: "Aksi tidak dikenal." };
}

export const giliran = (s) => (s.selesai ? null : s.giliran);

export function tampil(s, pid) {
  const musuh = lain(s, pid);
  const saya = s.giliran === pid && !s.selesai;
  const sus = susunTerbaik(s.tangan[pid]);
  let bisaTutup = [];
  if (saya && s.fase === "buang") {
    bisaTutup = s.tangan[pid].filter((k) => k !== s.dariBuangan && susunTerbaik(s.tangan[pid].filter((x, i) => i !== s.tangan[pid].indexOf(k))).poin <= 10);
  }
  return {
    jenis: "remi",
    tangan: [...s.tangan[pid]],
    jumlahLawan: s.tangan[musuh].length,
    atasBuangan: s.buangan[s.buangan.length - 1] || null,
    buangan: s.buangan.slice(-8),
    sisaTumpukan: s.tumpukan.length,
    giliranSaya: saya,
    fase: s.fase,
    dariBuangan: saya ? s.dariBuangan : null,
    susunanSaya: sus.susunan,
    sisaSaya: sus.sisa,
    poinSaya: sus.poin,
    bisaTutup,
    selesai: s.selesai ? { ...s.selesai } : null
  };
}
