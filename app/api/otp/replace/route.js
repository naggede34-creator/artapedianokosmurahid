import { NextResponse } from "next/server";
import { otpOrdersCol, usersCol } from "@/lib/db";
import { createOrder, toEpochMs } from "@/lib/rumahotp";
import { sendTelegramNotif, otpPurchaseNotif, otpAutoRefundNotif } from "@/lib/telegram";
import { logBalance } from "@/lib/ledger";

// Dipakai saat nomor yang dibeli kedaluwarsa tanpa kode OTP masuk. User bisa minta
// nomor pengganti tanpa membayar lagi (memakai saldo yang sudah terpotong di order lama).
// Kalau RumahOTP juga gagal menyediakan nomor baru, saldo otomatis dikembalikan penuh.
export async function POST(req) {
  try {
    const { token, orderId } = await req.json();
    if (!token || !orderId) return NextResponse.json({ error: "Parameter kurang." }, { status: 400 });

    const orders = await otpOrdersCol();
    const oldOrder = await orders.findOne({ orderId, token });
    if (!oldOrder) return NextResponse.json({ error: "Pesanan tidak ditemukan." }, { status: 404 });
    if (oldOrder.otpCode) {
      return NextResponse.json({ error: "Kode OTP sudah masuk, pesanan ini tidak perlu diganti." }, { status: 400 });
    }
    if (oldOrder.refunded) {
      return NextResponse.json({ error: "Pesanan ini sudah diproses (dibatalkan/diganti) sebelumnya." }, { status: 400 });
    }
    if (oldOrder.status !== "expired") {
      return NextResponse.json({ error: "Ganti nomor hanya bisa dipakai untuk pesanan yang sudah kedaluwarsa." }, { status: 400 });
    }
    if (!oldOrder.numberId || !oldOrder.providerId) {
      return NextResponse.json({ error: "Data pesanan lama tidak lengkap, tidak bisa diganti otomatis." }, { status: 400 });
    }

    const users = await usersCol();

    // Tandai order lama selesai diproses dulu supaya tidak bisa dipakai dobel (race condition).
    const claimed = await orders.findOneAndUpdate(
      { orderId, token, refunded: false },
      { $set: { refunded: true, status: "expired" } },
      { returnDocument: "after" }
    );
    if (!claimed) {
      return NextResponse.json({ error: "Pesanan ini sudah diproses sebelumnya." }, { status: 400 });
    }

    let result;
    try {
      result = await createOrder(process.env.RUMAHOTP_APIKEY, {
        numberId: oldOrder.numberId,
        providerId: oldOrder.providerId,
        operatorId: oldOrder.operatorId
      });
    } catch (e) {
      result = null;
    }
    const data = result?.data || result;

    if (!data || !data.order_id) {
      // Provider tidak bisa kasih nomor pengganti -> saldo dikembalikan penuh.
      const refunded = await users.findOneAndUpdate(
        { token },
        { $inc: { balance: oldOrder.price } },
        { returnDocument: "after" }
      );
      await logBalance({
        token,
        type: "otp_refund",
        amount: oldOrder.price,
        balanceAfter: refunded?.balance,
        title: `Refund OTP ${oldOrder.serviceName || ""}`.trim(),
        ref: oldOrder.orderId
      });
      sendTelegramNotif(
        otpAutoRefundNotif({
          orderId: oldOrder.orderId,
          serviceName: oldOrder.serviceName,
          countryName: oldOrder.countryName,
          price: oldOrder.price,
          token
        })
      );
      return NextResponse.json({
        replaced: false,
        refunded: true,
        balance: refunded?.balance,
        message: "Nomor pengganti tidak tersedia saat ini, saldo sudah dikembalikan penuh."
      });
    }

    await orders.insertOne({
      orderId: String(data.order_id),
      token,
      serviceId: oldOrder.serviceId || null,
      serviceName: oldOrder.serviceName,
      countryName: oldOrder.countryName,
      phoneNumber: data.phone_number || "-",
      price: oldOrder.price,
      status: "pending",
      otpCode: null,
      otpMsg: null,
      refunded: false,
      replacedFrom: oldOrder.orderId,
      numberId: oldOrder.numberId,
      providerId: oldOrder.providerId,
      operatorId: oldOrder.operatorId,
      basePrice: oldOrder.basePrice,
      createdAt: new Date(),
      expiredAt: toEpochMs(data.expired_at) ? new Date(toEpochMs(data.expired_at)) : null
    });

    sendTelegramNotif(
      otpPurchaseNotif({
        orderId: String(data.order_id),
        serviceName: oldOrder.serviceName,
        countryName: oldOrder.countryName,
        phoneNumber: data.phone_number || "-",
        price: oldOrder.price,
        token
      })
    );

    return NextResponse.json({
      replaced: true,
      refunded: false,
      orderId: String(data.order_id),
      phoneNumber: data.phone_number,
      price: oldOrder.price,
      expiredAt: data.expired_at || null,
      createdAt: new Date().toISOString()
    });
  } catch (err) {
    console.error(err?.response?.data || err);
    return NextResponse.json({ error: "Gagal memproses ganti nomor. Coba lagi atau hubungi admin." }, { status: 500 });
  }
}
