import { NextResponse } from "next/server";
import { adminSah } from "@/lib/adminAuth";
import { pratinjauKoreksi, terapkanKoreksi } from "@/lib/koreksiSaldo";
import { sendTelegramNotif } from "@/lib/telegram";

export const dynamic = "force-dynamic";
const H = { "Cache-Control": "no-store" };

// POST { aksi: "pratinjau" | "terapkan", csv, kunci?, alasanUmum? }
export async function POST(req) {
  if (!(await adminSah(req))) return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: H });
  const b = await req.json().catch(() => ({}));
  const csv = String(b.csv || "").slice(0, 200_000);
  try {
    if (b.aksi === "pratinjau") {
      const r = await pratinjauKoreksi(csv);
      return r.ok ? NextResponse.json(r, { headers: H }) : NextResponse.json({ error: r.alasan }, { status: 400, headers: H });
    }
    if (b.aksi === "terapkan") {
      const r = await terapkanKoreksi(csv, { kunci: b.kunci, alasanUmum: b.alasanUmum });
      if (!r.ok) return NextResponse.json({ error: r.alasan }, { status: 400, headers: H });
      sendTelegramNotif(`🧮 <b>KOREKSI SALDO MASSAL (CSV)</b>\n✅ ${r.berhasil} akun diubah${r.gagal.length ? ` · ⚠️ ${r.gagal.length} gagal` : ""}${r.dilewati ? ` · ${r.dilewati} baris dilewati` : ""}\n📝 ${String(b.alasanUmum || "").replace(/[<>&]/g, "").slice(0, 100)}`);
      return NextResponse.json(r, { headers: H });
    }
    return NextResponse.json({ error: "Aksi tidak dikenal." }, { status: 400, headers: H });
  } catch (err) {
    console.error("[admin/koreksi-saldo]", err?.message || err);
    return NextResponse.json({ error: "Gagal memproses koreksi." }, { status: 500, headers: H });
  }
}
