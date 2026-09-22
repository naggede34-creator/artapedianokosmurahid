import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { diagnoseRuangOtp, ruangOtpConfigured } from "@/lib/ruangotp";
import { diagnoseDibanana } from "@/lib/dibanana";

export const dynamic = "force-dynamic";

// Diagnosa koneksi provider dari sisi server. Tidak pernah membocorkan user id
// atau API key — hanya melaporkan berhasil/gagal dan penyebabnya.
export async function GET(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const provider = new URL(req.url).searchParams.get("provider") || "ruangotp";
  try {
    if (provider === "dibanana") return NextResponse.json(await diagnoseDibanana());
    if (!ruangOtpConfigured()) {
      return NextResponse.json({
        configured: false,
        verdict: "RUANGOTP_USER_ID belum diisi di environment variables Vercel."
      });
    }
    const d = await diagnoseRuangOtp();
    const blocked = [d.ruangotp_s1, d.ruangotp_s2].some((r) => r?.ipBlocked);
    const allOk = d.ruangotp_s1?.ok && d.ruangotp_s2?.ok;
    return NextResponse.json({
      ...d,
      verdict: allOk
        ? "Koneksi RuangOTP normal, kedua server bisa dihubungi."
        : blocked
        ? "IP server ini belum di-whitelist di RuangOTP. Daftarkan dulu di menu Profil RuangOTP."
        : "Sebagian server RuangOTP tidak bisa dihubungi — lihat rincian di bawah."
    });
  } catch (err) {
    return NextResponse.json({ error: err?.message || "Gagal diagnosa." }, { status: 502 });
  }
}
