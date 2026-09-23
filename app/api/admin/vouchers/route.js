import { NextResponse } from "next/server";
import { vouchersCol } from "@/lib/db";
import { isAdminRequest } from "@/lib/adminAuth";
import { generateVoucherCode } from "@/lib/voucherCode";
import { voucherCreatedNotif } from "@/lib/telegram";
import { umumkan } from "@/lib/notifyHub";

export const dynamic = "force-dynamic";

export async function GET(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const col = await vouchersCol();
  const list = await col.find({}).sort({ createdAt: -1 }).limit(100).toArray();
  return NextResponse.json({
    items: list.map((v) => ({
      code: v.code,
      amount: v.amount,
      maxUses: v.maxUses,
      usedCount: v.usedCount || 0,
      active: v.active !== false,
      createdAt: v.createdAt
    }))
  });
}

export async function POST(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const body = await req.json().catch(() => ({}));
    const amount = Math.abs(Number(body.amount || 0));
    const maxUses = Math.max(1, Math.floor(Number(body.maxUses || 1)));
    if (!amount) return NextResponse.json({ error: "Nominal voucher wajib diisi." }, { status: 400 });

    const col = await vouchersCol();
    let code = (body.code || "").trim().toUpperCase();
    if (code) {
      const exists = await col.findOne({ code });
      if (exists) return NextResponse.json({ error: "Kode voucher itu sudah dipakai, coba kode lain." }, { status: 400 });
    } else {
      for (let i = 0; i < 5; i++) {
        const candidate = generateVoucherCode();
        const exists = await col.findOne({ code: candidate });
        if (!exists) {
          code = candidate;
          break;
        }
      }
      if (!code) throw new Error("Gagal membuat kode voucher, coba lagi.");
    }

    await col.insertOne({
      code,
      amount,
      maxUses,
      usedCount: 0,
      redeemedBy: [],
      active: true,
      createdAt: new Date()
    });

    // Bawaannya MATI. Kalau dinyalakan, kodenya ikut terbaca seluruh channel —
    // itu memang gunanya untuk bagi-bagi voucher, tapi bukan yang diinginkan
    // untuk voucher yang dibuat khusus untuk satu orang.
    const teksVoucher = voucherCreatedNotif({ code, amount, maxUses });
    umumkan({ jenis: "voucher_baru", admin: teksVoucher, publik: teksVoucher });

    return NextResponse.json({ code, amount, maxUses, usedCount: 0 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal membuat voucher." }, { status: 500 });
  }
}
