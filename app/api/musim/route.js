import { NextResponse } from "next/server";
import { musimSekarang } from "@/lib/musim";

// Tanpa `dynamic = "force-dynamic"`: di Next 15 itu menimpa Cache-Control buatan sendiri jadi "no-store". GET handler memang tidak di-cache bawaan.

// Publik: event musiman yang sedang berjalan (banner, diskon, tema otomatis) + 4 event berikutnya.
export async function GET() {
  const m = await musimSekarang();
  const u = m.utama;
  return NextResponse.json({
    aktif: m.aktif,
    utama: u ? { id: u.id, nama: u.nama, ikon: u.ikon, banner: u.banner, selesai: u.selesai, sampai: u.sampai, sisaMs: u.sisaMs, warna: u.warna, gaya: u.gaya, skin: u.skin, musim: u.musim, diskonPersen: u.diskonPersen, cashbackBonus: u.cashbackBonus } : null,
    diskonPersen: m.diskonPersen,
    cashbackBonus: m.cashbackBonus,
    skinMusim: m.skinMusim || [],
    berikutnya: m.berikutnya
  }, { headers: { "Cache-Control": "public, max-age=30, s-maxage=30" } });
}
