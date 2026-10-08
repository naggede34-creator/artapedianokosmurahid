// Ekspor & impor DATA LENGKAP dari dasbor admin.
//
// Beda dengan backupData.js (khusus akun) dan backupReseller.js (ringkas):
// ini membuat satu berkas yang bisa dipakai MEMULIHKAN toko — pengguna, saldo
// nokos, saldo QRIS gateway, web reseller, bot reseller, transaksi, dan
// pengaturan penting lainnya.
//
// ATURAN KEAMANAN
//   - Hanya koleksi di DAFTAR KELOMPOK di bawah yang boleh diekspor/diimpor
//     (daftar putih). `app_config` (kunci API terenkripsi) TIDAK ADA di sana
//     dan tidak pernah ikut, sama seperti backup lain.
//   - Kredensial bot Telegram (token, webhookSecret), kunci API merchant
//     gateway, dan token bot lama di `settings` dibuang kecuali admin
//     SECARA SADAR mencentang "sertakan kredensial".
//   - Berkasnya tetap memuat token akun pengguna (kredensial akun). Perlakukan
//     seperti daftar kata sandi.
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";

export const VERSI_BERKAS = 3;
export const FORMAT_BERKAS = "artapedia-data-lengkap";

/** Kelompok data: kunci -> { label, catatan, koleksi: [nama], besar? } */
export const KELOMPOK = {
  pengguna: {
    label: "Pengguna & akun",
    catatan: "Semua pengguna (web utama, web reseller, bot reseller) beserta saldo nokos, saldo stor, notifikasi, favorit, tautan Telegram.",
    koleksi: ["users", "user_telegram", "user_notifications", "otp_favorites", "perangkat_akun"]
  },
  saldo: {
    label: "Saldo & mutasi",
    catatan: "Riwayat saldo, koreksi admin, saldo tertahan, pembukuan, referral tertahan.",
    koleksi: ["balance_logs", "admin_balance_logs", "saldo_holds", "koreksi_batch", "pembukuan", "referral_tertahan"]
  },
  transaksi: {
    label: "Transaksi nokos & deposit",
    catatan: "Deposit, pesanan OTP, pesanan produk, garansi, penarikan.",
    koleksi: ["deposits", "otp_orders", "product_orders", "warranty_claims", "withdrawals", "wd_instan", "deposit_rute_log", "bukti_terpakai"]
  },
  gateway: {
    label: "QRIS Gateway",
    catatan: "Akun & saldo merchant gateway, tagihan QRIS, penarikan, buku besar.",
    koleksi: ["gateway_accounts", "gateway_invoices", "gateway_withdrawals", "gateway_ledger"]
  },
  webReseller: {
    label: "Web Reseller",
    catatan: "Data web reseller, komisi, penarikan komisi, bonus.",
    koleksi: ["reseller_web", "reseller_komisi", "reseller_withdrawals", "reseller_bonus"]
  },
  botReseller: {
    label: "Bot Reseller",
    catatan: "Data bot reseller (tanpa token bot kecuali dicentang) dan sesi bot.",
    koleksi: ["bots", "bot_sessions"]
  },
  toko: {
    label: "Toko & pengaturan",
    catatan: "Pengaturan umum, markup, voucher, flash sale, jam diskon, produk, banner, popup, tampilan, pengumuman, siaran, tugas.",
    koleksi: [
      "settings", "platform_markup", "vouchers", "flash_sales", "lucky_hours", "products", "banners", "popup_admin",
      "tampilan_kustom", "announcements", "broadcasts", "jobs", "job_submissions", "support_tickets", "weekly_buyer_leaderboard"
    ]
  },
  fitur: {
    label: "Fitur lain",
    catatan: "Saldo Kaget, giveaway, afiliasi, Stor Gmail, daftar pantau stok, langganan push, blokir IP, catatan keamanan.",
    koleksi: [
      "kaget", "kaget_klaim", "giveaway_peserta", "giveaways", "afiliasi_pengajuan", "afiliasi_komisi", "setor_gmail",
      "setor_gmail_job", "setor_gmail_room", "stok_watch", "push_langganan", "push_kunci", "ip_blokir", "security_events"
    ]
  },
  chat: {
    label: "WEARTA Chat (besar)",
    catatan: "Pesan, profil, status, panggilan, media chat. Ukurannya bisa sangat besar — matikan kalau tidak perlu.",
    koleksi: ["chat_messages", "chat_group_settings", "wa_profil", "wa_room", "wa_pesan", "wa_pref", "wa_status", "wa_call", "wa_media", "wa_filter_log"],
    besar: true
  }
};

export const SEMUA_KOLEKSI = new Set(Object.values(KELOMPOK).flatMap((g) => g.koleksi));

/** Kelompok -> daftar koleksi, dengan validasi daftar putih. */
export function koleksiDariKelompok(kunciKelompok) {
  const hasil = [];
  for (const k of kunciKelompok || []) {
    if (KELOMPOK[k]) for (const n of KELOMPOK[k].koleksi) if (!hasil.includes(n)) hasil.push(n);
  }
  return hasil;
}

// ── Pengaman kredensial ────────────────────────────────────────────────────
const KREDENSIAL = {
  bots: ["token", "webhookSecret"],
  gateway_accounts: ["apiKey"],
  settings: ["telegramBotToken"]
};

export function bersihkanKredensial(koleksi, doc, sertakan) {
  if (sertakan) return doc;
  const buang = KREDENSIAL[koleksi];
  if (!buang) return doc;
  const salin = { ...doc };
  for (const f of buang) delete salin[f];
  return salin;
}

// ── Serialisasi yang mempertahankan tipe (Date, ObjectId, Binary) ──────────
export function cetakJson(nilai) {
  return JSON.stringify(nilai, function (kunci, v) {
    const asli = this[kunci];
    if (asli instanceof Date) return { $date: Number.isNaN(asli.getTime()) ? null : asli.toISOString() };
    if (asli && typeof asli === "object") {
      if (asli._bsontype === "ObjectId" || asli._bsontype === "ObjectID") return { $oid: String(asli.toHexString ? asli.toHexString() : asli) };
      if (asli._bsontype === "Decimal128") return { $dec: String(asli.toString()) };
      if (asli._bsontype === "Long") return Number(asli.toString());
      if (asli._bsontype === "Binary" && asli.buffer) return { $bin: Buffer.from(asli.buffer).toString("base64") };
      if (Buffer.isBuffer(asli)) return { $bin: asli.toString("base64") };
    }
    return v;
  });
}

/** Kebalikan cetakJson. Dipakai di server saat memulihkan. */
export function pulihkanTipe(nilai) {
  if (Array.isArray(nilai)) return nilai.map(pulihkanTipe);
  if (nilai && typeof nilai === "object") {
    const kunci = Object.keys(nilai);
    if (kunci.length === 1) {
      const k = kunci[0];
      if (k === "$date") return nilai.$date ? new Date(nilai.$date) : null;
      if (k === "$oid" && /^[a-fA-F0-9]{24}$/.test(String(nilai.$oid))) return new ObjectId(String(nilai.$oid));
      if (k === "$bin") return Buffer.from(String(nilai.$bin), "base64");
    }
    const hasil = {};
    for (const [a, b] of Object.entries(nilai)) {
      // Kunci berawalan $ tidak boleh lolos ke database.
      if (a.startsWith("$")) continue;
      hasil[a] = pulihkanTipe(b);
    }
    return hasil;
  }
  return nilai;
}

// ── Ringkasan saldo ────────────────────────────────────────────────────────
async function jumlahkan(col, filter, field) {
  const r = await col.aggregate([{ $match: filter }, { $group: { _id: null, total: { $sum: { $ifNull: [`$${field}`, 0] } }, n: { $sum: 1 } } }]).toArray();
  return { total: Number(r[0]?.total) || 0, jumlah: r[0]?.n || 0 };
}

/** Ringkasan angka penting: dipakai di kartu dasbor dan ditulis di berkas ekspor. */
export async function ringkasanData() {
  const db = await getDb();
  const out = { dibuat: new Date().toISOString(), saldo: {}, jumlah: {} };
  const aman = async (fn, fallback) => { try { return await fn(); } catch { return fallback; } };

  const users = db.collection("users");
  const saldoNokos = await aman(() => jumlahkan(users, {}, "balance"), { total: 0, jumlah: 0 });
  const saldoStor = await aman(() => jumlahkan(users, {}, "saldoSetor"), { total: 0, jumlah: 0 });
  const saldoGw = await aman(() => jumlahkan(db.collection("gateway_accounts"), {}, "balance"), { total: 0, jumlah: 0 });
  const komisiWeb = await aman(() => jumlahkan(db.collection("reseller_web"), {}, "komisiTertunda"), { total: 0, jumlah: 0 });
  const komisiBot = await aman(() => jumlahkan(db.collection("bots"), { jenis: "reseller" }, "komisi"), { total: 0, jumlah: 0 });

  out.saldo = {
    nokosSemuaPengguna: saldoNokos.total,
    stor: saldoStor.total,
    qrisGateway: saldoGw.total,
    komisiWebResellerTertunda: komisiWeb.total,
    komisiBotReseller: komisiBot.total
  };
  out.jumlah = {
    pengguna: saldoNokos.jumlah,
    penggunaWebReseller: await aman(() => users.countDocuments({ rwSlug: { $exists: true, $ne: null } }), 0),
    penggunaBotReseller: await aman(() => users.countDocuments({ telegramBotId: { $exists: true, $ne: null } }), 0),
    webReseller: await aman(() => db.collection("reseller_web").countDocuments({}), 0),
    botReseller: await aman(() => db.collection("bots").countDocuments({ jenis: "reseller" }), 0),
    akunGateway: saldoGw.jumlah
  };
  return out;
}

/** Hitung dokumen tiap koleksi (untuk tampilan dasbor). */
export async function hitungKoleksi() {
  const db = await getDb();
  const hasil = {};
  for (const [kunci, g] of Object.entries(KELOMPOK)) {
    let total = 0;
    const rinci = {};
    for (const n of g.koleksi) {
      let c = 0;
      try { c = await db.collection(n).estimatedDocumentCount(); } catch { c = 0; }
      rinci[n] = c;
      total += c;
    }
    hasil[kunci] = { label: g.label, catatan: g.catatan, besar: !!g.besar, total, koleksi: rinci };
  }
  return hasil;
}

// ── EKSPOR (dialirkan) ─────────────────────────────────────────────────────
/**
 * Mengalirkan berkas JSON koleksi demi koleksi, dokumen demi dokumen.
 * Tidak pernah memuat seluruh database ke memori.
 */
export function alirkanBackup({ kelompok, sertakanKredensial = false, batasPerKoleksi = 1_000_000 }) {
  const daftar = koleksiDariKelompok(kelompok);
  const enc = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      const tulis = (s) => controller.enqueue(enc.encode(s));
      const ringkasan = {};
      try {
        const db = await getDb();
        const info = await ringkasanData().catch(() => null);
        tulis(
          `{"format":${JSON.stringify(FORMAT_BERKAS)},"versi":${VERSI_BERKAS},"dibuat":${JSON.stringify(new Date().toISOString())},` +
            `"kelompok":${JSON.stringify(kelompok)},"kredensialDisertakan":${sertakanKredensial ? "true" : "false"},` +
            `"peringatan":${JSON.stringify("Berkas ini memuat token akun pengguna (kredensial). Simpan di tempat aman dan jangan dibagikan.")},` +
            `"ringkasanSaldo":${JSON.stringify(info)},"koleksi":{`
        );
        let pertamaKol = true;
        for (const nama of daftar) {
          if (!pertamaKol) tulis(",");
          pertamaKol = false;
          tulis(`${JSON.stringify(nama)}:[`);
          let n = 0;
          let gagal = null;
          try {
            const total = await db.collection(nama).estimatedDocumentCount().catch(() => 0);
            const cursor = db.collection(nama).find({}).limit(batasPerKoleksi);
            let pertama = true;
            for await (const doc of cursor) {
              tulis((pertama ? "" : ",") + cetakJson(bersihkanKredensial(nama, doc, sertakanKredensial)));
              pertama = false;
              n++;
            }
            ringkasan[nama] = { disimpan: n, totalDiDatabase: total, terpotong: total > n };
          } catch (e) {
            gagal = String(e?.message || e).slice(0, 200);
            console.error(`[data-lengkap] koleksi ${nama} gagal:`, gagal);
            ringkasan[nama] = { disimpan: n, totalDiDatabase: null, gagal };
          }
          tulis("]");
        }
        tulis(`},"ringkasan":${JSON.stringify(ringkasan)}}`);
        controller.close();
      } catch (e) {
        console.error("[data-lengkap] ekspor gagal:", e?.message || e);
        controller.error(e);
      }
    }
  });
}

// ── IMPOR (per batch, dipanggil berulang oleh dasbor) ──────────────────────
export const MODE_IMPOR = ["gabung", "aman", "ganti"];
export const BATAS_BATCH = 1000;

function kunciUpsert(koleksi, doc) {
  if (koleksi === "users" && doc.token) return { token: doc.token };
  if (koleksi === "bots" && doc.botId) return { botId: doc.botId };
  if (koleksi === "reseller_web" && doc.slug) return { slug: doc.slug };
  if (koleksi === "gateway_accounts" && doc.token) return { token: doc.token };
  return doc._id !== undefined ? { _id: doc._id } : null;
}

/** Kosongkan satu koleksi (mode ganti). */
export async function kosongkanKoleksi(nama) {
  if (!SEMUA_KOLEKSI.has(nama)) throw new Error("Koleksi tidak diizinkan.");
  const db = await getDb();
  const r = await db.collection(nama).deleteMany({});
  return { dihapus: r.deletedCount || 0 };
}

/** Masukkan satu batch dokumen ke satu koleksi. */
export async function isiBatch({ koleksi, dokumen, mode }) {
  if (!SEMUA_KOLEKSI.has(koleksi)) throw new Error("Koleksi tidak diizinkan.");
  if (!MODE_IMPOR.includes(mode)) throw new Error("Mode tidak valid.");
  if (!Array.isArray(dokumen)) throw new Error("Dokumen harus berupa larik.");
  if (dokumen.length > BATAS_BATCH) throw new Error(`Maksimal ${BATAS_BATCH} dokumen per batch.`);

  const col = (await getDb()).collection(koleksi);
  const ops = [];
  let dilewati = 0;

  for (const mentah of dokumen) {
    if (!mentah || typeof mentah !== "object") { dilewati++; continue; }
    const doc = pulihkanTipe(mentah);
    const kunci = kunciUpsert(koleksi, doc);
    if (!kunci) { dilewati++; continue; }

    if (mode === "ganti") {
      // Koleksi sudah dikosongkan: cukup masukkan apa adanya.
      ops.push({ insertOne: { document: doc } });
    } else if (mode === "aman") {
      // Hanya isi yang belum ada; tidak menyentuh dokumen yang sudah ada.
      const { _id, ...sisa } = doc;
      const saatBaru = kunci._id !== undefined ? sisa : { ...(_id !== undefined ? { _id } : {}), ...sisa };
      ops.push({ updateOne: { filter: kunci, update: { $setOnInsert: saatBaru }, upsert: true } });
    } else {
      const { _id, ...sisa } = doc;
      const set = { ...sisa };
      // Kunci yang dipakai pencarian tidak ikut di $set agar tidak bentrok.
      for (const k of Object.keys(kunci)) delete set[k];
      const upd = {};
      if (Object.keys(set).length) upd.$set = set;
      if (_id !== undefined && kunci._id === undefined) upd.$setOnInsert = { _id };
      if (!upd.$set && !upd.$setOnInsert) upd.$setOnInsert = { ...kunci };
      ops.push({ updateOne: { filter: kunci, update: upd, upsert: true } });
    }
  }

  let ditambah = 0, diperbarui = 0, gagal = 0;
  const contohGagal = [];
  if (ops.length) {
    try {
      const r = await col.bulkWrite(ops, { ordered: false });
      ditambah = (r.insertedCount || 0) + (r.upsertedCount || 0);
      diperbarui = r.modifiedCount || 0;
    } catch (e) {
      // bulkWrite tak berurutan tetap menulis yang bisa; hitung dari hasil parsial.
      const r = e?.result;
      ditambah = (r?.insertedCount || 0) + (r?.upsertedCount || 0);
      diperbarui = r?.modifiedCount || 0;
      const galat = e?.writeErrors || [];
      gagal = galat.length || ops.length - ditambah - diperbarui;
      for (const w of galat.slice(0, 3)) contohGagal.push(String(w?.errmsg || w?.err?.errmsg || w).slice(0, 160));
      if (!galat.length) contohGagal.push(String(e?.message || e).slice(0, 160));
    }
  }
  const sama = Math.max(0, ops.length - ditambah - diperbarui - gagal);
  return { ditambah, diperbarui, sama, dilewati, gagal, contohGagal };
}
