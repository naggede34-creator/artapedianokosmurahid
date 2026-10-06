// Penjaga semua rute /api/cron/* (dan /api/bot/setup).
//
// Rahasia cron bisa diisi dari DASBOR ADMIN (tab Konfigurasi) atau dari
// Environment Variable CRON_SECRET — dua-duanya diterima:
//   • nilai dari dasbor  → untuk cron eksternal (cron-job.org, Cloudflare Cron
//     Trigger, Netlify Scheduled Function, dll) lewat ?secret=… atau header
//     Authorization: Bearer …
//   • nilai dari env     → tetap diterima, karena Vercel Cron mengirim header
//     Authorization dari Environment Variable-nya sendiri, bukan dari dasbor.
// Keduanya kosong = endpoint terbuka (hanya cocok untuk awal setup).
import crypto from "node:crypto";
import { cfg } from "@/lib/config";

function samaAman(a, b) {
  const x = crypto.createHash("sha256").update(String(a)).digest();
  const y = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}

/** Daftar rahasia yang sah saat ini (dasbor/env digabung, tanpa duplikat). */
export async function rahasiaCronSah() {
  const nilai = [];
  try {
    nilai.push(String(await cfg("CRON_SECRET")).trim());
  } catch {}
  nilai.push(String(process.env.CRON_SECRET || "").trim());
  return [...new Set(nilai.filter(Boolean))];
}

/** Rahasia yang dipakai server saat memanggil cron-nya sendiri ("" kalau tidak ada). */
export async function rahasiaCronUtama() {
  return (await rahasiaCronSah())[0] || "";
}

export async function cronSah(req) {
  const daftar = await rahasiaCronSah();
  if (!daftar.length) return true; // belum diisi = terbuka, cocok untuk setup awal saja
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const diberi = new URL(req.url).searchParams.get("secret") || "";
  return daftar.some((s) => (token && samaAman(token, s)) || (diberi && samaAman(diberi, s)));
}
