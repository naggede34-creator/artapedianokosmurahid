import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { getSimuruBalance, simuruConfigured } from "@/lib/simuru";

export const dynamic = "force-dynamic";

export async function GET(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!simuruConfigured()) return NextResponse.json({ configured: false, balance: null });
  try {
    const balance = await getSimuruBalance();
    return NextResponse.json({ configured: true, balance });
  } catch (err) {
    return NextResponse.json({ configured: true, balance: null, error: err?.message || "Gagal cek saldo." });
  }
}
