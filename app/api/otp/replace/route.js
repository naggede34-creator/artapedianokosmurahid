import { NextResponse } from "next/server";
import { otpOrdersCol, usersCol } from "@/lib/db";
import { kreditRefund } from "@/lib/saldoDeposit";
import { beliNomorPengganti, bisaDiganti } from "@/lib/gantiNomor";
import { otpPurchaseNotif, otpAutoRefundNotif, otpRefundPublicNotif } from "@/lib/telegram";
import { umumkan } from "@/lib/notifyHub";
import { logBalance } from "@/lib/ledger";
import { tarikKomisi } from "@/lib/resellerKomisi";

// Dipakai saat nomor yang dibeli kedaluwarsa tanpa kode OTP masuk. User bisa minta
// nomor pengganti tanpa membayar lagi (memakai saldo yang sudah terpotong di order lama).
// Kalau provider juga gagal menyediakan nomor baru, saldo otomatis dikembalikan penuh.
// Berlaku untuk semua server: RumahOTP, WarungNokos, maupun dibanana.
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

    if (!bisaDiganti(oldOrder)) {
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

    const fresh = await beliNomorPengganti(oldOrder);

    if (!fresh) {
      // Provider tidak bisa kasih nomor pengganti -> saldo dikembalikan penuh,
      // termasuk biaya jaminan kalau ada: jaminannya tidak terpenuhi.
      const totalRefund = oldOrder.price + (Number(oldOrder.jaminanBiaya) || 0);
      const refunded = await kreditRefund(token, totalRefund, oldOrder.depositBagian);
      // Pembeli dapat uangnya kembali, jadi komisi resellernya (kalau ada) ikut ditarik.
      await tarikKomisi(oldOrder.komisiOrderId || oldOrder.orderId);
      await logBalance({
        token,
        type: "otp_refund",
        amount: totalRefund,
        balanceAfter: refunded?.balance,
        title: `Refund OTP ${oldOrder.serviceName || ""}`.trim(),
        ref: oldOrder.orderId
      });
      umumkan({
        jenis: "otp_refund",
        admin: otpAutoRefundNotif({
          orderId: oldOrder.orderId,
          serviceName: oldOrder.serviceName,
          countryName: oldOrder.countryName,
          price: oldOrder.price,
          token
        }),
        publik: otpRefundPublicNotif({
          serviceName: oldOrder.serviceName,
          countryName: oldOrder.countryName,
          price: oldOrder.price,
          token,
          reason: "nomor pengganti tidak tersedia"
        })
      });
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
      depositBagian: oldOrder.depositBagian ?? null,
      ...(oldOrder.jaminanBiaya ? { jaminanBiaya: oldOrder.jaminanBiaya, jaminanGanti: true } : {}),
      ...(oldOrder.resellerBotId ? { resellerBotId: oldOrder.resellerBotId, komisiOrderId: oldOrder.komisiOrderId || oldOrder.orderId } : {}),
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

    // Admin saja: nomor pengganti bukan penjualan baru — saldonya sudah
    // terpotong di pesanan sebelumnya. Mengumumkannya sebagai "terjual"
    // akan menghitung satu pembelian dua kali di channel.
    umumkan({
      admin: otpPurchaseNotif({
        orderId: fresh.orderId,
        serviceName: oldOrder.serviceName,
        countryName: oldOrder.countryName,
        phoneNumber: fresh.phoneNumber,
        price: oldOrder.price,
        token
      })
    });

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
