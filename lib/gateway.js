// QRIS Gateway — inti uangnya.
//
// Dompet ini TERPISAH dari saldo Arta Pedia, dan pemisahan itu disengaja:
// saldo gateway adalah uang yang dititipkan PEMBELI ORANG LAIN lewat tagihan
// yang dibuat merchant, sedangkan saldo Arta Pedia adalah uang yang sudah
// dibelanjakan di toko ini. Mencampurnya berarti satu kesalahan hitung bisa
// memakai titipan orang untuk membayar nokos.
//
// Semua perubahan saldo di berkas ini memakai pola yang sama dengan deposit:
// syaratnya ada DI DALAM filter findOneAndUpdate, bukan diperiksa dulu lalu
// ditulis. Dua permintaan yang tiba bersamaan kalau begitu sama-sama lolos
// pemeriksaan, dan uangnya berlipat.
import crypto from "crypto";
import {
  gatewayAccountsCol,
  gatewayInvoicesCol,
  gatewayWithdrawalsCol,
  gatewayLedgerCol,
  usersCol
} from "@/lib/db";
import { logBalance } from "@/lib/ledger";
import {
  createTransaction,
  getTransactionStatus,
  normalizePakasirTransaction,
  normalizePakasirStatus
} from "@/lib/pakasir";
import {
  INVOICE_MIN,
  INVOICE_MAX,
  BIAYA_QRIS,
  WD_MIN,
  BIAYA_WD,
  KONVERSI_MIN,
  ewalletValid,
  EWALLET,
  bersihDariTagihan,
  bersihDariPenarikan
} from "@/lib/gatewayConfig";

const gagal = (status, error) => ({ ok: false, status, error });

const rp = (n) => `Rp${Number(n || 0).toLocaleString("id-ID")}`;

function idAcak(awalan, panjang = 14) {
  return `${awalan}-${crypto.randomBytes(panjang).toString("base64url").slice(0, panjang).toUpperCase()}`;
}

/**
 * API key merchant.
 *
 * Diawali "apk_" supaya bisa dikenali kalau tidak sengaja tertempel di tempat
 * umum — pemindai rahasia di GitHub dan sejenisnya mencari awalan seperti ini.
 * 32 byte acak: cukup panjang untuk tidak bisa ditebak, dan tetap muat di satu
 * baris saat disalin.
 */
function kunciBaru() {
  return `apk_${crypto.randomBytes(32).toString("base64url")}`;
}

// ────────────────────────────── AKUN ──────────────────────────────

/**
 * Akun gateway milik satu kode akun, dibuatkan kalau belum ada.
 *
 * upsert dengan $setOnInsert, bukan "cari dulu lalu buat kalau kosong": dua
 * permintaan yang tiba bersamaan pada akun baru akan sama-sama melihat kosong,
 * dan yang kedua menimpa API key yang baru saja diberikan ke yang pertama.
 */
export async function ambilAkun(token) {
  if (!token) return null;
  const col = await gatewayAccountsCol();
  await col.updateOne(
    { token },
    {
      $setOnInsert: {
        token,
        balance: 0,
        apiKey: kunciBaru(),
        callbackUrl: "",
        aktif: true,
        dibekukan: false,
        totalMasuk: 0,
        totalTagihan: 0,
        createdAt: new Date()
      }
    },
    { upsert: true }
  );
  return col.findOne({ token });
}

export async function akunDariApiKey(apiKey) {
  const k = String(apiKey || "").trim();
  if (!k.startsWith("apk_")) return null;
  const col = await gatewayAccountsCol();
  return col.findOne({ apiKey: k });
}

/** Kunci lama langsung tidak berlaku begitu yang baru dibuat. */
export async function gantiApiKey(token) {
  const col = await gatewayAccountsCol();
  const baru = kunciBaru();
  const hasil = await col.findOneAndUpdate(
    { token },
    { $set: { apiKey: baru, apiKeyDigantiAt: new Date() } },
    { returnDocument: "after" }
  );
  if (!hasil) return gagal(404, "Akun gateway tidak ditemukan.");
  return { ok: true, apiKey: baru };
}

export async function setCallbackUrl(token, url) {
  const bersih = String(url || "").trim();
  if (bersih && !/^https:\/\/.+/i.test(bersih)) {
    // http:// ditolak, bukan sekadar dianjurkan https: callback memuat nominal
    // dan nomor tagihan, dan lewat http siapa pun di jaringan yang sama bisa
    // membaca DAN memalsukannya.
    return gagal(400, "URL callback harus diawali https://");
  }
  const col = await gatewayAccountsCol();
  await col.updateOne({ token }, { $set: { callbackUrl: bersih.slice(0, 300) } });
  return { ok: true, callbackUrl: bersih.slice(0, 300) };
}

// ────────────────────────────── MUTASI ──────────────────────────────

/**
 * Menulis mutasi SEBELUM saldo ditambah, dan mengandalkan indeks unik
 * (gateway_ledger.invoiceId untuk jenis "masuk") sebagai penjaga terakhir.
 *
 * Urutannya yang penting. Kalau saldo ditambah dulu baru dicatat, indeks
 * uniknya cuma MENDETEKSI kredit rangkap setelah uangnya terlanjur masuk.
 * Dengan urutan ini ia MENCEGAH: percobaan kedua ditolak database, dan
 * penambahan saldonya tidak pernah dijalankan.
 */
async function catatSekali({ token, jenis, invoiceId, amount, judul, saldoSetelah = null }) {
  const col = await gatewayLedgerCol();
  const doc = {
    token,
    jenis,
    invoiceId: invoiceId || null,
    amount,
    judul,
    saldoSetelah,
    createdAt: new Date()
  };
  try {
    const r = await col.insertOne(doc);
    return { ok: true, id: r.insertedId };
  } catch (err) {
    if (err?.code === 11000) return { ok: false, duplikat: true };
    throw err;
  }
}

async function setSaldoSetelah(id, saldo) {
  if (!id) return;
  const col = await gatewayLedgerCol();
  await col.updateOne({ _id: id }, { $set: { saldoSetelah: saldo } }).catch(() => {});
}

// ────────────────────────────── TAGIHAN ──────────────────────────────

/**
 * Buat tagihan QRIS.
 *
 * @param sumber "web" (dari dasbor) atau "api" (dari sistem merchant sendiri)
 */
export async function buatTagihan({ token, amount, merchantRef = "", callbackUrl = "", sumber = "web" }) {
  const nominal = Math.round(Number(amount));
  if (!token) return gagal(400, "Kode akun kosong.");
  if (!Number.isFinite(nominal)) return gagal(400, "Nominal tidak valid.");
  if (nominal < INVOICE_MIN) return gagal(400, `Nominal minimal ${rp(INVOICE_MIN)}.`);
  if (nominal > INVOICE_MAX) return gagal(400, `Nominal maksimal ${rp(INVOICE_MAX)}.`);

  const akun = await ambilAkun(token);
  if (!akun) return gagal(404, "Akun gateway tidak ditemukan.");
  if (akun.dibekukan) return gagal(403, "Akun gateway kamu sedang dibekukan admin.");
  if (akun.aktif === false) return gagal(403, "Akun gateway kamu sedang nonaktif.");

  const project = process.env.PAKASIR_PROJECT;
  const apikey = process.env.PAKASIR_APIKEY;
  if (!project || !apikey) return gagal(503, "Gateway pembayaran belum dikonfigurasi. Hubungi admin.");

  const invoiceId = idAcak("INV");
  let bayar;
  try {
    const hasil = await createTransaction(project, apikey, invoiceId, nominal, "qris");
    bayar = normalizePakasirTransaction(hasil);
  } catch (err) {
    console.error("[gateway] buat tagihan:", err?.message || err);
    // Pesan provider dipotong: apa pun yang dibalasnya, yang sampai ke layar
    // merchant harus tetap satu kalimat.
    return gagal(502, String(err?.message || "Gagal membuat QRIS, coba lagi.").slice(0, 160));
  }

  if (!bayar.qrString && !bayar.paymentUrl) {
    return gagal(502, "QRIS tidak diterima dari penyedia pembayaran, coba lagi.");
  }

  const col = await gatewayInvoicesCol();
  const doc = {
    invoiceId,
    token,
    amount: nominal,
    biaya: BIAYA_QRIS,
    diterima: bersihDariTagihan(nominal),
    status: "pending",
    credited: false,
    txnId: bayar.txnId ? String(bayar.txnId) : null,
    qrString: bayar.qrString || null,
    paymentUrl: bayar.paymentUrl || null,
    merchantRef: String(merchantRef || "").slice(0, 120),
    callbackUrl: String(callbackUrl || akun.callbackUrl || "").slice(0, 300),
    sumber,
    expiredAt: bayar.expiredAt ? new Date(bayar.expiredAt) : null,
    createdAt: new Date()
  };
  await col.insertOne(doc);
  await (await gatewayAccountsCol()).updateOne({ token }, { $inc: { totalTagihan: 1 } });

  return { ok: true, invoice: bentukTagihan(doc) };
}

export function bentukTagihan(d) {
  return {
    invoiceId: d.invoiceId,
    amount: d.amount,
    biaya: d.biaya,
    diterima: d.diterima,
    status: d.status,
    qrString: d.qrString,
    paymentUrl: d.paymentUrl,
    merchantRef: d.merchantRef || "",
    expiredAt: d.expiredAt || null,
    paidAt: d.paidAt || null,
    createdAt: d.createdAt
  };
}

/**
 * Tanyakan status tagihan ke Pakasir, dan kreditkan kalau sudah dibayar.
 *
 * Dipanggil dari mana saja — dasbor, API merchant, maupun callback. Aman
 * dipanggil berkali-kali: yang menjaganya bukan pemanggilnya, tapi klaim
 * atomik + indeks unik di dalam.
 */
export async function periksaTagihan(invoiceId) {
  const col = await gatewayInvoicesCol();
  const inv = await col.findOne({ invoiceId });
  if (!inv) return gagal(404, "Tagihan tidak ditemukan.");
  if (inv.status === "paid") return { ok: true, invoice: bentukTagihan(inv), berubah: false };

  const project = process.env.PAKASIR_PROJECT;
  const apikey = process.env.PAKASIR_APIKEY;
  if (!project || !apikey || !inv.txnId) return { ok: true, invoice: bentukTagihan(inv), berubah: false };

  let status;
  try {
    const raw = await getTransactionStatus(project, apikey, inv.txnId);
    const n = normalizePakasirTransaction(raw);
    status = normalizePakasirStatus(n.status ?? raw?.status);
  } catch (err) {
    console.error("[gateway] cek status:", err?.message || err);
    return { ok: true, invoice: bentukTagihan(inv), berubah: false };
  }

  if (status === "completed") return kreditkanTagihan(invoiceId);

  if (status === "canceled" || status === "failed") {
    await col.updateOne(
      { invoiceId, status: "pending" },
      { $set: { status: "expired", updatedAt: new Date() } }
    );
    const segar = await col.findOne({ invoiceId });
    return { ok: true, invoice: bentukTagihan(segar), berubah: true };
  }

  return { ok: true, invoice: bentukTagihan(inv), berubah: false };
}

/**
 * Kreditkan satu tagihan ke saldo merchant. Hanya boleh berhasil SEKALI.
 *
 * Dua lapis penjagaan, dan keduanya perlu:
 *   1. klaim atomik `credited: false` di dalam filter — menangkap panggilan
 *      berbarengan dari dasbor dan callback
 *   2. indeks unik gateway_ledger.invoiceId — menangkap SEMUA jalur lain,
 *      termasuk yang ditambahkan nanti oleh orang yang tidak membaca ini
 */
export async function kreditkanTagihan(invoiceId) {
  const col = await gatewayInvoicesCol();
  const inv = await col.findOneAndUpdate(
    { invoiceId, credited: { $ne: true } },
    { $set: { credited: true, status: "paid", paidAt: new Date(), updatedAt: new Date() } },
    { returnDocument: "after" }
  );
  if (!inv) {
    const ada = await col.findOne({ invoiceId });
    if (!ada) return gagal(404, "Tagihan tidak ditemukan.");
    return { ok: true, invoice: bentukTagihan(ada), berubah: false };
  }

  const diterima = bersihDariTagihan(inv.amount);
  const catatan = await catatSekali({
    token: inv.token,
    jenis: "masuk",
    invoiceId,
    amount: diterima,
    judul: `Tagihan ${invoiceId} dibayar`
  });
  if (!catatan.ok) {
    if (catatan.duplikat) {
      console.error(`[gateway] kredit rangkap DICEGAH untuk ${invoiceId} — saldo tidak ditambah.`);
    }
    return { ok: true, invoice: bentukTagihan(inv), berubah: false };
  }

  const akunCol = await gatewayAccountsCol();
  const akun = await akunCol.findOneAndUpdate(
    { token: inv.token },
    { $inc: { balance: diterima, totalMasuk: diterima } },
    { returnDocument: "after" }
  );
  await setSaldoSetelah(catatan.id, akun?.balance ?? null);

  return { ok: true, invoice: bentukTagihan(inv), berubah: true, saldo: akun?.balance ?? 0, diterima };
}

// ────────────────────────────── PENARIKAN ──────────────────────────────

export async function ajukanPenarikan({ token, amount, ewallet, nomor, atasNama }) {
  const nominal = Math.round(Number(amount));
  if (!token) return gagal(400, "Kode akun kosong.");
  if (!Number.isFinite(nominal) || nominal < WD_MIN) return gagal(400, `Penarikan minimal ${rp(WD_MIN)}.`);
  if (!EWALLET[ewallet]) return gagal(400, "E-wallet tujuan tidak dikenal.");
  if (!ewalletValid(ewallet, nomor)) {
    return gagal(400, `Nomor ${EWALLET[ewallet].nama} tidak valid. Contoh: ${EWALLET[ewallet].contoh}`);
  }
  const nama = String(atasNama || "").trim();
  if (nama.length < 2) return gagal(400, "Nama pemilik e-wallet wajib diisi.");

  const akun = await ambilAkun(token);
  if (!akun) return gagal(404, "Akun gateway tidak ditemukan.");
  if (akun.dibekukan) return gagal(403, "Akun gateway kamu sedang dibekukan admin.");

  const wdId = idAcak("WD", 12);
  const diterima = bersihDariPenarikan(nominal);

  // Saldo dipotong DI DALAM filter, bukan diperiksa lebih dulu. Dengan
  // "periksa dulu", dua permintaan penarikan yang dikirim berbarengan
  // sama-sama melihat saldo cukup, dan keduanya lolos — padahal uangnya cuma
  // cukup untuk satu.
  const akunCol = await gatewayAccountsCol();
  const sesudah = await akunCol.findOneAndUpdate(
    { token, balance: { $gte: nominal }, dibekukan: { $ne: true } },
    { $inc: { balance: -nominal } },
    { returnDocument: "after" }
  );
  if (!sesudah) return gagal(400, "Saldo gateway kamu tidak cukup.");

  const col = await gatewayWithdrawalsCol();
  const doc = {
    wdId,
    token,
    amount: nominal,
    biaya: BIAYA_WD,
    diterima,
    ewallet,
    ewalletNama: EWALLET[ewallet].nama,
    nomor: String(nomor).trim(),
    atasNama: nama.slice(0, 60),
    status: "pending",
    createdAt: new Date()
  };
  await col.insertOne(doc);

  const catatan = await catatSekali({
    token,
    jenis: "tarik",
    invoiceId: null,
    amount: -nominal,
    judul: `Penarikan ke ${EWALLET[ewallet].nama}`,
    saldoSetelah: sesudah.balance
  });
  if (!catatan.ok) console.error("[gateway] mutasi penarikan gagal dicatat:", wdId);

  return { ok: true, penarikan: doc, saldo: sesudah.balance };
}

/**
 * Admin menolak penarikan: saldonya dikembalikan PENUH, termasuk biayanya.
 *
 * Biaya penarikan itu ongkos mengirim uang. Kalau uangnya tidak jadi dikirim,
 * tidak ada ongkos yang wajar dipotong — memotongnya sama saja menagih orang
 * untuk layanan yang tidak ia terima.
 */
export async function tolakPenarikan(wdId, alasan = "") {
  const col = await gatewayWithdrawalsCol();
  const wd = await col.findOneAndUpdate(
    { wdId, status: "pending" },
    { $set: { status: "rejected", alasan: String(alasan || "").slice(0, 200), selesaiAt: new Date() } },
    { returnDocument: "after" }
  );
  if (!wd) return gagal(400, "Penarikan tidak ditemukan atau sudah diproses.");

  const akunCol = await gatewayAccountsCol();
  const akun = await akunCol.findOneAndUpdate(
    { token: wd.token },
    { $inc: { balance: wd.amount } },
    { returnDocument: "after" }
  );
  await catatSekali({
    token: wd.token,
    jenis: "tarik_batal",
    invoiceId: null,
    amount: wd.amount,
    judul: `Penarikan ${wdId} ditolak — saldo kembali`,
    saldoSetelah: akun?.balance ?? null
  });
  return { ok: true, penarikan: wd, saldo: akun?.balance ?? 0 };
}

export async function selesaikanPenarikan(wdId, catatan = "") {
  const col = await gatewayWithdrawalsCol();
  const wd = await col.findOneAndUpdate(
    { wdId, status: "pending" },
    { $set: { status: "done", catatanAdmin: String(catatan || "").slice(0, 200), selesaiAt: new Date() } },
    { returnDocument: "after" }
  );
  if (!wd) return gagal(400, "Penarikan tidak ditemukan atau sudah diproses.");
  return { ok: true, penarikan: wd };
}

// ────────────────────────── KONVERSI KE SALDO ARTA PEDIA ──────────────────────────

/**
 * Pindahkan saldo gateway jadi saldo Arta Pedia untuk beli nokos.
 *
 * Tanpa biaya: uangnya tidak keluar ke mana-mana, cuma berpindah dompet di
 * dalam sistem yang sama.
 */
export async function konversiKeSaldo({ token, amount }) {
  const nominal = Math.round(Number(amount));
  if (!token) return gagal(400, "Kode akun kosong.");
  if (!Number.isFinite(nominal) || nominal < KONVERSI_MIN) {
    return gagal(400, `Konversi minimal ${rp(KONVERSI_MIN)}.`);
  }

  const akunCol = await gatewayAccountsCol();
  const sesudah = await akunCol.findOneAndUpdate(
    { token, balance: { $gte: nominal }, dibekukan: { $ne: true } },
    { $inc: { balance: -nominal } },
    { returnDocument: "after" }
  );
  if (!sesudah) return gagal(400, "Saldo gateway kamu tidak cukup.");

  const users = await usersCol();
  const user = await users.findOneAndUpdate(
    { token },
    { $inc: { balance: nominal } },
    { returnDocument: "after" }
  );
  if (!user) {
    // Akun Arta Pedia-nya tidak ada: saldo gateway dikembalikan, jangan sampai
    // uangnya hilang di antara dua dompet.
    await akunCol.updateOne({ token }, { $inc: { balance: nominal } });
    return gagal(404, "Akun Arta Pedia tidak ditemukan.");
  }

  await catatSekali({
    token,
    jenis: "konversi",
    invoiceId: null,
    amount: -nominal,
    judul: "Dikonversi jadi saldo Arta Pedia",
    saldoSetelah: sesudah.balance
  });
  await logBalance({
    token,
    type: "gateway_konversi",
    amount: nominal,
    balanceAfter: user.balance,
    title: "Konversi dari QRIS Gateway"
  });

  return { ok: true, saldoGateway: sesudah.balance, saldoArta: user.balance, amount: nominal };
}

// ────────────────────────────── RINGKASAN ──────────────────────────────

export async function ringkasan(token) {
  const akun = await ambilAkun(token);
  if (!akun) return null;
  const inv = await gatewayInvoicesCol();
  const wd = await gatewayWithdrawalsCol();
  const [tagihanTerbaru, penarikanTerbaru, jumlahLunas, jumlahPending] = await Promise.all([
    inv.find({ token }).sort({ createdAt: -1 }).limit(20).toArray(),
    wd.find({ token }).sort({ createdAt: -1 }).limit(10).toArray(),
    inv.countDocuments({ token, status: "paid" }),
    inv.countDocuments({ token, status: "pending" })
  ]);
  return {
    saldo: akun.balance || 0,
    apiKey: akun.apiKey,
    callbackUrl: akun.callbackUrl || "",
    dibekukan: Boolean(akun.dibekukan),
    totalMasuk: akun.totalMasuk || 0,
    jumlahLunas,
    jumlahPending,
    tagihan: tagihanTerbaru.map(bentukTagihan),
    penarikan: penarikanTerbaru.map((w) => ({
      wdId: w.wdId,
      amount: w.amount,
      biaya: w.biaya,
      diterima: w.diterima,
      ewalletNama: w.ewalletNama,
      nomor: w.nomor,
      status: w.status,
      alasan: w.alasan || "",
      createdAt: w.createdAt
    }))
  };
}
