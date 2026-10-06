import { NextResponse } from "next/server";
import { adminSah } from "@/lib/adminAuth";
import { SEGMEN, hitungSegmen, buatSiaran, prosesSiaran, batalSiaran, daftarSiaran } from "@/lib/siaran";

export const dynamic = "force-dynamic";
const H = { "Cache-Control": "no-store" };

// GET ?segmen=&param= → { segmen, daftar, hitung? }  ·  POST { aksi: "buat" | "proses" | "batal", ... }
export async function GET(req) {
  if (!(await adminSah(req))) return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: H });
  const u = new URL(req.url).searchParams;
  try {
    const seg = u.get("segmen");
    return NextResponse.json({ segmen: SEGMEN, daftar: await daftarSiaran(), ...(seg ? { hitung: await hitungSegmen(seg, u.get("param")) } : {}) }, { headers: H });
  } catch (e) { console.error("[admin/siaran]", e?.message || e); return NextResponse.json({ error: "Gagal memuat." }, { status: 500, headers: H }); }
}

export async function POST(req) {
  if (!(await adminSah(req))) return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: H });
  const b = await req.json().catch(() => ({}));
  try {
    if (b.aksi === "buat") {
      const r = await buatSiaran(b);
      if (!r.ok) return NextResponse.json({ error: r.alasan }, { status: 400, headers: H });
      await prosesSiaran({ kelompok: 150 }); // kelompok pertama langsung jalan; sisanya oleh cron / tombol Proses
      return NextResponse.json(r, { headers: H });
    }
    if (b.aksi === "proses") return NextResponse.json({ ok: true, hasil: await prosesSiaran({ kelompok: 300 }) }, { headers: H });
    if (b.aksi === "batal") { const r = await batalSiaran(b.id); return r.ok ? NextResponse.json(r, { headers: H }) : NextResponse.json({ error: r.alasan }, { status: 400, headers: H }); }
    return NextResponse.json({ error: "Aksi tidak dikenal." }, { status: 400, headers: H });
  } catch (e) { console.error("[admin/siaran]", e?.message || e); return NextResponse.json({ error: "Gagal memproses." }, { status: 500, headers: H }); }
}
