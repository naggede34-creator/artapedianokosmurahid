// Admin event musiman: lihat kalender (bawaan + kustom), ubah event bawaan (aktif/diskon/cashback/banner/geser hari),
// tambah & hapus event kustom.
import { NextResponse } from "next/server";
import { adminSah } from "@/lib/adminAuth";
import { daftarEvent, musimSekarang, ubahEventBawaan, simpanEventKustom, hapusEventKustom, tanggalWib, lupakanCacheMusim } from "@/lib/musim";

export const dynamic = "force-dynamic";
const j = (d, s = 200) => NextResponse.json(d, { status: s, headers: { "Cache-Control": "no-store" } });
const tambah = (ymd, n) => new Date(Date.parse(`${ymd}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

export async function GET(req) {
  if (!(await adminSah(req))) return j({ error: "Unauthorized." }, 401);
  const hari = tanggalWib();
  const hari0 = Number(new URL(req.url).searchParams.get("hari")) || 200;
  const daftar = await daftarEvent(tambah(hari, -3), tambah(hari, Math.min(400, hari0)));
  // tanggal kembar tidak ditampilkan semuanya satu-satu (24 baris) — tetap bisa diubah per id lewat POST.
  return j({ hariIni: hari, sekarang: await musimSekarang({ segar: true }), events: daftar });
}

export async function POST(req) {
  if (!(await adminSah(req))) return j({ error: "Unauthorized." }, 401);
  const b = await req.json().catch(() => ({}));
  try {
    if (b.aksi === "ubah") {
      if (!b.id) return j({ error: "id wajib." }, 400);
      await ubahEventBawaan(String(b.id), b);
      return j({ ok: true });
    }
    if (b.aksi === "kustom") {
      const r = await simpanEventKustom(b);
      return r.ok ? j({ ok: true, id: r.id }) : j({ error: r.alasan }, 400);
    }
    if (b.aksi === "hapus") {
      await hapusEventKustom(String(b.id || ""));
      return j({ ok: true });
    }
    if (b.aksi === "segarkan") { lupakanCacheMusim(); return j({ ok: true }); }
    return j({ error: "Aksi tidak dikenal." }, 400);
  } catch (err) {
    console.error("[admin/musim]", err?.message || err);
    return j({ error: "Gagal memproses." }, 500);
  }
}
