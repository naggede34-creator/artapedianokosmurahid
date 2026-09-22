import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { diagnoseDibanana, dibananaConfigured, getDibananaBalance } from "@/lib/dibanana";

export const dynamic = "force-dynamic";

export async function GET(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  if (new URL(req.url).searchParams.get("diagnose")) {
    return NextResponse.json(await diagnoseDibanana());
  }

  if (!dibananaConfigured()) return NextResponse.json({ configured: false, balance: null });
  try {
    const balance = await getDibananaBalance();
    return NextResponse.json({ configured: true, balance });
  } catch (err) {
    return NextResponse.json({ configured: true, balance: null, error: err?.message || "Gagal cek saldo." });
  }
}
