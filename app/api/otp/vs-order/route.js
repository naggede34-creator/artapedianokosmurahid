import { NextResponse } from "next/server";
import { usersCol, otpOrdersCol } from "@/lib/db";
import {
  createVirtusimOrder,
  getVirtusimServices,
  virtusimConfigured,
  virtusimCountry,
  virtusimTtlMs
} from "@/lib/virtusim";
import { sendTelegramNotif, otpPurchaseNotif } from "@/lib/telegram";
import { getSettings } from "@/lib/settings";
import { logBalance } from "@/lib/ledger";

export const dynamic = "force-dynamic";

// Pesan nomor lewat server "Nokos OTP Fast" (VirtuSIM).
// Alur sama dengan /api/otp/order: harga selalu diambil ulang dari provider di server,
// saldo dipotong dulu secara atomik, dan dikembalikan kalau provider gagal.
export async function POST(req) {
  const users = await usersCol();
  let debited = false;
  let sellPrice = 0;
  let token;
  try {
    if (!virtusimConfigured()) {
      return NextResponse.json({ error: "Server OTP Fast belum dikonfigurasi admin. Pilih server lain." }, { status: 503 });
    }

    const body = await req.json().catch(() => ({}));
    token = body.token;
    const { serviceId } = body;
    if (!token || !serviceId) {
      return NextResponse.json({ error: "Parameter kurang. Muat ulang halaman lalu coba lagi." }, { status: 400 });
    }

    const user = await users.findOne({ token });
    if (!user) return NextResponse.json({ error: "Kode akun tidak ditemukan." }, { status: 404 });
    if (user.suspended) {
      return NextResponse.json(
        { error: `Akun ditangguhkan: ${user.suspendReason || "Hubungi admin untuk info lebih lanjut."}` },
        { status: 403 }
      );
    }

    // Harga & nama layanan dari server, bukan dari browser.
    let service;
    try {
      const list = await getVirtusimServices();
      service = list.find((s) => String(s.id) === String(serviceId));
    } catch (e) {
      console.error("[otp/vs-order] services gagal:", e?.message);
      return NextResponse.json({ error: "Server OTP Fast sedang sibuk. Coba lagi sebentar." }, { status: 503 });
    }
    if (!service) return NextResponse.json({ error: "Layanan ini sudah tidak tersedia. Pilih yang lain." }, { status: 400 });
    if (service.stock === 0) return NextResponse.json({ error: "Stok layanan ini sedang habis. Coba lagi nanti." }, { status: 400 });

    const { markupPercent } = await getSettings();
    sellPrice = Math.ceil(service.price * (1 + (Number(markupPercent) || 0) / 100));

    const afterDebit = await users.findOneAndUpdate(
      { token, balance: { $gte: sellPrice } },
      { $inc: { balance: -sellPrice } },
      { returnDocument: "after" }
    );
    if (!afterDebit) {
      return NextResponse.json(
        { error: `Saldo tidak cukup. Harga Rp${sellPrice.toLocaleString("id-ID")}, silakan deposit dulu.` },
        { status: 400 }
      );
    }
    debited = true;

    let vs;
    let failMsg = null;
    try {
      vs = await createVirtusimOrder({ serviceId: service.id, operator: "any" });
    } catch (e) {
      vs = null;
      failMsg = e?.message || null;
      console.error("[otp/vs-order] createVirtusimOrder gagal:", e?.message);
    }

    if (!vs || !vs.number) {
      await users.updateOne({ token }, { $inc: { balance: sellPrice } });
      debited = false;
      return NextResponse.json(
        { error: failMsg || "Nomor tidak tersedia saat ini. Saldo tidak terpotong, coba lagi atau pilih Server Murah." },
        { status: 400 }
      );
    }

    const now = Date.now();
    const expiredMs = vs.expiredAt && vs.expiredAt > now ? vs.expiredAt : now + virtusimTtlMs();
    const orderId = `VS${vs.id}`;
    const countryName = virtusimCountry();

    const orders = await otpOrdersCol();
    await orders.insertOne({
      orderId,
      provider: "virtusim",
      providerRef: vs.id,
      token,
      serviceId: String(service.id),
      serviceName: service.name,
      countryName,
      phoneNumber: vs.number,
      price: sellPrice,
      basePrice: service.price,
      status: "pending",
      otpCode: null,
      otpMsg: null,
      refunded: false,
      numberId: null,
      providerId: null,
      operatorId: "any",
      operatorName: null,
      createdAt: new Date(now),
      expiredAt: new Date(expiredMs)
    });

    await logBalance({
      token,
      type: "otp",
      amount: -sellPrice,
      balanceAfter: afterDebit.balance,
      title: `OTP Fast ${service.name} · ${countryName}`,
      ref: orderId
    });

    sendTelegramNotif(
      otpPurchaseNotif({
        orderId,
        serviceName: service.name,
        countryName,
        phoneNumber: vs.number,
        price: sellPrice,
        token,
        name: user.name,
        operator: "Server OTP Fast (VirtuSIM)",
        balance: afterDebit.balance
      })
    );

    return NextResponse.json({
      orderId,
      phoneNumber: vs.number,
      price: sellPrice,
      expiredAt: expiredMs,
      createdAt: new Date(now).toISOString(),
      balance: afterDebit.balance
    });
  } catch (err) {
    console.error("[otp/vs-order]", err?.message || err);
    if (debited && token && sellPrice > 0) {
      await users.updateOne({ token }, { $inc: { balance: sellPrice } }).catch(() => {});
    }
    return NextResponse.json({ error: "Gagal membuat pesanan nomor OTP." }, { status: 500 });
  }
}
