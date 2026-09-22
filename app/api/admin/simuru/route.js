import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { diagnoseSimuru, getSimuruBalance, simuruConfigured } from "@/lib/simuru";

export const dynamic = "force-dynamic";

export async function GET(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  // ?diagnose=1 menembak beberapa endpoint dan melaporkan siapa yang menolak:
  // Simuru sendiri (JSON) atau CDN/WAF di depannya (HTML).
  if (new URL(req.url).searchParams.get("diagnose")) {
    return NextResponse.json(await diagnoseSimuru());
  }

  if (!simuruConfigured()) return NextResponse.json({ configured: false, balance: null });
  try {
    const balance = await getSimuruBalance();
    return NextResponse.json({ configured: true, balance });
  } catch (err) {
    return NextResponse.json({ configured: true, balance: null, error: err?.message || "Gagal cek saldo." });
  }
}
