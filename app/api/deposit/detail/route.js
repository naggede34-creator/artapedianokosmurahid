import { NextResponse } from "next/server";
import { depositsCol } from "@/lib/db";

export const dynamic = "force-dynamic";

// Dipakai halaman deposit untuk menampilkan kembali QR yang masih aktif setelah refresh.
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  const orderId = searchParams.get("order_id");
  if (!token) return NextResponse.json({ error: "Kode akun kosong." }, { status: 400 });

  const deposits = await depositsCol();
  const filter = orderId
    ? { token, orderId }
    : { token, status: "pending", expiredAt: { $gt: new Date() } };
  const d = await deposits.find(filter).sort({ createdAt: -1 }).limit(1).next();
  if (!d) return NextResponse.json({ item: null });

  return NextResponse.json({
    item: {
      orderId: d.orderId,
      providerRef: d.providerRef && d.providerRef !== d.orderId ? d.providerRef : null,
      amount: d.amount,
      adminFee: d.adminFee ?? null,
      totalAmount: d.totalAmount ?? null,
      provider: d.provider,
      method: d.method || "qris",
      qrImage: d.qrImage || null,
      paymentUrl: d.paymentUrl || null,
      status: d.status,
      createdAt: d.createdAt,
      expiredAt: d.expiredAt ? new Date(d.expiredAt).getTime() : null
    }
  });
}
