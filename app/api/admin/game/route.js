import { NextResponse } from "next/server";
import { adminSah } from "@/lib/adminAuth";
import { ringkasanAdmin, batalkanPaksa, sapuGame } from "@/lib/game/inti";

export const dynamic = "force-dynamic";

export async function GET(req) {
  if (!(await adminSah(req))) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  await sapuGame({ batas: 20 }).catch(() => {});
  return NextResponse.json(await ringkasanAdmin());
}

export async function POST(req) {
  if (!(await adminSah(req))) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const { aksi, id } = await req.json().catch(() => ({}));
  if (aksi === "batalkan") {
    const r = await batalkanPaksa(String(id || ""));
    return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.alasan || "Gagal." }, { status: 400 });
  }
  if (aksi === "sapu") return NextResponse.json({ ok: true, ...(await sapuGame()) });
  return NextResponse.json({ error: "Aksi tidak dikenal." }, { status: 400 });
}
