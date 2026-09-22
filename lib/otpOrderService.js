// Satu alur pembelian nokos yang dipakai bersama oleh endpoint web
// (/api/otp/order) dan API publik (/api/v1/order).
//
// Prinsip yang dipegang di sini:
//  - Harga SELALU diambil ulang dari provider saat order, tidak pernah dari
//    body request, supaya tidak bisa dimanipulasi dari sisi klien.
//  - Saldo dipotong atomik dengan syarat saldo cukup; kalau provider gagal
//    memberi nomor, saldo langsung dikembalikan.
import { usersCol, otpOrdersCol } from "@/lib/db";
import { createOrder, getCountries, toEpochMs } from "@/lib/rumahotp";
import { createWarungNokosOrder, getWarungNokosCountries, isWarungNokosServer } from "@/lib/warungnokos";
import { createDibananaOrder, getDibananaPrices } from "@/lib/dibanana";
import { getSettings, markupForServer, serverOfflineMessage } from "@/lib/settings";
import { logBalance } from "@/lib/ledger";
import { sendTelegramNotif, otpPurchaseNotif } from "@/lib/telegram";

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

// Harga WarungNokos selalu diambil ulang dari provider saat order: mencegah
// harga dimanipulasi dari browser, sekaligus memastikan kita mengirim harga
// modal yang benar-benar berlaku saat itu.
async function resolveWarungNokos(serverId, serviceId, countryId, providerKey) {
  const rows = await getWarungNokosCountries(serverId, serviceId);
  const country = rows.find((c) => String(c.countryId) === String(countryId));
  if (!country) return null;
  const entry = providerKey
    ? country.pricelist.find((p) => String(p.key) === String(providerKey))
    : country.pricelist[0];
  if (!entry) return null;
  return {
    price: entry.price,
    outOfStock: entry.stock === 0,
    providerKey: entry.key,
    country: { name: country.name }
  };
}

// id produk dibanana bersifat opaque dan bisa kedaluwarsa, jadi diambil ulang.
async function resolveDibanana(serviceId, country, providerIndex) {
  const providers = await getDibananaPrices({ service: serviceId, country });
  const p = providers[providerIndex] || providers[0];
  if (!p) return null;
  const price = Number(p.price_idr || 0);
  if (!Number.isFinite(price) || price <= 0) return null;
  return { price, outOfStock: Number(p.stock) === 0, productId: p.id, country: null };
}

/**
 * Buat pesanan nokos. Mengembalikan { ok: true, order } atau
 * { ok: false, status, error } — pemanggil yang mengubahnya jadi HTTP response.
 * Pesan error sengaja berbahasa Indonesia; API publik menerjemahkannya sendiri.
 */
export async function placeOtpOrder(input) {
  const {
    token,
    serviceId,
    numberId,
    providerId,
    operatorId,
    operatorName,
    serviceName,
    countryName,
    server,
    countryId,
    providerIndex,
    notify = true
  } = input || {};

  const users = await usersCol();
  let debited = false;
  let sellPrice = 0;

  const isWn = isWarungNokosServer(server);
  const isBn = server === "dibanana";

  try {
    if (!token || !serviceId) {
      return { ok: false, status: 400, error: "Parameter kurang. Muat ulang halaman lalu coba lagi." };
    }
    if (!isWn && !isBn && (!numberId || !providerId)) {
      return { ok: false, status: 400, error: "Parameter kurang. Muat ulang halaman lalu coba lagi." };
    }
    if ((isWn || isBn) && (countryId === undefined || countryId === null || countryId === "")) {
      return { ok: false, status: 400, error: "Negara belum dipilih. Muat ulang halaman lalu coba lagi." };
    }

    const user = await users.findOne({ token });
    if (!user) return { ok: false, status: 404, error: "Kode akun tidak ditemukan." };
    if (user.suspended) {
      return {
        ok: false,
        status: 403,
        error: `Akun ditangguhkan: ${user.suspendReason || "Hubungi admin untuk info lebih lanjut."}`
      };
    }

    const settings = await getSettings();
    const serverId = server || "rumahotp";
    const list = Array.isArray(settings.otpServers) ? settings.otpServers : [];
    if (list.find((s) => s.id === serverId)?.enabled === false) {
      return { ok: false, status: 503, error: serverOfflineMessage(settings, serverId) };
    }

    const resolved = isBn
      ? await resolveDibanana(serviceId, countryId, Number(providerIndex) || 0)
      : isWn
      ? await resolveWarungNokos(serverId, serviceId, countryId, providerId)
      : await resolveRumahOTPPrice(serviceId, numberId, providerId);

    if (!resolved) {
      return { ok: false, status: 400, error: "Server/negara ini sudah tidak tersedia. Pilih yang lain." };
    }
    if (resolved.outOfStock) {
      return { ok: false, status: 400, error: "Stok server ini sedang habis. Pilih server lain." };
    }

    sellPrice = Math.ceil(resolved.price * (1 + markupForServer(settings, serverId) / 100));

    const afterDebit = await users.findOneAndUpdate(
      { token, balance: { $gte: sellPrice } },
      { $inc: { balance: -sellPrice } },
      { returnDocument: "after" }
    );
    if (!afterDebit) {
      return {
        ok: false,
        status: 400,
        error: `Saldo tidak cukup. Harga Rp${sellPrice.toLocaleString("id-ID")}, silakan deposit dulu.`
      };
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
        console.error("[otpOrder] dibanana order gagal:", failMsg);
      }
      if (!data || !data.orderId) {
        await users.updateOne({ token }, { $inc: { balance: sellPrice } });
        debited = false;
        return {
          ok: false,
          status: 400,
          error: `${failMsg || "Nomor tidak tersedia saat ini"}. Saldo tidak terpotong, coba negara/server lain.`
        };
      }
      orderId = data.orderId;
      phoneNumber = data.phoneNumber || "-";
      // dibanana memberi masa aktif sekitar 19 menit sejak order.
      expiredMs = Date.now() + 19 * 60 * 1000;
      finalCountry = countryName || "-";
    } else if (isWn) {
      let data = null;
      let failMsg = null;
      try {
        data = await createWarungNokosOrder(serverId, {
          key: resolved.providerKey,
          operator: operatorId || "any",
          // Harga modal apa adanya — markup ke user dihitung di sisi kita sendiri,
          // jadi saldo WarungNokos tidak pernah terpotong lebih dari semestinya.
          modalPrice: resolved.price,
          serviceName: serviceName || undefined
        });
      } catch (e) {
        failMsg = e?.message || null;
        console.error("[otpOrder] WarungNokos order gagal:", failMsg);
      }
      if (!data || !data.id) {
        await users.updateOne({ token }, { $inc: { balance: sellPrice } });
        debited = false;
        return {
          ok: false,
          status: 400,
          error: `${failMsg || "Nomor tidak tersedia saat ini"}. Saldo tidak terpotong, coba negara/server lain.`
        };
      }
      orderId = data.id;
      phoneNumber = data.number || "-";
      // WarungNokos tidak mengirim waktu kedaluwarsa; masa aktif standarnya 20 menit.
      expiredMs = Date.now() + 20 * 60 * 1000;
      finalCountry = countryName || resolved.country?.name || "-";
    } else {
      let data;
      try {
        const result = await createOrder(process.env.RUMAHOTP_APIKEY, { numberId, providerId, operatorId });
        data = result?.data || result;
      } catch (e) {
        data = null;
        console.error("[otpOrder] RumahOTP createOrder gagal:", e?.response?.data || e?.message);
      }
      if (!data || !data.order_id) {
        await users.updateOne({ token }, { $inc: { balance: sellPrice } });
        debited = false;
        return {
          ok: false,
          status: 400,
          error: data?.message || "Nomor tidak tersedia saat ini. Saldo tidak terpotong, coba server/negara lain."
        };
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
      server: isWn || isBn ? server : "rumahotp",
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
        : isWn
        ? { countryId: String(countryId), providerKey: resolved.providerKey, operator: operatorId || "any" }
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

    if (notify) {
      sendTelegramNotif(
        otpPurchaseNotif({
          orderId,
          serviceName: finalService,
          countryName: finalCountry,
          phoneNumber,
          price: sellPrice,
          token,
          name: user.name,
          operator: isWn || isBn ? operatorId || "any" : operatorName,
          balance: afterDebit.balance
        })
      );
    }

    return {
      ok: true,
      order: {
        orderId,
        phoneNumber,
        price: sellPrice,
        server: isWn || isBn ? server : "rumahotp",
        expiredAt: expiredMs || null,
        createdAt: new Date().toISOString(),
        balance: afterDebit.balance
      }
    };
  } catch (err) {
    console.error("[otpOrder]", err?.response?.data || err?.message || err);
    if (debited && token && sellPrice > 0) {
      await users.updateOne({ token }, { $inc: { balance: sellPrice } }).catch(() => {});
    }
    return { ok: false, status: 500, error: "Gagal membuat pesanan nomor OTP." };
  }
}
