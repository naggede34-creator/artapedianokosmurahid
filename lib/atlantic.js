// Client API Atlantic H2H (https://atlantich2h.com) — dipakai untuk dua hal
// yang arahnya berlawanan:
//
//   1. DEPOSIT  — uang MASUK dari pembeli ke saldo Atlantic kamu (QRIS).
//   2. TRANSFER — uang KELUAR dari saldo Atlantic ke rekening/e-wallet.
//                 Ini jalur penarikan, dan HANYA boleh dipanggil dari endpoint
//                 admin. Satu kebocoran di sini berarti orang lain bisa
//                 memindahkan uangmu ke rekeningnya sendiri.
//
// API key WAJIB di environment variable ATLANTIC_APIKEY (server only). Jangan
// pernah dikirim ke browser atau ditulis di kode — siapa pun yang memegangnya
// bisa menguras saldo Atlantic kamu lewat /transfer/create.
//
// Semua endpointnya POST dengan badan application/x-www-form-urlencoded, bukan
// JSON, dan membalas { status, data, code } — bukan kode status HTTP. Jadi
// HTTP 200 dengan status:false tetap berarti gagal, dan itu diperiksa di sini
// supaya pemanggilnya tidak perlu ingat.
import axios from "axios";

const BASE = (process.env.ATLANTIC_BASE_URL || "https://atlantich2h.com").trim().replace(/\/+$/, "");

export function atlanticApiKey() {
  return (process.env.ATLANTIC_APIKEY || "").trim();
}

export function atlanticConfigured() {
  return atlanticApiKey().length > 0;
}

function bentukPesan(data, bawaan) {
  if (!data) return bawaan;
  if (typeof data === "string") return data;
  return data.message || data.error || data.msg || bawaan;
}

async function panggil(path, params = {}) {
  const key = atlanticApiKey();
  if (!key) {
    const err = new Error("ATLANTIC_APIKEY belum diisi di environment variables.");
    err.status = 0;
    throw err;
  }

  const body = new URLSearchParams();
  body.set("api_key", key);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    body.set(k, String(v));
  }

  let res;
  try {
    res = await axios.post(`${BASE}${path}`, body.toString(), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      timeout: 20000,
      // Status HTTP tidak dipakai Atlantic untuk menandai gagal, jadi jangan
      // biarkan axios melempar sebelum badannya sempat dibaca.
      validateStatus: () => true
    });
  } catch (err) {
    const e = new Error(`Tidak bisa menghubungi Atlantic (${err?.message || "jaringan gagal"}).`);
    e.status = 0;
    throw e;
  }

  const data = res.data;

  // "status" kadang boolean true, kadang string "true" (lihat /transfer/bank_list
  // di dokumentasinya). Keduanya harus dianggap berhasil.
  const sukses = data?.status === true || data?.status === "true";
  if (!sukses) {
    const e = new Error(bentukPesan(data, `Atlantic menolak permintaan (HTTP ${res.status}).`));
    e.status = res.status;
    e.raw = data;
    throw e;
  }

  return data;
}

// ─────────────────────────────── DEPOSIT ───────────────────────────────

/**
 * reffId WAJIB unik per transaksi. Atlantic memakainya untuk menolak deposit
 * kembar, jadi mengirim ulang reff_id yang sama tidak membuat tagihan baru —
 * itu perlindungan, bukan penghalang.
 */
export async function createAtlanticDeposit({ reffId, nominal, type = "ewallet", metode = "qris" }) {
  const d = await panggil("/deposit/create", { reff_id: reffId, nominal, type, metode });
  const x = d.data || {};
  return {
    id: String(x.id || ""),
    reffId: String(x.reff_id || reffId),
    nominal: Number(x.nominal) || Number(nominal) || 0,
    qrString: x.qr_string || null,
    qrImage: x.qr_image || null,
    status: x.status || "pending",
    createdAt: x.created_at || null,
    expiredAt: x.expired_at || null
  };
}

export async function cancelAtlanticDeposit(id) {
  const d = await panggil("/deposit/cancel", { id });
  return { id: String(d.data?.id || id), status: d.data?.status || "cancel" };
}

export async function getAtlanticDepositStatus(id) {
  const d = await panggil("/deposit/status", { id });
  const x = d.data || {};
  return {
    id: String(x.id || id),
    reffId: x.reff_id || null,
    nominal: Number(x.nominal) || 0,
    fee: Number(x.fee) || 0,
    // get_balance = nominal bersih yang benar-benar masuk setelah dipotong fee.
    diterima: Number(x.get_balance) || 0,
    metode: x.metode || null,
    status: String(x.status || "").toLowerCase(),
    createdAt: x.created_at || null
  };
}

export async function atlanticDepositMethods({ type, metode } = {}) {
  const d = await panggil("/deposit/metode", { type, metode });
  return Array.isArray(d.data) ? d.data : [];
}

// ────────────────────────────── PENARIKAN ──────────────────────────────
//
// Semua di bawah ini memindahkan uang KELUAR. Pemanggilnya wajib sudah
// memastikan yang meminta adalah admin.

export async function atlanticBankList() {
  const d = await panggil("/transfer/bank_list");
  return (Array.isArray(d.data) ? d.data : []).map((b) => ({
    id: String(b.id || ""),
    code: String(b.bank_code || ""),
    name: String(b.bank_name || ""),
    type: String(b.type || "")
  }));
}

export async function atlanticCheckAccount({ bankCode, accountNumber }) {
  const d = await panggil("/transfer/cek_rekening", { bank_code: bankCode, account_number: accountNumber });
  const x = d.data || {};
  return {
    bankCode: x.kode_bank || bankCode,
    accountNumber: x.nomor_akun || accountNumber,
    ownerName: x.nama_pemilik || "",
    status: x.status || "unknown"
  };
}

export async function atlanticCreateTransfer({ refId, bankCode, accountNumber, ownerName, nominal, email, phone, note }) {
  const d = await panggil("/transfer/create", {
    ref_id: refId,
    kode_bank: bankCode,
    nomor_akun: accountNumber,
    nama_pemilik: ownerName,
    nominal,
    email,
    phone,
    note
  });
  const x = d.data || {};
  return {
    id: String(x.id || ""),
    refId: x.reff_id || refId,
    ownerName: x.nama || ownerName,
    accountNumber: x.nomor_tujuan || accountNumber,
    nominal: Number(x.nominal) || Number(nominal) || 0,
    fee: Number(x.fee) || 0,
    total: Number(x.total) || 0,
    status: String(x.status || "pending").toLowerCase(),
    createdAt: x.created_at || null
  };
}

export async function atlanticTransferStatus(id) {
  const d = await panggil("/transfer/status", { id });
  const x = d.data || {};
  return {
    id: String(x.id || id),
    refId: x.reff_id || null,
    ownerName: x.nama || "",
    accountNumber: x.nomor_tujuan || "",
    bankCode: x.bank_code || "",
    nominal: Number(x.nominal) || 0,
    fee: Number(x.fee) || 0,
    total: Number(x.total) || 0,
    status: String(x.status || "").toLowerCase(),
    createdAt: x.created_at || null
  };
}

// Status mentah Atlantic diterjemahkan ke istilah yang dipakai aplikasi ini,
// supaya sisa kode tidak perlu tahu kata apa saja yang mungkin dikirim.
export function normalizeAtlanticStatus(raw) {
  const s = String(raw || "").toLowerCase();
  if (["success", "sukses", "completed", "settled", "paid"].includes(s)) return "completed";
  if (["cancel", "canceled", "cancelled", "batal"].includes(s)) return "canceled";
  if (["expired", "kadaluarsa", "kedaluwarsa"].includes(s)) return "expired";
  if (["failed", "gagal", "error", "reject", "rejected"].includes(s)) return "failed";
  return "pending";
}
