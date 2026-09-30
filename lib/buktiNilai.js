// Menilai teks hasil OCR dari bukti transfer QRIS manual. Murni (tanpa database,
// tanpa OCR) supaya bisa diuji dengan teks apa pun.
//
// PENTING: ini membaca TEKS di gambar — bukan memeriksa uang yang benar-benar masuk.
// Gambar yang direkayasa bisa memuat teks yang sama persis. Karena itu lolos di sini
// hanyalah SYARAT MASUK penyetujuan otomatis; batas nominal, batas harian, kode unik,
// dan pencegahan bukti ganda dijaga terpisah di lib/depositOrderService.js.

const BULAN = { jan: 0, feb: 1, mar: 2, apr: 3, mei: 4, may: 4, jun: 5, jul: 6, agu: 7, agt: 7, aug: 7, sep: 8, okt: 9, oct: 9, nov: 10, des: 11, dec: 11 };
const WIB_MS = 7 * 3600_000;

/** Huruf yang sering tertukar oleh OCR disatukan (0/O, 1/l/I, 5/S, 8/B). */
export function lipat(s) {
  return String(s || "")
    .toUpperCase()
    .replace(/VV/g, "W")
    .replace(/[^A-Z0-9|!]/g, "")
    .replace(/[0Q]/g, "O")
    .replace(/[1L|!]/g, "I")
    .replace(/5/g, "S")
    .replace(/8/g, "B");
}

function jarak(a, b, maks = 1) {
  if (Math.abs(a.length - b.length) > maks) return maks + 1;
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    let min = i;
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (cur[j] < min) min = cur[j];
    }
    if (min > maks) return maks + 1;
    prev = cur;
  }
  return prev[n];
}

/** Apakah `nama` (boleh beberapa, dipisah koma) muncul di teks, toleran 1 salah baca OCR. */
export function adaNama(teks, nama) {
  const daftar = String(nama || "").split(/[,;\n]/).map(lipat).filter((x) => x.length >= 5);
  if (!daftar.length) return false;
  const baris = String(teks || "").split(/\r?\n/).map(lipat).filter(Boolean);
  // Nama boleh terpecah di dua baris berurutan.
  const bahan = [...baris, ...baris.slice(1).map((b, i) => baris[i] + b)];
  for (const target of daftar) {
    const maks = target.length >= 8 ? 1 : 0;
    for (const b of bahan) {
      if (b.includes(target)) return true;
      if (!maks) continue;
      for (let len = target.length - 1; len <= target.length + 1; len++) {
        for (let i = 0; i + len <= b.length; i++) if (jarak(b.slice(i, i + len), target, 1) <= 1) return true;
      }
    }
  }
  return false;
}

const keAngka = (s) => {
  let x = String(s).replace(/\s+/g, "");
  x = x.replace(/[.,]\d{2}$/, ""); // 50.000,00 → 50.000
  x = x.replace(/[.,]/g, "");
  const n = Number(x);
  return Number.isFinite(n) && n > 0 && n < 1e12 ? n : null;
};

/** Semua nominal rupiah yang tampak di teks. */
export function ambilNominal(teks) {
  const t = String(teks || "");
  const hasil = new Set();
  for (const m of t.matchAll(/(?:rp|idr)\.?\s*([0-9][0-9.,\s]{0,14}[0-9]|[0-9])/gi)) { const n = keAngka(m[1]); if (n) hasil.add(n); }
  for (const m of t.matchAll(/\b(\d{1,3}(?:[.,]\d{3})+)(?:[.,]\d{2})?\b/g)) { const n = keAngka(m[1]); if (n) hasil.add(n); }
  return [...hasil].sort((a, b) => a - b);
}

/** Tanggal+jam WIB yang terbaca (epoch ms). */
export function ambilWaktu(teks) {
  const t = String(teks || "").replace(/\r/g, "");
  const hasil = [];
  const tambah = (y, mo, d, jam, mnt, dtk) => {
    if (!(y >= 2020 && y <= 2100 && mo >= 0 && mo <= 11 && d >= 1 && d <= 31)) return;
    if (jam != null && !(jam >= 0 && jam <= 23 && mnt >= 0 && mnt <= 59)) return;
    const ms = Date.UTC(y, mo, d, jam ?? 0, mnt ?? 0, dtk ?? 0) - WIB_MS;
    hasil.push({ ms, adaJam: jam != null });
  };
  const cariJam = (dari) => {
    const sisa = t.slice(dari, dari + 40);
    const m = sisa.match(/(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?/);
    return m ? [Number(m[1]), Number(m[2]), Number(m[3] || 0)] : [null, null, null];
  };
  // 30 Sep 2026 / 30 September 2026
  for (const m of t.matchAll(/(\d{1,2})[\s\-\/.]*([A-Za-z]{3,9})[\s\-\/.,]*(\d{4})/g)) {
    const bln = BULAN[m[2].slice(0, 3).toLowerCase()];
    if (bln == null) continue;
    const [j, mn, ds] = cariJam(m.index + m[0].length);
    tambah(Number(m[3]), bln, Number(m[1]), j, mn, ds);
  }
  // 30/09/2026
  for (const m of t.matchAll(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/g)) {
    const [j, mn, ds] = cariJam(m.index + m[0].length);
    tambah(Number(m[3]), Number(m[2]) - 1, Number(m[1]), j, mn, ds);
  }
  // 2026-09-30
  for (const m of t.matchAll(/(\d{4})-(\d{2})-(\d{2})/g)) {
    const [j, mn, ds] = cariJam(m.index + m[0].length);
    tambah(Number(m[1]), Number(m[2]) - 1, Number(m[3]), j, mn, ds);
  }
  return hasil;
}

/** Nomor referensi/transaksi (huruf besar tanpa tanda baca), atau null. */
export function ambilRef(teks) {
  const t = String(teks || "");
  const label = /(?:no\.?\s*(?:ref(?:erensi)?|transaksi|trx|resi)|ref(?:erensi)?(?:\s*(?:no|id|number))?|id\s*(?:transaksi|trx|pembayaran|order)|transaction\s*id|reference(?:\s*(?:no|number|id))?|rrn|nomor\s*(?:ref(?:erensi)?|transaksi))[\s.:#]*([A-Za-z0-9\-]{8,40})/i;
  const m = t.match(label);
  if (m) {
    const ref = m[1].replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    if (ref.length >= 8 && (ref.match(/\d/g) || []).length >= 4) return ref;
  }
  const angka = t.match(/\b\d{12,30}\b/);
  return angka ? angka[0] : null;
}

const KATA_SUKSES = /(berhasil|sukses|success|selesai|completed|terkirim|lunas)/i;
const KATA_GAGAL = /(gagal|failed|pending|menunggu|dibatalkan|batal\b|expired|kedaluwarsa|belum\s+dibayar)/i;

const rp = (n) => `Rp${Number(n).toLocaleString("id-ID")}`;

/**
 * @param {object} p
 * @param {string} p.teks      hasil OCR
 * @param {string} p.nama      nama penerima yang harus tampak (mis. "NAWA CELL")
 * @param {number} p.nominal   nominal tagihan (sudah termasuk kode unik)
 * @param {Date|number} p.dibuat  waktu tagihan dibuat
 * @param {number} [p.sekarang]
 */
export function nilaiBukti({ teks, nama, nominal, dibuat, sekarang = Date.now(), jendelaSebelumMs = 15 * 60_000, jendelaSesudahMs = 10 * 60_000 }) {
  const alasan = [];
  const cek = { nama: false, nominal: false, sukses: false, waktu: false, ref: false };
  const dibaca = { nominal: ambilNominal(teks), waktu: null, ref: ambilRef(teks) };

  cek.nama = adaNama(teks, nama);
  if (!cek.nama) alasan.push(`Nama penerima “${String(nama).split(/[,;]/)[0].trim()}” tidak terbaca di bukti.`);

  cek.nominal = dibaca.nominal.includes(Number(nominal));
  if (!cek.nominal) {
    alasan.push(dibaca.nominal.length
      ? `Nominal di bukti (${rp(dibaca.nominal[dibaca.nominal.length - 1])}) tidak sama dengan tagihan (${rp(nominal)}).`
      : `Nominal ${rp(nominal)} tidak terbaca di bukti.`);
  }

  cek.sukses = KATA_SUKSES.test(teks) && !KATA_GAGAL.test(teks);
  if (!cek.sukses) alasan.push("Status “berhasil” tidak terbaca di bukti.");

  const waktu = ambilWaktu(teks).filter((w) => w.adaJam);
  const mulai = new Date(dibuat).getTime() - jendelaSebelumMs;
  const akhir = sekarang + jendelaSesudahMs;
  const cocok = waktu.find((w) => w.ms >= mulai && w.ms <= akhir);
  if (cocok) { cek.waktu = true; dibaca.waktu = new Date(cocok.ms).toISOString(); }
  else alasan.push(waktu.length ? "Tanggal/jam di bukti di luar waktu tagihan ini." : "Tanggal & jam transfer tidak terbaca di bukti.");

  cek.ref = Boolean(dibaca.ref && dibaca.ref.length >= 8);
  if (!cek.ref) alasan.push("Nomor referensi transaksi tidak terbaca di bukti.");

  return { lulus: Object.values(cek).every(Boolean), cek, alasan, dibaca };
}
