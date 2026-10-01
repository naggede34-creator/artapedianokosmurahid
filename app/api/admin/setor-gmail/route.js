import { NextResponse } from "next/server";
import { adminSah } from "@/lib/adminAuth";
import { ringkasAdmin, daftarAdmin, putusanManual, aturRoom, tesKoneksi, ambilRoom, sapuSetorGmail } from "@/lib/setorGmail";
import { daftarWdAdmin } from "@/lib/wdInstan";

export const dynamic = "force-dynamic";
const H = { "Cache-Control": "no-store" };

// GET ?status=semua|diterima|dibayar|ditolak|menunggu-admin|dikirim|digenerate
export async function GET(req) {
  if (!(await adminSah(req))) return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: H });
  try {
    const status = new URL(req.url).searchParams.get("status") || "semua";
    const [ringkas, daftar, wd, room] = await Promise.all([ringkasAdmin(), daftarAdmin({ status }), daftarWdAdmin({ jenis: "setor", limit: 25 }), ambilRoom()]);
    return NextResponse.json({ ringkas, daftar, wd, rooms: room.rooms, galatPenyedia: room.galat }, { headers: H });
  } catch (err) {
    console.error("[admin/setor-gmail]", err?.message || err);
    return NextResponse.json({ error: "Gagal memuat data Stor Gmail." }, { status: 500 });
  }
}

// POST { aksi: "setuju"|"tolak", email, alasan } | { aksi: "room", roomId, untung?, tutup? } | { aksi: "tes" } | { aksi: "sapu" }
export async function POST(req) {
  if (!(await adminSah(req))) return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: H });
  const b = await req.json().catch(() => ({}));
  try {
    let r;
    if (b.aksi === "setuju" || b.aksi === "tolak") r = await putusanManual(b.email, b.aksi, b.alasan);
    else if (b.aksi === "room") r = await aturRoom(b.roomId, { untung: b.untung, tutup: b.tutup });
    else if (b.aksi === "tes") r = await tesKoneksi();
    else if (b.aksi === "sapu") { r = { ok: true, ...(await sapuSetorGmail({ jeda: 0 })) }; }
    else r = { ok: false, alasan: "Aksi tidak dikenal." };
    return r.ok ? NextResponse.json(r, { headers: H }) : NextResponse.json({ error: r.alasan }, { status: 400 });
  } catch (err) {
    console.error("[admin/setor-gmail]", err?.message || err);
    return NextResponse.json({ error: "Gagal memproses." }, { status: 500 });
  }
}
