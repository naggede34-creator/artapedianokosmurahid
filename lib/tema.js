"use client";

// Tema tampilan pilihan pengguna.
//
// Disimpan di localStorage, BUKAN di database: ini preferensi tampilan, bukan
// data akun. Menyimpannya di server berarti tiap pemuatan halaman menunggu
// satu permintaan jaringan hanya untuk tahu warna apa yang dipakai — dan
// selama menunggu itu, warnanya berkedip dari tema lama ke tema baru.

export const TEMA = [
  { id: "default", nama: "Arta Pedia", ringkas: "Tema asli situs", warna: ["#ED5A0F", "#2E86FF"] },
  { id: "senja", nama: "Senja", ringkas: "Jingga hangat", warna: ["#E94E3E", "#E27456"] },
  { id: "rimba", nama: "Rimba", ringkas: "Hijau daun", warna: ["#16915E", "#34A276"] },
  { id: "samudra", nama: "Samudra", ringkas: "Biru toska", warna: ["#0E91A8", "#2078BE"] },
  { id: "anggur", nama: "Anggur", ringkas: "Ungu lembut", warna: ["#8248CD", "#A054C8"] },
  { id: "arang", nama: "Arang", ringkas: "Abu netral", warna: ["#485670", "#60708C"] }
];

export const KUNCI_TEMA = "artapedia_tema";
export const KUNCI_WARNA = "artapedia_warna";

const TOKEN = ["--c-orange", "--c-orange-soft", "--c-orange-bright", "--c-blue", "--c-blue-soft", "--c-blue-bright"];

/** "#ED5A0F" -> [237, 90, 15]. null kalau bukan hex yang sah. */
export function hexKeRgb(hex) {
  const m = String(hex || "").trim().match(/^#?([0-9a-f]{6})$/i);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const jepit = (n) => Math.max(0, Math.min(255, Math.round(n)));

/** Versi muda untuk latar lembut, dan versi tua untuk teks di atas putih. */
function turunan([r, g, b]) {
  // Soft: dicampur putih sampai sangat muda. Dipakai sebagai latar di
  // belakang teks berwarna, jadi harus cukup terang.
  const soft = [r, g, b].map((v) => jepit(v + (255 - v) * 0.88));
  // Bright: digelapkan. Dipakai untuk TEKS, jadi harus cukup gelap supaya
  // tetap terbaca di atas latar terang — warna pilihan yang terlalu muda
  // akan menghasilkan teks yang nyaris tidak terlihat.
  const bright = [r, g, b].map((v) => jepit(v * 0.62));
  return { soft, bright };
}

/**
 * Memasang tema ke <html>.
 * Dipanggil sedini mungkin supaya warnanya tidak berkedip.
 */
export function pasangTema(id, hex) {
  if (typeof document === "undefined") return;
  const el = document.documentElement;

  if (id && id !== "default") el.setAttribute("data-tema", id);
  else el.removeAttribute("data-tema");

  // Warna pilihan sendiri selalu menang: gaya inline mengalahkan blok CSS
  // mana pun tanpa perlu !important.
  const rgb = hexKeRgb(hex);
  if (rgb) {
    const { soft, bright } = turunan(rgb);
    el.style.setProperty("--c-orange", rgb.join(" "));
    el.style.setProperty("--c-orange-soft", soft.join(" "));
    el.style.setProperty("--c-orange-bright", bright.join(" "));
    el.style.setProperty("--c-blue", rgb.join(" "));
    el.style.setProperty("--c-blue-soft", soft.join(" "));
    el.style.setProperty("--c-blue-bright", bright.join(" "));
  } else {
    for (const t of TOKEN) el.style.removeProperty(t);
  }
}

export function bacaTema() {
  if (typeof window === "undefined") return { id: "default", warna: "" };
  try {
    return {
      id: localStorage.getItem(KUNCI_TEMA) || "default",
      warna: localStorage.getItem(KUNCI_WARNA) || ""
    };
  } catch {
    // localStorage diblokir (mode privat). Tema asli, dan itu tetap benar.
    return { id: "default", warna: "" };
  }
}

export function simpanTema(id, warna) {
  try {
    if (id && id !== "default") localStorage.setItem(KUNCI_TEMA, id);
    else localStorage.removeItem(KUNCI_TEMA);
    if (warna) localStorage.setItem(KUNCI_WARNA, warna);
    else localStorage.removeItem(KUNCI_WARNA);
  } catch {}
  pasangTema(id, warna);
}
