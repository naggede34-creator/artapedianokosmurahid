// Penarikan saldo QRIS Gateway ke e-wallet, OTOMATIS lewat AustinPay.
//
// Uang yang keluar dari sini sungguhan dan tidak bisa ditarik kembali, jadi
// urutannya dijaga ketat dan tiap langkahnya idempoten:
//
//   1. dokumen penarikan dicatat dulu (status "disiapkan")
//   2. saldo gateway dipotong ATOMIK, dengan kunci `wdDebit` supaya satu
//      penarikan tidak pernah memotong dua kali → status "baru"
//   3. barulah AustinPay dipanggil. Hasilnya:
//        sukses/proses     → catat id penyedia
//        ditolak tegas     → saldo dikembalikan SEKALI (kunci `wdRefund`)
//        TIDAK PASTI       → (timeout / putus / 5xx) saldo TIDAK dikembalikan dulu,
//                            karena uangnya bisa saja sudah terkirim. Penyapu
//                            mencocokkannya ke riwayat AustinPay; baru bila
//                            10 menit tidak ada jejak, saldo dikembalikan.
//
// Penyapu (sapuWdGateway) memulihkan proses yang mati di tengah jalan tanpa
// pernah mengirim ganda atau menelan saldo. Bila AustinPay bermasalah berulang
// kali, penarikan otomatis dimatikan sendiri dan permintaan baru jatuh ke antrean
// manual admin — pengguna tidak ditolak, hanya menunggu.
import { randomBytes } from "node:crypto";
import {
  gatewayAccountsCol,
  gatewayWithdrawalsCol,
  gatewayLedgerCol,
  usersCol,
  userNotificationsCol,
  wdInstanCol
} from "@/lib/db";
import { cfg, cfgAngka, simpanCfg } from "@/lib/config";
import {
  austinConfigured,
  austinAkun,
  produkBebas,
  kirimInstan,
  riwayatInstan,
  normalisasiStatusInstan
} from "@/lib/austinpay";
import { bersihkanNomor, daftarDompetOtomatis } from "@/lib/wdInstan";
import { periksaTransaksi } from "@/lib/gerbangUang";
import { catatKejadian } from "@/lib/keamanan";
import { kirimPush } from "@/lib/webPush";
import { notifyBotUser } from "@/lib/shopBot";
import { kabariAdmin } from "@/lib/gatewayNotify";
import { WD_MIN, WD_MAX, BIAYA_WD, EWALLET, ewalletValid, totalPenarikan } from "@/lib/gatewayConfig";

const rp = (n) => `Rp${Number(n || 0).toLocaleString("id-ID")}`;
const esc = (x) => String(x ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const gagal = (status, error) => ({ ok: false, status, error });
const MENIT = 60_000;
const PANJANG_TANDA = 300;
const AKTIF = ["disiapkan", "baru", "dikirim", "proses", "tidak-pasti", "pending"];
const BATAS_TIDAK_PASTI_MS = () => Math.max(0.01, Number(process.env.WD_TIDAK_PASTI_MENIT) || 10) * MENIT;

const nyala = async (nama, bawaan = "1") => String((await cfg(nama)) ?? bawaan) !== "0";

const idWd = () => `WD-${randomBytes(9).toString("base64url").slice(0, 12).toUpperCase()}`;

const awalHariWib = () => {
  const w = new Date(Date.now() + 7 * 3600_000);
  return new Date(Date.UTC(w.getUTCFullYear(), w.getUTCMonth(), w.getUTCDate()) - 7 * 3600_000);
};

/** Otomatis hanya bila AustinPay terhubung dan saklarnya tidak dimatikan (manual atau oleh pemutus arus). */
export async function wdOtomatisAktif() {
  return (await nyala("GW_WD_OTOMATIS")) && (await austinConfigured());
}

/** Bentuk penarikan yang aman ditampilkan ke merchant. */
export const publikWdGateway = (w) => ({
  wdId: w.wdId,
  amount: w.amount,
  biaya: w.biaya,
  diterima: w.diterima,
  ewalletNama: w.ewalletNama,
  nomor: w.nomor,
  status: w.status,
  alasan: w.alasan || "",
  otomatis: Boolean(w.otomatis),
  createdAt: w.createdAt
});

// ───────────────────────── MUTASI ─────────────────────────
async function catatMutasi({ token, jenis, amount, judul, saldoSetelah = null }) {
  try {
    await (await gatewayLedgerCol()).insertOne({ token, jenis, invoiceId: null, amount, judul, saldoSetelah, createdAt: new Date() });
  } catch (e) {
    console.error("[gateway/wd] mutasi gagal dicatat:", e?.message || e);
  }
}

// ───────────────────────── NOTIFIKASI ─────────────────────────
async function kabariMerchantWd(wd, { judul, isi }) {
  try {
    await (await userNotificationsCol()).insertOne({
      token: wd.token, type: "gateway_wd", title: judul, body: isi, read: false, createdAt: new Date(), url: "/gateway", meta: { wdId: wd.wdId }
    });
  } catch {}
  await kirimPush(wd.token, { judul, isi, url: "/gateway", tag: `gwwd-${wd.wdId}` }).catch(() => {});
  try { await notifyBotUser(wd.token, `${judul}\n\n${isi}`); } catch {}
}

function infoAdmin(wd, judul, ekstra = []) {
  return kabariAdmin(
    [
      judul,
      `🧾 <code>${esc(wd.wdId)}</code>`,
      `💸 Kirim <b>${rp(wd.diterima)}</b> → ${esc(wd.ewalletNama)} <code>${esc(wd.nomor)}</code> (biaya ${rp(wd.biaya)})`,
      wd.providerId ? `🔖 ID AustinPay <code>${esc(wd.providerId)}</code>` : "",
      ...ekstra
    ].filter(Boolean).join("\n")
  );
}

// ───────────────────────── PENGEMBALIAN SALDO ─────────────────────────
/**
 * Mengembalikan saldo PENUH (nominal + biaya) sekali saja. Aman dipanggil
 * berulang: kunci `wdRefund` di akun mencegah dua pengembalian untuk satu
 * penarikan, apa pun jalur yang memanggilnya (penyapu, admin, atau jalur gagal).
 */
export async function kembalikanSaldoWd(wd) {
  const akunCol = await gatewayAccountsCol();
  const h = await akunCol.findOneAndUpdate(
    { token: wd.token, wdRefund: { $ne: wd.wdId } },
    { $inc: { balance: wd.amount }, $push: { wdRefund: { $each: [wd.wdId], $slice: -PANJANG_TANDA } } },
    { returnDocument: "after" }
  );
  if (h) {
    await catatMutasi({
      token: wd.token, jenis: "tarik_batal", amount: wd.amount,
      judul: `Penarikan ${wd.wdId} gagal — saldo kembali`, saldoSetelah: h.balance ?? null
    });
  } else if (!(await akunCol.findOne({ token: wd.token }, { projection: { _id: 1 } }))) {
    return { ok: false, saldo: null };
  }
  await (await gatewayWithdrawalsCol()).updateOne({ wdId: wd.wdId }, { $set: { refundOk: true } });
  return { ok: true, saldo: h?.balance ?? null, dikembalikan: Boolean(h) };
}

// ───────────────────────── PENUTUPAN ─────────────────────────
/**
 * Menutup penarikan jadi "done" atau "rejected". Idempoten: hanya satu pemanggil
 * yang lolos klaim `final`, jadi notifikasi dan pengembalian tidak berlipat.
 */
async function tutup(wdId, status, pesan = "") {
  const kol = await gatewayWithdrawalsCol();
  const wd = await kol.findOneAndUpdate(
    { wdId, final: { $ne: true }, status: { $in: ["baru", "dikirim", "proses", "tidak-pasti"] } },
    { $set: { status, alasan: String(pesan || "").slice(0, 200), final: true, selesaiAt: new Date(), updatedAt: new Date() } },
    { returnDocument: "after" }
  );
  if (!wd) return null;

  if (status === "done") {
    infoAdmin(wd, "✅ <b>PENARIKAN GATEWAY BERHASIL</b>");
    await kabariMerchantWd(wd, {
      judul: "✅ Penarikan berhasil",
      isi: `${rp(wd.diterima)} sudah dikirim ke ${wd.ewalletNama} ${wd.nomor}. (biaya ${rp(wd.biaya)})`
    });
    return wd;
  }

  let ok = false;
  try { ok = (await kembalikanSaldoWd(wd)).ok; } catch (e) { console.error("[gateway/wd] kembalikan:", e?.message || e); }
  infoAdmin(wd, "❌ <b>PENARIKAN GATEWAY GAGAL — SALDO DIKEMBALIKAN</b>", [`📝 ${esc(wd.alasan || "ditolak penyedia")}`]);
  await kabariMerchantWd(wd, {
    judul: "❌ Penarikan gagal",
    isi: `Penarikan ${rp(wd.diterima)} ke ${wd.ewalletNama} ${wd.nomor} tidak berhasil${wd.alasan ? ` (${String(wd.alasan).slice(0, 120)})` : ""}. Saldo gateway kamu sudah dikembalikan penuh, termasuk biayanya.${ok ? "" : " (pengembalian sedang diselesaikan sistem)"}`
  });
  return wd;
}

// ───────────────────────── PEMUTUS ARUS ─────────────────────────
async function pemutusArus(wd, alasan) {
  try {
    const kol = await gatewayWithdrawalsCol();
    await kol.updateOne({ wdId: wd.wdId }, { $set: { masalahProvider: true } });
    const n = await kol.countDocuments({ masalahProvider: true, createdAt: { $gte: new Date(Date.now() - 10 * MENIT) } });
    if (n < Math.max(1, Math.round(await cfgAngka("WD_PEMUTUS_MAKS", 4)))) return;
    if (!(await nyala("GW_WD_OTOMATIS"))) return;
    await simpanCfg("GW_WD_OTOMATIS", "0");
    await catatKejadian({ jenis: "gw-wd-dimatikan-otomatis", tingkat: "tinggi", detail: String(alasan).slice(0, 200) });
    await kabariAdmin(
      `🛑 <b>PENARIKAN OTOMATIS GATEWAY DIMATIKAN SENDIRI</b>\n${n} masalah AustinPay dalam 10 menit.\n📝 ${esc(alasan)}\n` +
      `Permintaan baru sekarang masuk antrean manual. Periksa AustinPay (saldo / IP whitelist / key), lalu nyalakan lagi di Dasbor Admin → Konfigurasi (GW_WD_OTOMATIS).`
    );
  } catch (e) {
    console.error("[gateway/wd] pemutus arus:", e?.message || e);
  }
}

// ───────────────────────── PENGIRIMAN ─────────────────────────
/** Mengirim satu penarikan berstatus "baru". Aman dipanggil berulang/bersamaan (klaim atomik). */
export async function jalankanWdGateway(wdId) {
  const kol = await gatewayWithdrawalsCol();
  const wd = await kol.findOneAndUpdate(
    { wdId, status: "baru" },
    { $set: { status: "dikirim", kirimAt: new Date(), updatedAt: new Date() } },
    { returnDocument: "after" }
  );
  if (!wd) return (await kol.findOne({ wdId })) || null;

  const akhir = async (status, pesan) => {
    await tutup(wdId, status, pesan);
    return kol.findOne({ wdId });
  };

  let produk;
  try {
    produk = await produkBebas(wd.ewalletNama);
  } catch (e) {
    return akhir("rejected", `Daftar produk AustinPay tidak bisa dibaca: ${e?.message || "gagal"}`);
  }
  if (!produk) return akhir("rejected", `${wd.ewalletNama} belum didukung untuk penarikan otomatis.`);
  if (wd.diterima < produk.min || wd.diterima > produk.max) {
    return akhir("rejected", `Nominal harus antara ${rp(produk.min)} – ${rp(produk.max)} untuk ${wd.ewalletNama}.`);
  }

  try {
    const r = await kirimInstan({ wallet: wd.ewalletNama, productCode: produk.code, phone: wd.nomor, nominal: wd.diterima });
    const st = normalisasiStatusInstan(r.status);
    await kol.updateOne({ wdId }, { $set: { providerId: r.id || null, kodeProduk: produk.code, pesanProvider: r.pesan || "", updatedAt: new Date() } });
    if (st === "sukses") return akhir("done");
    if (st === "gagal") return akhir("rejected", r.pesan || "ditolak penyedia");
    await kol.updateOne({ wdId }, { $set: { status: "proses" } });
    return kol.findOne({ wdId });
  } catch (err) {
    if (err?.ambigu) {
      await pemutusArus(wd, err.message);
      await kol.updateOne({ wdId }, { $set: { status: "tidak-pasti", pesanProvider: String(err.message).slice(0, 200), updatedAt: new Date() } });
      infoAdmin(wd, "⚠️ <b>PENARIKAN GATEWAY — HASIL BELUM PASTI</b>", [
        `📝 ${esc(err.message)}`,
        "Sistem mencocokkan ke riwayat AustinPay otomatis; saldo merchant TIDAK dikembalikan sebelum dipastikan."
      ]);
      return kol.findOne({ wdId });
    }
    const pesan = String(err?.message || "ditolak").slice(0, 200);
    if (err?.status === 401 || err?.status === 403 || err?.status >= 500 || /saldo/i.test(pesan)) await pemutusArus(wd, pesan);
    if (err?.status === 401 || err?.status === 403 || /saldo/i.test(pesan)) {
      infoAdmin(wd, "🚨 <b>AUSTINPAY MENOLAK PENARIKAN GATEWAY</b>", [
        `📝 ${esc(pesan)}`,
        err?.status === 403
          ? "IP server belum masuk whitelist AustinPay."
          : /saldo/i.test(pesan)
            ? "Saldo akun AustinPay kemungkinan habis — isi saldo AustinPay."
            : "Periksa API key / secret di Dasbor Admin → Konfigurasi."
      ]);
    }
    // Pesan teknis penyedia tidak ditampilkan ke merchant.
    return akhir(
      "rejected",
      err?.status === 403 || err?.status === 401
        ? "Layanan penarikan sedang gangguan, coba lagi nanti."
        : /saldo/i.test(pesan) ? "Layanan penarikan sedang penuh, coba lagi nanti." : pesan
    );
  }
}

/** Mencocokkan satu penarikan dengan riwayat AustinPay. */
export async function sinkronWdGateway(wd) {
  const kol = await gatewayWithdrawalsCol();
  if (!["proses", "tidak-pasti"].includes(wd.status)) return wd;
  let daftar;
  try { daftar = (await riwayatInstan({ page: 1, limit: 50 })).data; } catch { return wd; }

  let cocok = null;
  if (wd.providerId) {
    cocok = daftar.find((x) => x.id === wd.providerId);
  } else {
    const ids = daftar.map((x) => x.id);
    // Id yang sudah dipakai penarikan lain (gateway MAUPUN saldo nokos) tidak boleh dipakai dua kali.
    const dipakai = new Set([
      ...(await kol.find({ providerId: { $in: ids } }, { projection: { providerId: 1 } }).toArray()).map((d) => d.providerId),
      ...(await (await wdInstanCol()).find({ providerId: { $in: ids } }, { projection: { providerId: 1 } }).toArray()).map((d) => d.providerId)
    ]);
    const dari = new Date(wd.kirimAt || wd.createdAt).getTime() - 2 * MENIT;
    cocok = daftar.find(
      (x) => !dipakai.has(x.id) && x.wallet === wd.ewalletNama && bersihkanNomor(x.phone) === wd.nomor &&
        x.nominal === wd.diterima && new Date(x.createdAt).getTime() >= dari
    );
  }

  if (cocok) {
    const st = normalisasiStatusInstan(cocok.status);
    await kol.updateOne({ wdId: wd.wdId }, { $set: { providerId: cocok.id, pesanProvider: cocok.pesan || "", status: st === "proses" ? "proses" : wd.status, updatedAt: new Date() } });
    if (st === "sukses") await tutup(wd.wdId, "done");
    else if (st === "gagal") await tutup(wd.wdId, "rejected", cocok.pesan || "ditolak penyedia");
  } else if (wd.status === "tidak-pasti" && Date.now() - new Date(wd.kirimAt || wd.createdAt).getTime() > BATAS_TIDAK_PASTI_MS()) {
    // Tidak ada jejak di AustinPay setelah 10 menit → permintaan tidak pernah dieksekusi; aman dikembalikan.
    await tutup(wd.wdId, "rejected", "Tidak terkirim (tidak ada jejak di penyedia)");
  } else if (wd.status === "proses" && Date.now() - new Date(wd.kirimAt || wd.createdAt).getTime() > 30 * MENIT && !wd.dikabariLama) {
    await kol.updateOne({ wdId: wd.wdId }, { $set: { dikabariLama: true } });
    infoAdmin(wd, "⏳ <b>PENARIKAN GATEWAY MASIH DIPROSES > 30 MENIT</b>", ["Cek status di dashboard AustinPay."]);
  }
  return kol.findOne({ wdId: wd.wdId });
}

/** Penyapu: memulihkan yang macet. Dipanggil dari cron tick (dibatasi per instance). */
let sapuTerakhir = 0;
export async function sapuWdGateway({ maks = 15, jeda = 25_000 } = {}) {
  if (Date.now() - sapuTerakhir < jeda) return { dilewati: true };
  sapuTerakhir = Date.now();
  const kol = await gatewayWithdrawalsCol();
  const akunCol = await gatewayAccountsCol();
  let n = 0;

  // 1) "disiapkan" yang prosesnya mati: saldo sudah terpotong → lanjutkan; belum → buang.
  for (const wd of await kol.find({ status: "disiapkan", createdAt: { $lt: new Date(Date.now() - 2 * MENIT) } }).limit(maks).toArray()) {
    const terpotong = await akunCol.findOne({ token: wd.token, wdDebit: wd.wdId }, { projection: { _id: 1 } });
    if (terpotong) await kol.updateOne({ wdId: wd.wdId, status: "disiapkan" }, { $set: { status: wd.otomatis ? "baru" : "pending" } });
    else await kol.deleteOne({ wdId: wd.wdId, status: "disiapkan" });
    n++;
  }

  if (await austinConfigured()) {
    // 2) "baru" yang belum sempat dikirim; "dikirim" yang macet > 3 menit dianggap tidak pasti.
    for (const wd of await kol.find({ status: "baru", createdAt: { $lt: new Date(Date.now() - 1 * MENIT) } }).limit(maks).toArray()) {
      await jalankanWdGateway(wd.wdId);
      n++;
    }
    await kol.updateMany(
      { status: "dikirim", kirimAt: { $lt: new Date(Date.now() - 3 * MENIT) } },
      { $set: { status: "tidak-pasti", pesanProvider: "Proses terputus saat mengirim", updatedAt: new Date() } }
    );
    // 3) cocokkan yang berjalan / tidak pasti
    for (const wd of await kol.find({ status: { $in: ["proses", "tidak-pasti"] } }).sort({ createdAt: 1 }).limit(maks).toArray()) {
      await sinkronWdGateway(wd);
      n++;
    }
  }

  // 4) pengembalian yang belum tuntas
  for (const wd of await kol.find({ status: "rejected", final: true, refundOk: { $ne: true } }).limit(maks).toArray()) {
    try { await kembalikanSaldoWd(wd); } catch {}
    n++;
  }
  return { diproses: n };
}

// ───────────────────────── PENGAJUAN ─────────────────────────
/** Info untuk formulir penarikan di halaman gateway. */
export async function infoWdGateway() {
  const otomatis = await wdOtomatisAktif();
  return {
    otomatis,
    min: WD_MIN,
    maks: WD_MAX,
    biaya: BIAYA_WD,
    dompet: otomatis ? await daftarDompetOtomatis() : Object.values(EWALLET).map((e) => e.nama)
  };
}

/**
 * Menarik saldo gateway ke e-wallet.
 *
 * `amount` adalah nominal yang DITERIMA di e-wallet (minimal Rp10.000); biaya
 * Rp1.000 ditambahkan di atasnya dan ikut dipotong dari saldo gateway.
 */
export async function ajukanPenarikan({ token, amount, ewallet, nomor, atasNama, ip = null }) {
  const nominal = Math.round(Number(amount));
  if (!token) return gagal(400, "Kode akun kosong.");
  if (!Number.isFinite(nominal) || nominal < WD_MIN) return gagal(400, `Penarikan minimal ${rp(WD_MIN)} (yang diterima di e-wallet).`);
  if (nominal > WD_MAX) return gagal(400, `Penarikan maksimal ${rp(WD_MAX)} per transaksi.`);

  const otomatis = await wdOtomatisAktif();
  let dompet;
  let no;
  if (otomatis) {
    const daftar = await daftarDompetOtomatis();
    dompet = daftar.find((w) => w.toLowerCase() === String(ewallet || "").toLowerCase());
    if (!dompet) return gagal(400, `Pilih e-wallet tujuan: ${daftar.join(", ")}.`);
    no = bersihkanNomor(nomor);
    if (!/^08\d{8,12}$/.test(no)) return gagal(400, `Nomor ${dompet} tidak valid. Contoh: 08123456789`);
  } else {
    const kunci = Object.keys(EWALLET).find((k) => k === String(ewallet || "").toLowerCase() || EWALLET[k].nama.toLowerCase() === String(ewallet || "").toLowerCase());
    if (!kunci) return gagal(400, "E-wallet tujuan tidak dikenal.");
    no = bersihkanNomor(nomor);
    if (!ewalletValid(kunci, no)) return gagal(400, `Nomor ${EWALLET[kunci].nama} tidak valid. Contoh: ${EWALLET[kunci].contoh}`);
    dompet = EWALLET[kunci].nama;
  }
  const nama = String(atasNama || "").replace(/\s+/g, " ").trim();
  if (nama.length < 2) return gagal(400, "Nama pemilik e-wallet wajib diisi.");

  const akunCol = await gatewayAccountsCol();
  const akun = await akunCol.findOne({ token });
  if (!akun) return gagal(404, "Akun gateway tidak ditemukan.");
  if (akun.dibekukan) return gagal(403, "Akun gateway kamu sedang dibekukan admin.");

  const user = await (await usersCol()).findOne({ token }, { projection: { suspended: 1 } });
  if (user?.suspended) return gagal(403, "Akun ditangguhkan. Hubungi CS.");
  const gerbang = await periksaTransaksi(token);
  if (gerbang) return gagal(423, gerbang.error);

  const total = totalPenarikan(nominal);
  if ((akun.balance || 0) < total) {
    return gagal(400, `Saldo gateway tidak cukup. Dibutuhkan ${rp(total)} (nominal ${rp(nominal)} + biaya ${rp(BIAYA_WD)}).`);
  }

  const kol = await gatewayWithdrawalsCol();
  const awal = awalHariWib();
  const maksHari = Math.max(1, Math.round(await cfgAngka("GW_WD_MAKS_HARI", 10)));
  const hariIni = await kol.countDocuments({ token, createdAt: { $gte: awal }, status: { $ne: "rejected" } });
  if (hariIni >= maksHari) return gagal(429, `Batas penarikan ${maksHari}× per hari sudah tercapai. Coba lagi besok (reset 00.00 WIB).`);
  if ((await kol.countDocuments({ token, status: { $in: AKTIF } })) >= 2) {
    return gagal(429, "Masih ada penarikan yang sedang diproses. Tunggu selesai dulu.");
  }
  // Satu nomor e-wallet tidak boleh jadi tujuan banyak akun (pola akun ganda / pencucian uang).
  const akunPerNomor = Math.max(1, Math.round(await cfgAngka("WD_AKUN_PER_NOMOR", 2)));
  const akunLain = (await kol.distinct("token", {
    nomor: no, token: { $ne: token }, status: { $ne: "rejected" }, createdAt: { $gte: new Date(Date.now() - 30 * 86400_000) }
  })).length;
  if (akunLain >= akunPerNomor) {
    await catatKejadian({ jenis: "gw-wd-nomor-bersama", tingkat: "sedang", token, ip, detail: `nomor ${no.slice(0, 4)}•••${no.slice(-3)} dipakai ${akunLain + 1} akun` }).catch(() => {});
    return gagal(400, "Nomor e-wallet ini sudah dipakai akun lain untuk menarik. Hubungi CS bila ini milikmu.");
  }

  if (otomatis) {
    let produk = null;
    try { produk = await produkBebas(dompet); } catch {}
    if (!produk) return gagal(503, `${dompet} sedang tidak bisa dipakai untuk penarikan. Coba e-wallet lain atau tunggu sebentar.`);
    if (nominal < produk.min) return gagal(400, `Minimal ${rp(produk.min)} untuk ${dompet}.`);
    if (nominal > produk.max) return gagal(400, `Maksimal ${rp(produk.max)} untuk ${dompet}.`);
  }

  const wdId = idWd();
  const doc = {
    wdId, token,
    amount: total, biaya: BIAYA_WD, diterima: nominal,
    ewallet: dompet, ewalletNama: dompet, nomor: no, atasNama: nama.slice(0, 60),
    otomatis, status: "disiapkan", ip, createdAt: new Date()
  };
  await kol.insertOne(doc);

  // Saldo dipotong DI DALAM filter, bukan diperiksa lebih dulu: dua permintaan
  // serentak sama-sama melihat saldo cukup bila diperiksa dulu.
  const sesudah = await akunCol.findOneAndUpdate(
    { token, balance: { $gte: total }, dibekukan: { $ne: true }, wdDebit: { $ne: wdId } },
    { $inc: { balance: -total }, $push: { wdDebit: { $each: [wdId], $slice: -PANJANG_TANDA } } },
    { returnDocument: "after" }
  );
  if (!sesudah) {
    await kol.deleteOne({ wdId, status: "disiapkan" });
    return gagal(400, "Saldo gateway kamu tidak cukup.");
  }
  await kol.updateOne({ wdId, status: "disiapkan" }, { $set: { status: otomatis ? "baru" : "pending" } });
  await catatMutasi({ token, jenis: "tarik", amount: -total, judul: `Penarikan ke ${dompet}`, saldoSetelah: sesudah.balance });

  const baru = { ...doc, status: otomatis ? "baru" : "pending" };
  if (!otomatis) return { ok: true, penarikan: baru, saldo: sesudah.balance, otomatis: false };

  const hasil = await jalankanWdGateway(wdId).catch((e) => {
    console.error("[gateway/wd] kirim:", e?.message || e);
    return null;
  });
  return { ok: true, penarikan: hasil || baru, saldo: sesudah.balance, otomatis: true };
}

/** Saldo akun AustinPay (untuk peringatan admin): dipanggil dari cron, dibatasi sekali per 10 menit. */
let saldoDicek = 0;
let saldoDikabari = 0;
export async function cekSaldoAustinGateway() {
  if (Date.now() - saldoDicek < 10 * MENIT) return;
  saldoDicek = Date.now();
  const batas = Math.round(await cfgAngka("AUSTINPAY_SALDO_MIN", 200_000));
  if (!batas || !(await austinConfigured())) return;
  const a = await austinAkun();
  if (a.saldo < batas && Date.now() - saldoDikabari > 3 * 3600_000) {
    saldoDikabari = Date.now();
    await kabariAdmin(`🟠 <b>SALDO AUSTINPAY MENIPIS</b>\n💰 Sisa ${rp(a.saldo)} (batas peringatan ${rp(batas)})\nPenarikan otomatis merchant gateway akan gagal bila saldo habis.`);
  }
}
