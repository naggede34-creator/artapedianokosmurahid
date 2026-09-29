// Satu alur pembelian nokos yang dipakai bersama oleh endpoint web
// (/api/otp/order) dan API publik (/api/v1/order).
//
// Prinsip yang dipegang di sini:
//  - Harga SELALU diambil ulang dari provider saat order, tidak pernah dari
//    body request, supaya tidak bisa dimanipulasi dari sisi klien.
//  - Saldo dipotong atomik dengan syarat saldo cukup; kalau provider gagal
//    memberi nomor, saldo langsung dikembalikan.
//  - Potongannya DICATAT LEBIH DULU sebagai hold (lib/saldoHold.js). Kalau
//    fungsinya mati di tengah jalan — batas waktu habis, instance dimatikan —
//    kode pengembalian di bawah tidak pernah jalan, dan tanpa catatan hold itu
//    potongannya tidak meninggalkan jejak apa pun. Yang menggantung disapu
//    belakangan dan dikembalikan.
import { usersCol, otpOrdersCol } from "@/lib/db";
import { createOrder, getCountries, toEpochMs } from "@/lib/rumahotp";
import {
  createWarungNokosOrder,
  cancelWarungNokosOrder,
  getWarungNokosCountries,
  isWarungNokosServer
} from "@/lib/warungnokos";
import { createDibananaOrder, cancelDibananaOrder, getDibananaPrices } from "@/lib/dibanana";
import { setOrderStatus } from "@/lib/rumahotp";
import { reconcileOtpOrder } from "@/lib/orderReconcile";
import { getSettings, markupForServer, serverOfflineMessage } from "@/lib/settings";
import { logBalance } from "@/lib/ledger";
import { buatHold, pakaiHold, kembalikanHold, sapuHoldMacet } from "@/lib/saldoHold";
import { botAktif } from "@/lib/botContext";
import { hargaResellerDari, catatKomisi, tarikKomisi } from "@/lib/resellerKomisi";
import { kabariPemilikBot, botResellerSekarang } from "@/lib/kirimReseller";
import { resellerBeliNotif, resellerRefundNotif } from "@/lib/resellerNotif";
import { otpPurchaseNotif, otpSoldPublicNotif, otpAutoRefundNotif, otpRefundPublicNotif } from "@/lib/telegram";
import { umumkan } from "@/lib/notifyHub";

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
  let holdId = null;

  // Sebelum memotong lagi, hold milik orang ini yang menggantung dari
  // pembelian sebelumnya dikembalikan dulu. Cron juga menyapu, tapi yang
  // paling cepat merasakan saldonya kurang adalah orang itu sendiri — dan ia
  // biasanya langsung mencoba lagi. Kegagalannya tidak boleh menghentikan
  // pembelian ini.
  if (token) {
    sapuHoldMacet({ token, batas: 10 }).catch((e) =>
      console.error("[otpOrder] sapu hold gagal:", e?.message || e)
    );
  }

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

    const hargaSitus = Math.ceil(resolved.price * (1 + markupForServer(settings, serverId) / 100));

    // Kalau pembelian ini datang dari bot reseller, markup resellernya
    // ditambahkan di atas harga situs. Selisihnya jadi komisinya.
    //
    // botAktif() null di web dan di bot toko utama, jadi keduanya membayar
    // harga situs apa adanya — tidak ada cabang khusus yang perlu diingat.
    const botIni = botAktif();
    const reseller = botIni?.jenis === "reseller" ? botIni : null;
    const { harga: hargaAkhir, komisi: komisiReseller } = reseller
      ? hargaResellerDari(hargaSitus, reseller.markupPersen)
      : { harga: hargaSitus, komisi: 0 };

    sellPrice = hargaAkhir;

    // Hold ditulis SEBELUM saldo dipotong. Urutan ini yang penting: kalau
    // fungsinya mati sedetik setelah potongan, holdnya tetap ada di database
    // dan penyapu bisa mengembalikan uangnya. Dibalik, potongannya tidak punya
    // pasangan sama sekali dan hilang tanpa jejak.
    holdId = await buatHold({
      token,
      amount: sellPrice,
      jenis: "otp",
      catatan: `${serviceName || "-"} / ${countryName || "-"}`
    });
    if (!holdId) {
      // Holdnya gagal dicatat, jadi saldonya TIDAK dipotong. Lebih baik
      // pembelian ini gagal daripada memotong saldo tanpa jejak.
      return { ok: false, status: 503, error: "Sistem sedang sibuk, coba lagi sebentar lagi. Saldo tidak terpotong." };
    }

    const afterDebit = await users.findOneAndUpdate(
      { token, balance: { $gte: sellPrice } },
      { $inc: { balance: -sellPrice } },
      { returnDocument: "after" }
    );
    if (!afterDebit) {
      await kembalikanHold(holdId, "Saldo tidak cukup, tidak jadi dipotong");
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
        await kembalikanHold(holdId, "Provider tidak memberi nomor");
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
        await kembalikanHold(holdId, "Provider tidak memberi nomor");
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
        await kembalikanHold(holdId, "Provider tidak memberi nomor");
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
      // holdId ikut disimpan supaya penyapu bisa membedakan "pesanan berhasil,
      // holdnya cuma belum sempat ditandai" dari "pesanan tidak pernah jadi".
      // Tanpa ini, pesanan yang berhasil bisa ikut dikembalikan — nomor gratis.
      holdId,
      // Asal pesanan. Dipakai saat refund untuk menarik kembali komisinya:
      // tanpa ini, pembeli dapat uangnya kembali DAN resellernya tetap dapat
      // komisi — uang yang tidak pernah ada.
      ...(reseller ? { resellerBotId: reseller.botId, komisiReseller } : {}),
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

    // Holdnya ditandai terpakai SESUDAH pesanannya tersimpan. Kalau dibalik,
    // fungsi yang mati di antaranya meninggalkan hold "terpakai" tanpa
    // pesanan — uangnya hilang dan penyapu tidak akan menyentuhnya lagi.
    await pakaiHold(holdId, orderId);

    // Komisi dicatat SESUDAH pesanannya tersimpan, dan kegagalannya tidak
    // pernah menggagalkan pesanan: nomornya sudah diberikan ke pembeli.
    // Komisi yang gagal tercatat masih bisa diperbaiki dari log; pesanan yang
    // dibatalkan sesudah nomornya keluar tidak bisa.
    if (reseller && komisiReseller > 0) {
      await catatKomisi({
        botId: reseller.botId,
        orderId,
        pemilikToken: reseller.pemilikToken,
        komisi: komisiReseller,
        hargaJual: sellPrice,
        hargaSitus,
        serviceName: finalService,
        countryName: finalCountry
      });

      // Pemilik botnya dikabari. Tidak ditunggu: pembeli sudah menunggu
      // nomornya, dan notifikasi orang lain tidak boleh menahannya.
      (async () => {
        try {
          const dok = await botResellerSekarang(reseller);
          if (!dok) return;
          await kabariPemilikBot(
            dok,
            resellerBeliNotif({
              botUsername: dok.username,
              botNama: dok.nama,
              ownerUsername: dok.ownerUsername,
              serviceName: finalService,
              countryName: finalCountry,
              phoneNumber,
              harga: sellPrice,
              komisi: komisiReseller,
              username: user?.telegramUsername || null
            })
          );
        } catch (e) {
          console.error("[reseller] notif terjual gagal:", e?.message || e);
        }
      })();
    }

    await logBalance({
      token,
      type: "otp",
      amount: -sellPrice,
      balanceAfter: afterDebit.balance,
      title: `OTP ${finalService} · ${finalCountry}`,
      ref: orderId
    });

    if (notify) {
      const operatorTampil = isWn || isBn ? operatorId || "any" : operatorName;
      umumkan({
        jenis: "otp_terjual",
        admin: otpPurchaseNotif({
          orderId,
          serviceName: finalService,
          countryName: finalCountry,
          phoneNumber,
          price: sellPrice,
          token,
          name: user.name,
          operator: operatorTampil,
          balance: afterDebit.balance
        }),
        // Tanpa nama asli dan tanpa sisa saldo: dua hal itu milik pembelinya,
        // dan channel bisa dibaca siapa saja.
        publik: otpSoldPublicNotif({
          serviceName: finalService,
          countryName: finalCountry,
          phoneNumber,
          price: sellPrice,
          operator: operatorTampil,
          token
        })
      });
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
    if (debited && holdId) {
      const r = await kembalikanHold(holdId, "Error saat membuat pesanan");
      // TIDAK ditelan diam-diam. Kalau gagal, holdnya kembali jadi "held" dan
      // penyapu yang mengambilnya — tapi kegagalannya tetap harus terlihat.
      if (!r.ok) console.error(`[otpOrder] PENGEMBALIAN GAGAL untuk hold ${holdId} — menunggu disapu.`);
    }
    return {
      ok: false,
      status: 500,
      error: "Gagal membuat pesanan nomor OTP. Kalau saldo sempat terpotong, akan dikembalikan otomatis dalam beberapa menit."
    };
  }
}

// ─────────────────────────── PEMBATALAN ───────────────────────────
//
// Dipakai bersama oleh /api/otp/cancel (web) dan bot Telegram. Jalur refund
// TIDAK boleh ada dua: kalau bot punya salinannya sendiri, satu perbedaan kecil
// di syarat findOneAndUpdate sudah cukup untuk membuat satu pesanan direfund
// dua kali.
//
// Mengembalikan { ok: true, ... } atau { ok: false, status, error, ... }.
export const CANCEL_COOLDOWN_MS = 3 * 60 * 1000;

export async function cancelOtpOrder({ token, orderId }) {
  if (!token || !orderId) return { ok: false, status: 400, error: "Parameter kurang." };

  const orders = await otpOrdersCol();
  const users = await usersCol();
  const order = await orders.findOne({ orderId, token });
  if (!order) return { ok: false, status: 404, error: "Pesanan tidak ditemukan." };

  if (order.refunded) {
    const current = await users.findOne({ token });
    return {
      ok: true,
      balance: current?.balance,
      message: "Pesanan ini sudah dibatalkan dan saldonya sudah dikembalikan sebelumnya."
    };
  }
  if (order.otpCode || order.status === "done") {
    return { ok: false, status: 400, error: "Kode OTP sudah masuk, pesanan ini tidak bisa dibatalkan." };
  }

  const elapsed = Date.now() - new Date(order.createdAt).getTime();
  if (elapsed < CANCEL_COOLDOWN_MS) {
    const remainingMs = CANCEL_COOLDOWN_MS - elapsed;
    return {
      ok: false,
      status: 400,
      error: `Pesanan baru bisa dibatalkan 3 menit setelah dibeli. Tunggu ${Math.ceil(remainingMs / 1000)} detik lagi.`,
      remainingMs
    };
  }

  // Cek status terakhir di provider SEBELUM refund. Tanpa ini, user bisa menekan
  // batal tepat setelah OTP masuk di provider (tapi belum ter-polling) dan
  // mendapat kode OTP sekaligus refund.
  try {
    const r = await reconcileOtpOrder(order);
    if (r.otpCode) {
      return {
        ok: false,
        status: 409,
        error: "Kode OTP baru saja masuk, pesanan tidak bisa dibatalkan.",
        otpCode: r.otpCode,
        orderStatus: "done"
      };
    }
    if (r.refunded) {
      return { ok: true, balance: r.newBalance, message: "Pesanan sudah dibatalkan provider, saldo dikembalikan." };
    }
  } catch {
    return { ok: false, status: 503, error: "Status pesanan belum bisa dicek ke server. Coba lagi sebentar." };
  }

  let providerMessage;
  try {
    if (order.server === "dibanana") {
      // dibanana mengembalikan saldonya sendiri saat cancel.
      await cancelDibananaOrder(orderId);
    } else if (isWarungNokosServer(order.server)) {
      // Endpoint cancel WarungNokos sekaligus mengembalikan saldo di sisi mereka.
      await cancelWarungNokosOrder(order.server, orderId);
    } else {
      const result = await setOrderStatus(process.env.RUMAHOTP_APIKEY, orderId, "cancel");
      const d = result?.data || result;
      providerMessage = d?.message;
      if (result?.success === false && /otp|sms|received|diterima/i.test(String(providerMessage || ""))) {
        return { ok: false, status: 409, error: "Provider menolak pembatalan karena kode sudah masuk. Muat ulang pesanan." };
      }
    }
  } catch (e) {
    console.error("[otp/cancel] cancel gagal, lanjut refund lokal:", e?.response?.data || e?.message || e);
  }

  // Syarat refunded:false + otpCode:null adalah kunci anti-refund-ganda:
  // dua permintaan batal yang datang bersamaan, hanya satu yang menang.
  const claimed = await orders.findOneAndUpdate(
    { orderId, token, refunded: false, otpCode: null },
    { $set: { status: "canceled", refunded: true, canceledAt: new Date() } }
  );
  if (!claimed) {
    const current = await users.findOne({ token });
    return { ok: true, balance: current?.balance, message: "Pesanan ini sudah diproses sebelumnya." };
  }

  const updated = await users.findOneAndUpdate({ token }, { $inc: { balance: order.price } }, { returnDocument: "after" });

  // Komisi resellernya ditarik kembali. Tanpa ini, pembeli dapat uangnya
  // kembali DAN resellernya tetap dapat komisi — uang yang tidak pernah ada.
  // Dipanggil tanpa syarat: tarikKomisi sendiri yang tahu pesanan ini punya
  // komisi atau tidak, dan klaimnya atomik jadi pembatalan yang terjadi dua
  // kali tidak memotong dua kali.
  const ditarik = await tarikKomisi(orderId);

  await logBalance({
    token,
    type: "otp_refund",
    amount: order.price,
    balanceAfter: updated?.balance,
    title: `Batal OTP ${order.serviceName || ""}`.trim(),
    ref: orderId
  });

  // Pembatalan oleh penggunanya sendiri dulu tidak mengabarkan siapa pun —
  // padahal ini persis kejadian yang sama dengan refund otomatis, cuma
  // pemicunya orang, bukan waktu. Yang tidak dikabari tidak bisa dicocokkan
  // dengan catatan saldo kalau suatu hari ada yang mempertanyakannya.
  const sebabBatal = "Dibatalkan pengguna sebelum kode OTP masuk, saldo dikembalikan otomatis.";
  umumkan({
    jenis: "otp_refund",
    admin: otpAutoRefundNotif({
      orderId,
      serviceName: order.serviceName,
      countryName: order.countryName,
      price: order.price,
      token,
      reason: sebabBatal
    }),
    publik: otpRefundPublicNotif({
      serviceName: order.serviceName,
      countryName: order.countryName,
      price: order.price,
      token,
      reason: "dibatalkan pembeli"
    })
  }).catch(() => {});

  if (ditarik?.berubah && order.resellerBotId) {
    (async () => {
      try {
        const dok = await botResellerSekarang({ jenis: "reseller", botId: order.resellerBotId });
        if (!dok) return;
        await kabariPemilikBot(
          dok,
          resellerRefundNotif({
            botUsername: dok.username,
            botNama: dok.nama,
            ownerUsername: dok.ownerUsername,
            serviceName: order.serviceName,
            countryName: order.countryName,
            phoneNumber: order.phoneNumber,
            komisi: ditarik.komisi,
            harga: order.price,
            sebab: "Dibatalkan pembeli sebelum kode OTP masuk."
          })
        );
      } catch (e) {
        console.error("[reseller] notif batal gagal:", e?.message || e);
      }
    })();
  }

  return { ok: true, balance: updated?.balance, refundAmount: order.price, message: providerMessage };
}
