import { NextResponse } from "next/server";
import { usersCol, otpOrdersCol } from "@/lib/db";
import { createOrder, getCountries, toEpochMs } from "@/lib/rumahotp";
import {
  createOtpmaniaOrder,
  getOtpmaniaPrices,
  isOtpmaniaServer,
  normalizeOtpmaniaPrices,
  otpmaniaServerCode
} from "@/lib/otpmania";
import { sendTelegramNotif, otpPurchaseNotif } from "@/lib/telegram";
import { createDibananaOrder, getDibananaPrices } from "@/lib/dibanana";
import { getSettings, markupForServer } from "@/lib/settings";
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

// Harga OTPMANIA selalu diambil ulang dari provider saat order supaya harga yang
// ditagih tidak bisa dimanipulasi dari sisi browser.
async function resolveOtpmaniaPrice(serviceId, countryId, serverCode) {
  const raw = await getOtpmaniaPrices({ service: serviceId, country: countryId, server: serverCode });
  const rows = normalizeOtpmaniaPrices(raw, { countryHint: countryId });
  const entry = rows.find((r) => String(r.countryId) === String(countryId)) || rows[0];
  if (!entry) return null;
  return { price: entry.price, outOfStock: entry.stock === 0, country: null };
}

// Harga & id produk dibanana selalu diambil ulang saat order: id-nya opaque dan
// bisa kedaluwarsa, sekaligus mencegah harga dimanipulasi dari sisi browser.
async function resolveDibanana(serviceId, country, providerIndex) {
  const providers = await getDibananaPrices({ service: serviceId, country });
  const p = providers[providerIndex] || providers[0];
  if (!p) return null;
  const price = Number(p.price_idr || 0);
  if (!Number.isFinite(price) || price <= 0) return null;
  return { price, outOfStock: Number(p.stock) === 0, productId: p.id, country: null };
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
      // Khusus server OTPMANIA & dibanana
      countryId, providerIndex
    } = body;

    const isOm = isOtpmaniaServer(server);
    const isBn = server === "dibanana";
    const serverCode = isOm ? otpmaniaServerCode(server) : null;

    if (!token || !serviceId) {
      return NextResponse.json({ error: "Parameter kurang. Muat ulang halaman lalu coba lagi." }, { status: 400 });
    }
    if (!isOm && !isBn && (!numberId || !providerId)) {
      return NextResponse.json({ error: "Parameter kurang. Muat ulang halaman lalu coba lagi." }, { status: 400 });
    }
    if ((isOm || isBn) && (countryId === undefined || countryId === null || countryId === "")) {
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

    const resolved = isBn
      ? await resolveDibanana(serviceId, countryId, Number(providerIndex) || 0)
      : isOm
      ? await resolveOtpmaniaPrice(serviceId, countryId, serverCode)
      : await resolveRumahOTPPrice(serviceId, numberId, providerId);

    if (!resolved) return NextResponse.json({ error: "Server/negara ini sudah tidak tersedia. Pilih yang lain." }, { status: 400 });
    if (resolved.outOfStock) return NextResponse.json({ error: "Stok server ini sedang habis. Pilih server lain." }, { status: 400 });

    const settings = await getSettings();
    sellPrice = Math.ceil(resolved.price * (1 + markupForServer(settings, server || "rumahotp") / 100));

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

    let orderId, phoneNumber, expiredMs, finalCountry;

    if (isBn) {
      let data = null;
      let failMsg = null;
      try {
        data = await createDibananaOrder({ id: resolved.productId });
      } catch (e) {
        failMsg = e?.message || null;
        console.error("[otp/order] dibanana order gagal:", failMsg);
      }

      if (!data || !data.orderId) {
        await users.updateOne({ token }, { $inc: { balance: sellPrice } });
        debited = false;
        return NextResponse.json(
          { error: `${failMsg || "Nomor tidak tersedia saat ini"}. Saldo tidak terpotong, coba negara/server lain.` },
          { status: 400 }
        );
      }

      orderId = data.orderId;
      phoneNumber = data.phoneNumber || "-";
      // dibanana memberi masa aktif sekitar 19 menit sejak order.
      expiredMs = Date.now() + 19 * 60 * 1000;
      finalCountry = countryName || "-";
    } else if (isOm) {
      let data = null;
      let failMsg = null;
      try {
        data = await createOtpmaniaOrder({
          service: serviceId,
          country: countryId,
          operator: operatorId || "any",
          server: serverCode
        });
      } catch (e) {
        failMsg = e?.message || null;
        console.error("[otp/order] OTPMANIA getNumber gagal:", failMsg);
      }

      if (!data || !data.id) {
        await users.updateOne({ token }, { $inc: { balance: sellPrice } });
        debited = false;
        return NextResponse.json(
          { error: `${failMsg || "Nomor tidak tersedia saat ini"}. Saldo tidak terpotong, coba negara/server lain.` },
          { status: 400 }
        );
      }

      orderId = data.id;
      phoneNumber = data.number || "-";
      expiredMs = toEpochMs(data.expiredAt);
      finalCountry = countryName || "-";
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
      server: isOm || isBn ? server : "rumahotp",
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
      ...(isBn
        ? { countryId: String(countryId), providerIndex: Number(providerIndex) || 0 }
        : isOm
        ? { countryId: String(countryId), operator: operatorId || "any" }
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

    sendTelegramNotif(
      otpPurchaseNotif({
        orderId,
        serviceName: finalService,
        countryName: finalCountry,
        phoneNumber,
        price: sellPrice,
        token,
        name: user.name,
        operator: isOm || isBn ? operatorId || "any" : operatorName,
        balance: afterDebit.balance
      })
    );

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
