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
import { DEFAULT_SERVER, serverTampil } from "@/lib/otpServers";
import { periksaTransaksi } from "@/lib/gerbangUang";
import { usersCol, otpOrdersCol } from "@/lib/db";
import { catatPotongan, kreditRefund } from "@/lib/saldoDeposit";
import { saldoHoldsCol } from "@/lib/db";
import { createOrder, getCountries, toEpochMs } from "@/lib/rumahotp";
import {
  createWarungNokosOrder,
  cancelWarungNokosOrder,
  getWarungNokosCountries,
  getWarungNokosHargaLangsung,
  isWarungNokosServer,
  diagnoseWarungNokos
} from "@/lib/warungnokos";
import { createDibananaOrder, cancelDibananaOrder, getDibananaPrices } from "@/lib/dibanana";
import { setOrderStatus } from "@/lib/rumahotp";
import { reconcileOtpOrder } from "@/lib/orderReconcile";
import { getSettings, markupForServer, serverOfflineMessage, getDepositLimits } from "@/lib/settings";
import { hitungNominalTopup } from "@/lib/topup";
import { logBalance } from "@/lib/ledger";
import { buatHold, pakaiHold, kembalikanHold, batalkanHold, sapuHoldMacet } from "@/lib/saldoHold";
import { botAktif } from "@/lib/botContext";
import { hargaResellerDari, catatKomisi, tarikKomisi } from "@/lib/resellerKomisi";
import { kabariPemilikBot, botResellerSekarang } from "@/lib/kirimReseller";
import { resellerBeliNotif, resellerRefundNotif } from "@/lib/resellerNotif";
import { otpPurchaseNotif, otpSoldPublicNotif, otpAutoRefundNotif, otpRefundPublicNotif } from "@/lib/telegram";
import { umumkan } from "@/lib/notifyHub";
import { cfg } from "@/lib/config";
import { pilihCadangan, cobaBerurutan } from "@/lib/otpRetry";
import { diskonGrosir, hargaModalGrosir } from "@/lib/resellerPaket";
import { batasUntukPemilik } from "@/lib/resellerBot";
import { rwMarkupMaks } from "@/lib/webReseller";
import { hitungBiayaJaminan, persenJaminan, syaratBolehRefund, JAMINAN_MACET_MS } from "@/lib/jaminan";

async function resolveRumahOTPPrice(serviceId, numberId, providerId) {
  const data = await getCountries((await cfg("RUMAHOTP_APIKEY")), serviceId);
  const list = data?.data || data || [];
  const country = (Array.isArray(list) ? list : []).find((c) => String(c.number_id) === String(numberId));
  if (!country) return null;
  const p = (country.pricelist || []).find((x) => String(x.provider_id) === String(providerId));
  if (!p) return null;
  const price = Number(p.price);
  if (!Number.isFinite(price) || price <= 0) return null;
  const alternatif = (country.pricelist || []).map((x) => ({ id: x.provider_id, harga: Number(x.price), stok: x.stock, tersedia: x.available }));
  if (p.available === false && p.stock === 0) return { price, outOfStock: true, country, alternatif, idDipilih: providerId };
  return { price, outOfStock: false, country, alternatif, idDipilih: providerId };
}

// Harga WarungNokos selalu diambil ulang dari provider saat order: mencegah
// harga dimanipulasi dari browser, sekaligus memastikan kita mengirim harga
// modal yang benar-benar berlaku saat itu.
async function resolveWarungNokos(serverId, serviceId, countryId, providerKey) {
  // Jalur cepat: 1 panggilan API ke produk yang dipilih (id sudah ada di kunci).
  let rows = null;
  if (providerKey && String(providerKey).split(":").length === 3) {
    try {
      const langsung = await getWarungNokosHargaLangsung(serverId, providerKey);
      if (langsung?.pricelist?.length) rows = [langsung];
    } catch (e) {
      console.error("[otpOrder] harga langsung gagal, pakai katalog:", e?.message || e);
    }
  }
  if (!rows) rows = await getWarungNokosCountries(serverId, serviceId, { countryId });
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
    country: { name: country.name },
    alternatif: country.pricelist.map((x) => ({ id: x.key, harga: Number(x.price), stok: x.stock })),
    idDipilih: entry.key
  };
}

// id produk dibanana bersifat opaque dan bisa kedaluwarsa, jadi diambil ulang.
async function resolveDibanana(serviceId, country, providerIndex) {
  const providers = await getDibananaPrices({ service: serviceId, country });
  const p = providers[providerIndex] || providers[0];
  if (!p) return null;
  const price = Number(p.price_idr || 0);
  if (!Number.isFinite(price) || price <= 0) return null;
  const idx = providers[providerIndex] ? providerIndex : 0;
  return {
    price,
    outOfStock: Number(p.stock) === 0,
    productId: p.id,
    country: null,
    alternatif: providers.map((x, i) => ({ id: i, harga: Number(x.price_idr || 0), stok: Number(x.stock), productId: x.id })),
    idDipilih: idx
  };
}

// ─────────────────────────── GALAT PEMASOK WARUNGNOKOS ───────────────────────────
const SALDO_POLA = /balance|saldo|insufficient|not enough/i;
/** Pesan untuk pembeli: kalimat teknis soal "balance" disamarkan karena yang kosong bukan saldo pembeli. */
function pesanGagalPemasok(pesan) {
  if (!pesan) return "Nomor tidak tersedia saat ini";
  if (SALDO_POLA.test(pesan)) return "Pemasok nomor untuk pilihan ini sedang kosong";
  return pesan;
}
const laporTerakhir = new Map();
async function laporGagalWarungNokos(serverId, resolved, pesan, status) {
  if (!pesan || !SALDO_POLA.test(pesan)) return;
  const kunci = `${serverId}:${resolved?.providerKey || ""}`;
  if (Date.now() - (laporTerakhir.get(kunci) || 0) < 10 * 60_000) return;
  laporTerakhir.set(kunci, Date.now());
  let saldo = "tidak terbaca";
  try { const d = await diagnoseWarungNokos(); saldo = d?.profile?.balance != null ? `Rp${Number(d.profile.balance).toLocaleString("id-ID")} (akun ${d.profile.username || "?"})` : d?.profile?.error || saldo; } catch {}
  const { sendTelegramNotif, providerAlertNotif } = await import("@/lib/telegram");
  await sendTelegramNotif(providerAlertNotif({
    provider: "WarungNokos",
    action: `Beli nomor (${serverId}, pilihan ${resolved?.providerKey || "-"}, modal Rp${Number(resolved?.price || 0).toLocaleString("id-ID")})`,
    message: `${pesan}${status ? ` [HTTP ${status}]` : ""} · saldo akun WarungNokos yang terbaca API key ini: ${saldo}. Jika saldo cukup, berarti pemasok di balik pilihan itu yang kosong; pembeli otomatis dialihkan ke pilihan lain.`
  }));
}

/**
 * Buat pesanan nokos. Mengembalikan { ok: true, order } atau
 * { ok: false, status, error } — pemanggil yang mengubahnya jadi HTTP response.
 * Pesan error sengaja berbahasa Indonesia; API publik menerjemahkannya sendiri.
 */
// Konteks web reseller ditempel lewat Symbol privat: isi body JSON dari pengguna (mis. API publik v1,
// yang menyebar `...body` ke sini) tidak bisa memalsukannya.
const KUNCI_WEB = Symbol("resellerWeb");
/** Menandai sebuah input pesanan datang dari web reseller `web` (dokumen reseller_web). Hanya dipanggil rute web yang sudah memverifikasinya. */
export function denganWeb(input, web) {
  return web ? { ...input, [KUNCI_WEB]: web } : input;
}

export async function placeOtpOrder(input) {
  const resellerWeb = input?.[KUNCI_WEB] || null;
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
    jaminan = false,
    notify = true
  } = input || {};

  const users = await usersCol();
  let debited = false;
  let sellPrice = 0;
  // Biaya jaminan OTP (0 kalau tidak dipilih). Dipotong bersama harga nomor,
  // di dalam hold yang sama, jadi semua jalur pengembalian menangkapnya.
  let biayaJaminan = 0;
  let holdId = null;
  let depositBagian = 0;

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
    const gerbang = await periksaTransaksi(token, { user });
    if (gerbang) return { ok: false, status: gerbang.status, error: gerbang.error };

    const settings = await getSettings();
    const serverId = server || DEFAULT_SERVER;
    // Hanya server yang ditampilkan (WarungNokos) yang menerima pesanan baru; yang lain disembunyikan dan ditolak di sini.
    if (!serverTampil(serverId)) {
      return { ok: false, status: 503, error: "Server ini sudah tidak tersedia. Pilih Server Plus atau Server Express." };
    }
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
    const reseller = botIni?.jenis === "reseller"
      ? botIni
      : resellerWeb
      ? { jenis: "reseller", web: true, botId: `web:${resellerWeb.slug}`, pemilikToken: resellerWeb.pemilik, markupPersen: resellerWeb.markupPersen }
      : null;
    // Level reseller memberi potongan grosir: modalnya turun, harga jual
    // pembeli tetap. Lantainya modal toko, jadi tidak pernah merugikan toko.
    const diskonGrosirPersen = reseller && !reseller.web ? await diskonGrosir(reseller.pemilikToken) : 0;
    const hargaModalReseller = reseller ? hargaModalGrosir(hargaSitus, diskonGrosirPersen, resolved.price) : hargaSitus;
    // Markup yang tersimpan bisa melebihi batas kalau Premium-nya sudah habis:
    // yang berlaku selalu batas saat ini.
    const markupBerlaku = reseller
      ? Math.min(Number(reseller.markupPersen) || 0, reseller.web ? await rwMarkupMaks() : (await batasUntukPemilik(reseller.pemilikToken)).markupMaks)
      : 0;
    const { harga: hargaAkhir, komisi: komisiReseller } = reseller
      ? hargaResellerDari(hargaSitus, markupBerlaku, hargaModalReseller)
      : { harga: hargaSitus, komisi: 0 };

    sellPrice = hargaAkhir;
    biayaJaminan = jaminan ? hitungBiayaJaminan(sellPrice, await persenJaminan()) : 0;
    const totalBayar = sellPrice + biayaJaminan;

    // Hold ditulis SEBELUM saldo dipotong. Urutan ini yang penting: kalau
    // fungsinya mati sedetik setelah potongan, holdnya tetap ada di database
    // dan penyapu bisa mengembalikan uangnya. Dibalik, potongannya tidak punya
    // pasangan sama sekali dan hilang tanpa jejak.
    holdId = await buatHold({
      token,
      amount: totalBayar,
      jenis: "otp",
      catatan: `${serviceName || "-"} / ${countryName || "-"}`
    });
    if (!holdId) {
      // Holdnya gagal dicatat, jadi saldonya TIDAK dipotong. Lebih baik
      // pembelian ini gagal daripada memotong saldo tanpa jejak.
      return { ok: false, status: 503, error: "Sistem sedang sibuk, coba lagi sebentar lagi. Saldo tidak terpotong." };
    }

    const afterDebit = await users.findOneAndUpdate(
      { token, balance: { $gte: totalBayar } },
      // Tanda potongan di dokumen user, atomik dengan potongannya: hanya
      // hold yang punya tanda ini yang boleh dikembalikan (lihat saldoHold.js).
      { $inc: { balance: -totalBayar }, $addToSet: { holdDebit: holdId } },
      { returnDocument: "after" }
    );
    if (!afterDebit) {
      // Tidak ada yang dipotong, jadi tidak ada yang dikembalikan: holdnya
      // dibatalkan TANPA kredit. (Sebelumnya di sini memanggil kembalikanHold,
      // yang mengkredit jumlah hold ke saldo — mencetak saldo dari nol.)
      await batalkanHold(holdId, "Saldo tidak cukup, tidak jadi dipotong");
      const saldoSekarang = Math.max(0, Number((await users.findOne({ token }, { projection: { balance: 1 } }))?.balance) || 0);
      const kurang = Math.max(0, totalBayar - saldoSekarang);
      return {
        ok: false,
        status: 400,
        error: `Saldo tidak cukup. Harga Rp${totalBayar.toLocaleString("id-ID")}${biayaJaminan ? " (termasuk jaminan)" : ""}, silakan deposit dulu.`,
        // Untuk tombol "Top-up sekarang": nominal yang persis menutup selisihnya.
        kurang,
        harga: totalBayar,
        nominalTopup: await getDepositLimits().then((l) => hitungNominalTopup(kurang, l.min, l.max)).catch(() => hitungNominalTopup(kurang))
      };
    }
    debited = true;
    // Bagian deposit yang terpakai (bonus dipakai lebih dulu) — dicatat di hold & pesanan agar refund mengembalikan bagian yang sama.
    depositBagian = await catatPotongan(token, afterDebit, totalBayar);
    if (holdId) { try { await (await saldoHoldsCol()).updateOne({ holdId }, { $set: { depositBagian } }); } catch {} }

    let orderId, phoneNumber, expiredMs, finalCountry;
    // Diisi kalau penyedia yang dipilih gagal dan cadangannya yang berhasil.
    // Order harus tersimpan dengan penyedia yang BENAR-BENAR dipakai, karena
    // pengecekan status dan ganti nomor membacanya dari sana.
    let cadanganDipakai = 0;
    let providerKeyDipakai = resolved.providerKey;
    let providerIndexDipakai = Number(providerIndex) || 0;
    let providerIdDipakai = providerId;
    // true = panggilan pertama tidak mendapat jawaban sama sekali (waktu habis,
    // koneksi putus). Hasilnya TIDAK DIKETAHUI: nomornya bisa saja sudah
    // dipesan di provider. Mencoba cadangan dalam keadaan itu berarti membeli
    // dua nomor, jadi retry hanya untuk PENOLAKAN yang jelas.
    let hasilTakDiketahui = false;

    if (isBn) {
      let data = null;
      let failMsg = null;
      try {
        data = await createDibananaOrder({ id: resolved.productId });
      } catch (e) {
        failMsg = e?.message || null;
        hasilTakDiketahui = !!e?.ambiguous;
        console.error("[otpOrder] dibanana order gagal:", failMsg);
      }
      if ((!data || !data.orderId) && !hasilTakDiketahui) {
        // Coba penyedia lain untuk negara yang sama sebelum menyerah (lib/otpRetry.js).
        const alt = await cobaBerurutan(pilihCadangan(resolved.alternatif, resolved.idDipilih, resolved.price), async (c) => {
          const d = await createDibananaOrder({ id: c.productId });
          return d?.orderId ? d : null;
        });
        if (alt) {
          data = alt.hasil;
          resolved.price = Number(alt.cadangan.harga);
          providerIndexDipakai = alt.cadangan.id;
          cadanganDipakai = alt.percobaan;
        }
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
        hasilTakDiketahui = !!e?.ambiguous;
        console.error("[otpOrder] WarungNokos order gagal:", failMsg, e?.status || "", JSON.stringify(e?.body || {}).slice(0, 300));
        // Pesan "Not enough balance" dkk. = pemasok (server nomor di sisi WarungNokos) yang kehabisan saldo, bukan saldo
        // pembeli. Admin dikabari (dibatasi 1× per 10 menit per server) lengkap dengan saldo akun WarungNokos.
        laporGagalWarungNokos(serverId, resolved, failMsg, e?.status).catch(() => {});
      }
      if ((!data || !data.id) && !hasilTakDiketahui) {
        // Cadangan boleh sedikit lebih mahal dari yang gagal selama modalnya tetap ≤ 97% dari harga yang dibayar pembeli
        // (untung minimal 3%, tidak pernah rugi) — supaya satu pemasok yang kosong tidak menggagalkan pembelian.
        const batasCadangan = Math.max(Number(resolved.price), Math.floor(sellPrice * 0.97));
        const alt = await cobaBerurutan(pilihCadangan(resolved.alternatif, resolved.idDipilih, batasCadangan), async (c) => {
          const d = await createWarungNokosOrder(serverId, {
            key: c.id,
            operator: operatorId || "any",
            modalPrice: Number(c.harga),
            serviceName: serviceName || undefined
          });
          return d?.id ? d : null;
        });
        if (alt) {
          data = alt.hasil;
          resolved.price = Number(alt.cadangan.harga);
          providerKeyDipakai = alt.cadangan.id;
          cadanganDipakai = alt.percobaan;
        }
      }
      if (!data || !data.id) {
        await kembalikanHold(holdId, "Provider tidak memberi nomor");
        debited = false;
        return {
          ok: false,
          status: 400,
          error: `${pesanGagalPemasok(failMsg)}. Saldo tidak terpotong, coba negara/server lain.`
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
        const result = await createOrder((await cfg("RUMAHOTP_APIKEY")), { numberId, providerId, operatorId });
        data = result?.data || result;
      } catch (e) {
        data = null;
        // axios: tidak ada e.response berarti tidak ada jawaban dari server.
        hasilTakDiketahui = !e?.response;
        console.error("[otpOrder] RumahOTP createOrder gagal:", e?.response?.data || e?.message);
      }
      if ((!data || !data.order_id) && !hasilTakDiketahui) {
        const pesanAsli = data?.message;
        const alt = await cobaBerurutan(pilihCadangan(resolved.alternatif, resolved.idDipilih, resolved.price), async (c) => {
          const r = await createOrder((await cfg("RUMAHOTP_APIKEY")), { numberId, providerId: c.id, operatorId: undefined });
          const d = r?.data || r;
          return d?.order_id ? d : null;
        });
        if (alt) {
          data = alt.hasil;
          resolved.price = Number(alt.cadangan.harga);
          providerIdDipakai = alt.cadangan.id;
          cadanganDipakai = alt.percobaan;
        } else if (data == null || !data.order_id) {
          data = { message: pesanAsli };
        }
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
      depositBagian,
      basePrice: resolved.price,
      status: "pending",
      otpCode: null,
      otpMsg: null,
      refunded: false,
      ...(isBn
        ? { countryId: String(countryId), providerIndex: providerIndexDipakai }
        : isWn
        ? { countryId: String(countryId), providerKey: providerKeyDipakai, operator: operatorId || "any" }
        : {
            numberId,
            providerId: providerIdDipakai,
            operatorId: cadanganDipakai ? null : operatorId || null,
            operatorName: cadanganDipakai ? null : operatorName || null
          }),
      ...(cadanganDipakai ? { cadangan: cadanganDipakai } : {}),
      ...(biayaJaminan ? { jaminanBiaya: biayaJaminan } : {}),
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
        hargaGrosir: hargaModalReseller,
        serviceName: finalService,
        countryName: finalCountry
      });

      // Pemilik botnya dikabari. Tidak ditunggu: pembeli sudah menunggu
      // nomornya, dan notifikasi orang lain tidak boleh menahannya.
      if (!reseller.web) (async () => {
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
      amount: -totalBayar,
      balanceAfter: afterDebit.balance,
      title: `OTP ${finalService} · ${finalCountry}${biayaJaminan ? " + jaminan" : ""}`,
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
          balance: afterDebit.balance,
          server: isWn || isBn ? server : "rumahotp",
          modal: resolved.price,
          jaminanBiaya: biayaJaminan || null
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
        ...(biayaJaminan ? { jaminanBiaya: biayaJaminan } : {}),
        server: isWn || isBn ? server : "rumahotp",
        expiredAt: expiredMs || null,
        createdAt: new Date().toISOString(),
        balance: afterDebit.balance,
        // Penyedia yang dipilih gagal dan yang cadangan yang memberi nomor.
        // Dikabarkan ke pembeli supaya tidak bingung kalau nomornya beda dari
        // yang ia lihat di daftar.
        ...(cadanganDipakai ? { pakaiCadangan: true } : {})
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
// OTP_CANCEL_COOLDOWN_DETIK hanya untuk pengujian; produksi memakai bawaan 3 menit.
export const CANCEL_COOLDOWN_MS = Math.max(0, Number(process.env.OTP_CANCEL_COOLDOWN_DETIK ?? 180)) * 1000;

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

  if (order.jaminanProses && new Date(order.jaminanMulaiAt).getTime() > Date.now() - JAMINAN_MACET_MS) {
    return { ok: false, status: 409, error: "Nomor ini sedang diganti otomatis oleh jaminan. Tunggu sebentar lalu muat ulang." };
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
      const result = await setOrderStatus((await cfg("RUMAHOTP_APIKEY")), orderId, "cancel");
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
    { orderId, token, refunded: false, otpCode: null, ...syaratBolehRefund() },
    { $set: { status: "canceled", refunded: true, canceledAt: new Date() } }
  );
  if (!claimed) {
    const current = await users.findOne({ token });
    return { ok: true, balance: current?.balance, message: "Pesanan ini sudah diproses sebelumnya." };
  }

  // Biaya jaminan ikut kembali: dibatalkan sebelum ada kode berarti jaminannya tidak terpakai.
  const totalRefund = order.price + (Number(order.jaminanBiaya) || 0);
  const updated = await kreditRefund(token, totalRefund, order.depositBagian);

  // Komisi resellernya ditarik kembali. Tanpa ini, pembeli dapat uangnya
  // kembali DAN resellernya tetap dapat komisi — uang yang tidak pernah ada.
  // Dipanggil tanpa syarat: tarikKomisi sendiri yang tahu pesanan ini punya
  // komisi atau tidak, dan klaimnya atomik jadi pembatalan yang terjadi dua
  // kali tidak memotong dua kali.
  const ditarik = await tarikKomisi(order.komisiOrderId || orderId);

  await logBalance({
    token,
    type: "otp_refund",
    amount: totalRefund,
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
      reason: sebabBatal,
      phoneNumber: order.phoneNumber,
      server: order.server,
      balance: updated?.balance,
      name: updated?.name || null
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

  return { ok: true, balance: updated?.balance, refundAmount: totalRefund, message: providerMessage };
}
