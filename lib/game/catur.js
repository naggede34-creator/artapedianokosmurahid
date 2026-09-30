// Catur lengkap untuk dua pemain: semua gerakan sah, rokade, en passant,
// promosi, skak, skakmat, pat, remis (material kurang, aturan 50 langkah,
// pengulangan tiga kali, atau disetujui kedua pihak).
//
// Papan: 64 petak, indeks = baris*8 + kolom, baris 0 = rank 8 (sisi hitam),
// kolom 0 = file a. Bidak ditulis dua huruf: warna (w/b) + jenis (PNBRQK).
export const info = { kode: "catur", nama: "Catur", ikon: "♟", batasGilirMs: 180_000, pemain: 2 };

const AWAL = [
  "bR", "bN", "bB", "bQ", "bK", "bB", "bN", "bR",
  "bP", "bP", "bP", "bP", "bP", "bP", "bP", "bP",
  ...Array(32).fill(null),
  "wP", "wP", "wP", "wP", "wP", "wP", "wP", "wP",
  "wR", "wN", "wB", "wQ", "wK", "wB", "wN", "wR"
];

const lawan = (w) => (w === "w" ? "b" : "w");
const baris = (i) => i >> 3;
const kolom = (i) => i & 7;
const dalam = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
const NAMA_PETAK = (i) => "abcdefgh"[kolom(i)] + (8 - baris(i));

const LONCAT = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
const RAJA = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const LURUS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

function diserang(papan, petak, olehWarna) {
  const r = baris(petak), c = kolom(petak);
  // bidak pion: pion putih menyerang ke atas (baris berkurang)
  const dr = olehWarna === "w" ? 1 : -1;
  for (const dc of [-1, 1]) {
    const rr = r + dr, cc = c + dc;
    if (dalam(rr, cc) && papan[rr * 8 + cc] === olehWarna + "P") return true;
  }
  for (const [a, b] of LONCAT) {
    const rr = r + a, cc = c + b;
    if (dalam(rr, cc) && papan[rr * 8 + cc] === olehWarna + "N") return true;
  }
  for (const [a, b] of RAJA) {
    const rr = r + a, cc = c + b;
    if (dalam(rr, cc) && papan[rr * 8 + cc] === olehWarna + "K") return true;
  }
  for (const [arah, jenis] of [[LURUS, "R"], [DIAG, "B"]]) {
    for (const [a, b] of arah) {
      let rr = r + a, cc = c + b;
      while (dalam(rr, cc)) {
        const p = papan[rr * 8 + cc];
        if (p) {
          if (p[0] === olehWarna && (p[1] === jenis || p[1] === "Q")) return true;
          break;
        }
        rr += a; cc += b;
      }
    }
  }
  return false;
}

function cariRaja(papan, w) {
  return papan.indexOf(w + "K");
}

/** Semua langkah pseudo-sah (belum disaring soal raja sendiri terkena skak). */
function langkahPseudo(s, warna) {
  const { papan } = s;
  const hasil = [];
  for (let i = 0; i < 64; i++) {
    const p = papan[i];
    if (!p || p[0] !== warna) continue;
    const r = baris(i), c = kolom(i);
    const jenis = p[1];
    if (jenis === "P") {
      const dr = warna === "w" ? -1 : 1;
      const awal = warna === "w" ? 6 : 1;
      const akhir = warna === "w" ? 0 : 7;
      const tambah = (ke, ekstra = {}) => {
        if (baris(ke) === akhir) for (const promo of ["Q", "R", "B", "N"]) hasil.push({ dari: i, ke, promo, ...ekstra });
        else hasil.push({ dari: i, ke, ...ekstra });
      };
      if (dalam(r + dr, c) && !papan[(r + dr) * 8 + c]) {
        tambah((r + dr) * 8 + c);
        if (r === awal && !papan[(r + 2 * dr) * 8 + c]) hasil.push({ dari: i, ke: (r + 2 * dr) * 8 + c, dua: true });
      }
      for (const dc of [-1, 1]) {
        const rr = r + dr, cc = c + dc;
        if (!dalam(rr, cc)) continue;
        const ke = rr * 8 + cc;
        const t = papan[ke];
        if (t && t[0] !== warna) tambah(ke, { tangkap: true });
        else if (!t && s.ep === ke) hasil.push({ dari: i, ke, ep: true, tangkap: true });
      }
    } else if (jenis === "N" || jenis === "K") {
      for (const [a, b] of jenis === "N" ? LONCAT : RAJA) {
        const rr = r + a, cc = c + b;
        if (!dalam(rr, cc)) continue;
        const t = papan[rr * 8 + cc];
        if (!t || t[0] !== warna) hasil.push({ dari: i, ke: rr * 8 + cc, tangkap: !!t });
      }
      if (jenis === "K") {
        const baseR = warna === "w" ? 7 : 0;
        if (i === baseR * 8 + 4 && !diserang(papan, i, lawan(warna))) {
          const hak = s.rokade;
          if (hak[warna + "K"] && !papan[baseR * 8 + 5] && !papan[baseR * 8 + 6] && papan[baseR * 8 + 7] === warna + "R"
            && !diserang(papan, baseR * 8 + 5, lawan(warna)) && !diserang(papan, baseR * 8 + 6, lawan(warna))) {
            hasil.push({ dari: i, ke: baseR * 8 + 6, rokade: "K" });
          }
          if (hak[warna + "Q"] && !papan[baseR * 8 + 3] && !papan[baseR * 8 + 2] && !papan[baseR * 8 + 1] && papan[baseR * 8] === warna + "R"
            && !diserang(papan, baseR * 8 + 3, lawan(warna)) && !diserang(papan, baseR * 8 + 2, lawan(warna))) {
            hasil.push({ dari: i, ke: baseR * 8 + 2, rokade: "Q" });
          }
        }
      }
    } else {
      const arah = jenis === "R" ? LURUS : jenis === "B" ? DIAG : [...LURUS, ...DIAG];
      for (const [a, b] of arah) {
        let rr = r + a, cc = c + b;
        while (dalam(rr, cc)) {
          const t = papan[rr * 8 + cc];
          if (!t) hasil.push({ dari: i, ke: rr * 8 + cc });
          else {
            if (t[0] !== warna) hasil.push({ dari: i, ke: rr * 8 + cc, tangkap: true });
            break;
          }
          rr += a; cc += b;
        }
      }
    }
  }
  return hasil;
}

/** Terapkan langkah pada salinan keadaan (tanpa memeriksa keabsahan). */
function jalankan(s, m) {
  const papan = [...s.papan];
  const p = papan[m.dari];
  const warna = p[0];
  const rokade = { ...s.rokade };
  let ep = null;
  let tangkap = !!papan[m.ke];
  papan[m.dari] = null;
  if (m.ep) {
    papan[m.ke + (warna === "w" ? 8 : -8)] = null;
    tangkap = true;
  }
  papan[m.ke] = m.promo ? warna + m.promo : p;
  if (m.rokade === "K") { papan[m.ke - 1] = papan[m.ke + 1]; papan[m.ke + 1] = null; }
  if (m.rokade === "Q") { papan[m.ke + 1] = papan[m.ke - 2]; papan[m.ke - 2] = null; }
  if (m.dua) ep = (m.dari + m.ke) / 2;
  if (p[1] === "K") { rokade[warna + "K"] = false; rokade[warna + "Q"] = false; }
  for (const [petak, kunci] of [[56, "wQ"], [63, "wK"], [0, "bQ"], [7, "bK"]]) {
    if (m.dari === petak || m.ke === petak) rokade[kunci] = false;
  }
  return {
    papan, rokade, ep,
    giliranWarna: lawan(warna),
    setengah: p[1] === "P" || tangkap ? 0 : s.setengah + 1,
    penuh: s.penuh + (warna === "b" ? 1 : 0)
  };
}

export function langkahSah(s, warna = s.giliranWarna) {
  const keadaan = { papan: s.papan, rokade: s.rokade, ep: s.ep };
  return langkahPseudo(keadaan, warna).filter((m) => {
    const t = jalankan({ ...keadaan, setengah: 0, penuh: 1 }, m);
    return !diserang(t.papan, cariRaja(t.papan, warna), lawan(warna));
  });
}

const kunciPosisi = (s, warna) => `${s.papan.map((x) => x || "-").join("")}|${warna}|${Object.entries(s.rokade).filter(([, v]) => v).map(([k]) => k).join("")}|${s.ep ?? ""}`;

function materialKurang(papan) {
  const sisa = papan.filter((x) => x && x[1] !== "K");
  if (!sisa.length) return true;
  if (sisa.length === 1 && (sisa[0][1] === "B" || sisa[0][1] === "N")) return true;
  if (sisa.every((x) => x[1] === "B")) {
    const warnaPetak = new Set(papan.map((x, i) => (x && x[1] === "B" ? (baris(i) + kolom(i)) % 2 : null)).filter((x) => x !== null));
    return warnaPetak.size === 1;
  }
  return false;
}

export function baru(pids) {
  const s = {
    jenis: "catur",
    pemain: [pids[0], pids[1]], // pemain[0] = putih, pemain[1] = hitam
    papan: [...AWAL],
    giliranWarna: "w",
    giliran: pids[0],
    rokade: { wK: true, wQ: true, bK: true, bQ: true },
    ep: null,
    setengah: 0,
    penuh: 1,
    riwayat: [],
    ulang: {},
    tawarSeri: null,
    selesai: null
  };
  s.ulang[kunciPosisi(s, "w")] = 1;
  return s;
}

const warnaDari = (s, pid) => (s.pemain[0] === pid ? "w" : s.pemain[1] === pid ? "b" : null);

/**
 * aksi: { tipe: "jalan", dari, ke, promo? } | { tipe: "tawarSeri" } | { tipe: "terimaSeri" } | { tipe: "tolakSeri" }
 * Mengembalikan { ok, state } (state dimodifikasi di tempat) atau { ok:false, alasan }.
 */
export function aksi(s, pid, a) {
  if (s.selesai) return { ok: false, alasan: "Permainan sudah selesai." };
  const w = warnaDari(s, pid);
  if (!w) return { ok: false, alasan: "Kamu bukan pemain di permainan ini." };

  if (a?.tipe === "tawarSeri") {
    if (s.tawarSeri) return { ok: false, alasan: "Tawaran remis sudah ada." };
    s.tawarSeri = pid;
    return { ok: true, state: s };
  }
  if (a?.tipe === "terimaSeri") {
    if (!s.tawarSeri || s.tawarSeri === pid) return { ok: false, alasan: "Tidak ada tawaran remis dari lawan." };
    s.selesai = { pemenang: null, seri: true, alasan: "Remis disepakati" };
    return { ok: true, state: s };
  }
  if (a?.tipe === "tolakSeri") {
    if (!s.tawarSeri || s.tawarSeri === pid) return { ok: false, alasan: "Tidak ada tawaran remis dari lawan." };
    s.tawarSeri = null;
    return { ok: true, state: s };
  }
  if (a?.tipe !== "jalan") return { ok: false, alasan: "Aksi tidak dikenal." };
  if (s.giliranWarna !== w) return { ok: false, alasan: "Bukan giliranmu." };

  const dari = Number(a.dari), ke = Number(a.ke);
  if (!Number.isInteger(dari) || !Number.isInteger(ke) || dari < 0 || dari > 63 || ke < 0 || ke > 63) return { ok: false, alasan: "Petak tidak valid." };
  const kandidat = langkahSah(s, w).filter((m) => m.dari === dari && m.ke === ke);
  if (!kandidat.length) return { ok: false, alasan: "Langkah itu tidak sah." };
  let m = kandidat[0];
  if (kandidat.length > 1) {
    const promo = String(a.promo || "Q").toUpperCase();
    m = kandidat.find((x) => x.promo === promo);
    if (!m) return { ok: false, alasan: "Pilih bidak promosi (V, R, B, atau N)." };
  }

  const t = jalankan(s, m);
  const bidak = s.papan[m.dari];
  s.papan = t.papan;
  s.rokade = t.rokade;
  s.ep = t.ep;
  s.setengah = t.setengah;
  s.penuh = t.penuh;
  s.giliranWarna = t.giliranWarna;
  s.giliran = s.pemain[t.giliranWarna === "w" ? 0 : 1];
  s.tawarSeri = null;

  const sah = langkahSah(s, t.giliranWarna);
  const skak = diserang(s.papan, cariRaja(s.papan, t.giliranWarna), w);
  const mat = skak && sah.length === 0;
  s.riwayat.push({ dari, ke, promo: m.promo || null, bidak, san: sanDariBidak(bidak, m, skak, mat), skak });

  const kunci = kunciPosisi(s, s.giliranWarna);
  s.ulang[kunci] = (s.ulang[kunci] || 0) + 1;

  if (mat) s.selesai = { pemenang: pid, seri: false, alasan: "Skakmat" };
  else if (!sah.length) s.selesai = { pemenang: null, seri: true, alasan: "Pat (tidak ada langkah sah)" };
  else if (materialKurang(s.papan)) s.selesai = { pemenang: null, seri: true, alasan: "Material tidak cukup untuk skakmat" };
  else if (s.setengah >= 100) s.selesai = { pemenang: null, seri: true, alasan: "Aturan 50 langkah" };
  else if (s.ulang[kunci] >= 3) s.selesai = { pemenang: null, seri: true, alasan: "Posisi berulang tiga kali" };
  return { ok: true, state: s };
}

function sanDariBidak(bidak, m, skak, mat) {
  if (m.rokade) return (m.rokade === "K" ? "O-O" : "O-O-O") + (mat ? "#" : skak ? "+" : "");
  const jenis = bidak[1] === "P" ? "" : bidak[1];
  const asal = bidak[1] === "P" && m.tangkap ? "abcdefgh"[kolom(m.dari)] : "";
  return `${jenis}${asal}${m.tangkap ? "x" : ""}${NAMA_PETAK(m.ke)}${m.promo ? "=" + m.promo : ""}${mat ? "#" : skak ? "+" : ""}`;
}

export function giliran(s) {
  return s.selesai ? null : s.giliran;
}

/** Tampilan untuk satu pemain (catur tidak punya informasi tersembunyi). */
export function tampil(s, pid) {
  const w = warnaDari(s, pid);
  const giliranSaya = !s.selesai && s.giliranWarna === w;
  const langkah = giliranSaya ? langkahSah(s, w).map((m) => [m.dari, m.ke, m.promo ? 1 : 0]) : [];
  return {
    jenis: "catur",
    papan: s.papan,
    warnaSaya: w,
    giliranWarna: s.giliranWarna,
    giliranSaya,
    langkah, // [dari, ke, promosi?]
    skak: !s.selesai && diserang(s.papan, cariRaja(s.papan, s.giliranWarna), lawan(s.giliranWarna)),
    riwayat: s.riwayat.slice(-60).map((r) => ({ dari: r.dari, ke: r.ke, san: r.san })),
    langkahTerakhir: s.riwayat.length ? [s.riwayat[s.riwayat.length - 1].dari, s.riwayat[s.riwayat.length - 1].ke] : null,
    tawarSeri: s.tawarSeri ? (s.tawarSeri === pid ? "saya" : "lawan") : null,
    nomor: s.penuh,
    selesai: s.selesai
  };
}

// ── Untuk pengujian (perft): jumlah simpul langkah sah pada kedalaman tertentu.
export function dariFen(fen, pids = ["a", "b"]) {
  const [susun, giliranW, hak, ep, setengah, penuh] = fen.split(" ");
  const papan = [];
  for (const ch of susun) {
    if (ch === "/") continue;
    if (/\d/.test(ch)) for (let i = 0; i < Number(ch); i++) papan.push(null);
    else papan.push((ch === ch.toUpperCase() ? "w" : "b") + ch.toUpperCase());
  }
  const s = baru(pids);
  s.papan = papan;
  s.giliranWarna = giliranW;
  s.giliran = pids[giliranW === "w" ? 0 : 1];
  s.rokade = { wK: hak.includes("K"), wQ: hak.includes("Q"), bK: hak.includes("k"), bQ: hak.includes("q") };
  s.ep = ep === "-" ? null : (8 - Number(ep[1])) * 8 + "abcdefgh".indexOf(ep[0]);
  s.setengah = Number(setengah || 0);
  s.penuh = Number(penuh || 1);
  return s;
}

export function perft(s, kedalaman) {
  if (kedalaman === 0) return 1;
  let total = 0;
  for (const m of langkahSah(s, s.giliranWarna)) {
    const t = jalankan(s, m);
    const anak = { ...s, papan: t.papan, rokade: t.rokade, ep: t.ep, giliranWarna: t.giliranWarna, setengah: t.setengah, penuh: t.penuh };
    total += kedalaman === 1 ? 1 : perft(anak, kedalaman - 1);
  }
  return total;
}
