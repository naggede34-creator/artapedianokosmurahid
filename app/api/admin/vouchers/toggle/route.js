import { NextResponse } from "next/server";
import { vouchersCol } from "@/lib/db";
import { isAdminRequest } from "@/lib/adminAuth";

export async function POST(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const { code } = await req.json();
    if (!code) return NextResponse.json({ error: "Kode voucher wajib diisi." }, { status: 400 });

    const col = await vouchersCol();
    const voucher = await col.findOne({ code });
    if (!voucher) return NextResponse.json({ error: "Voucher tidak ditemukan." }, { status: 404 });

    const updated = await col.findOneAndUpdate(
      { code },
      { $set: { active: !(voucher.active !== false) } },
      { returnDocument: "after" }
    );

    return NextResponse.json({ code, active: updated.active });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal mengubah status voucher." }, { status: 500 });
  }
}
