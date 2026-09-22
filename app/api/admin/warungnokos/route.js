import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { diagnoseWarungNokos, warungNokosConfigured } from "@/lib/warungnokos";
import { diagnoseDibanana } from "@/lib/dibanana";

export const dynamic = "force-dynamic";

// Diagnosa koneksi provider dari sisi server. Tidak pernah membocorkan API key —
// hanya melaporkan berhasil/gagal, saldo, dan penyebabnya.
export async function GET(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const provider = new URL(req.url).searchParams.get("provider") || "warungnokos";
  try {
    if (provider === "dibanana") return NextResponse.json(await diagnoseDibanana());
    if (!warungNokosConfigured()) {
      return NextResponse.json({
        configured: false,
        verdict: "WARUNGNOKOS_APIKEY belum diisi di environment variables Vercel."
      });
    }
    const d = await diagnoseWarungNokos();
    const allOk = d.warungnokos_s1?.ok && d.warungnokos_s2?.ok;
    const balance = d.profile?.balance;
    return NextResponse.json({
      ...d,
      verdict: allOk
        ? `Koneksi WarungNokos normal.${
            balance != null ? ` Saldo akun: Rp${Number(balance).toLocaleString("id-ID")}.` : ""
          }`
        : d.profile?.error
        ? `API key ditolak atau tidak bisa dihubungi: ${d.profile.error}`
        : "Sebagian server WarungNokos tidak bisa dihubungi — lihat rincian di bawah."
    });
  } catch (err) {
    return NextResponse.json({ error: err?.message || "Gagal diagnosa." }, { status: 502 });
  }
}
