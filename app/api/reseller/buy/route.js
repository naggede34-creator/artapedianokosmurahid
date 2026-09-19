import { NextResponse } from "next/server";
import { usersCol, resellersCol, resellerOrdersCol, otpOrdersCol } from "@/lib/db";
import { getCountries, createOrder, toEpochMs } from "@/lib/rumahotp";
import { sendTelegramNotif, sendTelegramChannelNotif, resellerOrderNotif } from "@/lib/telegram";
import { logBalance } from "@/lib/ledger";

export const dynamic = "force-dynamic";

export async function POST(req) {
  let debited = false;
  let sellPrice = 0;
  let buyerToken = null;

  try {
    const body = await req.json().catch(() => ({}));
    const { token, storeSlug, serviceId, numberId, providerId, operatorId, operatorName, serviceName, countryName } = body;
    buyerToken = token;

    if (!token || !storeSlug || !serviceId || !numberId || !providerId) {
      return NextResponse.json({ error: "Parameter kurang." }, { status: 400 });
    }

    // Get reseller store info
    const rCol = await resellersCol();
    const store = await rCol.findOne({ slug: storeSlug, active: true });
    if (!store) return NextResponse.json({ error: "Toko tidak ditemukan atau tidak aktif." }, { status: 404 });

    // Get buyer
    const users = await usersCol();
    const user = await users.findOne({ token });
    if (!user) return NextResponse.json({ error: "Kode akun tidak ditemukan." }, { status: 404 });
    if (user.suspended) return NextResponse.json({ error: "Akun ditangguhkan." }, { status: 403 });

    // Resolve base price from RumahOTP (server-side, can't be spoofed)
    const data = await getCountries(process.env.RUMAHOTP_APIKEY, serviceId);
    const list = Array.isArray(data?.data || data) ? (data?.data || data) : [];
    const country = list.find(c => String(c.number_id) === String(numberId));
    if (!country) return NextResponse.json({ error: "Negara/server tidak tersedia." }, { status: 400 });

    const pl = (country.pricelist || []).find(x => String(x.provider_id) === String(providerId));
    if (!pl) return NextResponse.json({ error: "Provider tidak tersedia." }, { status: 400 });

    const basePrice = Number(pl.price);
    if (!Number.isFinite(basePrice) || basePrice <= 0) return NextResponse.json({ error: "Harga tidak valid." }, { status: 400 });

    // Apply reseller markup on top of base price
    const markup = Math.max(0, Math.min(100, Number(store.markup) || 0));
    sellPrice = Math.ceil(basePrice * (1 + markup / 100));
    const commission = sellPrice - basePrice;

    // Debit buyer's saldo atomically
    const afterDebit = await users.findOneAndUpdate(
      { token, balance: { $gte: sellPrice } },
      { $inc: { balance: -sellPrice } },
      { returnDocument: "after" }
    );
    if (!afterDebit) {
      return NextResponse.json({ error: `Saldo tidak cukup. Harga Rp${sellPrice.toLocaleString("id-ID")}, silakan deposit dulu.` }, { status: 400 });
    }
    debited = true;

    // Place order with RumahOTP
    let orderData;
    try {
      const result = await createOrder(process.env.RUMAHOTP_APIKEY, { numberId, providerId, operatorId });
      orderData = result?.data || result;
    } catch (e) {
      orderData = null;
      console.error("[reseller/buy] createOrder gagal:", e?.response?.data || e?.message);
    }

    if (!orderData?.order_id) {
      await users.updateOne({ token }, { $inc: { balance: sellPrice } });
      debited = false;
      return NextResponse.json({ error: "Nomor tidak tersedia. Saldo tidak terpotong." }, { status: 400 });
    }

    const orderId = String(orderData.order_id);
    const expiredMs = toEpochMs(orderData.expired_at);
    const finalService = serviceName || orderData.service || "-";
    const finalCountry = countryName || country.name || orderData.country || "-";

    // Save OTP order record
    const otpOrders = await otpOrdersCol();
    await otpOrders.insertOne({
      orderId,
      token,
      serviceId: String(serviceId),
      serviceName: finalService,
      countryName: finalCountry,
      phoneNumber: orderData.phone_number || "-",
      price: sellPrice,
      basePrice,
      status: "pending",
      otpCode: null,
      otpMsg: null,
      refunded: false,
      numberId,
      providerId,
      operatorId: operatorId || null,
      operatorName: operatorName || null,
      resellerSlug: storeSlug,
      createdAt: new Date(),
      expiredAt: expiredMs ? new Date(expiredMs) : null,
    });

    // Save reseller order record
    const resellerOrders = await resellerOrdersCol();
    await resellerOrders.insertOne({
      resellerToken: store.token,
      resellerSlug: storeSlug,
      buyerToken: token,
      type: "OTP",
      detail: `${finalService} · ${finalCountry}`,
      charge: sellPrice,
      commission,
      orderId,
      createdAt: new Date(),
    });

    await logBalance({
      token,
      type: "otp_reseller",
      amount: -sellPrice,
      balanceAfter: afterDebit.balance,
      title: `OTP ${finalService} · ${finalCountry} (via ${store.webName})`,
      ref: orderId,
    });

    // Notify reseller channel
    const notifText = resellerOrderNotif({
      resellerWebName: store.webName,
      resellerSlug: storeSlug,
      type: "OTP",
      detail: `${finalService} · ${finalCountry}`,
      charge: sellPrice,
      token,
      balance: afterDebit.balance,
    });
    sendTelegramNotif(notifText);
    sendTelegramChannelNotif(notifText);

    return NextResponse.json({
      ok: true,
      orderId,
      phoneNumber: orderData.phone_number,
      price: sellPrice,
      expiredAt: expiredMs || null,
      balance: afterDebit.balance,
    });
  } catch (err) {
    console.error("[reseller/buy]", err?.response?.data || err?.message || err);
    if (debited && buyerToken && sellPrice > 0) {
      const users = await usersCol().catch(() => null);
      if (users) await users.updateOne({ token: buyerToken }, { $inc: { balance: sellPrice } }).catch(() => {});
    }
    return NextResponse.json({ error: "Gagal proses pesanan." }, { status: 500 });
  }
}
