import { NextResponse } from "next/server";
import { usersCol, otpOrdersCol } from "@/lib/db";
import { createOrder, getCountries, toEpochMs } from "@/lib/rumahotp";
import { sendTelegramNotif, otpPurchaseNotif } from "@/lib/telegram";
import { getSettings } from "@/lib/settings";
import { getApiKeys } from "@/lib/apiKeys";
import { logBalance } from "@/lib/ledger";

export const dynamic = "force-dynamic";

// Harga SELALU diambil ulang dari RumahOTP di server. Dulu harga dasar dikirim dari
// browser (basePrice), sehingga siapa pun bisa mengirim basePrice=0 dan mendapat
// nomor gratis.
async function resolveBasePrice(serviceId, numberId, providerId, apiKey) {
  const data = await getCountries(apiKey, serviceId);
  const list = data?.data || data || [];
  const country = (Array.isArray(list) ? list : []).find((c) => String(c.number_id) === String(numberId));
  if (!country) return null;
  const p = (country.pricelist || []).find((x) => String(x.provider_id) === String(providerId));
  if (!p) return null;
  const price = Number(p.price);
  if (!Number.isFinite(price) || price <= 0) return null;
  // Tidak blokir berdasarkan data stok dari endpoint countries — data ini
  // sering basi atau tidak akurat untuk WA. Biarkan createOrder yang handle.
  if (p.available === false && p.stock === 0) return { price, outOfStock: true, country };
  return { price, outOfStock: false, country };
}

export async function POST(req) {
  const users = await usersCol();
  let debited = false;
  let sellPrice = 0;
  let token;
  try {
    const body = await req.json().catch(() => ({}));
    token = body.token;
    const { serviceId, numberId, providerId, operatorId, operatorName, serviceName, countryName } = body;
    if (!token || !serviceId || !numberId || !providerId) {
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

    const { markupPercent } = await getSettings();
    const { rumahOtp } = await getApiKeys();
    const resolved = await resolveBasePrice(serviceId, numberId, providerId, rumahOtp);
    if (!resolved) return NextResponse.json({ error: "Server/negara ini sudah tidak tersedia. Pilih yang lain." }, { status: 400 });
    if (resolved.outOfStock) return NextResponse.json({ error: "Stok server ini sedang habis. Pilih server lain." }, { status: 400 });
    sellPrice = Math.ceil(resolved.price * (1 + (Number(markupPercent) || 0) / 100));

    // Potong saldo DULU secara atomik, baru pesan ke provider. Kalau provider gagal,
    // saldo dikembalikan. Dengan urutan ini tidak mungkin terjadi nomor sudah dibeli
    // di provider tapi saldo user gagal dipotong.
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

    let data;
    try {
      const result = await createOrder(rumahOtp, { numberId, providerId, operatorId });
      data = result?.data || result;
    } catch (e) {
      data = null;
      console.error("[otp/order] createOrder gagal:", e?.response?.data || e?.message);
    }

    if (!data || !data.order_id) {
      await users.updateOne({ token }, { $inc: { balance: sellPrice } });
      debited = false;
      return NextResponse.json(
        { error: data?.message || "Nomor tidak tersedia saat ini. Saldo tidak terpotong, coba server/negara lain." },
        { status: 400 }
      );
    }

    const orderId = String(data.order_id);
    const expiredMs = toEpochMs(data.expired_at);
    const finalService = serviceName || data.service || "-";
    const finalCountry = countryName || resolved.country?.name || data.country || "-";

    const orders = await otpOrdersCol();
    await orders.insertOne({
      orderId,
      token,
      serviceId: String(serviceId),
      serviceName: finalService,
      countryName: finalCountry,
      phoneNumber: data.phone_number || "-",
      price: sellPrice,
      basePrice: resolved.price,
      status: "pending",
      otpCode: null,
      otpMsg: null,
      refunded: false,
      numberId,
      providerId,
      operatorId: operatorId || null,
      operatorName: operatorName || null,
      createdAt: new Date(),
      expiredAt: expiredMs ? new Date(expiredMs) : null
    });

    await logBalance({
      token,
      type: "otp",
      amount: -sellPrice,
      balanceAfter: afterDebit.balance,
      title: `OTP ${finalService} · ${finalCountry}`,
      ref: orderId
    });

    const purchaseText = otpPurchaseNotif({
      orderId,
      serviceName: finalService,
      countryName: finalCountry,
      phoneNumber: data.phone_number || "-",
      price: sellPrice,
      token,
      name: user.name,
      operator: operatorName,
      balance: afterDebit.balance
    });
    sendTelegramNotif(purchaseText);

    return NextResponse.json({
      orderId,
      phoneNumber: data.phone_number,
      price: sellPrice,
      expiredAt: expiredMs || null,
      createdAt: new Date().toISOString(),
      balance: afterDebit.balance
    });
  } catch (err) {
    console.error("[otp/order]", err?.response?.data || err?.message || err);
    if (debited && token && sellPrice > 0) {
      await users.updateOne({ token }, { $inc: { balance: sellPrice } }).catch(() => {});
    }
    return NextResponse.json({ error: "Gagal membuat pesanan nomor OTP." }, { status: 500 });
  }
}
