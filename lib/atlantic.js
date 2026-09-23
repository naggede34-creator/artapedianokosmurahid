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

// Atlantic berada di belakang Cloudflare. Kalau Cloudflare memutuskan
// permintaannya perlu diverifikasi, yang dibalas BUKAN JSON melainkan halaman
// HTML "Just a moment..." — dan itu tetap HTTP 200 atau 403, bukan error
// jaringan. Tanpa pemeriksaan ini, seluruh halaman HTML-nya ikut jadi pesan
// error dan tumpah ke layar pembeli.
function halamanTantangan(data) {
  if (typeof data !== "string") return false;
  const t = data.slice(0, 4000).toLowerCase();
  return (
    t.includes("<!doctype html") ||
    t.includes("just a moment") ||
    t.includes("cf-chl") ||
    t.includes("_cf_chl_opt") ||
    t.includes("challenge-platform")
  );
}

// Ray ID adalah nomor yang dipakai Cloudflare untuk menandai SATU permintaan.
// Tanpa itu, "API kami diblokir" hampir mustahil ditelusuri pemilik situsnya —
// dengan itu, dia bisa membuka permintaan yang persis ini di dasbornya dan
// melihat aturan mana yang menghadangnya. Ini satu-satunya keterangan yang
// membuat laporan ke Atlantic bisa ditindaklanjuti, jadi ia diambil dan dibawa
// sampai ke panel admin.
function ambilRayId(html) {
  if (typeof html !== "string") return null;
  const m =
    html.match(/cRay:\s*'([a-f0-9]+)'/i) ||
    html.match(/ray=([a-f0-9]{10,})/i) ||
    html.match(/Ray ID:?\s*<[^>]*>([a-f0-9]{10,})/i);
  return m ? m[1] : null;
}

function bentukPesan(data, bawaan) {
  if (!data) return bawaan;
  if (typeof data === "string") {
    if (halamanTantangan(data)) return bawaan;
    // Jawaban teks apa pun tetap dipotong: badan respons bisa sepanjang apa
    // saja, dan tidak ada pesan kesalahan berguna yang lebih dari dua baris.
    return data.trim().slice(0, 200);
  }
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
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        // Header-header ini bukan hiasan. Cloudflare di depan Atlantic menilai
        // permintaan tanpa User-Agent yang wajar sebagai bot dan membalasnya
        // dengan halaman tantangan, bukan JSON. Bawaan axios adalah
        // "axios/1.x", yang langsung menandai permintaannya.
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
        "Cache-Control": "no-cache",
        Origin: BASE,
        Referer: `${BASE}/`
      },
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

  // Tantangan Cloudflare diperiksa lebih dulu dan dijadikan kesalahan
  // tersendiri: sebabnya sama sekali bukan salah pemakai atau salah nominal,
  // jadi pesannya pun tidak boleh terdengar begitu. Penandanya dipakai
  // pemanggil untuk memilih kalimat yang tepat.
  if (halamanTantangan(data)) {
    const e = new Error(
      "Server Atlantic sedang memblokir permintaan otomatis (verifikasi Cloudflare). Ini masalah di sisi Atlantic, bukan pembayaranmu."
    );
    e.status = res.status;
    e.cloudflare = true;
    e.rayId = ambilRayId(data);
    e.endpoint = `POST ${path}`;
    e.waktu = new Date().toISOString();
    console.error(
      `[atlantic] dihadang Cloudflare pada ${e.endpoint} — Ray ID ${e.rayId || "(tidak terbaca)"}, HTTP ${res.status}`
    );
    throw e;
  }

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

/**
 * Diagnosa koneksi Atlantic DARI SERVER YANG SEBENARNYA.
 *
 * Ini ada karena dua lapis yang sering tertukar:
 *   1. Pembatasan IP pada API key — diatur di dasbor Atlantic. "IP bebas"
 *      mematikan lapis ini.
 *   2. Cloudflare di depan atlantich2h.com — menyaring permintaan SEBELUM
 *      sampai ke Atlantic, jadi ia tidak tahu-menahu soal API key maupun
 *      pengaturan IP-nya. Mematikan pembatasan IP tidak berpengaruh di sini.
 *
 * Menebak-nebak yang mana yang sedang terjadi tidak ada gunanya; fungsi ini
 * menanyakannya langsung dari server yang memang memanggil Atlantic, dan
 * melaporkan APA yang dibalas, bukan kesimpulan.
 *
 * Tidak pernah membocorkan API key — yang dilaporkan cuma bentuk jawabannya.
 */
export async function diagnoseAtlantic() {
  if (!atlanticConfigured()) {
    return {
      configured: false,
      lolosCloudflare: null,
      verdict: "ATLANTIC_APIKEY belum diisi di environment variables Vercel."
    };
  }

  try {
    // /deposit/metode dipilih karena hanya membaca daftar metode: tidak
    // membuat tagihan, tidak memindahkan uang, aman ditekan berkali-kali.
    const d = await atlanticDepositMethods();
    return {
      configured: true,
      lolosCloudflare: true,
      apiKeyDiterima: true,
      jumlahMetode: d.length,
      verdict: `Koneksi Atlantic normal. ${d.length} metode deposit terbaca, dan tidak ada hadangan Cloudflare.`
    };
  } catch (err) {
    if (err?.cloudflare) {
      // Laporan siap salin-tempel. Kalimat "API saya diblokir" hampir selalu
      // dijawab "coba lagi"; yang membuat orang di seberang bisa bertindak
      // adalah Ray ID, jam kejadian, dan endpoint yang persis.
      const laporan =
        `Halo, permintaan API H2H dari server kami dihadang Cloudflare (halaman "Just a moment..."), ` +
        `bukan dijawab API. Mohon endpoint API dikecualikan dari browser challenge / bot fight mode untuk akun kami.\n\n` +
        `Endpoint : ${err.endpoint || "POST /deposit/metode"}\n` +
        `Ray ID   : ${err.rayId || "(tidak terbaca)"}\n` +
        `Waktu    : ${err.waktu || new Date().toISOString()} (UTC)\n` +
        `Perlu dikecualikan: POST /deposit/create, /deposit/status, /deposit/cancel, /deposit/metode, dan /transfer/*\n\n` +
        `Catatan: server kami tidak punya IP tetap, jadi whitelist per-IP tidak bisa dipakai. ` +
        `Pengaturan "IP bebas" pada API key sudah aktif, tapi tidak berpengaruh karena Cloudflare menyaring sebelum API key dibaca.`;

      return {
        configured: true,
        lolosCloudflare: false,
        apiKeyDiterima: null,
        rayId: err.rayId || null,
        endpoint: err.endpoint || null,
        waktu: err.waktu || null,
        laporan,
        verdict:
          "Dihadang verifikasi Cloudflare — permintaan tidak sampai ke Atlantic sama sekali, jadi API key dan pengaturan IP-nya belum sempat diperiksa. " +
          (err.rayId
            ? `Ray ID permintaan ini: ${err.rayId}. Berikan nomor itu ke Atlantic — dengan itu mereka bisa membuka permintaan yang persis ini di dasbor Cloudflare dan melihat aturan mana yang menghadangnya. `
            : "") +
          "Pengaturan 'IP bebas' pada API key TIDAK menyelesaikan ini karena Cloudflare berada di depannya."
      };
    }
    if (err?.status === 0) {
      return {
        configured: true,
        lolosCloudflare: null,
        verdict: `Server tidak bisa menghubungi Atlantic sama sekali: ${String(err?.message || "").slice(0, 160)}`
      };
    }
    return {
      configured: true,
      lolosCloudflare: true,
      apiKeyDiterima: false,
      verdict: `Cloudflare terlewati, tapi Atlantic menolak permintaannya: ${String(err?.message || "").slice(0, 160)}`
    };
  }
}
