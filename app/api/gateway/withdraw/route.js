import { NextResponse } from "next/server";
import { ajukanPenarikan } from "@/lib/gateway";
import { publikWdGateway } from "@/lib/gatewayWd";
import { rateLimit } from "@/lib/rateLimit";
import { kabariAdmin, gwPenarikanNotif } from "@/lib/gatewayNotify";

export const dynamic = "force-dynamic";

export async function POST(req) {
  const { token, amount, ewallet, nomor, atasNama } = await req.json().catch(() => ({}));
  if (!token) return NextResponse.json({ error: "Kode akun kosong." }, { status: 400 });
  // Dibatasi ketat: penarikan memindahkan uang keluar, dan percobaan beruntun
  // yang cepat adalah bentuk paling umum dari penyalahgunaan akun yang diambil
  // alih orang lain.
  if (!rateLimit(`gwwd:${token}`, 5, 300_000)) {
    return NextResponse.json({ error: "Terlalu banyak permintaan penarikan. Coba lagi 5 menit lagi." }, { status: 429 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const r = await ajukanPenarikan({ token, amount, ewallet, nomor, atasNama, ip });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status || 400 });

  // Penarikan otomatis dikabari admin oleh gatewayWd saat selesai/gagal; yang manual
  // perlu diproses admin, jadi dikabari sekarang.
  if (!r.otomatis) kabariAdmin(gwPenarikanNotif({ ...r.penarikan, token })).catch(() => {});
  return NextResponse.json({ ok: true, penarikan: publikWdGateway(r.penarikan), saldo: r.saldo, otomatis: r.otomatis });
}
