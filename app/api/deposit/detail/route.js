import { NextResponse } from "next/server";
import { depositsCol } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { MANUAL_DEPOSIT_KEY } from "@/lib/paymentProviders";

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
    : {
        token,
        // Deposit manual yang sudah dikonfirmasi user ikut dipulihkan: layarnya
        // masih punya isi ("menunggu dicek admin"), tidak seperti QRIS otomatis
        // yang begitu lewat statusnya tidak ada lagi yang perlu dilihat.
        status: { $in: ["pending", "review"] },
        expiredAt: { $gt: new Date() }
      };
  const d = await deposits.find(filter).sort({ createdAt: -1 }).limit(1).next();
  if (!d) return NextResponse.json({ item: null });

  // Gambar QRIS manual tidak disalin ke tiap dokumen deposit — satu gambar
  // milik admin dipakai semua orang. Diambil dari pengaturan saat dibutuhkan.
  let qrImage = d.qrImage || null;
  if (d.provider === MANUAL_DEPOSIT_KEY && !qrImage) {
    try {
      qrImage = (await getSettings()).manualDeposit?.qrImage || null;
    } catch {
      qrImage = null;
    }
  }

  return NextResponse.json({
    item: {
      orderId: d.orderId,
      providerRef: d.providerRef && d.providerRef !== d.orderId ? d.providerRef : null,
      amount: d.amount,
      adminFee: d.adminFee ?? null,
      totalAmount: d.totalAmount ?? null,
      provider: d.provider,
      method: d.method || "qris",
      qrImage,
      ...(d.provider === MANUAL_DEPOSIT_KEY ? { manual: true, manualInfo: d.manualInfo || null } : {}),
      paymentUrl: d.paymentUrl || null,
      status: d.status,
      createdAt: d.createdAt,
      expiredAt: d.expiredAt ? new Date(d.expiredAt).getTime() : null
    }
  });
}
