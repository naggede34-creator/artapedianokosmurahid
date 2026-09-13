import { NextResponse } from "next/server";
import { usersCol, otpOrdersCol } from "@/lib/db";
import { createOrder } from "@/lib/rumahotp";
import { sendTelegramNotif, otpPurchaseNotif } from "@/lib/telegram";
import { getSettings } from "@/lib/settings";

export async function POST(req) {
  try {
    const { token, numberId, providerId, operatorId, basePrice, serviceName, countryName } = await req.json();
    if (!token || !numberId || !providerId) {
      return NextResponse.json({ error: "Parameter kurang." }, { status: 400 });
    }

    const { markupPercent } = await getSettings();

    const users = await usersCol();
    const user = await users.findOne({ token });
    if (!user) return NextResponse.json({ error: "Kode akun tidak ditemukan." }, { status: 404 });

    const sellPrice = Math.ceil(Number(basePrice || 0) * (1 + markupPercent / 100));
    if (user.balance < sellPrice) {
      return NextResponse.json({ error: "Saldo tidak cukup. Silakan deposit dulu." }, { status: 400 });
    }

    const result = await createOrder(process.env.RUMAHOTP_APIKEY, { numberId, providerId, operatorId });
    const data = result.data || result;
    if (!data || !data.order_id) {
      return NextResponse.json({ error: data?.message || "Nomor tidak tersedia, coba pilih negara/provider lain." }, { status: 400 });
    }

    // Potong saldo hanya setelah order berhasil dibuat di RumahOTP.
    const updated = await users.findOneAndUpdate(
      { token, balance: { $gte: sellPrice } },
      { $inc: { balance: -sellPrice } },
      { returnDocument: "after" }
    );
    if (!updated) {
      return NextResponse.json({ error: "Saldo tidak cukup. Silakan deposit dulu." }, { status: 400 });
    }

    const orders = await otpOrdersCol();
    await orders.insertOne({
      orderId: String(data.order_id),
      token,
      serviceName: serviceName || data.service || "-",
      countryName: countryName || data.country || "-",
      phoneNumber: data.phone_number || "-",
      price: sellPrice,
      status: "pending",
      otpCode: null,
      otpMsg: null,
      refunded: false,
      createdAt: new Date(),
      expiredAt: data.expired_at ? new Date(data.expired_at) : null
    });

    sendTelegramNotif(
      otpPurchaseNotif({
        orderId: String(data.order_id),
        serviceName: serviceName || data.service || "-",
        countryName: countryName || data.country || "-",
        phoneNumber: data.phone_number || "-",
        price: sellPrice,
        token
      })
    );

    return NextResponse.json({
      orderId: String(data.order_id),
      phoneNumber: data.phone_number,
      price: sellPrice,
      expiredAt: data.expired_at || null,
      createdAt: new Date().toISOString(),
      balance: updated.balance
    });
  } catch (err) {
    console.error(err?.response?.data || err);
    return NextResponse.json({ error: "Gagal membuat pesanan nomor OTP." }, { status: 500 });
  }
}
