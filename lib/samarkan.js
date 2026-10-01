// Menyamarkan identitas untuk tampilan publik (pita "baru saja beli/menang", papan peringkat tamu).
import { createHash } from "node:crypto";

/** Nama disamarkan: dua huruf pertama kata pertama + •••. Tanpa nama → "Pengguna" + kode hash (tak bisa dibalik ke token). */
export function samarkan(nama, kunci) {
  const n = String(nama || "").replace(/\s+/g, " ").trim();
  if (n.length >= 3 && !/^pengguna$/i.test(n)) return `${Array.from(n.split(" ")[0]).slice(0, 2).join("")}•••`;
  return `Pengguna ${createHash("sha256").update(String(kunci || "")).digest("hex").slice(0, 3).toUpperCase()}`;
}
