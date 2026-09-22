import { NextResponse } from "next/server";
import { otpOrdersCol, usersCol } from "@/lib/db";
import { createOrder, toEpochMs } from "@/lib/rumahotp";
import { createOtpmaniaOrder, isOtpmaniaServer, otpmaniaServerCode } from "@/lib/otpmania";
import { sendTelegramNotif, otpPurchaseNotif, otpAutoRefundNotif } from "@/lib/telegram";
import { logBalance } from "@/lib/ledger";

// Dipakai saat nomor yang dibeli kedaluwarsa tanpa kode OTP masuk. User bisa minta
// nomor pengganti tanpa membayar lagi (memakai saldo yang sudah terpotong di order lama).
// Kalau provider juga gagal menyediakan nomor baru, saldo otomatis dikembalikan penuh.
// Berlaku untuk semua server: RumahOTP maupun OTPMANIA.
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

    const isOm = isOtpmaniaServer(oldOrder.server);
    if (isOm ? !oldOrder.serviceId || oldOrder.countryId == null : !oldOrder.numberId || !oldOrder.providerId) {
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

    // Pesan nomor pengganti ke provider yang sama. Hasilnya diseragamkan ke `fresh`.
    let fresh = null;
    try {
      if (isOm) {
        const fresh2 = await createOtpmaniaOrder({
          service: oldOrder.serviceId,
          country: oldOrder.countryId,
          operator: oldOrder.operator || "any",
          server: otpmaniaServerCode(oldOrder.server)
        });
        if (fresh2?.id) {
          fresh = {
            orderId: fresh2.id,
            phoneNumber: fresh2.number || "-",
            expiredMs: toEpochMs(fresh2.expiredAt),
            extra: { server: oldOrder.server, countryId: String(oldOrder.countryId), operator: oldOrder.operator || "any" }
          };
        }
      } else {
        const result = await createOrder(process.env.RUMAHOTP_APIKEY, {
          numberId: oldOrder.numberId,
          providerId: oldOrder.providerId,
          operatorId: oldOrder.operatorId
        });
        const data = result?.data || result;
        if (data?.order_id) {
          fresh = {
            orderId: String(data.order_id),
            phoneNumber: data.phone_number || "-",
            expiredMs: toEpochMs(data.expired_at),
            extra: { server: "rumahotp" }
          };
        }
      }
    } catch (e) {
      fresh = null;
    }

    if (!fresh) {
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
      orderId: fresh.orderId,
      ...fresh.extra,
      token,
      serviceId: oldOrder.serviceId || null,
      serviceName: oldOrder.serviceName,
      countryName: oldOrder.countryName,
      phoneNumber: fresh.phoneNumber,
      price: oldOrder.price,
      status: "pending",
      otpCode: null,
      otpMsg: null,
      refunded: false,
      replacedFrom: oldOrder.orderId,
      numberId: oldOrder.numberId || null,
      providerId: oldOrder.providerId || null,
      operatorId: oldOrder.operatorId || null,
      basePrice: oldOrder.basePrice,
      createdAt: new Date(),
      expiredAt: fresh.expiredMs ? new Date(fresh.expiredMs) : null
    });

    sendTelegramNotif(
      otpPurchaseNotif({
        orderId: fresh.orderId,
        serviceName: oldOrder.serviceName,
        countryName: oldOrder.countryName,
        phoneNumber: fresh.phoneNumber,
        price: oldOrder.price,
        token
      })
    );

    return NextResponse.json({
      replaced: true,
      refunded: false,
      orderId: fresh.orderId,
      phoneNumber: fresh.phoneNumber,
      price: oldOrder.price,
      expiredAt: fresh.expiredMs || null,
      createdAt: new Date().toISOString()
    });
  } catch (err) {
    console.error(err?.response?.data || err?.message || err);
    return NextResponse.json({ error: "Gagal memproses ganti nomor. Coba lagi atau hubungi admin." }, { status: 500 });
  }
}
