// Pet Arta Pedia: lihat keadaan pet, beri makan, ajak main, ganti nama.
//
// Perawatannya dibatasi sekali sehari per jenis, dan batas itu ditegakkan di
// lib/pet.js — bukan di sini, bukan di halaman. XP pet berujung pada persen
// cashback deposit, jadi ia bagian dari jalur uang dan tidak boleh bergantung
// pada tombol yang dimatikan di browser.
import { NextResponse } from "next/server";
import { getSettings } from "@/lib/settings";
import { ambilPet, rawatPet, gantiNamaPet, petConfig } from "@/lib/pet";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Kode akun kosong." }, { status: 400 });
  try {
    const settings = await getSettings();
    const cfg = petConfig(settings);
    if (!cfg.enabled) return NextResponse.json({ enabled: false });
    const pet = await ambilPet(token, settings);
    return NextResponse.json({ enabled: true, pet, config: { bonusPerLevel: cfg.bonusPerLevel, maxBonus: cfg.maxBonus } });
  } catch (err) {
    console.error("[pet GET]", err?.message || err);
    return NextResponse.json({ error: "Gagal memuat pet." }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!rateLimit(`${ip}:pet`, 30, 60_000)) {
      return NextResponse.json({ error: "Terlalu cepat. Coba lagi sebentar lagi." }, { status: 429 });
    }

    const { token, action, nama } = await req.json().catch(() => ({}));
    if (!token) return NextResponse.json({ error: "Kode akun kosong." }, { status: 400 });

    const settings = await getSettings();

    if (action === "nama") {
      const r = await gantiNamaPet(token, nama);
      if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
      return NextResponse.json({ ok: true, nama: r.nama, pet: await ambilPet(token, settings) });
    }

    if (action === "makan" || action === "main") {
      const r = await rawatPet(token, action, settings);
      if (!r.ok) return NextResponse.json({ error: r.error }, { status: 409 });
      return NextResponse.json(r);
    }

    return NextResponse.json({ error: "Action tidak dikenal." }, { status: 400 });
  } catch (err) {
    console.error("[pet POST]", err?.message || err);
    return NextResponse.json({ error: "Gagal merawat pet." }, { status: 500 });
  }
}
