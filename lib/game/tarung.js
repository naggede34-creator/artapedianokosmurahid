// ARENA PENDEKAR — duel tarung 1 lawan 1 antar pengguna, server-otoritatif.
//
// Alur:
//  1. Fase "pilih": kedua pemain memilih petarung (pilihan lawan disembunyikan sampai keduanya memilih).
//  2. Fase "tarung": tiap giliran KEDUA pemain memilih aksi secara RAHASIA (dikunci). Setelah keduanya memilih,
//     server menyelesaikan bentrokan (siapa lebih cepat, tangkis/hindar, bantingan, jurus khusus, pamungkas),
//     menghitung damage/combo/energi/efek, lalu kedua layar memutar animasinya.
//  3. Ronde: nyawa habis = K.O.; 14 giliran tanpa K.O. = nyawa terbanyak (persen) menang ronde. Dua ronde = menang.
//  Diam melewati batas waktu = otomatis "Tangkis Atas"; diam 3 giliran berturut-turut = kalah (AFK).
//
// Murni & deterministik (acak dari benih di dalam state) — mudah diuji tanpa server.
import { KARAKTER, URUTAN_KARAKTER, GERAK, URUTAN_GERAK, BIAYA_JURUS, BIAYA_PAMUNGKAS, daftarAksi } from "../tarung/karakter.js";

export const info = { kode: "tarung", nama: "Arena Pendekar", ikon: "🥋", ringkas: "pertarungan arcade 1 lawan 1", batasGilirMs: 20_000, pemain: 2, serentak: true };

export const MAKS_LANGKAH = 14;
export const MENANG_RONDE = 2;
export const MAKS_RONDE = 5;
export const AFK_MAKS = 3;
export const BATAS_PILIH_MS = 30_000;
export const BATAS_TARUNG_MS = 20_000;
export const ENERGI_AWAL = 25;
const SIMPAN_RIWAYAT = 6;
// Serangan yang memotong bantingan (penyerang bantingan terbuka tetapi tidak sedang menyerang balik).
export let PENGALI_POTONG_BANTING = 1;
export const aturPengaliPotong = (x) => { PENGALI_POTONG_BANTING = x; };

const lain = (s, pid) => (s.pemain[0] === pid ? s.pemain[1] : s.pemain[0]);
const nm = (s, pid) => s.nama?.[pid] || (pid === s.pemain[0] ? "Pemain 1" : "Pemain 2");
const kar = (s, pid) => KARAKTER[s.karakter[pid]];

/** Acak deterministik dari benih di state (mulberry32). */
function acak(s) {
  s.benih = (s.benih + 0x6d2b79f5) >>> 0;
  let t = s.benih;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function baru(pids, rng = Math.random, opsi = {}) {
  const [a, b] = pids;
  return {
    jenis: "tarung",
    pemain: [a, b],
    nama: { [a]: opsi.nama?.[a] || null, [b]: opsi.nama?.[b] || null },
    fase: "pilih",
    ke: 0, // nomor giliran yang sedang dipilih (dipakai klien supaya pilihan tidak nyasar ke giliran berikutnya)
    ronde: 1,
    langkah: 0,
    karakter: { [a]: null, [b]: null },
    pilihan: { [a]: null, [b]: null }, // RAHASIA sampai giliran diselesaikan
    hp: {}, hpMaks: {}, energi: {}, efek: {}, combo: {},
    menangRonde: { [a]: 0, [b]: 0 },
    idle: { [a]: 0, [b]: 0 },
    terakhir: null,
    arena: null,
    benih: Math.floor(rng() * 4294967296) >>> 0,
    riwayat: [],
    selesai: null
  };
}

function mulaiTarung(s) {
  const [a, b] = s.pemain;
  const pilihanArena = [kar(s, a).arena, kar(s, b).arena];
  s.arena = pilihanArena[Math.floor(acak(s) * 2)];
  for (const p of s.pemain) {
    s.hpMaks[p] = kar(s, p).stat.hp;
    s.energi[p] = ENERGI_AWAL;
  }
  s.fase = "tarung";
  s.ke = 1;
  resetRonde(s);
  catat(s, { ke: 0, tipe: "mulai", ronde: 1, karakter: { ...s.karakter }, arena: s.arena });
}

function resetRonde(s) {
  for (const p of s.pemain) {
    s.hp[p] = s.hpMaks[p];
    s.efek[p] = { beku: 0, bakar: 0 };
    s.combo[p] = 0;
    s.pilihan[p] = null;
  }
  s.langkah = 0;
}

function catat(s, rek) {
  s.riwayat.push(rek);
  if (s.riwayat.length > SIMPAN_RIWAYAT) s.riwayat.splice(0, s.riwayat.length - SIMPAN_RIWAYAT);
}

const perlu = (s, pid) => !s.selesai && (s.fase === "pilih" ? !s.karakter[pid] : !s.pilihan[pid]);

/** Siapa yang masih ditunggu (untuk notifikasi & batas waktu). Utamakan yang BUKAN baru saja bergerak. */
export function giliran(s) {
  if (s.selesai) return null;
  const tunggu = s.pemain.filter((p) => perlu(s, p));
  if (!tunggu.length) return null;
  return tunggu.find((p) => p !== s.terakhir) || tunggu[0];
}
export const giliranUntuk = (s, pid) => perlu(s, pid);
export const batasMs = (s) => (s.fase === "pilih" ? BATAS_PILIH_MS : s.langkah === 0 ? BATAS_TARUNG_MS + 5000 : BATAS_TARUNG_MS);

// ─────────────────────────── AKSI PEMAIN ───────────────────────────
/** a: { tipe: "karakter", id } | { tipe: "gerak", gerak, ke } */
export function aksi(s, pid, a) {
  if (s.selesai) return { ok: false, alasan: "Pertarungan sudah selesai." };
  if (!s.pemain.includes(pid)) return { ok: false, alasan: "Kamu bukan pemain di duel ini." };
  if (a?.tipe === "karakter") {
    if (s.fase !== "pilih") return { ok: false, alasan: "Petarung sudah dipilih." };
    if (s.karakter[pid]) return { ok: false, alasan: "Kamu sudah memilih petarung." };
    const id = String(a.id || "");
    if (!URUTAN_KARAKTER.includes(id)) return { ok: false, alasan: "Petarung tidak dikenal." };
    s.karakter[pid] = id;
    s.idle[pid] = 0;
    s.terakhir = pid;
    if (s.pemain.every((p) => s.karakter[p])) mulaiTarung(s);
    return { ok: true, state: s };
  }
  if (a?.tipe !== "gerak") return { ok: false, alasan: "Aksi tidak dikenal." };
  if (s.fase !== "tarung") return { ok: false, alasan: "Pilih petarung dulu." };
  if (Number(a.ke) !== s.ke) return { ok: false, alasan: "Giliran sudah berganti — pilih lagi." };
  if (s.pilihan[pid]) return { ok: false, alasan: "Pilihanmu untuk giliran ini sudah terkunci." };
  const gerak = String(a.gerak || "");
  if (![...URUTAN_GERAK, "jurus", "pamungkas"].includes(gerak)) return { ok: false, alasan: "Aksi tidak dikenal." };
  if (gerak === "jurus" && s.energi[pid] < BIAYA_JURUS) return { ok: false, alasan: `Energi belum cukup untuk jurus (butuh ${BIAYA_JURUS}).` };
  if (gerak === "pamungkas" && s.energi[pid] < BIAYA_PAMUNGKAS) return { ok: false, alasan: "Energi belum penuh untuk jurus pamungkas." };
  s.pilihan[pid] = { gerak, auto: false };
  s.idle[pid] = 0;
  s.terakhir = pid;
  if (s.pemain.every((p) => s.pilihan[p])) selesaikanGiliran(s);
  return { ok: true, state: s };
}

/** Dipanggil kerangka duel saat batas waktu lewat: yang diam otomatis menangkis (atau dipilihkan petarung acak). */
export function waktuHabis(s) {
  if (s.selesai) return { state: s };
  if (s.fase === "pilih") {
    for (const p of s.pemain) if (!s.karakter[p]) { s.karakter[p] = URUTAN_KARAKTER[Math.floor(acak(s) * URUTAN_KARAKTER.length)]; s.idle[p] += 1; }
    mulaiTarung(s);
    return { state: s };
  }
  for (const p of s.pemain) if (!s.pilihan[p]) { s.pilihan[p] = { gerak: "tangkis", auto: true }; s.idle[p] += 1; }
  const afk = s.pemain.filter((p) => s.idle[p] >= AFK_MAKS);
  if (afk.length === 2) { s.selesai = { pemenang: null, seri: true, alasan: "Kedua pemain tidak bergerak 3 giliran" }; return { state: s }; }
  if (afk.length === 1) { s.selesai = { pemenang: lain(s, afk[0]), seri: false, alasan: `${nm(s, afk[0])} tidak bergerak ${AFK_MAKS} giliran berturut-turut` }; return { state: s }; }
  selesaikanGiliran(s);
  return { state: s };
}

// ─────────────────────────── PENYELESAIAN BENTROKAN ───────────────────────────
/** Sifat aksi `gerak` milik pemain `pid` untuk giliran ini (sudah memperhitungkan petarung & efek beku). */
export function deskripsi(s, pid, gerak) {
  const k = kar(s, pid);
  let d;
  if (gerak === "jurus") d = { ...k.jurus, gerak, dmg: k.jurus.dmg };
  else if (gerak === "pamungkas") d = { jenis: "pamungkas", level: "pamungkas", gerak, dmg: k.pamungkas.dmg, efek: k.pamungkas.efek || null, cepat: 9 };
  else d = { ...GERAK[gerak], gerak };
  d.pid = pid;
  if (d.jenis === "serang") {
    if (gerak === "pukul" && k.stat.pukulCepat) d.cepat = k.stat.pukulCepat;
    d.cepat += k.stat.cepat || 0;
    if (s.efek[pid]?.beku > 0) d.cepat -= 1;
  }
  return d;
}

/**
 * Bentrokan murni dua aksi. Hasil per pemain: { hasil, f, counter?, balas? } dengan f = pengali damage yang ia
 * berikan ke lawan (0 = tidak kena). Label hasil dipakai klien untuk memilih animasi.
 */
export function tabrak(A, B) {
  const r = { [A.pid]: { hasil: "diam", f: 0 }, [B.pid]: { hasil: "diam", f: 0 }, urut: "bersamaan" };
  const set = (X, hasil, f = 0, extra = {}) => { r[X.pid] = { hasil, f, ...extra }; };
  const dulu = (X) => { r.urut = X.pid; };
  const P = (X) => X.jenis === "pamungkas";
  const T = (X) => X.jenis === "tangkis";
  const G = (X) => X.jenis === "banting";

  if (P(A) && P(B)) { set(A, "bentrok", 0.5); set(B, "bentrok", 0.5); return r; }
  if (P(A) || P(B)) {
    const [U, O] = P(A) ? [A, B] : [B, A];
    dulu(U);
    if (T(O)) { set(U, "ditangkis", 0.5); set(O, "menangkis"); } else { set(U, "kena", 1); set(O, "terpotong"); }
    return r;
  }
  if (T(A) && T(B)) { set(A, "diam"); set(B, "diam"); return r; }
  if (T(A) || T(B)) {
    const [D, X] = T(A) ? [A, B] : [B, A];
    dulu(X);
    if (G(X)) { set(X, "kena", 1); set(D, "dibanting"); return r; }
    const lvl = X.level;
    if (X.tembus) { set(X, "kena", 1); set(D, "tertembus"); return r; }
    if (D.hindari?.includes(lvl)) { set(X, "meleset"); set(D, "balas", 0, { balas: D.balas?.[lvl] || 0 }); return r; }
    if (D.blok?.includes(lvl)) {
      const balas = D.balas?.[lvl] || 0;
      set(X, "ditangkis", X.jenis === "proyektil" ? 0.25 : 0.15);
      set(D, balas ? "balas" : "menangkis", 0, { balas });
      return r;
    }
    set(X, "kena", 1); set(D, "salahTangkis");
    return r;
  }
  if (G(A) && G(B)) {
    if (A.perintah && !B.perintah) { dulu(A); set(A, "kena", 1); set(B, "terpotong"); return r; }
    if (B.perintah && !A.perintah) { dulu(B); set(B, "kena", 1); set(A, "terpotong"); return r; }
    set(A, "lepas"); set(B, "lepas");
    return r;
  }
  if (G(A) || G(B)) {
    const [Gr, X] = G(A) ? [A, B] : [B, A];
    if (X.level === "udara") { dulu(X); set(X, "kena", 1.2, { counter: true }); set(Gr, "meleset"); return r; }
    if (X.tembus) { dulu(Gr); set(Gr, "kena", 1); set(X, "terpotong"); return r; }
    if (Gr.armor?.includes(X.level)) { dulu(X); set(X, "armor", 0.5); set(Gr, "kena", 1, { armor: true }); return r; }
    dulu(X);
    if (X.jenis === "proyektil") { set(X, "kena", 1); set(Gr, "terpotong"); return r; }
    set(X, "kena", PENGALI_POTONG_BANTING, PENGALI_POTONG_BANTING > 1 ? { counter: true } : {}); set(Gr, "terpotong");
    return r;
  }
  // serangan / tembakan lawan serangan / tembakan
  const lv = (X) => X.level;
  const rentan = (X, Y) => X.rentan?.includes(lv(Y));
  const kebal = (X, Y) => X.kebal?.includes(lv(Y));
  const menang = (W, L, f, hasilL, extra = {}) => { dulu(W); set(W, "kena", f, extra); set(L, hasilL); return r; };
  if (rentan(A, B) && !rentan(B, A)) return menang(B, A, 1.2, "terpotong", { counter: true });
  if (rentan(B, A) && !rentan(A, B)) return menang(A, B, 1.2, "terpotong", { counter: true });
  if (kebal(A, B) && !kebal(B, A)) return menang(A, B, 1, "meleset");
  if (kebal(B, A) && !kebal(A, B)) return menang(B, A, 1, "meleset");
  const proA = A.jenis === "proyektil", proB = B.jenis === "proyektil";
  if (proA && proB) { set(A, "bentrok"); set(B, "bentrok"); return r; }
  if (proA) return menang(A, B, 1, "terpotong");
  if (proB) return menang(B, A, 1, "terpotong");
  // Segitiga serangan: sapuan menunduk di bawah pukulan, tendangan kapak menghantam penyapu dari atas,
  // pukulan (paling cepat) memotong tendangan.
  if (lv(A) === "bawah" && lv(B) === "atas") return menang(A, B, 1.2, "meleset", { counter: true });
  if (lv(B) === "bawah" && lv(A) === "atas") return menang(B, A, 1.2, "meleset", { counter: true });
  if (lv(A) === "overhead" && lv(B) === "bawah") return menang(A, B, 1.2, "terpotong", { counter: true });
  if (lv(B) === "overhead" && lv(A) === "bawah") return menang(B, A, 1.2, "terpotong", { counter: true });
  if (A.cepat > B.cepat) return menang(A, B, 1.2, "terpotong", { counter: true });
  if (B.cepat > A.cepat) return menang(B, A, 1.2, "terpotong", { counter: true });
  set(A, "tukar", 0.6); set(B, "tukar", 0.6);
  return r;
}

const bulat = (x) => Math.max(1, Math.round(x));

function selesaikanGiliran(s) {
  const [p1, p2] = s.pemain;
  const gerak = { [p1]: s.pilihan[p1].gerak, [p2]: s.pilihan[p2].gerak };
  const D = { [p1]: deskripsi(s, p1, gerak[p1]), [p2]: deskripsi(s, p2, gerak[p2]) };
  const bekuSebelum = { [p1]: s.efek[p1].beku, [p2]: s.efek[p2].beku };
  const bakarSebelum = { [p1]: s.efek[p1].bakar, [p2]: s.efek[p2].bakar };
  for (const p of s.pemain) {
    if (gerak[p] === "jurus") s.energi[p] -= BIAYA_JURUS;
    if (gerak[p] === "pamungkas") s.energi[p] -= BIAYA_PAMUNGKAS;
  }
  const r = tabrak(D[p1], D[p2]);
  const isi = { [p1]: 0, [p2]: 0 };
  const efekBaru = { [p1]: {}, [p2]: {} };
  const babak = [];
  const comboLama = { ...s.combo };

  // Damage utama tiap pemain ke lawannya.
  const urutan = r.urut === p2 ? [p2, p1] : [p1, p2];
  for (const p of urutan) {
    const o = lain(s, p);
    const h = r[p];
    const k = kar(s, p), ko = kar(s, o);
    const beat = { oleh: p, gerak: gerak[p], hasil: h.hasil, sasaran: o, dmg: 0 };
    if (h.counter) beat.counter = true;
    if (h.armor) beat.armor = true;
    if (h.f > 0) {
      const penuh = h.hasil === "kena";
      const pengaliCombo = penuh && comboLama[p] >= 1 ? 1 + 0.1 * Math.min(3, comboLama[p]) : 1;
      const variasi = 0.92 + acak(s) * 0.16;
      const dmg = bulat(D[p].dmg * k.stat.kuat * ko.stat.tahan * h.f * pengaliCombo * variasi);
      beat.dmg = dmg;
      s.hp[o] -= dmg;
      isi[p] += dmg * 0.6;
      isi[o] += dmg * 0.8;
      if (penuh) beat.combo = comboLama[p] + 1;
      if ((penuh || h.hasil === "tukar") && D[p].efek) Object.assign(efekBaru[o], D[p].efek);
      if (h.hasil === "bentrok" && D[p].efek) Object.assign(efekBaru[o], D[p].efek);
    }
    babak.push(beat);
  }
  // Balasan dari tangkisan / uppercut.
  for (const p of s.pemain) {
    const h = r[p];
    if (h.hasil === "balas" && h.balas > 0) {
      const o = lain(s, p);
      const dmg = bulat(h.balas * kar(s, p).stat.kuat * kar(s, o).stat.tahan);
      s.hp[o] -= dmg;
      isi[p] += dmg * 0.6;
      isi[o] += dmg * 0.8;
      babak.push({ oleh: p, gerak: "balas", hasil: "kena", sasaran: o, dmg, balasan: true });
    }
    if (h.hasil === "menangkis" || h.hasil === "balas") isi[p] += 12;
    if (h.hasil === "diam") isi[p] += 6;
    if (["meleset", "terpotong", "lepas", "bentrok"].includes(h.hasil)) isi[p] += 3;
  }
  // Combo: bertambah bila mendaratkan serangan penuh, putus bila terkena serangan penuh / tidak menyerang.
  for (const p of s.pemain) {
    const o = lain(s, p);
    const kenaPenuh = r[p].hasil === "kena";
    const dihantam = r[o].hasil === "kena" || r[o].hasil === "tukar";
    s.combo[p] = kenaPenuh && !dihantam ? comboLama[p] + 1 : 0;
  }
  // Efek status.
  for (const p of s.pemain) {
    const e = s.efek[p];
    if (bakarSebelum[p] > 0) {
      const dmg = bulat(3 * kar(s, p).stat.tahan);
      s.hp[p] -= dmg;
      babak.push({ tipe: "bakar", sasaran: p, dmg });
      e.bakar = bakarSebelum[p] - 1;
    }
    if (bekuSebelum[p] > 0) e.beku = bekuSebelum[p] - 1;
    if (efekBaru[p].bakar) e.bakar = Math.max(e.bakar, efekBaru[p].bakar);
    if (efekBaru[p].beku) e.beku = Math.max(e.beku, efekBaru[p].beku);
  }
  for (const p of s.pemain) s.energi[p] = Math.max(0, Math.min(100, Math.round(s.energi[p] + isi[p] * kar(s, p).stat.energi)));

  s.langkah += 1;
  const rek = {
    ke: s.ke, ronde: s.ronde, langkah: s.langkah,
    aksi: gerak,
    auto: { [p1]: !!s.pilihan[p1].auto, [p2]: !!s.pilihan[p2].auto },
    babak,
    hp: {}, energi: { ...s.energi }, efek: { [p1]: { ...s.efek[p1] }, [p2]: { ...s.efek[p2] } },
    combo: { ...s.combo },
    akhirRonde: null
  };
  for (const p of s.pemain) rek.hp[p] = Math.max(0, s.hp[p]);

  // Akhir ronde?
  const habis = s.pemain.filter((p) => s.hp[p] <= 0);
  let akhir = null;
  if (habis.length === 2) akhir = { pemenang: null, alasan: "K.O. ganda" };
  else if (habis.length === 1) akhir = { pemenang: lain(s, habis[0]), alasan: "K.O." };
  else if (s.langkah >= MAKS_LANGKAH) {
    const pa = s.hp[p1] / s.hpMaks[p1], pb = s.hp[p2] / s.hpMaks[p2];
    akhir = Math.abs(pa - pb) < 1e-9 ? { pemenang: null, alasan: "Waktu habis — imbang" } : { pemenang: pa > pb ? p1 : p2, alasan: "Waktu habis" };
  }
  for (const p of s.pemain) s.pilihan[p] = null;
  s.ke += 1;
  if (akhir) {
    if (akhir.pemenang) s.menangRonde[akhir.pemenang] += 1;
    rek.akhirRonde = { ...akhir, ronde: s.ronde, menang: { ...s.menangRonde } };
    const juara = s.pemain.find((p) => s.menangRonde[p] >= MENANG_RONDE);
    const skor = (p) => `${s.menangRonde[p]}–${s.menangRonde[lain(s, p)]}`;
    if (juara) {
      s.selesai = { pemenang: juara, seri: false, alasan: `${akhir.alasan === "K.O." ? "K.O.! " : ""}${nm(s, juara)} (${kar(s, juara).nama}) menang ${skor(juara)}` };
    } else if (s.ronde >= MAKS_RONDE) {
      const [x, y] = s.pemain;
      if (s.menangRonde[x] === s.menangRonde[y]) s.selesai = { pemenang: null, seri: true, alasan: `Imbang ${s.menangRonde[x]}–${s.menangRonde[y]} setelah ${MAKS_RONDE} ronde` };
      else { const j = s.menangRonde[x] > s.menangRonde[y] ? x : y; s.selesai = { pemenang: j, seri: false, alasan: `${nm(s, j)} (${kar(s, j).nama}) menang ${skor(j)}` }; }
    } else {
      s.ronde += 1;
      resetRonde(s);
    }
  }
  catat(s, rek);
  if (s.selesai) s.fase = "selesai";
}

// ─────────────────────────── TAMPILAN ───────────────────────────
export function tampil(s, pid) {
  const o = lain(s, pid);
  const keduanya = !!(s.karakter[s.pemain[0]] && s.karakter[s.pemain[1]]);
  const sisi = (p, saya) => ({
    pid: p,
    nama: nm(s, p),
    karakter: saya || keduanya ? s.karakter[p] : null,
    sudahPilih: !!s.karakter[p],
    hp: s.fase === "pilih" ? null : Math.max(0, s.hp[p] ?? 0),
    hpMaks: s.hpMaks[p] ?? null,
    energi: s.energi[p] ?? 0,
    efek: s.efek[p] ? { ...s.efek[p] } : { beku: 0, bakar: 0 },
    combo: s.combo[p] || 0,
    menang: s.menangRonde[p] || 0,
    idle: s.idle[p] || 0
  });
  const saya = sisi(pid, true);
  saya.pilihan = s.pilihan[pid]?.gerak || null;
  const lawan = sisi(o, false);
  lawan.siap = s.fase === "tarung" ? !!s.pilihan[o] : !!s.karakter[o];
  const energi = s.energi[pid] ?? 0;
  return {
    jenis: "tarung",
    fase: s.fase,
    ke: s.ke,
    ronde: s.ronde,
    langkah: s.langkah,
    maksLangkah: MAKS_LANGKAH,
    menangPerlu: MENANG_RONDE,
    arena: s.arena,
    saya,
    lawan,
    aksi: s.fase === "tarung" && s.karakter[pid] ? daftarAksi(s.karakter[pid]).map((x) => ({ id: x.id, nama: x.nama, ikon: x.ikon, biaya: x.biaya, bisa: energi >= x.biaya, ket: x.ket })) : [],
    giliranSaya: perlu(s, pid),
    riwayat: s.riwayat.map((r) => JSON.parse(JSON.stringify(r))),
    selesai: s.selesai
  };
}
