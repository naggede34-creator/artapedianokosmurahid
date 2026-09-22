import { NextResponse } from "next/server";
import { usersCol, otpOrdersCol } from "@/lib/db";
import { createOrder, getCountries, toEpochMs } from "@/lib/rumahotp";
import { createSimuruOtpOrder, getSimuruCountries, getSimuruPricelist } from "@/lib/simuru";
import { sendTelegramNotif, otpPurchaseNotif } from "@/lib/telegram";
import { getSettings } from "@/lib/settings";
import { logBalance } from "@/lib/ledger";

export const dynamic = "force-dynamic";

async function resolveRumahOTPPrice(serviceId, numberId, providerId) {
  const data = await getCountries(process.env.RUMAHOTP_APIKEY, serviceId);
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

// Harga Simuru selalu diambil ulang dari provider saat order supaya harga yang
// ditagih tidak bisa dimanipulasi dari sisi browser.
async function resolveSimuruPrice(serviceId, countryId, operator) {
  let list = [];
  try {
    list = await getSimuruCountries(serviceId);
  } catch (err) {
    console.error("[otp/order] simuru per-service gagal, pakai pricelist:", err?.message || err);
  }
  if (!list.length) list = await getSimuruPricelist({ serviceId });

  const sameCountry = list.filter((c) => String(c.country_id) === String(countryId));
  if (!sameCountry.length) return null;
  const entry = sameCountry.find((c) => (c.operator || "random") === (operator || "random")) || sameCountry[0];
  const price = Number(entry.price || 0);
  if (!Number.isFinite(price) || price <= 0) return null;
  return { price, outOfStock: false, country: entry, operator: entry.operator || "random" };
}

export async function POST(req) {
  const users = await usersCol();
  let debited = false;
  let sellPrice = 0;
  let token;
  try {
    const body = await req.json().catch(() => ({}));
    token = body.token;
    const {
      serviceId, numberId, providerId, operatorId, operatorName,
      serviceName, countryName, server,
      // Khusus Server OTP Fast (Simuru)
      countryId, operator
    } = body;

    const isSimuru = server === "simuru";

    if (!token || !serviceId) {
      return NextResponse.json({ error: "Parameter kurang. Muat ulang halaman lalu coba lagi." }, { status: 400 });
    }
    if (!isSimuru && (!numberId || !providerId)) {
      return NextResponse.json({ error: "Parameter kurang. Muat ulang halaman lalu coba lagi." }, { status: 400 });
    }
    if (isSimuru && countryId === undefined) {
      return NextResponse.json({ error: "Negara belum dipilih. Muat ulang halaman lalu coba lagi." }, { status: 400 });
    }

    const user = await users.findOne({ token });
    if (!user) return NextResponse.json({ error: "Kode akun tidak ditemukan." }, { status: 404 });
    if (user.suspended) {
      return NextResponse.json(
        { error: `Akun ditangguhkan: ${user.suspendReason || "Hubungi admin untuk info lebih lanjut."}` },
        { status: 403 }
      );
    }

    let resolved;
    if (isSimuru) {
      resolved = await resolveSimuruPrice(serviceId, countryId, operator);
    } else {
      resolved = await resolveRumahOTPPrice(serviceId, numberId, providerId);
    }

    if (!resolved) return NextResponse.json({ error: "Server/negara ini sudah tidak tersedia. Pilih yang lain." }, { status: 400 });
    if (resolved.outOfStock) return NextResponse.json({ error: "Stok server ini sedang habis. Pilih server lain." }, { status: 400 });

    const { markupPercent } = await getSettings();
    sellPrice = Math.ceil(resolved.price * (1 + (Number(markupPercent) || 0) / 100));

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

    let orderId, phoneNumber, expiredMs, finalCountry, simuruOperator;

    if (isSimuru) {
      let data;
      let failMsg = null;
      // Operator pilihan user menang; `resolved.operator` hanya cadangan dari
      // baris pricelist kalau user tidak memilih apa pun.
      simuruOperator = operator || resolved.operator || "random";
      try {
        data = await createSimuruOtpOrder({
          serviceId,
          countryId: Number(countryId),
          operator: simuruOperator
        });
      } catch (e) {
        data = null;
        failMsg = e?.message || null;
        console.error("[otp/order] Simuru createOrder gagal:", failMsg);
      }

      if (!data || !data.id) {
        await users.updateOne({ token }, { $inc: { balance: sellPrice } });
        debited = false;
        return NextResponse.json(
          { error: `${failMsg || "Nomor tidak tersedia saat ini"}. Saldo tidak terpotong, coba negara lain.` },
          { status: 400 }
        );
      }

      orderId = String(data.id);
      phoneNumber = data.phone_number || "-";
      expiredMs = toEpochMs(data.expired_at) || (data.remaining_seconds ? Date.now() + data.remaining_seconds * 1000 : null);
      finalCountry = countryName || resolved.country?.country_name || "-";
    } else {
      let data;
      try {
        const result = await createOrder(process.env.RUMAHOTP_APIKEY, { numberId, providerId, operatorId });
        data = result?.data || result;
      } catch (e) {
        data = null;
        console.error("[otp/order] RumahOTP createOrder gagal:", e?.response?.data || e?.message);
      }

      if (!data || !data.order_id) {
        await users.updateOne({ token }, { $inc: { balance: sellPrice } });
        debited = false;
        return NextResponse.json(
          { error: data?.message || "Nomor tidak tersedia saat ini. Saldo tidak terpotong, coba server/negara lain." },
          { status: 400 }
        );
      }

      orderId = String(data.order_id);
      phoneNumber = data.phone_number || "-";
      expiredMs = toEpochMs(data.expired_at);
      finalCountry = countryName || resolved.country?.name || data.country || "-";
    }

    const finalService = serviceName || "-";
    const orders = await otpOrdersCol();
    await orders.insertOne({
      orderId,
      token,
      server: isSimuru ? "simuru" : "rumahotp",
      serviceId: String(serviceId),
      serviceName: finalService,
      countryName: finalCountry,
      phoneNumber,
      price: sellPrice,
      basePrice: resolved.price,
      status: "pending",
      otpCode: null,
      otpMsg: null,
      refunded: false,
      ...(isSimuru
        ? { countryId: Number(countryId), operator: simuruOperator }
        : { numberId, providerId, operatorId: operatorId || null, operatorName: operatorName || null }),
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
      phoneNumber,
      price: sellPrice,
      token,
      name: user.name,
      operator: isSimuru ? simuruOperator : operatorName,
      balance: afterDebit.balance
    });
    sendTelegramNotif(purchaseText);

    return NextResponse.json({
      orderId,
      phoneNumber,
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
