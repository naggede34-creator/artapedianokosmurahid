// Penarikan INSTANT lewat AustinPay: saldo nokos → e-wallet, poin game → e-wallet, dan penarikan admin.
//
// ── URUTAN YANG MENJAGA UANG (jangan diubah tanpa memahami tiap langkah) ───────────────────────────────────
//   1. dokumen `wd_instan` dicatat dulu (status "disiapkan", saldoDipotong:false)
//   2. saldo/poin pengguna dipotong ATOMIK (satu pembaruan dokumen + kunci idempotensi) → status "baru"
//   3. barulah penyedia dipanggil (status "dikirim"); hasilnya:
//        sukses/proses → catat id penyedia; gagal tegas (ditolak) → kembalikan saldo sekali (idempoten)
//        HASIL TIDAK PASTI (timeout / putus / 5xx) → "tidak-pasti": TIDAK dikembalikan dulu, karena uangnya bisa saja
//        sudah terkirim. Penyapu mencocokkannya ke riwayat AustinPay (nomor+nominal+waktu); bila setelah 10 menit
//        benar-benar tidak ada, baru dikembalikan dan admin dikabari.
//   Penyapu (sapuWdInstan) memulihkan proses yang mati di tengah jalan tanpa pernah mengirim ganda atau menelan saldo.
import { pastikanDepositBalance } from "@/lib/saldoDeposit";
import { randomUUID } from "node:crypto";
import { usersCol, wdInstanCol, tarikPoinCol, userNotificationsCol } from "@/lib/db";
import { cfg, cfgAngka } from "@/lib/config";
import { logBalance } from "@/lib/ledger";
import { kirimPush } from "@/lib/webPush";
import { umumkan } from "@/lib/notifyHub";
import { notifyBotUser } from "@/lib/shopBot";
import { periksaTransaksi } from "@/lib/gerbangUang";
import { catatKejadian } from "@/lib/keamanan";
import { simpanCfg } from "@/lib/config";
import {
  austinConfigured, austinAkun, dompetInstan, produkBebas, kirimInstan, riwayatInstan, normalisasiStatusInstan
} from "@/lib/austinpay";

const rp = (n) => `Rp${Number(n || 0).toLocaleString("id-ID")}`;
const esc = (x) => String(x ?? "").replace(/[<>&]/g, "");
const PANJANG_TANDA = 300;
export const DOMPET_CADANGAN = ["DANA", "GoPay", "ShopeePay", "LinkAja", "iSaku", "Doku", "Kaspro", "AstraPay"];
const AKTIF_STATUS = ["disiapkan", "baru", "dikirim", "proses", "tidak-pasti"];
const MENIT = 60_000;
// Batas menunggu sebelum penarikan yang "tidak pasti" dianggap tidak pernah terkirim (menit). Bisa dipercepat lewat env untuk uji.
const BATAS_TIDAK_PASTI_MS = () => Math.max(0.01, Number(process.env.WD_TIDAK_PASTI_MENIT) || 10) * MENIT;

const nyala = async (nama, bawaan = "1") => String((await cfg(nama)) ?? bawaan) !== "0";
const awalHariWib = () => {
  const w = new Date(Date.now() + 7 * 3600_000);
  return new Date(Date.UTC(w.getUTCFullYear(), w.getUTCMonth(), w.getUTCDate()) - 7 * 3600_000);
};

export function bersihkanNomor(x) {
  let n = String(x || "").replace(/[^\d+]/g, "");
  if (n.startsWith("+62")) n = "0" + n.slice(3);
  else if (n.startsWith("62")) n = "0" + n.slice(2);
  return n.replace(/\D/g, "");
}

/** Wallet berbasis nomor HP yang didukung penarikan otomatis (dari AustinPay; cadangan bila API gagal). */
export async function daftarDompetOtomatis() {
  try {
    const d = await dompetInstan();
    const w = d.wallets.filter((x) => (d.tipe[x] || "phone") === "phone" && d.bebasNominal[x] !== false);
    if (w.length) return w;
  } catch {}
  return DOMPET_CADANGAN;
}

export async function konfigWdNokos() {
  return {
    aktif: await nyala("WD_NOKOS_AKTIF"),
    minRp: Math.max(1000, Math.round(await cfgAngka("WD_NOKOS_MIN_RP", 10000))),
    feeRp: Math.max(0, Math.round(await cfgAngka("WD_NOKOS_FEE_RP", 2000))),
    maksHari: Math.max(1, Math.round(await cfgAngka("WD_NOKOS_MAKS_HARI", 5))),
    maksRp: Math.max(1000, Math.round(await cfgAngka("WD_NOKOS_MAKS_RP", 1_000_000))),
    maksRpHari: Math.max(1000, Math.round(await cfgAngka("WD_NOKOS_MAKS_RP_HARI", 3_000_000))),
    akunPerNomor: Math.max(1, Math.round(await cfgAngka("WD_AKUN_PER_NOMOR", 2))),
    umurAkunJam: Math.max(0, await cfgAngka("WD_UMUR_AKUN_JAM", 1)),
    alertRp: Math.max(0, Math.round(await cfgAngka("WD_ALERT_RP", 500_000)))
  };
}

/** Penarikan otomatis tersedia untuk Poin Game? (saklar nyala + AustinPay terisi) */
export async function tarikGameOtomatis() {
  return (await nyala("GAME_TARIK_OTOMATIS")) && (await austinConfigured());
}

// ───────────────────────── NOTIFIKASI ─────────────────────────
async function kabariUser(wd, { judul, isi, url }) {
  if (!wd.token) return;
  try { await (await userNotificationsCol()).insertOne({ token: wd.token, type: "wd_otomatis", title: judul, body: isi, read: false, createdAt: new Date(), url: url || (wd.jenis === "setor" ? "/setor-gmail" : "/tarik"), meta: { wid: wd.wid } }); } catch {}
  await kirimPush(wd.token, { judul, isi, url: url || (wd.jenis === "setor" ? "/setor-gmail" : "/tarik"), tag: `wd-${wd.wid}` }).catch(() => {});
  try { await notifyBotUser(wd.token, `${judul}\n\n${isi}`); } catch {}
}
const namaJenis = (j) => ({ nokos: "SALDO NOKOS", game: "POIN GAME", setor: "SALDO STOR GMAIL", admin: "ADMIN" }[j] || j);
function kabariAdmin(wd, judul, ekstra = []) {
  umumkan({
    admin: [
      `${judul}`,
      `🧾 <code>${wd.wid}</code> · ${namaJenis(wd.jenis)}`,
      wd.nama ? `👤 ${esc(wd.nama)}` : "",
      `💸 Kirim <b>${rp(wd.nominal)}</b> → ${esc(wd.wallet)} <code>${esc(wd.nomor)}</code>${wd.fee ? ` (biaya ${rp(wd.fee)})` : ""}`,
      wd.providerId ? `🔖 ID AustinPay <code>${esc(wd.providerId)}</code>` : "",
      ...ekstra
    ].filter(Boolean).join("\n")
  });
}

// ───────────────────────── PENGEMBALIAN & PENYELESAIAN ─────────────────────────
async function kembalikanSaldo(wd) {
  if (wd.jenis === "admin") return true;
  const kol = await usersCol();
  const ref = `wd-batal:${wd.wid}`;
  if (wd.jenis === "nokos") {
    const hasField = wd.pakaiDepositBalance !== false;
    const h = await kol.findOneAndUpdate(
      { token: wd.token, wdBayar: { $ne: ref } },
      { $inc: { balance: wd.bayarRp, ...(hasField ? { depositBalance: wd.bayarRp } : {}), wdNokosTotal: -wd.nominal }, $push: { wdBayar: { $each: [ref], $slice: -PANJANG_TANDA } } },
      { returnDocument: "after" }
    );
    if (h) await logBalance({ token: wd.token, type: "wd_nokos_batal", amount: wd.bayarRp, balanceAfter: h.balance, title: `Penarikan ${wd.wid} gagal — saldo dikembalikan`, ref });
    else if (!(await kol.findOne({ token: wd.token }, { projection: { _id: 1 } }))) return false;
    return true;
  }
  if (wd.jenis === "setor") {
    const h = await kol.findOneAndUpdate(
      { token: wd.token, wdBayar: { $ne: ref } },
      { $inc: { saldoSetor: wd.bayarRp, wdSetorTotal: -wd.nominal }, $push: { wdBayar: { $each: [ref], $slice: -PANJANG_TANDA } } },
      { returnDocument: "after" }
    );
    if (h) await logBalance({ token: wd.token, type: "wd_setor_batal", amount: wd.bayarRp, balanceAfter: h.saldoSetor, title: `Penarikan ${wd.wid} gagal — saldo Stor dikembalikan`, ref, wallet: "setor" });
    else if (!(await kol.findOne({ token: wd.token }, { projection: { _id: 1 } }))) return false;
    return true;
  }
  if (wd.jenis === "game") {
    const { gagalkanTarikOtomatis } = await import("@/lib/game/dompet");
    return gagalkanTarikOtomatis(wd.ref, wd.pesan || "Penarikan otomatis gagal");
  }
  return true;
}

/** Idempoten: hanya satu pemanggil yang lolos klaim `final`. */
async function selesaikan(wid) {
  const kol = await wdInstanCol();
  const wd = await kol.findOneAndUpdate({ wid, final: { $ne: true }, status: { $in: ["sukses", "gagal"] } }, { $set: { final: true, finalAt: new Date() } }, { returnDocument: "after" });
  if (!wd) return;
  if (wd.status === "sukses") {
    if (wd.jenis === "game") {
      try { const { selesaiTarikOtomatis } = await import("@/lib/game/dompet"); await selesaiTarikOtomatis(wd.ref, wd.providerId || ""); } catch (e) { console.error("[wd] selesaiTarikOtomatis:", e?.message || e); }
    }
    kabariAdmin(wd, "✅ <b>PENARIKAN INSTANT BERHASIL</b>");
    await kabariUser(wd, { judul: "✅ Penarikan berhasil", isi: `${rp(wd.nominal)} sudah dikirim ke ${wd.wallet} ${wd.nomor}.${wd.fee ? ` (biaya admin ${rp(wd.fee)})` : ""}` });
    return;
  }
  // gagal → saldo/poin dikembalikan (idempoten). Bila pengembalian gagal, penyapu mengulang (refundOk belum true).
  let ok = false;
  try { ok = await kembalikanSaldo(wd); } catch (e) { console.error("[wd] kembalikan:", e?.message || e); }
  if (ok) await kol.updateOne({ wid }, { $set: { refundOk: true } });
  kabariAdmin(wd, "❌ <b>PENARIKAN INSTANT GAGAL — SALDO DIKEMBALIKAN</b>", [`📝 ${esc(wd.pesan || "ditolak penyedia")}`]);
  await kabariUser(wd, { judul: "❌ Penarikan gagal", isi: `Penarikan ${rp(wd.nominal)} ke ${wd.wallet} ${wd.nomor} tidak berhasil${wd.pesan ? ` (${String(wd.pesan).slice(0, 120)})` : ""}. ${wd.jenis === "game" ? "Poin" : "Saldo"} kamu sudah dikembalikan.` });
}

// ───────────────────────── PENGIRIMAN KE PENYEDIA ─────────────────────────
/**
 * Pemutus arus: bila penyedia bermasalah berulang kali (key/IP ditolak, saldo habis, galat server, hasil tidak pasti),
 * penarikan otomatis dimatikan sendiri agar pengguna tidak terus gagal & uang tidak menggantung. Admin menyalakannya lagi.
 */
async function pemutusArus(wd, alasan) {
  try {
    const kol = await wdInstanCol();
    await kol.updateOne({ wid: wd.wid }, { $set: { masalahProvider: true } });
    const n = await kol.countDocuments({ masalahProvider: true, createdAt: { $gte: new Date(Date.now() - 10 * MENIT) } });
    if (n < Math.max(1, Math.round(await cfgAngka("WD_PEMUTUS_MAKS", 4)))) return;
    if (!(await nyala("WD_NOKOS_AKTIF")) && !(await nyala("GAME_TARIK_OTOMATIS")) && !(await nyala("WD_SETOR_AKTIF"))) return; // sudah mati
    await simpanCfg("WD_NOKOS_AKTIF", "0");
    await simpanCfg("WD_SETOR_AKTIF", "0");
    await simpanCfg("GAME_TARIK_OTOMATIS", "0");
    await catatKejadian({ jenis: "wd-dimatikan-otomatis", tingkat: "tinggi", detail: String(alasan).slice(0, 200) });
    umumkan({ admin: `🛑 <b>PENARIKAN OTOMATIS DIMATIKAN SENDIRI</b>\n${n} masalah penyedia dalam 10 menit.\n📝 ${esc(alasan)}\nPeriksa panel AustinPay (saldo/IP whitelist/key), lalu nyalakan lagi di Dasbor Admin → AustinPay. Penarikan poin sementara masuk antrean manual.` });
  } catch (e) { console.error("[wd] pemutus arus:", e?.message || e); }
}

/** Mengirim satu penarikan yang sudah berstatus "baru". Aman dipanggil berulang/bersamaan (klaim atomik). */
export async function jalankanWd(wid) {
  const kol = await wdInstanCol();
  const wd = await kol.findOneAndUpdate({ wid, status: "baru" }, { $set: { status: "dikirim", kirimAt: new Date(), updatedAt: new Date() } }, { returnDocument: "after" });
  if (!wd) return (await kol.findOne({ wid })) || null;

  const akhir = async (set) => { await kol.updateOne({ wid }, { $set: { ...set, updatedAt: new Date() } }); await selesaikan(wid); return kol.findOne({ wid }); };

  let produk;
  try { produk = await produkBebas(wd.wallet); } catch (e) { return akhir({ status: "gagal", pesan: `Daftar produk AustinPay tidak bisa dibaca: ${e?.message || "gagal"}` }); }
  if (!produk) return akhir({ status: "gagal", pesan: `${wd.wallet} belum didukung untuk penarikan otomatis.` });
  if (wd.nominal < produk.min || wd.nominal > produk.max) return akhir({ status: "gagal", pesan: `Nominal harus antara ${rp(produk.min)} – ${rp(produk.max)} untuk ${wd.wallet}.` });

  try {
    const r = await kirimInstan({ wallet: wd.wallet, productCode: produk.code, phone: wd.nomor, nominal: wd.nominal });
    const st = normalisasiStatusInstan(r.status);
    await kol.updateOne({ wid }, { $set: { providerId: r.id || null, kodeProduk: produk.code, pesan: r.pesan || "", updatedAt: new Date() } });
    if (st === "sukses") return akhir({ status: "sukses" });
    if (st === "gagal") return akhir({ status: "gagal" });
    await kol.updateOne({ wid }, { $set: { status: "proses" } });
    return kol.findOne({ wid });
  } catch (err) {
    if (err?.ambigu) {
      await pemutusArus(wd, err.message);
      await kol.updateOne({ wid }, { $set: { status: "tidak-pasti", pesan: String(err.message).slice(0, 200), updatedAt: new Date() } });
      kabariAdmin(wd, "⚠️ <b>PENARIKAN INSTANT — HASIL BELUM PASTI</b>", [`📝 ${esc(err.message)}`, "Sistem mencocokkan ke riwayat AustinPay otomatis; saldo pengguna TIDAK dikembalikan sebelum dipastikan."]);
      return kol.findOne({ wid });
    }
    // Gagal tegas dari AustinPay (saldo tidak cukup, nomor ditolak, IP belum whitelist, dst.)
    const pesan = String(err?.message || "ditolak").slice(0, 200);
    if (err?.status === 401 || err?.status === 403 || err?.status >= 500 || /saldo/i.test(pesan)) await pemutusArus(wd, pesan);
    if (err?.status === 401 || err?.status === 403 || /saldo/i.test(pesan)) {
      kabariAdmin(wd, "🚨 <b>AUSTINPAY MENOLAK PENARIKAN</b>", [`📝 ${esc(pesan)}`, err?.status === 403 ? "IP server belum masuk whitelist AustinPay." : /saldo/i.test(pesan) ? "Saldo akun AustinPay kemungkinan habis — top up / deposit ke akun AustinPay." : "Periksa API key / secret di Dasbor Admin → Konfigurasi."]);
    }
    return akhir({ status: "gagal", pesan: err?.status === 403 ? "Layanan penarikan sedang gangguan, coba lagi nanti." : /saldo/i.test(pesan) ? "Layanan penarikan sedang penuh, coba lagi nanti." : pesan });
  }
}

/** Mencocokkan satu penarikan dengan riwayat AustinPay. Mengembalikan dokumen terbaru. */
export async function sinkronWd(wd) {
  const kol = await wdInstanCol();
  if (!["proses", "tidak-pasti"].includes(wd.status)) return wd;
  let daftar;
  try { daftar = (await riwayatInstan({ page: 1, limit: 50 })).data; } catch { return wd; }
  let cocok = null;
  if (wd.providerId) cocok = daftar.find((x) => x.id === wd.providerId);
  else {
    const dipakai = new Set((await kol.find({ providerId: { $in: daftar.map((x) => x.id) } }, { projection: { providerId: 1 } }).toArray()).map((d) => d.providerId));
    const dari = new Date(wd.kirimAt || wd.createdAt).getTime() - 2 * MENIT;
    cocok = daftar.find((x) => !dipakai.has(x.id) && x.wallet === wd.wallet && bersihkanNomor(x.phone) === wd.nomor && x.nominal === wd.nominal && new Date(x.createdAt).getTime() >= dari);
  }
  if (cocok) {
    const st = normalisasiStatusInstan(cocok.status);
    await kol.updateOne({ wid: wd.wid }, { $set: { providerId: cocok.id, pesan: cocok.pesan || wd.pesan || "", status: st === "sukses" ? "sukses" : st === "gagal" ? "gagal" : "proses", updatedAt: new Date() } });
    if (st !== "proses") await selesaikan(wd.wid);
  } else if (wd.status === "tidak-pasti" && Date.now() - new Date(wd.kirimAt || wd.createdAt).getTime() > BATAS_TIDAK_PASTI_MS()) {
    // Tidak ada jejak di AustinPay setelah 10 menit → permintaan tidak pernah dieksekusi; aman dikembalikan.
    await kol.updateOne({ wid: wd.wid }, { $set: { status: "gagal", pesan: "Tidak terkirim (tidak ada jejak di penyedia)", updatedAt: new Date() } });
    await selesaikan(wd.wid);
  } else if (wd.status === "proses" && Date.now() - new Date(wd.kirimAt || wd.createdAt).getTime() > 30 * MENIT && !wd.dikabariLama) {
    await kol.updateOne({ wid: wd.wid }, { $set: { dikabariLama: true } });
    kabariAdmin(wd, "⏳ <b>PENARIKAN INSTANT MASIH DIPROSES > 30 MENIT</b>", ["Cek status di dashboard AustinPay."]);
  }
  return kol.findOne({ wid: wd.wid });
}

/** Penyapu: memulihkan yang macet. Dipanggil dari cron tick & lalu lintas web (dibatasi per instance). */
let sapuTerakhir = 0;
export async function sapuWdInstan({ maks = 15, jeda = 25_000 } = {}) {
  if (Date.now() - sapuTerakhir < jeda) return { dilewati: true };
  sapuTerakhir = Date.now();
  if (!(await austinConfigured())) return { dilewati: true };
  const kol = await wdInstanCol();
  const kolU = await usersCol();
  let n = 0;
  // 1) "disiapkan" yang prosesnya mati: saldo sudah terpotong → lanjutkan; belum → buang.
  for (const wd of await kol.find({ status: "disiapkan", createdAt: { $lt: new Date(Date.now() - 2 * MENIT) } }).limit(maks).toArray()) {
    const potong = wd.jenis === "admin" ? false : wd.jenis === "game" ? true : !!(await kolU.findOne({ token: wd.token, wdBayar: `wd:${wd.wid}` }, { projection: { _id: 1 } }));
    if (potong) await kol.updateOne({ wid: wd.wid, status: "disiapkan" }, { $set: { status: "baru", saldoDipotong: true } });
    else await kol.deleteOne({ wid: wd.wid, status: "disiapkan" });
    n++;
  }
  // 2) "baru" yang belum sempat dikirim → kirim sekarang. "dikirim" yang macet (> 3 menit) → anggap tidak pasti.
  for (const wd of await kol.find({ status: "baru", createdAt: { $lt: new Date(Date.now() - 1 * MENIT) } }).limit(maks).toArray()) { await jalankanWd(wd.wid); n++; }
  await kol.updateMany({ status: "dikirim", kirimAt: { $lt: new Date(Date.now() - 3 * MENIT) } }, { $set: { status: "tidak-pasti", pesan: "Proses terputus saat mengirim", updatedAt: new Date() } });
  // 3) cocokkan yang berjalan / tidak pasti
  for (const wd of await kol.find({ status: { $in: ["proses", "tidak-pasti"] } }).sort({ createdAt: 1 }).limit(maks).toArray()) { await sinkronWd(wd); n++; }
  // 4) pengembalian yang belum tuntas
  for (const wd of await kol.find({ status: "gagal", final: true, refundOk: { $ne: true } }).limit(maks).toArray()) {
    try { if (await kembalikanSaldo(wd)) await kol.updateOne({ wid: wd.wid }, { $set: { refundOk: true } }); } catch {}
    n++;
  }
  await cekSaldoRendah().catch(() => {});
  return { diproses: n };
}

/** Kabari admin (maks 1× per 3 jam) bila saldo akun AustinPay menipis — penarikan otomatis akan gagal kalau habis. */
let saldoDicek = 0, saldoDikabari = 0;
async function cekSaldoRendah() {
  if (Date.now() - saldoDicek < 10 * MENIT) return;
  saldoDicek = Date.now();
  const batas = Math.round(await cfgAngka("AUSTINPAY_SALDO_MIN", 200_000));
  if (!batas) return;
  const a = await austinAkun();
  if (a.saldo < batas && Date.now() - saldoDikabari > 3 * 3600_000) {
    saldoDikabari = Date.now();
    umumkan({ admin: `🟠 <b>SALDO AUSTINPAY MENIPIS</b>\n💰 Sisa ${rp(a.saldo)} (batas peringatan ${rp(batas)})\nPenarikan otomatis pengguna akan gagal bila saldo habis — isi saldo AustinPay (deposit ke akun AustinPay).` });
  }
}

// ───────────────────────── PEMBUATAN: GAME ─────────────────────────
/** Dipanggil dompet.js SETELAH poin ditahan. Mengembalikan wid. */
export const idWdBaru = () => `W${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
export async function buatWdGame({ wid, token, tid, wallet, nomor, atasNama, nominal, fee, jumlah, nama, ip }) {
  const kol = await wdInstanCol();
  const sudah = await kol.findOne({ wid }, { projection: { _id: 1 } });
  if (sudah) return wid;
  await kol.insertOne({ wid, jenis: "game", token, ref: tid, nama: nama || "", wallet, nomor, atasNama, nominal, fee, bayarRp: jumlah, status: "baru", saldoDipotong: true, ip: ip || null, createdAt: new Date() });
  return wid;
}

// ───────────────────────── PEMBUATAN: SALDO NOKOS ─────────────────────────
/** Info untuk halaman Tarik Saldo. */
export async function infoWdNokos(token) {
  await pastikanDepositBalance(token);
  const k = await konfigWdNokos();
  const u = await (await usersCol()).findOne({ token }, { projection: { balance: 1, depositBalance: 1, depositTotal: 1, name: 1, createdAt: 1, joinedAt: 1, suspended: 1 } });
  if (!u) return null;
  const kol = await wdInstanCol();
  const awal = awalHariWib();
  const hariIni = await kol.find({ token, jenis: "nokos", createdAt: { $gte: awal }, status: { $ne: "gagal" } }, { projection: { nominal: 1 } }).toArray();
  const riwayat = await kol.find({ token, jenis: "nokos", status: { $ne: "disiapkan" } }).sort({ createdAt: -1 }).limit(15).toArray();
  return {
    aktif: k.aktif && (await austinConfigured()),
    saldo: u.balance || 0,
    dapatDitarik: dapatDitarik(u),
    minRp: k.minRp, feeRp: k.feeRp, maksHari: k.maksHari, maksRp: k.maksRp, maksRpHari: k.maksRpHari,
    sisaHariIni: Math.max(0, k.maksHari - hariIni.length),
    terpakaiRpHariIni: hariIni.reduce((a, b) => a + (b.nominal || 0), 0),
    dompet: await daftarDompetOtomatis(),
    riwayat: riwayat.map(publikWd)
  };
}

export const publikWd = (w) => ({ id: w.wid, jenis: w.jenis, wallet: w.wallet, nomor: w.nomor, nominal: w.nominal, fee: w.fee || 0, total: w.bayarRp || null, status: w.status, pesan: w.status === "gagal" ? w.pesan || "" : "", dibuat: w.createdAt, providerId: w.providerId || null });

/** Hanya saldo yang berasal dari DEPOSIT yang boleh ditarik (bonus/hadiah/saldo gratis tidak) — sama seperti transfer. */
export function dapatDitarik(u) {
  const bal = Number(u?.balance) || 0;
  if (u?.depositBalance !== undefined && u?.depositBalance !== null) return Math.max(0, Math.min(bal, Number(u.depositBalance) || 0));
  return Math.max(0, Math.min(bal, Number(u?.depositTotal) || 0));
}

export async function ajukanWdNokos(token, { wallet, nomor, atasNama, nominal }, { ip = null } = {}) {
  const k = await konfigWdNokos();
  if (!k.aktif) return { ok: false, alasan: "Penarikan saldo nokos sedang dinonaktifkan admin." };
  if (!(await austinConfigured())) return { ok: false, alasan: "Penarikan otomatis belum tersedia. Hubungi admin." };
  const daftar = await daftarDompetOtomatis();
  const dompet = daftar.find((w) => w.toLowerCase() === String(wallet || "").toLowerCase());
  if (!dompet) return { ok: false, alasan: `Pilih e-wallet tujuan: ${daftar.join(", ")}.` };
  const no = bersihkanNomor(nomor);
  if (!/^0\d{8,13}$/.test(no)) return { ok: false, alasan: "Nomor e-wallet harus diawali 0 dan 9–14 digit (contoh 081234567890)." };
  const nm = String(atasNama || "").replace(/\s+/g, " ").trim().slice(0, 60);
  const n = Math.floor(Number(nominal));
  if (!Number.isFinite(n) || n < k.minRp) return { ok: false, alasan: `Minimal penarikan ${rp(k.minRp)} (diterima).` };
  if (n > k.maksRp) return { ok: false, alasan: `Maksimal ${rp(k.maksRp)} per penarikan.` };
  const total = n + k.feeRp;

  await pastikanDepositBalance(token);
  const kolU = await usersCol();
  const u = await kolU.findOne({ token }, { projection: { balance: 1, depositBalance: 1, depositTotal: 1, name: 1, createdAt: 1, joinedAt: 1, suspended: 1, suspendReason: 1 } });
  if (!u) return { ok: false, alasan: "Akun tidak ditemukan." };
  if (u.suspended) return { ok: false, alasan: "Akun ditangguhkan. Hubungi CS." };
  const gerbangWd = await periksaTransaksi(token);
  if (gerbangWd) return { ok: false, alasan: gerbangWd.error };
  const lahir = u.createdAt || u.joinedAt;
  if (k.umurAkunJam > 0 && lahir && Date.now() - new Date(lahir).getTime() < k.umurAkunJam * 3600_000) {
    return { ok: false, alasan: `Akun baru bisa menarik ${k.umurAkunJam} jam setelah daftar. Coba lagi nanti.` };
  }
  if (!((Number(u.depositTotal) || 0) > 0)) return { ok: false, alasan: "Penarikan hanya untuk akun yang pernah deposit." };
  const bisa = dapatDitarik(u);
  if (total > bisa) {
    return { ok: false, alasan: (u.balance || 0) >= total ? `Hanya saldo hasil deposit yang bisa ditarik (maks ${rp(bisa)} saat ini). Saldo bonus/hadiah tidak bisa ditarik.` : `Saldo tidak cukup. Dibutuhkan ${rp(total)} (nominal ${rp(n)} + biaya ${rp(k.feeRp)}).` };
  }

  const kol = await wdInstanCol();
  const awal = awalHariWib();
  const hariIni = await kol.find({ token, jenis: "nokos", createdAt: { $gte: awal }, status: { $ne: "gagal" } }, { projection: { nominal: 1 } }).toArray();
  if (hariIni.length >= k.maksHari) return { ok: false, alasan: `Batas penarikan ${k.maksHari}× per hari sudah tercapai. Coba lagi besok (reset 00.00 WIB).` };
  if (hariIni.reduce((a, b) => a + (b.nominal || 0), 0) + n > k.maksRpHari) return { ok: false, alasan: `Batas total penarikan harian ${rp(k.maksRpHari)} akan terlampaui.` };
  if ((await kol.countDocuments({ token, jenis: "nokos", status: { $in: AKTIF_STATUS } })) >= 2) return { ok: false, alasan: "Masih ada penarikan yang sedang diproses. Tunggu selesai dulu." };
  // Satu nomor e-wallet tidak boleh jadi tujuan banyak akun (pola akun ganda / pencucian).
  const akunLain = (await kol.distinct("token", { jenis: "nokos", nomor: no, token: { $ne: token }, status: { $ne: "gagal" }, createdAt: { $gte: new Date(Date.now() - 30 * 86400_000) } })).length;
  if (akunLain >= k.akunPerNomor) {
    await catatKejadian({ jenis: "wd-nomor-bersama", tingkat: "sedang", token, ip, detail: `nomor ${no.slice(0, 4)}•••${no.slice(-3)} dipakai ${akunLain + 1} akun` });
    umumkan({ admin: `🟠 <b>WD DITOLAK — NOMOR DIPAKAI BANYAK AKUN</b>\n👤 ${esc(u.name || "—")}\n📱 ${esc(dompet)} <code>${no}</code> sudah dipakai ${akunLain} akun lain.` });
    return { ok: false, alasan: "Nomor e-wallet ini sudah dipakai akun lain untuk menarik. Hubungi CS bila ini milikmu." };
  }
  let produk = null;
  try { produk = await produkBebas(dompet); } catch {}
  if (!produk) return { ok: false, alasan: `${dompet} sedang tidak bisa dipakai untuk penarikan.` };
  if (n < produk.min) return { ok: false, alasan: `Minimal ${rp(produk.min)} untuk ${dompet}.` };

  const wid = idWdBaru();
  const hasField = u.depositBalance !== undefined && u.depositBalance !== null;
  // (cek di bawah dilakukan ULANG setelah dokumen masuk: dua permintaan serentak tidak bisa sama-sama lolos batas harian)
  await kol.insertOne({ wid, jenis: "nokos", token, nama: u.name || "", wallet: dompet, nomor: no, atasNama: nm, nominal: n, fee: k.feeRp, bayarRp: total, pakaiDepositBalance: hasField, status: "disiapkan", saldoDipotong: false, ip, createdAt: new Date() });
  const ref = `wd:${wid}`;
  const ikut = await kol.find({ token, jenis: "nokos", createdAt: { $gte: awal }, status: { $ne: "gagal" } }, { projection: { nominal: 1, status: 1, createdAt: 1, wid: 1 } }).sort({ createdAt: 1, wid: 1 }).toArray();
  const urut = ikut.findIndex((x) => x.wid === wid);
  const aktifN = ikut.filter((x) => AKTIF_STATUS.includes(x.status)).length;
  if (urut >= k.maksHari || ikut.slice(0, urut + 1).reduce((a, b) => a + (b.nominal || 0), 0) > k.maksRpHari || aktifN > 2) {
    await kol.deleteOne({ wid, status: "disiapkan" });
    return { ok: false, alasan: "Batas penarikan tercapai atau masih ada penarikan yang diproses. Coba beberapa saat lagi." };
  }
  const h = await kolU.findOneAndUpdate(
    hasField
      ? { token, suspended: { $ne: true }, balance: { $gte: total }, depositBalance: { $gte: total }, wdBayar: { $ne: ref } }
      : { token, suspended: { $ne: true }, balance: { $gte: total }, depositTotal: { $gte: total }, wdBayar: { $ne: ref } },
    { $inc: { balance: -total, ...(hasField ? { depositBalance: -total } : {}), wdNokosTotal: n }, $push: { wdBayar: { $each: [ref], $slice: -PANJANG_TANDA } } },
    { returnDocument: "after" }
  );
  if (!h) { await kol.deleteOne({ wid, status: "disiapkan" }); return { ok: false, alasan: "Saldo tidak cukup atau akun tidak bisa menarik." }; }
  await logBalance({ token, type: "wd_nokos", amount: -total, balanceAfter: h.balance, title: `Tarik ke ${dompet} ${no} (${rp(n)} + biaya ${rp(k.feeRp)})`, ref });
  await kol.updateOne({ wid, status: "disiapkan" }, { $set: { status: "baru", saldoDipotong: true } });

  kabariAdmin({ wid, jenis: "nokos", nama: u.name, wallet: dompet, nomor: no, nominal: n, fee: k.feeRp }, "💸 <b>PENARIKAN SALDO NOKOS DIAJUKAN</b>", [`💼 Sisa saldo nokos: ${rp(h.balance)}`]);
  if (k.alertRp && n >= k.alertRp) {
    await catatKejadian({ jenis: "wd-besar", tingkat: "sedang", token, ip, detail: `${rp(n)} → ${dompet}` });
    umumkan({ admin: `🟡 <b>PENARIKAN BESAR</b> ${rp(n)}\n👤 ${esc(u.name || "—")} <code>${esc(token.slice(0, 4))}••••${esc(token.slice(-4))}</code>\n🔖 <code>${wid}</code>` });
  }
  const hasil = await jalankanWd(wid);
  return { ok: true, wd: publikWd(hasil || { wid, status: "baru", wallet: dompet, nomor: no, nominal: n, fee: k.feeRp, createdAt: new Date() }), saldo: h.balance };
}

// ───────────────────────── PEMBUATAN: SALDO STOR GMAIL ─────────────────────────
export async function konfigWdSetor() {
  return {
    aktif: await nyala("WD_SETOR_AKTIF"),
    minRp: Math.max(1000, Math.round(await cfgAngka("WD_SETOR_MIN_RP", 10000))),
    feeRp: Math.max(0, Math.round(await cfgAngka("WD_SETOR_FEE_RP", 1000))),
    maksHari: Math.max(1, Math.round(await cfgAngka("WD_SETOR_MAKS_HARI", 5))),
    maksRp: Math.max(1000, Math.round(await cfgAngka("WD_SETOR_MAKS_RP", 1_000_000))),
    maksRpHari: Math.max(1000, Math.round(await cfgAngka("WD_NOKOS_MAKS_RP_HARI", 3_000_000))),
    akunPerNomor: Math.max(1, Math.round(await cfgAngka("WD_AKUN_PER_NOMOR", 2)))
  };
}

/** Info untuk bagian Tarik di halaman Stor Gmail. */
export async function infoWdSetor(token) {
  const k = await konfigWdSetor();
  const u = await (await usersCol()).findOne({ token }, { projection: { saldoSetor: 1 } });
  if (!u) return null;
  const kol = await wdInstanCol();
  const hariIni = await kol.find({ token, jenis: "setor", createdAt: { $gte: awalHariWib() }, status: { $ne: "gagal" } }, { projection: { nominal: 1 } }).toArray();
  const riwayat = await kol.find({ token, jenis: "setor", status: { $ne: "disiapkan" } }).sort({ createdAt: -1 }).limit(10).toArray();
  return {
    aktif: k.aktif && (await austinConfigured()),
    saldo: u.saldoSetor || 0,
    minRp: k.minRp, feeRp: k.feeRp, maksHari: k.maksHari, maksRp: k.maksRp,
    sisaHariIni: Math.max(0, k.maksHari - hariIni.length),
    dompet: await daftarDompetOtomatis(),
    riwayat: riwayat.map(publikWd)
  };
}

/** Tarik saldo Stor Gmail ke e-wallet. Urutan penjaga uang SAMA dengan saldo nokos: catat → potong atomik → kirim. */
export async function ajukanWdSetor(token, { wallet, nomor, atasNama, nominal }, { ip = null } = {}) {
  const k = await konfigWdSetor();
  if (!k.aktif) return { ok: false, alasan: "Penarikan saldo Stor sedang dinonaktifkan admin." };
  if (!(await austinConfigured())) return { ok: false, alasan: "Penarikan otomatis belum tersedia. Hubungi admin." };
  const daftar = await daftarDompetOtomatis();
  const dompet = daftar.find((w) => w.toLowerCase() === String(wallet || "").toLowerCase());
  if (!dompet) return { ok: false, alasan: `Pilih e-wallet tujuan: ${daftar.join(", ")}.` };
  const no = bersihkanNomor(nomor);
  if (!/^0\d{8,13}$/.test(no)) return { ok: false, alasan: "Nomor e-wallet harus diawali 0 dan 9–14 digit (contoh 081234567890)." };
  const nm = String(atasNama || "").replace(/\s+/g, " ").trim().slice(0, 60);
  const n = Math.floor(Number(nominal));
  if (!Number.isFinite(n) || n < k.minRp) return { ok: false, alasan: `Minimal penarikan ${rp(k.minRp)} (diterima).` };
  if (n > k.maksRp) return { ok: false, alasan: `Maksimal ${rp(k.maksRp)} per penarikan.` };
  const total = n + k.feeRp;

  const kolU = await usersCol();
  const u = await kolU.findOne({ token }, { projection: { saldoSetor: 1, name: 1, suspended: 1, setorSetuju: 1 } });
  if (!u) return { ok: false, alasan: "Akun tidak ditemukan." };
  if (u.suspended) return { ok: false, alasan: "Akun ditangguhkan. Hubungi CS." };
  { const g = await periksaTransaksi(token); if (g) return { ok: false, alasan: g.error }; }
  if (!u.setorSetuju) return { ok: false, alasan: "Setujui Syarat & Ketentuan Stor Gmail dulu." };
  if ((u.saldoSetor || 0) < total) return { ok: false, alasan: `Saldo Stor tidak cukup. Dibutuhkan ${rp(total)} (nominal ${rp(n)} + biaya ${rp(k.feeRp)}).` };

  const kol = await wdInstanCol();
  const awal = awalHariWib();
  const hariIni = await kol.find({ token, jenis: "setor", createdAt: { $gte: awal }, status: { $ne: "gagal" } }, { projection: { nominal: 1 } }).toArray();
  if (hariIni.length >= k.maksHari) return { ok: false, alasan: `Batas penarikan ${k.maksHari}× per hari sudah tercapai. Coba lagi besok (reset 00.00 WIB).` };
  if ((await kol.countDocuments({ token, jenis: "setor", status: { $in: AKTIF_STATUS } })) >= 2) return { ok: false, alasan: "Masih ada penarikan yang sedang diproses. Tunggu selesai dulu." };
  const akunLain = (await kol.distinct("token", { jenis: { $in: ["nokos", "setor"] }, nomor: no, token: { $ne: token }, status: { $ne: "gagal" }, createdAt: { $gte: new Date(Date.now() - 30 * 86400_000) } })).length;
  if (akunLain >= k.akunPerNomor) {
    await catatKejadian({ jenis: "wd-nomor-bersama", tingkat: "sedang", token, ip, detail: `(stor) nomor ${no.slice(0, 4)}•••${no.slice(-3)} dipakai ${akunLain + 1} akun` });
    return { ok: false, alasan: "Nomor e-wallet ini sudah dipakai akun lain untuk menarik. Hubungi CS bila ini milikmu." };
  }
  let produk = null;
  try { produk = await produkBebas(dompet); } catch {}
  if (!produk) return { ok: false, alasan: `${dompet} sedang tidak bisa dipakai untuk penarikan.` };
  if (n < produk.min) return { ok: false, alasan: `Minimal ${rp(produk.min)} untuk ${dompet}.` };

  const wid = idWdBaru();
  await kol.insertOne({ wid, jenis: "setor", token, nama: u.name || "", wallet: dompet, nomor: no, atasNama: nm, nominal: n, fee: k.feeRp, bayarRp: total, status: "disiapkan", saldoDipotong: false, ip, createdAt: new Date() });
  const ref = `wd:${wid}`;
  const ikut = await kol.find({ token, jenis: "setor", createdAt: { $gte: awal }, status: { $ne: "gagal" } }, { projection: { status: 1, createdAt: 1, wid: 1 } }).sort({ createdAt: 1, wid: 1 }).toArray();
  const urut = ikut.findIndex((x) => x.wid === wid);
  if (urut >= k.maksHari || ikut.filter((x) => AKTIF_STATUS.includes(x.status)).length > 2) {
    await kol.deleteOne({ wid, status: "disiapkan" });
    return { ok: false, alasan: "Batas penarikan tercapai atau masih ada penarikan yang diproses. Coba beberapa saat lagi." };
  }
  const h = await kolU.findOneAndUpdate(
    { token, suspended: { $ne: true }, saldoSetor: { $gte: total }, wdBayar: { $ne: ref } },
    { $inc: { saldoSetor: -total, wdSetorTotal: n }, $push: { wdBayar: { $each: [ref], $slice: -PANJANG_TANDA } } },
    { returnDocument: "after" }
  );
  if (!h) { await kol.deleteOne({ wid, status: "disiapkan" }); return { ok: false, alasan: "Saldo tidak cukup atau akun tidak bisa menarik." }; }
  await logBalance({ token, type: "wd_setor", amount: -total, balanceAfter: h.saldoSetor, title: `Tarik saldo Stor ke ${dompet} ${no} (${rp(n)} + biaya ${rp(k.feeRp)})`, ref, wallet: "setor" });
  await kol.updateOne({ wid, status: "disiapkan" }, { $set: { status: "baru", saldoDipotong: true } });
  kabariAdmin({ wid, jenis: "setor", nama: u.name, wallet: dompet, nomor: no, nominal: n, fee: k.feeRp }, "💸 <b>PENARIKAN SALDO STOR GMAIL DIAJUKAN</b>", [`💼 Sisa saldo Stor: ${rp(h.saldoSetor)}`]);
  const hasil = await jalankanWd(wid);
  return { ok: true, wd: publikWd(hasil || { wid, status: "baru", wallet: dompet, nomor: no, nominal: n, fee: k.feeRp, createdAt: new Date() }), saldo: h.saldoSetor };
}

// ───────────────────────── ADMIN ─────────────────────────
/** Penarikan saldo akun AustinPay milik admin ke e-wallet admin (tanpa memotong saldo pengguna mana pun). */
export async function adminTarikInstan({ wallet, nomor, nominal, catatan }) {
  const no = bersihkanNomor(nomor);
  if (!/^0\d{8,13}$/.test(no)) return { ok: false, alasan: "Nomor harus diawali 0 dan 9–14 digit." };
  const n = Math.floor(Number(nominal));
  if (!Number.isFinite(n) || n < 10000) return { ok: false, alasan: "Minimal Rp10.000." };
  const kol = await wdInstanCol();
  const wid = idWdBaru();
  await kol.insertOne({ wid, jenis: "admin", token: null, nama: "ADMIN", wallet: String(wallet), nomor: no, nominal: n, fee: 0, bayarRp: n, catatan: String(catatan || "").slice(0, 200), status: "baru", saldoDipotong: false, createdAt: new Date() });
  const hasil = await jalankanWd(wid);
  return { ok: true, wd: publikWd(hasil) };
}

export async function daftarWdAdmin({ status = "semua", jenis = "semua", limit = 50 } = {}) {
  const kol = await wdInstanCol();
  const f = {};
  if (status !== "semua") f.status = status;
  else f.status = { $ne: "disiapkan" };
  if (jenis !== "semua") f.jenis = jenis;
  const items = await kol.find(f).sort({ createdAt: -1 }).limit(Math.min(100, limit)).toArray();
  return items.map((w) => ({ ...publikWd(w), token: w.token ? `${w.token.slice(0, 4)}••••${w.token.slice(-4)}` : null, nama: w.nama || "", atasNama: w.atasNama || "", final: !!w.final, refundOk: !!w.refundOk, catatan: w.catatan || "" }));
}
