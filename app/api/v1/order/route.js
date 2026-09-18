import { NextResponse } from "next/server";
import { resolveApiKey } from "@/lib/apiKeyAuth";
import { usersCol, otpOrdersCol } from "@/lib/db";
import { createOrder, getCountries, toEpochMs } from "@/lib/rumahotp";
import { getSettings } from "@/lib/settings";
import { getApiKeys } from "@/lib/apiKeys";
import { logBalance } from "@/lib/ledger";

export const dynamic = "force-dynamic";

async function resolveBasePrice(serviceId, numberId, providerId, apiKey) {
  const data = await getCountries(apiKey, serviceId);
  const list = data?.data || data || [];
  const country = (Array.isArray(list) ? list : []).find((c) => String(c.number_id) === String(numberId));
  if (!country) return null;
  const p = (country.pricelist || []).find((x) => String(x.provider_id) === String(providerId));
  if (!p) return null;
  const price = Number(p.price);
  if (!Number.isFinite(price) || price <= 0) return null;
  if (p.available === false && p.stock === 0) return { price, outOfStock: true, country };
  return { price, outOfStock: false, country };
}

export async function POST(req) {
  const { user, error } = await resolveApiKey(req);
  if (error) return error;

  const users = await usersCol();
  let debited = false;
  let sellPrice = 0;

  try {
    const body = await req.json().catch(() => ({}));
    const { serviceId, numberId, providerId, operatorId, operatorName, serviceName, countryName } = body;

    if (!serviceId || !numberId || !providerId) {
      return NextResponse.json({ error: "serviceId, numberId, and providerId are required." }, { status: 400 });
    }

    const [{ markupPercent }, { rumahOtp }] = await Promise.all([getSettings(), getApiKeys()]);
    const resolved = await resolveBasePrice(serviceId, numberId, providerId, rumahOtp);
    if (!resolved) return NextResponse.json({ error: "Server/country not available." }, { status: 400 });
    if (resolved.outOfStock) return NextResponse.json({ error: "Server stock empty, try another." }, { status: 400 });
    sellPrice = Math.ceil(resolved.price * (1 + (Number(markupPercent) || 0) / 100));

    const afterDebit = await users.findOneAndUpdate(
      { token: user.token, balance: { $gte: sellPrice } },
      { $inc: { balance: -sellPrice } },
      { returnDocument: "after" }
    );
    if (!afterDebit) {
      return NextResponse.json({ error: `Insufficient balance. Price Rp${sellPrice.toLocaleString("id-ID")}.` }, { status: 400 });
    }
    debited = true;

    let data;
    try {
      const result = await createOrder(rumahOtp, { numberId, providerId, operatorId });
      data = result?.data || result;
    } catch (e) {
      data = null;
      console.error("[v1/order] createOrder failed:", e?.response?.data || e?.message);
    }

    if (!data || !data.order_id) {
      await users.updateOne({ token: user.token }, { $inc: { balance: sellPrice } });
      debited = false;
      return NextResponse.json({ error: data?.message || "Number unavailable. Balance not deducted." }, { status: 400 });
    }

    const orderId = String(data.order_id);
    const expiredMs = toEpochMs(data.expired_at);
    const finalService = serviceName || data.service || "-";
    const finalCountry = countryName || resolved.country?.name || data.country || "-";

    const orders = await otpOrdersCol();
    await orders.insertOne({
      orderId,
      token: user.token,
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
      token: user.token,
      type: "otp",
      amount: -sellPrice,
      balanceAfter: afterDebit.balance,
      title: `OTP ${finalService} · ${finalCountry}`,
      ref: orderId
    });

    return NextResponse.json({
      orderId,
      phoneNumber: data.phone_number,
      price: sellPrice,
      expiredAt: expiredMs || null,
      createdAt: new Date().toISOString(),
      balance: afterDebit.balance
    });
  } catch (err) {
    console.error("[v1/order]", err?.response?.data || err?.message || err);
    if (debited && user?.token && sellPrice > 0) {
      await users.updateOne({ token: user.token }, { $inc: { balance: sellPrice } }).catch(() => {});
    }
    return NextResponse.json({ error: "Failed to create OTP order." }, { status: 500 });
  }
}
