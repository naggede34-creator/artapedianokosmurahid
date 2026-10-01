import { NextResponse } from "next/server";
import { adminSah } from "@/lib/adminAuth";
import { daftarIpBlokir, blokirIpManual, bukaIpManual } from "@/lib/blokirIp";

export const dynamic = "force-dynamic";
const H = { "Cache-Control": "no-store" };

// GET → daftar IP yang diblokir dari situs.
export async function GET(req) {
  if (!(await adminSah(req))) return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: H });
  try {
    const d = await daftarIpBlokir();
    return NextResponse.json({ items: d.map((x) => ({ ip: x._id, alasan: x.alasan || "", at: x.at || null, manual: !!x.manual, akun: (x.tokens || []).map((t) => `${t.slice(0, 6)}••••${t.slice(-4)}`) })) }, { headers: H });
  } catch (err) {
    console.error("[admin/ip-blokir]", err?.message || err);
    return NextResponse.json({ error: "Gagal memuat daftar IP." }, { status: 500 });
  }
}

// POST { aksi: "buka" | "blokir", ip, alasan? }
export async function POST(req) {
  if (!(await adminSah(req))) return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: H });
  const b = await req.json().catch(() => ({}));
  try {
    const r = b.aksi === "blokir" ? await blokirIpManual(b.ip, b.alasan) : b.aksi === "buka" ? await bukaIpManual(b.ip) : { ok: false, alasan: "Aksi tidak dikenal." };
    return r.ok ? NextResponse.json(r, { headers: H }) : NextResponse.json({ error: r.alasan }, { status: 400 });
  } catch (err) {
    console.error("[admin/ip-blokir]", err?.message || err);
    return NextResponse.json({ error: "Gagal mengubah blokir IP." }, { status: 500 });
  }
}
