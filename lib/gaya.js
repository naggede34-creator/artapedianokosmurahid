// Gaya tampilan & skin maskot — konstanta AMAN untuk browser maupun server (tanpa database).
//
// GAYA   = bentuk visual (kartu, tombol, latar): Komik 3D (bawaan), Liquid, Glass, Neon, Clay, Bersih, Retro.
//          Beda dengan TEMA WARNA di lib/tema.js; keduanya bisa dipadukan. CSS-nya di app/gaya.css.
// SKIN   = kostum maskot elang: filter warna pada gambar maskot + aksesori. Semua gratis dipilih sendiri,
//          ada yang musiman (hanya tersedia & otomatis dipasang saat event-nya berlangsung).

export const GAYA = [
  { id: "komik", nama: "Komik 3D", ringkas: "Bawaan — garis tebal, bayangan keras" },
  { id: "liquid", nama: "Liquid", ringkas: "Cairan berkilau, lembut & hidup" },
  { id: "glass", nama: "Glass", ringkas: "Kaca buram di atas aurora" },
  { id: "neon", nama: "Neon", ringkas: "Cyber gelap bercahaya" },
  { id: "clay", nama: "Clay", ringkas: "Timbul empuk ala tanah liat" },
  { id: "bersih", nama: "Bersih", ringkas: "Minimal, rata, tenang" },
  { id: "retro", nama: "Retro", ringkas: "Arkade piksel & garis pindai" }
];
export const GAYA_ID = GAYA.map((g) => g.id);

export const KUNCI_GAYA = "artapedia_gaya";
export const KUNCI_SKIN = "artapedia_skin";
export const KUNCI_MUSIM = "artapedia_musim";

/**
 * filter: nilai CSS `filter` untuk gambar maskot · aksesori: emoji di atas kepala (opsional)
 * musim: id jenis event (skin musiman otomatis dipasang saat event itu aktif)
 */
export const SKIN = [
  { id: "klasik", nama: "Klasik", ikon: "🦅", harga: 0, filter: "", aksesori: "", ket: "Elang asli ARTA PEDIA" },
  { id: "emas", nama: "Elang Emas", ikon: "🥇", harga: 600, filter: "sepia(.55) saturate(2.4) hue-rotate(-6deg) brightness(1.06) drop-shadow(0 0 7px rgb(250 204 21 / .8))", aksesori: "👑", ket: "Berkilau seperti juara" },
  { id: "es", nama: "Elang Es", ikon: "🧊", harga: 400, filter: "hue-rotate(168deg) saturate(1.3) brightness(1.05) drop-shadow(0 0 7px rgb(56 189 248 / .8))", aksesori: "", ket: "Dingin dan tenang" },
  { id: "api", nama: "Elang Api", ikon: "🔥", harga: 400, filter: "hue-rotate(-28deg) saturate(1.9) brightness(1.04) drop-shadow(0 0 7px rgb(239 68 68 / .8))", aksesori: "", ket: "Membara!" },
  { id: "hantu", nama: "Elang Hantu", ikon: "👻", harga: 500, filter: "grayscale(.55) hue-rotate(250deg) contrast(1.1) drop-shadow(0 0 7px rgb(139 92 246 / .85))", aksesori: "", ket: "Misterius di balik bayangan" },
  { id: "sakura", nama: "Elang Sakura", ikon: "🌸", harga: 450, filter: "hue-rotate(300deg) saturate(1.2) brightness(1.1) drop-shadow(0 0 7px rgb(244 114 182 / .8))", aksesori: "🌸", ket: "Manis, tapi tetap gagah" },
  // Musiman: harga murah, dan otomatis dipakai semua orang selama event berlangsung.
  { id: "santa", nama: "Elang Santa", ikon: "🎅", harga: 150, filter: "saturate(1.15) drop-shadow(0 0 6px rgb(220 38 38 / .7))", aksesori: "🎅", musim: "natal", ket: "Spesial Natal" },
  { id: "ramadan", nama: "Elang Ramadan", ikon: "🌙", harga: 150, filter: "hue-rotate(-12deg) saturate(1.1) drop-shadow(0 0 6px rgb(250 204 21 / .75))", aksesori: "🌙", musim: "ramadan", ket: "Spesial Ramadan & Lebaran" },
  { id: "merdeka", nama: "Elang Merdeka", ikon: "🇮🇩", harga: 150, filter: "saturate(1.25) drop-shadow(0 0 6px rgb(220 38 38 / .75))", aksesori: "🇮🇩", musim: "merdeka", ket: "Spesial 17 Agustus" },
  { id: "pesta", nama: "Elang Pesta", ikon: "🥳", harga: 150, filter: "saturate(1.3) hue-rotate(12deg) drop-shadow(0 0 7px rgb(236 72 153 / .75))", aksesori: "🥳", musim: "pesta", ket: "Spesial tanggal kembar & tahun baru" }
];
export const SKIN_PETA = Object.fromEntries(SKIN.map((s) => [s.id, s]));

// ───────────────────────── PEMASANGAN KE <html> ─────────────────────────
export function pasangGaya(id) {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  if (id && id !== "komik" && GAYA_ID.includes(id)) el.setAttribute("data-gaya", id);
  else el.removeAttribute("data-gaya");
}

export function pasangSkin(id) {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  const s = SKIN_PETA[id];
  if (s && id !== "klasik") {
    el.setAttribute("data-skin", id);
  } else {
    el.removeAttribute("data-skin");
  }
  try { window.dispatchEvent(new CustomEvent("artapedia-skin", { detail: { id: s ? id : "klasik" } })); } catch {}
}

export function bacaPilihan() {
  if (typeof window === "undefined") return { gaya: "", skin: "" };
  try { return { gaya: localStorage.getItem(KUNCI_GAYA) || "", skin: localStorage.getItem(KUNCI_SKIN) || "" }; } catch { return { gaya: "", skin: "" }; }
}
export function simpanGaya(id) {
  try { if (id) localStorage.setItem(KUNCI_GAYA, id); else localStorage.removeItem(KUNCI_GAYA); } catch {}
}
export function simpanSkin(id) {
  try { if (id) localStorage.setItem(KUNCI_SKIN, id); else localStorage.removeItem(KUNCI_SKIN); } catch {}
}

/**
 * Skrip inline yang dijalankan SEBELUM React (di layout.js) agar tidak ada kedipan.
 * Pilihan manual pengguna selalu menang; kalau kosong, pakai tampilan event yang tersimpan selama masih berlaku.
 */
export const SKRIP_GAYA_AWAL = `
(function(){try{
  var d=document.documentElement,g=localStorage.getItem("${KUNCI_GAYA}"),s=localStorage.getItem("${KUNCI_SKIN}"),m=null;
  try{m=JSON.parse(localStorage.getItem("${KUNCI_MUSIM}")||"null");}catch(e){}
  if(m&&m.sampai&&m.sampai<Date.now())m=null;
  var gg=g||(m&&m.gaya)||"",ss=s||(m&&m.skin)||"";
  if(gg&&gg!=="komik")d.setAttribute("data-gaya",gg);
  if(ss&&ss!=="klasik"){d.setAttribute("data-skin",ss);}
}catch(e){}})();
`;
