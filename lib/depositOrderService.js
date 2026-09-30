// Pembuatan & pembatalan deposit, dipakai bersama oleh:
//   - app/api/deposit/create + app/api/deposit/cancel  (web)
//   - lib/shopBotFlow.js                               (bot Telegram)
//
// Sebelumnya bot memanggil endpoint webnya sendiri lewat HTTP. Itu membuat
// deposit di bot bergantung pada Site URL yang diisi admin — kalau kolom itu
// kosong, depositnya mati padahal semua yang dibutuhkan ada di server yang sama.
// Sekarang keduanya memanggil fungsi ini langsung, jadi tidak ada lagi
// perjalanan jaringan ke diri sendiri dan tidak ada alamat yang bisa salah isi.
//
// Mengembalikan { ok: true, deposit } atau { ok: false, status, error }.
import QRCode from "qrcode";
import { usersCol, depositsCol } from "@/lib/db";
import { botAktif } from "@/lib/botContext";
import { createTransaction, normalizePakasirTransaction, cancelTransactionV2, cancelTransactionV1 } from "@/lib/pakasir";
import {
  createDeposit as createRumahOtpDeposit,
  cancelDeposit as cancelRumahOtpDeposit,
  toEpochMs,
  rumahOtpConfigured
} from "@/lib/rumahotp";
import {
  createWarungNokosDeposit,
  cancelWarungNokosDeposit,
  warungNokosConfigured,
  WARUNGNOKOS_DEPOSIT_KEY
} from "@/lib/warungnokos";
import {
  createAtlanticDeposit,
  cancelAtlanticDeposit,
  atlanticConfigured
} from "@/lib/atlantic";
import crypto from "node:crypto";
import { buktiTerpakaiCol } from "@/lib/db";
import { bacaTeks } from "@/lib/ocrBukti";
import { nilaiBukti } from "@/lib/buktiNilai";
import { getSettings, updateSettings, depositLimits, manualDepositReady, manualDepositHours } from "@/lib/settings";
import { PROVIDER_KEYS, MANUAL_DEPOSIT_KEY } from "@/lib/paymentProviders";
import { fetchProviderStatus, creditDeposit } from "@/lib/depositService";
import {
  sendTelegramNotif,
  depositPendingNotif,
  depositPendingPublicNotif,
  depositCanceledNotif,
  depositCanceledPublicNotif,
  providerAlertNotif,
  manualDepositReviewNotif,
  manualDepositAutoNotif
} from "@/lib/telegram";
import { umumkan } from "@/lib/notifyHub";
import { cfg } from "@/lib/config";

const MAX_PENDING_PER_USER = 3;
const DEFAULT_QR_TTL_MS = 15 * 60 * 1000;

const fail = (status, error) => ({ ok: false, status, error });

function pickField(obj, names) {
  for (const n of names) {
    if (obj?.[n] !== undefined && obj[n] !== null && obj[n] !== "") return obj[n];
  }
  return null;
}

function toNumberOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function asImageSrc(value) {
  if (!value || typeof value !== "string") return null;
  if (value.startsWith("data:") || value.startsWith("http")) return value;
  if (/^[A-Za-z0-9+/=\s]{200,}$/.test(value)) return `data:image/png;base64,${value.replace(/\s/g, "")}`;
  return null;
}

// RumahOTP kadang mengembalikan message sebagai object nested, bukan string.
// Tanpa ini, yang sampai ke user adalah "[object Object]".
function toErrStr(v, fallback = "Terjadi kesalahan, coba lagi.") {
  if (!v) return fallback;
  if (typeof v === "string") return v;
  if (typeof v === "object") return v.message || v.error || v.description || JSON.stringify(v);
  return String(v);
}

export async function createDepositForToken({ token, amount, provider, wallet }) {
  if (!token) return fail(400, "Kode akun tidak valid.");
  // Deposit SALDO GAME hanya lewat QRIS manual (diverifikasi OCR/admin); saldo nokos tetap bebas metode.
  const untukGame = wallet === "game";

  const { min: MIN, max: MAX } = depositLimits();
  let amt = Math.floor(Number(amount));
  if (!Number.isFinite(amt) || amt < MIN || amt > MAX) {
    return fail(
      400,
      `Nominal deposit harus antara Rp${MIN.toLocaleString("id-ID")} - Rp${MAX.toLocaleString("id-ID")}.`
    );
  }

  const settingsDoc = await getSettings();
  const { depositProviders } = settingsDoc;
  const chosen = PROVIDER_KEYS.includes(provider) ? provider : null;
  if (untukGame && provider !== MANUAL_DEPOSIT_KEY) {
    return fail(400, "Saldo game diisi lewat QRIS manual.");
  }
  if (!chosen || !depositProviders?.[chosen]) {
    return fail(400, "Metode pembayaran ini sedang tidak tersedia.");
  }
  if (chosen === WARUNGNOKOS_DEPOSIT_KEY && !(await warungNokosConfigured())) {
    return fail(400, "QRIS WarungNokos belum dikonfigurasi admin. Pilih metode lain.");
  }
  if (chosen === "rumahotp" && !(await rumahOtpConfigured())) {
    return fail(400, "QRIS RumahOTP belum dikonfigurasi. Pilih metode lain.");
  }
  if (chosen === "atlantic" && !(await atlanticConfigured())) {
    return fail(400, "QRIS Atlantic belum dikonfigurasi admin. Pilih metode lain.");
  }
  // Tanpa gambar QRIS dari admin, layar bayarnya kosong dan tidak ada yang
  // bisa dipindai — lebih baik ditolak di sini daripada user menunggu
  // di halaman yang tidak mungkin dia selesaikan.
  if (chosen === MANUAL_DEPOSIT_KEY) {
    if (!manualDepositReady(settingsDoc)) {
      return fail(400, "Deposit manual belum disiapkan admin. Pilih metode lain.");
    }
    // Jam buka diperiksa DI SINI, bukan cuma disembunyikan di halaman. Yang
    // mengecek pembayarannya manusia; kalau tagihannya tetap bisa dibuat jam 3
    // pagi, yang membayar menunggu sampai pagi tanpa tahu kenapa.
    const jam = manualDepositHours(settingsDoc);
    if (!jam.open) {
      return fail(400, `QRIS manual tutup. Buka lagi pukul ${String(jam.openHour).padStart(2, "0")}.00 WIB (jam layanan ${jam.label}). Pilih metode lain kalau mau sekarang juga.`);
    }
  }

  const users = await usersCol();
  const user = await users.findOne({ token });
  if (!user) return fail(404, "Kode akun tidak ditemukan.");

  const deposits = await depositsCol();
  const pendingCount = await deposits.countDocuments({
    token,
    status: "pending",
    createdAt: { $gte: new Date(Date.now() - 30 * 60 * 1000) }
  });
  if (pendingCount >= MAX_PENDING_PER_USER) {
    return fail(429, "Kamu masih punya beberapa QRIS yang belum dibayar. Selesaikan atau batalkan dulu di Riwayat.");
  }

  const orderId = `DP${Date.now()}${Math.floor(Math.random() * 1000)}`;
  let qrisString = null;
  let qrImage = null;
  let expiredAt = null;
  let paymentUrl = null;
  let providerRef = orderId;
  let adminFee = null;
  let totalAmount = null;
  // txn_id dari Pakasir v2 — kunci untuk cek status & pembatalan.
  let pakasirTxnId = null;
  // Keterangan QRIS manual (atas nama siapa, cara bayarnya). Hanya terisi untuk
  // metode manual, dan ikut disimpan supaya riwayatnya tetap terbaca walau
  // admin mengganti QRIS-nya besok.
  let manualInfo = null;
  let kodeUnik = 0;
  const paymentMethod = "qris";

  if (chosen === WARUNGNOKOS_DEPOSIT_KEY) {
    let dep;
    try {
      dep = await createWarungNokosDeposit(amt, "qris");
    } catch (err) {
      console.error("[deposit/create] warungnokos:", err?.message);
      if (err?.status === 401 || err?.status >= 500) {
        sendTelegramNotif(
          providerAlertNotif({ provider: "WarungNokos", action: "Buat deposit QRIS", message: err.message })
        );
      }
      return fail(400, err?.message || "Gagal membuat QRIS WarungNokos, coba metode lain.");
    }
    providerRef = String(dep.id || "");
    if (!providerRef) return fail(502, "Respons WarungNokos tidak lengkap, coba lagi.");
    qrisString = dep.qrString ? String(dep.qrString) : null;
    qrImage = asImageSrc(dep.qrImage);
    expiredAt = dep.expiredAt;
    // WarungNokos mengirim `total` yang sudah termasuk biaya; selisihnya biaya admin.
    totalAmount = dep.total ?? amt;
    adminFee = dep.total != null ? Math.max(0, dep.total - amt) : null;
    if (!qrisString && !qrImage) return fail(502, "QRIS WarungNokos tidak tersedia, coba metode lain.");
  } else if (chosen === "pakasir") {
    let result;
    try {
      result = await createTransaction((await cfg("PAKASIR_PROJECT")), (await cfg("PAKASIR_APIKEY")), orderId, amt, "qris");
    } catch (err) {
      console.error("[deposit/create] pakasir error:", err?.message || err);
      sendTelegramNotif(
        providerAlertNotif({ provider: "Pakasir", action: "Buat transaksi QRIS", message: err?.message || "gagal" })
      );
      return fail(400, "Gagal membuat QRIS Pakasir, coba metode lain.");
    }
    const payment = normalizePakasirTransaction(result);
    qrisString = payment.qrString ? String(payment.qrString) : null;
    expiredAt = toEpochMs(payment.expiredAt);
    paymentUrl = payment.paymentUrl || null;
    adminFee = toNumberOrNull(payment.fee);
    totalAmount = toNumberOrNull(payment.total) ?? amt;
    // txn_id WAJIB disimpan: cek status & pembatalan di API v2 memakai itu,
    // bukan order_id + amount seperti v1.
    pakasirTxnId = payment.txnId ? String(payment.txnId) : null;
    if (!pakasirTxnId) {
      console.error("[deposit/create] pakasir respons tanpa txn_id:", JSON.stringify(result).slice(0, 500));
      return fail(502, "Respons Pakasir tidak lengkap, coba metode lain.");
    }
    if (!qrisString && !paymentUrl) {
      console.error("[deposit/create] pakasir respons tanpa QRIS:", JSON.stringify(result).slice(0, 500));
      return fail(400, "Gagal membuat QRIS Pakasir, coba metode lain.");
    }
  } else if (chosen === "atlantic") {
    let dep;
    try {
      dep = await createAtlanticDeposit({ reffId: orderId, nominal: amt });
    } catch (err) {
      console.error("[deposit/create] atlantic:", err?.message);

      // Tantangan Cloudflare berarti permintaannya tidak pernah sampai ke
      // Atlantic. Yang perlu tahu adalah PEMILIK WEB — pembelinya tidak bisa
      // berbuat apa-apa selain memilih metode lain, jadi dia tidak perlu
      // membaca istilah "Cloudflare" apalagi halaman HTML-nya.
      if (err?.cloudflare) {
        // Hadangan Cloudflare tidak sembuh sendiri: ia bertahan sampai ada
        // orang di sisi Atlantic yang mengubah aturannya. Membiarkan metodenya
        // menyala berarti setiap pembeli berikutnya mengisi nominal, memilih
        // metode, menekan bayar, lalu gagal — satu per satu, sampai admin
        // kebetulan membaca notifnya. Jadi metodenya dimatikan sekarang juga;
        // admin tinggal menyalakannya lagi setelah Atlantic membereskannya.
        try {
          await updateSettings({ depositProviders: { atlantic: false } });
        } catch (e) {
          console.error("[deposit/create] gagal mematikan metode atlantic:", e?.message || e);
        }

        sendTelegramNotif(
          providerAlertNotif({
            provider: "Atlantic",
            action: "Buat deposit QRIS",
            message:
              `Diblokir verifikasi Cloudflare — permintaan tidak sampai ke Atlantic${err.rayId ? ` (Ray ID ${err.rayId})` : ""}. ` +
              "Metode Atlantic OTOMATIS DIMATIKAN supaya pembeli lain tidak ikut gagal. " +
              "Nyalakan lagi di panel admin setelah Atlantic mengecualikan endpoint API dari browser challenge; cek dulu lewat tombol Cek Koneksi Atlantic."
          })
        );
        return fail(400, "QRIS Atlantic sedang tidak bisa dipakai. Silakan pilih metode pembayaran lain dulu.");
      }

      if (err?.status === 0 || err?.status === 401 || err?.status >= 500) {
        sendTelegramNotif(
          providerAlertNotif({ provider: "Atlantic", action: "Buat deposit QRIS", message: err?.message || "gagal" })
        );
      }
      // Pesan dari provider dipotong: apa pun yang dibalasnya, yang sampai ke
      // layar pembeli harus tetap satu kalimat.
      return fail(400, String(err?.message || "Gagal membuat QRIS Atlantic, coba metode lain.").slice(0, 200));
    }
    providerRef = String(dep.id || "");
    if (!providerRef) return fail(502, "Respons Atlantic tidak lengkap, coba lagi.");
    qrisString = dep.qrString ? String(dep.qrString) : null;
    qrImage = asImageSrc(dep.qrImage);
    // expired_at Atlantic berupa waktu lokal "YYYY-MM-DD HH:mm:ss"; kalau tidak
    // terbaca, biarkan null supaya dipakai batas waktu bawaan di bawah.
    expiredAt = toEpochMs(dep.expiredAt);
    totalAmount = dep.nominal || amt;
    if (!qrisString && !qrImage) return fail(502, "QRIS Atlantic tidak tersedia, coba metode lain.");
  } else if (chosen === MANUAL_DEPOSIT_KEY) {
    // Tidak ada provider yang dihubungi: QRIS-nya milik admin sendiri, dan
    // yang memutuskan lunas atau tidak juga admin.
    const md = settingsDoc.manualDeposit || {};
    manualInfo = {
      accountName: String(md.accountName || ""),
      accountLabel: String(md.accountLabel || ""),
      instructions: String(md.instructions || "")
    };
    // Verifikasi OCR menyala → nominal diberi KODE UNIK (1–999). Nominal transfer jadi
    // khas per tagihan, sehingga bukti milik tagihan lain tidak cocok. Yang dibayar user
    // = yang dikreditkan (kode unik ikut jadi saldo, tidak ada yang hilang).
    if (md.ocrAktif) {
      const aktif = await deposits.find({ provider: MANUAL_DEPOSIT_KEY, status: { $in: ["pending", "review"] } }, { projection: { amount: 1 } }).limit(2000).toArray();
      const dipakai = new Set(aktif.map((d) => Number(d.amount)));
      let kode = 0;
      for (let i = 0; i < 40 && !kode; i++) {
        const k = 1 + crypto.randomInt(999);
        if (!dipakai.has(amt + k)) kode = k;
      }
      if (!kode) return fail(429, "Sedang ramai, coba buat tagihan lagi sebentar lagi.");
      kodeUnik = kode;
      amt += kode;
      manualInfo.kodeUnik = kode;
      manualInfo.nominalAsli = amt - kode;
    }
    totalAmount = amt;
    adminFee = 0;
    expiredAt = Date.now() + Math.max(5, Number(md.ttlMinutes) || 60) * 60 * 1000;
  } else {
    let result;
    try {
      result = await createRumahOtpDeposit((await cfg("RUMAHOTP_APIKEY")), { amount: amt, paymentId: "qris" });
    } catch (err) {
      const errData = err?.response?.data;
      console.error("[deposit/create] rumahotp request error:", err?.response?.status, errData || err?.message);
      const status = err?.response?.status;
      if (status === 401 || (status && status >= 500)) {
        sendTelegramNotif(providerAlertNotif({ provider: "RumahOTP", action: "Buat deposit QRIS", message: err.message }));
      }
      return fail(
        400,
        toErrStr(errData?.message || errData || err?.message, "Gagal membuat pembayaran RumahOTP, coba metode lain.")
      );
    }

    // API ini kadang membalas 200 tapi isinya error.
    const isSoftError = result?.success === false || result?.status === false || (result?.message && !result?.data);
    if (isSoftError) {
      console.error("[deposit/create] rumahotp soft error:", JSON.stringify(result));
      return fail(400, toErrStr(result?.message || result?.error, "Gagal membuat pembayaran RumahOTP, coba metode lain."));
    }

    const data = result?.data || result;
    qrisString = pickField(data, ["qr_string", "qris", "payment_number", "qris_string", "qr_code", "qris_content"]);
    const qrImageUrl = asImageSrc(pickField(data, ["qr_image", "qr_image_url"]));
    expiredAt = toEpochMs(
      pickField(data, ["expired_at_ts", "expires_at_ts", "expired_ts", "expired", "expired_at", "expire_at", "expires_at"])
    );
    paymentUrl = pickField(data, ["payment_url", "checkout_url", "payment_link"]);
    providerRef = String(pickField(data, ["id", "order_id", "trx_id", "reference", "deposit_id"]) || orderId);
    adminFee = toNumberOrNull(pickField(data, ["fee", "admin_fee", "biaya_admin", "total_fee"]));
    totalAmount = toNumberOrNull(pickField(data, ["total", "amount", "total_amount", "amount_total", "total_pembayaran"]));
    const curr = data?.currency;
    if (curr && typeof curr === "object") {
      if (adminFee === null) adminFee = toNumberOrNull(curr.fee);
      if (totalAmount === null) totalAmount = toNumberOrNull(curr.total) ?? toNumberOrNull(curr.diterima);
    }
    if (totalAmount === null) totalAmount = amt;
    // QR selalu digambar sendiri dari qr_string: URL gambar dari provider bisa
    // kedaluwarsa lebih dulu daripada QRIS-nya.
    if (qrisString) {
      try {
        qrImage = await QRCode.toDataURL(String(qrisString), { margin: 1, scale: 8, errorCorrectionLevel: "M" });
      } catch {
        qrImage = qrImageUrl;
      }
    } else {
      qrImage = qrImageUrl;
    }
    if (!qrisString && !qrImage && !paymentUrl) {
      console.error("[deposit/create] rumahotp missing qris fields, full response:", JSON.stringify(result));
      return fail(400, toErrStr(data?.message || result?.message, "Gagal membuat pembayaran RumahOTP, coba metode lain."));
    }
  }

  if (!qrImage && qrisString) {
    qrImage = await QRCode.toDataURL(String(qrisString), { margin: 1, scale: 8, errorCorrectionLevel: "M" });
  }
  if (!expiredAt) expiredAt = Date.now() + DEFAULT_QR_TTL_MS;

  // Asal deposit ikut disimpan supaya notif "deposit masuk" nanti tahu bot
  // mana yang harus dikabari — kreditnya berjalan dari webhook pembayaran,
  // di luar konteks bot mana pun.
  const botDeposit = botAktif();
  const resellerDeposit = botDeposit?.jenis === "reseller" ? botDeposit : null;

  await deposits.insertOne({
    orderId,
    providerRef,
    token,
    ...(resellerDeposit ? { resellerBotId: resellerDeposit.botId } : {}),
    amount: amt,
    adminFee,
    totalAmount,
    method: paymentMethod,
    provider: chosen,
    ...(pakasirTxnId ? { pakasirTxnId } : {}),
    ...(manualInfo ? { manual: true, manualInfo } : {}),
    ...(kodeUnik ? { kodeUnik } : {}),
    ...(untukGame ? { wallet: "game" } : {}),
    // QR disimpan supaya halaman deposit bisa menampilkan QR yang sama setelah
    // di-refresh. Dihapus otomatis oleh cron setelah lewat 24 jam.
    //
    // Kecuali manual: QRIS-nya satu gambar milik admin yang sama untuk semua
    // orang. Menyalinnya ke tiap dokumen deposit berarti menyimpan gambar
    // ratusan kilobita berulang-ulang; halaman bayar mengambilnya dari
    // pengaturan saja.
    qrImage: manualInfo ? null : qrImage,
    paymentUrl,
    status: "pending",
    credited: false,
    createdAt: new Date(),
    expiredAt: new Date(expiredAt)
  });

  // Versi channel tidak memuat kode QRIS-nya maupun kode akun: QRIS yang
  // terbaca orang lain bisa dibayar orang lain, dan saldonya tetap masuk ke
  // akun yang membuatnya — bukan ke yang membayar.
  umumkan({
    jenis: "deposit_pending",
    admin: depositPendingNotif({
      orderId,
      providerRef,
      provider: chosen,
      amount: amt,
      fee: adminFee,
      total: totalAmount,
      expiredAt,
      token,
      name: user.name
    }),
    publik: untukGame ? undefined : depositPendingPublicNotif({ provider: chosen, amount: amt, expiredAt })
  });

  return {
    ok: true,
    deposit: {
      orderId,
      providerRef: providerRef !== orderId ? providerRef : null,
      amount: amt,
      adminFee,
      totalAmount,
      method: paymentMethod,
      provider: chosen,
      qrImage: manualInfo ? String(settingsDoc.manualDeposit?.qrImage || "") : qrImage,
      ...(manualInfo ? { manual: true, manualInfo } : {}),
      ...(untukGame ? { wallet: "game" } : {}),
      expiredAt,
      paymentUrl: paymentUrl || null,
      createdAt: new Date().toISOString(),
      status: "pending"
    }
  };
}

export async function cancelDepositForToken({ token, orderId }) {
  if (!token || !orderId) return fail(400, "Parameter kurang.");

  const deposits = await depositsCol();
  const deposit = await deposits.findOne({ orderId, token });
  if (!deposit) return fail(404, "Transaksi tidak ditemukan.");
  if (deposit.status === "completed") {
    return { ...fail(400, "Transaksi ini sudah berhasil, tidak bisa dibatalkan."), depositStatus: "completed" };
  }
  if (deposit.status !== "pending") {
    return { ok: true, status: deposit.status, message: "Transaksi ini sudah tidak aktif." };
  }

  // Cek dulu ke provider: kalau ternyata sudah dibayar, jangan dibatalkan — kreditkan.
  const remote = await fetchProviderStatus(deposit);
  if (remote === "completed") {
    await creditDeposit(deposit);
    return {
      ...fail(409, "Pembayaran sudah diterima, saldo sudah masuk. Transaksi tidak dibatalkan."),
      depositStatus: "completed"
    };
  }

  const claimed = await deposits.findOneAndUpdate(
    { orderId, token, status: "pending" },
    { $set: { status: "canceled", canceledAt: new Date() } }
  );
  if (!claimed) return { ok: true, message: "Transaksi ini sudah tidak aktif." };

  // Kalau user tetap membayar setelah membatalkan, cron tetap mengkreditkan saldonya.
  if (deposit.provider === WARUNGNOKOS_DEPOSIT_KEY) {
    cancelWarungNokosDeposit(deposit.providerRef || orderId).catch((e) =>
      console.error("[deposit/cancel] warungnokos:", e?.message || e)
    );
  } else if (deposit.provider === "pakasir") {
    // v2 membatalkan lewat txn_id; deposit lama tanpa txn_id tetap lewat v1.
    const p = deposit.pakasirTxnId
      ? cancelTransactionV2((await cfg("PAKASIR_PROJECT")), (await cfg("PAKASIR_APIKEY")), deposit.pakasirTxnId)
      : cancelTransactionV1((await cfg("PAKASIR_PROJECT")), (await cfg("PAKASIR_APIKEY")), orderId, deposit.amount);
    p.catch((e) => console.error("[deposit/cancel] pakasir:", e?.message || e));
  } else if (deposit.provider === "rumahotp") {
    cancelRumahOtpDeposit((await cfg("RUMAHOTP_APIKEY")), deposit.providerRef || orderId).catch(() => {});
  } else if (deposit.provider === "atlantic") {
    cancelAtlanticDeposit(deposit.providerRef || orderId).catch((e) =>
      console.error("[deposit/cancel] atlantic:", e?.message || e)
    );
  }
  // Metode manual tidak punya siapa-siapa untuk dikabari: tidak ada tagihan di
  // luar sana yang perlu ditutup.

  const u = await (await usersCol()).findOne({ token }, { projection: { name: 1 } });
  umumkan({
    jenis: "deposit_batal",
    admin: depositCanceledNotif({
      orderId,
      provider: deposit.provider,
      amount: deposit.amount,
      token,
      name: u?.name,
      reason: "canceled"
    }),
    publik: depositCanceledPublicNotif({
      provider: deposit.provider,
      amount: deposit.amount,
      reason: "canceled"
    })
  });

  return { ok: true, status: "canceled" };
}


// Bukti transfer disimpan sebagai data URL di dokumen depositnya. 800 KB sudah
// lebih dari cukup untuk tangkapan layar yang sudah dikecilkan, dan menahan
// orang mengunggah berkas raksasa ke database.
const MAX_PROOF_CHARS = 800_000;

/**
 * Konfirmasi pembayaran deposit MANUAL oleh user — dipakai web dan bot Telegram.
 *
 * Yang berubah di sini HANYA status: pending → review. Tidak ada saldo yang
 * bertambah. Kalau fungsi ini bisa menambah saldo, siapa pun cukup membuat
 * deposit manual lalu memanggilnya untuk mencetak uang sendiri — yang boleh
 * mengkreditkan cuma admin, lewat /api/admin/deposits.
 */
// ─────────────────────── VERIFIKASI OTOMATIS (OCR) ───────────────────────
const hashGambar = (dataUrl) => crypto.createHash("sha256").update(String(dataUrl)).digest("hex");
const awalHariWib = () => {
  const wib = new Date(Date.now() + 7 * 3600_000);
  return new Date(Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate()) - 7 * 3600_000);
};
const rpTeks = (n) => `Rp${Number(n).toLocaleString("id-ID")}`;

/** Memasang penanda "bukti sudah dipakai". false = sudah pernah dipakai (atau gagal). */
async function tandaiBukti(orderId, hash, ref) {
  const kol = await buktiTerpakaiCol();
  const dipasang = [];
  try {
    for (const id of [`img:${hash}`, ...(ref ? [`ref:${ref}`] : [])]) {
      await kol.insertOne({ _id: id, kunci: id, orderId, at: new Date() });
      dipasang.push(id);
    }
    return true;
  } catch (err) {
    // Duplikat: lepas yang sempat terpasang oleh percobaan ini, lalu tolak.
    for (const id of dipasang) { try { await kol.deleteOne({ _id: id, orderId }); } catch {} }
    if (err?.code !== 11000) console.error("[deposit/ocr] penanda bukti:", err?.message || err);
    return false;
  }
}

/**
 * Menilai bukti dan memutuskan boleh disetujui otomatis atau tidak. TIDAK mengubah saldo.
 * Hasil `setuju` hanya berarti "semua syarat lolos"; persetujuannya sendiri lewat approveManualDeposit.
 */
async function nilaiOtomatis(deposit, md) {
  const ringkas = { dicoba: true, setuju: false, alasan: [], cek: null, keyakinan: null, refId: null, teks: "" };
  let ocr;
  try {
    ocr = await bacaTeks(deposit.proofImage);
  } catch (err) {
    console.error("[deposit/ocr] gagal membaca bukti:", err?.message || err);
    ringkas.alasan = ["Bukti belum bisa dibaca otomatis — akan dicek admin."];
    ringkas.galat = String(err?.message || err).slice(0, 120);
    return ringkas;
  }
  ringkas.keyakinan = Math.round(ocr.keyakinan);
  ringkas.teks = ocr.teks.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").slice(0, 1500);
  const n = nilaiBukti({ teks: ocr.teks, nama: md.ocrNama || "NAWA CELL", nominal: deposit.amount, dibuat: deposit.createdAt });
  ringkas.cek = n.cek;
  ringkas.refId = n.dibaca.ref;
  ringkas.dibaca = n.dibaca;
  ringkas.alasan = [...n.alasan];
  if (ocr.keyakinan < 55) ringkas.alasan.push("Foto bukti kurang jelas — gunakan tangkapan layar yang utuh dan tajam.");
  if (!n.lulus || ocr.keyakinan < 55) return ringkas;

  const maks = Number(md.ocrMaks) || 0;
  if (maks && deposit.amount > maks) {
    ringkas.alasan.push(`Nominal di atas batas verifikasi otomatis (${rpTeks(maks)}) — dicek admin.`);
    return ringkas;
  }
  const harian = Number(md.ocrHarian) || 0;
  if (harian) {
    const hariIni = await (await depositsCol()).find({ token: deposit.token, autoOcr: true, confirmedAt: { $gte: awalHariWib() } }, { projection: { amount: 1 } }).limit(500).toArray();
    const total = hariIni.reduce((s, d) => s + (Number(d.amount) || 0), 0);
    if (total + deposit.amount > harian) {
      ringkas.alasan.push(`Batas verifikasi otomatis harian (${rpTeks(harian)}) tercapai — dicek admin.`);
      return ringkas;
    }
  }
  if (!(await tandaiBukti(deposit.orderId, hashGambar(deposit.proofImage), n.dibaca.ref))) {
    ringkas.alasan.push("Bukti ini sudah pernah dipakai untuk transaksi lain.");
    ringkas.ganda = true;
    return ringkas;
  }
  ringkas.setuju = true;
  return ringkas;
}

/**
 * Menyetujui deposit manual (oleh admin atau OCR): klaim atomik "review" → dikreditkan lewat jalur
 * yang sama dengan deposit otomatis lain. Dua klik/dua proses tidak pernah mengkreditkan dua kali.
 */
export async function approveManualDeposit(orderId, { oleh = "admin", catatan = "", tandai = true } = {}) {
  const deposits = await depositsCol();
  const claimed = await deposits.findOneAndUpdate(
    { orderId, provider: MANUAL_DEPOSIT_KEY, status: "review" },
    { $set: { reviewedAt: new Date(), reviewedBy: oleh, adminNote: String(catatan || "").slice(0, 300), ...(oleh === "ocr" ? { autoOcr: true } : {}) } },
    { returnDocument: "after" }
  );
  if (!claimed) {
    const ada = await deposits.findOne({ orderId });
    return { ok: false, tidakAda: !ada, status: ada?.status };
  }
  // Persetujuan admin ikut menandai bukti sebagai terpakai, supaya tidak bisa dipakai ulang oleh jalur otomatis.
  if (tandai && oleh !== "ocr" && claimed.proofImage) {
    await tandaiBukti(orderId, hashGambar(claimed.proofImage), claimed.ocr?.refId || null).catch(() => {});
  }
  const credit = await creditDeposit(claimed);
  return { ok: true, credited: Boolean(credit), credit };
}

export async function confirmManualDeposit({ token, orderId, proofImage, note }) {
  if (!token || !orderId) return fail(400, "Parameter kurang.");

  const proof = String(proofImage || "").trim();
  // Bukti transfer WAJIB. Tanpa itu yang sampai ke admin cuma klaim "sudah
  // bayar" yang tidak bisa dicocokkan dengan apa pun, dan satu-satunya jalan
  // memeriksanya adalah membuka mutasi satu per satu untuk tiap klaim.
  if (!proof) return fail(400, "Bukti transfer wajib diunggah sebelum konfirmasi.");
  if (!proof.startsWith("data:image/")) return fail(400, "Bukti bayar harus berupa gambar.");
  if (proof.length > MAX_PROOF_CHARS) return fail(413, "Ukuran bukti bayar terlalu besar. Maksimal 500KB.");

  const deposits = await depositsCol();

  // Syarat status ada DI DALAM filter, bukan diperiksa lebih dulu lalu
  // di-update. Dua ketukan cepat kalau begitu bisa mengirim dua notif ke admin
  // untuk transaksi yang sama.
  const claimed = await deposits.findOneAndUpdate(
    { orderId, token, provider: MANUAL_DEPOSIT_KEY, status: "pending" },
    {
      $set: {
        status: "review",
        confirmedAt: new Date(),
        proofImage: proof,
        ...(note ? { userNote: String(note).slice(0, 300) } : {})
      }
    },
    { returnDocument: "after" }
  );

  if (!claimed) {
    // Bukan error kalau memang sudah dikonfirmasi tadi — user cuma menekan dua
    // kali. Yang perlu dibedakan cuma transaksi yang benar-benar tidak ada.
    const ada = await deposits.findOne({ orderId, token });
    if (!ada) return fail(404, "Transaksi tidak ditemukan.");
    if (ada.provider !== MANUAL_DEPOSIT_KEY) return fail(400, "Metode ini dicek otomatis, tidak perlu dikonfirmasi.");
    return { ok: true, status: ada.status, otomatis: ada.autoOcr === true, alasan: ada.ocr?.alasan || [] };
  }

  const user = await (await usersCol()).findOne({ token }, { projection: { name: 1 } });

  // Verifikasi otomatis (bila admin menyalakannya). Kegagalan apa pun di sini TIDAK menggagalkan
  // konfirmasi: bukti tetap masuk antrean pengecekan admin seperti biasa.
  let ocr = null;
  const md = (await getSettings()).manualDeposit || {};
  if (md.ocrAktif) {
    try {
      ocr = await nilaiOtomatis(claimed, md);
      await deposits.updateOne({ orderId }, { $set: { ocr: { setuju: ocr.setuju, alasan: ocr.alasan, cek: ocr.cek, keyakinan: ocr.keyakinan, refId: ocr.refId, dibaca: ocr.dibaca || null, teks: ocr.teks, ganda: !!ocr.ganda, galat: ocr.galat || null, at: new Date() } } });
      if (ocr.setuju) {
        const r = await approveManualDeposit(orderId, { oleh: "ocr", catatan: "Disetujui otomatis (OCR bukti transfer)" });
        if (r.ok && r.credited) {
          sendTelegramNotif(manualDepositAutoNotif({ orderId, amount: claimed.amount, token, name: user?.name, ocr, wallet: claimed.wallet }));
          return { ok: true, status: "completed", otomatis: true, alasan: [] };
        }
        ocr.alasan = ["Verifikasi otomatis belum bisa menyelesaikan — akan dicek admin."];
      }
    } catch (err) {
      console.error("[deposit/ocr]", err?.message || err);
      ocr = { alasan: ["Verifikasi otomatis sedang bermasalah — akan dicek admin."] };
    }
  }

  sendTelegramNotif(
    manualDepositReviewNotif({
      orderId,
      amount: claimed.amount,
      token,
      name: user?.name,
      note: claimed.userNote,
      hasProof: true,
      createdAt: claimed.createdAt,
      wallet: claimed.wallet,
      ocrAlasan: ocr?.alasan || null
    })
  );

  return { ok: true, status: "review", otomatis: false, alasan: ocr?.alasan || [] };
}
