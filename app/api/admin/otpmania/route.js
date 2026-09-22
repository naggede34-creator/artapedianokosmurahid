import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { diagnoseOtpmania, getOtpmaniaBalance, otpmaniaConfigured } from "@/lib/otpmania";

export const dynamic = "force-dynamic";

export async function GET(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  // ?diagnose=1 menembak beberapa endpoint dan melaporkan apa yang sebenarnya
  // dibalas — dipakai untuk mencocokkan bentuk respons & melacak penolakan.
  if (new URL(req.url).searchParams.get("diagnose")) {
    return NextResponse.json(await diagnoseOtpmania());
  }

  if (!otpmaniaConfigured()) return NextResponse.json({ configured: false, balance: null });
  try {
    const balance = await getOtpmaniaBalance();
    return NextResponse.json({ configured: true, balance });
  } catch (err) {
    return NextResponse.json({ configured: true, balance: null, error: err?.message || "Gagal cek saldo." });
  }
}
