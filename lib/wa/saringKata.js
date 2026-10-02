// Penyaring kata terlarang untuk WEARTA CHAT. Murni (tanpa database) supaya mudah diuji.
//
// Cara mencocokkan — sengaja BUKAN "mengandung huruf" (itu menghapus "asuransi", "script", "newest"):
//   • teks dinormalkan: huruf kecil, tanpa aksen/karakter tak terlihat, angka/simbol pengecoh (4→a, 3→e, 1→i, 0→o, @→a, $→s, 5→s, 7→t)
//   • dipecah jadi kata utuh; kata dengan huruf berulang ("gooobloook") dipadatkan; huruf yang dipisah ("g.o.b.l.o.k", "a s u") digabung
//   • kata terlarang cocok bila UTUH, atau dengan imbuhan lazim (me-/di-/pe-… dan -an/-nya/-in/-lah/-ku/-mu…).
//     Kata pendek (≤4 huruf: asu, ajg, ewe, rip, scam) hanya boleh akhiran -nya/-lu/-mu/-ku/-lah/-kah — supaya "asus", "ripan", "asuransi" aman.
export const KATA_BAWAAN = ["scam", "nipu", "penipu", "goblok", "ajg", "asu", "jancok", "tolol", "ewe", "entot", "ngentod", "ngentot", "ripper", "rip"];

const LEET = { 0: "o", 1: "i", 3: "e", 4: "a", 5: "s", 7: "t", "@": "a", $: "s" };

const bersih = (s) =>
  String(s || "")
    .normalize("NFKD").replace(/[\u0300-\u036f\u200b-\u200f\u2060\ufeff\u00ad]/g, "")
    .toLowerCase();
const normal = (s) => bersih(s).replace(/[0134578@$]/g, (c) => LEET[c] ?? c);

const padat = (w) => w.replace(/(.)\1+/g, "$1");
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** "scam, nipu\nasu" → ["scam","nipu","asu"] (huruf kecil, unik, hanya huruf, 2–30 karakter). */
export function uraiDaftar(teks) {
  const arr = Array.isArray(teks) ? teks : String(teks || "").split(/[,\n;]+/);
  const out = [];
  for (const x of arr) {
    const w = normal(x).replace(/[^a-z]/g, "");
    if (w.length >= 2 && w.length <= 30 && !out.includes(w)) out.push(w);
  }
  return out;
}

const PREFIKS = "(?:me|men|meng|meny|di|ter|ke|se|pe|pen|peng|ber)?";
const AKHIRAN_PANJANG = "(?:an|nya|in|lah|kah|ku|mu|lu|s|er|ers|mer|mers|ing)?";
const AKHIRAN_PENDEK = "(?:nya|lu|mu|ku|lah|kah)?";

/** Menyusun pencocok dari daftar kata. Mengembalikan fungsi (teks) → kata terlarang yang cocok, atau null. */
export function buatPenyaring(daftar) {
  const kata = uraiDaftar(daftar);
  const pola = kata.map((k) => {
    const p = padat(k);
    const pendek = p.length <= 3 || p === "scam";
    const ekstra = p === "scam" ? "|mer|mers|s" : "";
    return { asli: k, re: new RegExp(`^${pendek ? "" : PREFIKS}${esc(p)}${pendek ? AKHIRAN_PENDEK.replace(")?", `${ekstra})?`) : AKHIRAN_PANJANG}$`) };
  });
  return (teks) => {
    if (!pola.length) return null;
    const asal = bersih(teks);
    // Beberapa "pembacaan" teks: dengan angka/simbol pengecoh dibaca sebagai huruf, dengan angka dibuang, dan masing-masing
    // dengan tanda penyambung (. - _ * ') di dalam kata dihapus ("jan.cok" → "jancok").
    const sambung = (x) => x.replace(/[.\-_*'’`~|·•]/g, "");
    const baca = [normal(asal), asal.replace(/[0-9]/g, " "), normal(sambung(asal)), sambung(asal).replace(/[0-9]/g, " ")];
    const kandidat = new Set();
    for (const v of baca) {
      const token = v.split(/[^a-z]+/).filter(Boolean);
      for (const t of token) kandidat.add(t);
      // huruf yang dipisah-pisah: "g o b l o k", "a s u" → gabungkan deret huruf tunggal berurutan
      let deret = "";
      for (const t of token) { if (t.length === 1) deret += t; else { if (deret.length >= 2) kandidat.add(deret); deret = ""; } }
      if (deret.length >= 2) kandidat.add(deret);
    }
    for (const c of kandidat) {
      const p = padat(c);
      for (const x of pola) if (x.re.test(p) || x.re.test(c)) return x.asli;
    }
    return null;
  };
}

/** Teks yang diperiksa dari satu pesan (teks, keterangan foto/dokumen, pertanyaan & opsi poll, label lokasi, nama dokumen). */
export function teksPesan(msg) {
  const out = [msg.teks];
  if (msg.poll) { out.push(msg.poll.pertanyaan); for (const o of msg.poll.opsi || []) out.push(o.teks); }
  if (msg.lokasi) out.push(msg.lokasi.label);
  if (msg.dokumen) out.push(msg.dokumen.nama);
  return out.filter(Boolean).join(" \n ");
}
