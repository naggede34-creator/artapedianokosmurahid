import { NextResponse } from "next/server";
import { otpOrdersCol, warrantyClaimsCol } from "@/lib/db";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    // Diperiksa di sini, bukan cuma disembunyikan tombolnya di dashboard.
    // Tombol yang hilang tidak menghentikan siapa pun yang sudah tahu alamat
    // rutenya, dan klaim yang tetap masuk saat fiturnya "mati" akan menumpuk
    // di panel admin tanpa ada yang mengharapkannya.
    try {
      const settings = await getSettings();
      if (settings?.warranty?.enabled === false) {
        return NextResponse.json(
          { error: settings.warranty.note || "Klaim garansi sedang ditutup sementara." },
          { status: 403 }
        );
      }
    } catch (err) {
      // Pengaturan tidak terbaca: fitur dibiarkan JALAN. Gagal ke arah menolak
      // klaim berarti pembeli yang nomornya bermasalah kehilangan satu-satunya
      // jalan untuk mengadu, hanya karena database sedang lambat.
      console.error("[warranty/claim] pengaturan tidak terbaca:", err?.message || err);
    }

    const { token, orderId, description, screenshotData, purchasePrice } = await req.json();

    if (!token || !orderId || !description?.trim() || !purchasePrice) {
      return NextResponse.json({ error: "Data tidak lengkap." }, { status: 400 });
    }
    if (Number(purchasePrice) <= 0) {
      return NextResponse.json({ error: "Harga beli tidak valid." }, { status: 400 });
    }

    const orders = await otpOrdersCol();
    const order = await orders.findOne({ orderId, token });
    if (!order) {
      return NextResponse.json({ error: "Pesanan tidak ditemukan atau bukan milik akun ini." }, { status: 404 });
    }

    const claims = await warrantyClaimsCol();
    const existing = await claims.findOne({ orderId });
    if (existing) {
      return NextResponse.json({ error: "Garansi untuk pesanan ini sudah pernah diklaim." }, { status: 400 });
    }

    // Validate screenshot size (base64 max ~1.5MB)
    if (screenshotData && screenshotData.length > 2_000_000) {
      return NextResponse.json({ error: "Ukuran screenshot terlalu besar (maks 1.5 MB)." }, { status: 400 });
    }

    await claims.insertOne({
      token,
      orderId,
      serviceName: order.serviceName || "-",
      countryName: order.countryName || "-",
      phoneNumber: order.phoneNumber || "-",
      description: description.trim(),
      screenshotData: screenshotData || null,
      purchasePrice: Number(purchasePrice),
      status: "pending",
      adminNote: "",
      createdAt: new Date(),
      resolvedAt: null
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Gagal menyimpan klaim." }, { status: 500 });
  }
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Token kosong." }, { status: 400 });

  const claims = await warrantyClaimsCol();
  const list = await claims.find({ token }).sort({ createdAt: -1 }).toArray();

  return NextResponse.json({
    items: list.map((c) => ({
      id: c._id.toString(),
      orderId: c.orderId,
      serviceName: c.serviceName,
      countryName: c.countryName,
      phoneNumber: c.phoneNumber,
      description: c.description,
      purchasePrice: c.purchasePrice,
      status: c.status,
      adminNote: c.adminNote || "",
      createdAt: c.createdAt,
      resolvedAt: c.resolvedAt
    }))
  });
}
