// Gaya tampilan — konstanta AMAN untuk browser maupun server (tanpa database).
//
// GAYA = bentuk visual (kartu, tombol, latar): Komik 3D (bawaan), Liquid, Glass, Neon, Clay, Bersih, Retro.
//        Beda dengan TEMA WARNA di lib/tema.js; keduanya bisa dipadukan. CSS-nya di app/gaya.css.

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

export function pasangGaya(id) {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  if (id && id !== "komik" && GAYA_ID.includes(id)) el.setAttribute("data-gaya", id);
  else el.removeAttribute("data-gaya");
}

export function bacaPilihan() {
  if (typeof window === "undefined") return { gaya: "" };
  try { return { gaya: localStorage.getItem(KUNCI_GAYA) || "" }; } catch { return { gaya: "" }; }
}
export function simpanGaya(id) {
  try { if (id) localStorage.setItem(KUNCI_GAYA, id); else localStorage.removeItem(KUNCI_GAYA); } catch {}
}

/** Skrip inline yang dijalankan SEBELUM React (di layout.js) agar tidak ada kedipan. */
export const SKRIP_GAYA_AWAL = `
(function(){try{
  var g=localStorage.getItem("${KUNCI_GAYA}");
  if(g&&g!=="komik")document.documentElement.setAttribute("data-gaya",g);
}catch(e){}})();
`;
