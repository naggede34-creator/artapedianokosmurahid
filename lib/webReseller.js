// Web reseller: pengguna membuat web jualan sendiri (subdomain / tautan /r/nama) yang
// isinya sama dengan web utama, tetapi bermerek dan berharga sendiri.
//
// Uangnya:
//   • Pembeli membayar harga situs + markup web. Markup itulah komisi pemilik web.
//   • Komisi dicatat TERTUNDA saat pesanan dibuat, baru jadi milik pemilik saat kode OTP masuk
//     (selesai). Pesanan yang direfund menarik kembali komisinya (lib/resellerKomisi.js).
//   • Komisi yang selesai masuk ke dompet gateway pemilik (gateway_accounts.balance), sehingga
//     penarikannya memakai jalur penarikan otomatis AustinPay yang sudah teruji (lib/gatewayWd.js):
//     nominal ditarik penuh, biaya Rp1.000 dipotong dari nominal itu, minimal Rp11.000.
import { resellerWebCol, usersCol, resellerKomisiCol, gatewayAccountsCol, gatewayLedgerCol } from "@/lib/db";
import { cfg, cfgAngka } from "@/lib/config";
import { ambilAkun } from "@/lib/gateway";
import { ajukanPenarikan } from "@/lib/gatewayWd";
import { hargaResellerDari } from "@/lib/resellerKomisi";
import { SLUG_RE, RESERVED, bersihNama, awalWib, tglWib } from "@/lib/webResellerUi";

export { WD_MIN_WEB } from "@/lib/webResellerUi";
import { WD_MIN_WEB } from "@/lib/webResellerUi";

const gagal = (status, error) => ({ ok: false, status, error });
const PANJANG_TANDA = 500;

export async function rwAktif() {
  return String((await cfg("RW_AKTIF")) ?? "1") !== "0";
}
export async function rwMarkupMaks() {
  return Math.max(0, Math.min(500, await cfgAngka("RW_MARKUP_MAKS", 100)));
}

/** Domain induk subdomain: RW_DOMAIN_ROOT, atau host dari Site URL tanpa "www.". */
export async function rwDomainInduk(settings = null) {
  const x = String((await cfg("RW_DOMAIN_ROOT")) || "").trim().toLowerCase();
  if (x) return x;
  const dasar = settings?.siteUrl || process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "");
  try { return new URL(dasar.startsWith("http") ? dasar : `https://${dasar}`).host.replace(/^www\./, "").toLowerCase(); } catch { return ""; }
}

/** Bahan membentuk tautan: subdomain hanya dipakai bila admin mengisi RW_DOMAIN_ROOT (tanda wildcard sudah dipasang). */
export async function rwOpsiTautan(settings = null) {
  const eksplisit = String((await cfg("RW_DOMAIN_ROOT")) || "").trim().toLowerCase();
  const siteUrl = settings?.siteUrl || process.env.NEXT_PUBLIC_SITE_URL || "";
  return { induk: eksplisit || (await rwDomainInduk(settings)), siteUrl, subdomain: !!eksplisit };
}

/** Tautan web reseller: subdomain bila domain induk memang bisa wildcard, kalau tidak /r/nama di domain utama. */
export function urlWeb(slug, { induk = "", siteUrl = "", subdomain = true } = {}) {
  if (subdomain && induk && !/\.(vercel\.app|onrender\.com|netlify\.app|pages\.dev|workers\.dev)$/.test(induk)) return `https://${slug}.${induk}`;
  const dasar = String(siteUrl || (induk ? `https://${induk}` : "")).replace(/\/+$/, "");
  return `${dasar}/r/${slug}`;
}

// ───────────────────────── PENCARIAN (dengan cache pendek) ─────────────────────────
const cache = new Map(); // slug → { at, dok }
const UMUR = 15_000;
export function lupakanWeb(slug) { if (slug) cache.delete(slug); else cache.clear(); }

export async function webDariSlug(slug) {
  const s = String(slug || "").toLowerCase();
  if (!SLUG_RE.test(s)) return null;
  const c = cache.get(s);
  if (c && Date.now() - c.at < UMUR) return c.dok;
  const dok = (await (await resellerWebCol()).findOne({ slug: s })) || null;
  cache.set(s, { at: Date.now(), dok });
  if (cache.size > 500) cache.clear();
  return dok;
}

export async function webMilik(token) {
  if (!token) return null;
  return (await (await resellerWebCol()).findOne({ pemilik: token })) || null;
}

/** Web yang berlaku untuk pengunjung: ada, aktif, dan fiturnya dinyalakan admin. */
export async function webBerlaku(slug) {
  const w = await webDariSlug(slug);
  if (!w || w.aktif === false || w.dibekukan) return null;
  if (!(await rwAktif())) return null;
  return w;
}

// ───────────────────────── BUAT / UBAH ─────────────────────────
export async function buatWeb({ token, slug, nama, markupPersen, setuju }) {
  if (!(await rwAktif())) return gagal(403, "Fitur web reseller sedang dimatikan.");
  if (setuju !== true) return gagal(400, "Kamu harus menyetujui Syarat & Ketentuan Web Reseller dulu.");
  const user = await (await usersCol()).findOne({ token }, { projection: { suspended: 1, name: 1 } });
  if (!user) return gagal(404, "Kode akun tidak dikenali.");
  if (user.suspended) return gagal(403, "Akun kamu sedang ditangguhkan.");

  const s = String(slug || "").trim().toLowerCase();
  if (!SLUG_RE.test(s)) return gagal(400, "Nama web 3–24 karakter: huruf kecil, angka, dan tanda - (tidak di awal/akhir).");
  if (RESERVED.has(s)) return gagal(400, "Nama web ini tidak boleh dipakai. Pilih yang lain.");
  const merek = bersihNama(nama);
  if (merek.length < 2) return gagal(400, "Nama brand/merek web minimal 2 karakter.");
  const maks = await rwMarkupMaks();
  const m = Number(markupPersen);
  if (!Number.isFinite(m) || m < 0 || m > maks) return gagal(400, `Markup harus 0–${maks}%.`);

  const col = await resellerWebCol();
  if (await col.findOne({ pemilik: token }, { projection: { _id: 1 } })) return gagal(409, "Satu akun hanya bisa membuat satu web reseller.");

  const dok = {
    slug: s, pemilik: token, nama: merek, markupPersen: Math.round(m * 100) / 100,
    aktif: true, dibekukan: false, syaratSetujuAt: new Date(),
    kunjungan: 0, kunjunganHarian: {},
    komisiTertunda: 0, komisiTotal: 0, pesananTotal: 0, pesananSelesai: 0, omzet: 0,
    createdAt: new Date()
  };
  try {
    await col.insertOne(dok);
  } catch (e) {
    if (e?.code === 11000) {
      const adaMilik = await col.findOne({ pemilik: token }, { projection: { _id: 1 } });
      return adaMilik ? gagal(409, "Satu akun hanya bisa membuat satu web reseller.") : gagal(409, "Nama web itu sudah dipakai. Pilih nama lain.");
    }
    throw e;
  }
  lupakanWeb(s);
  // Dompet gateway disiapkan sekarang supaya komisi pertama langsung punya tempat masuk.
  await ambilAkun(token).catch(() => {});
  return { ok: true, web: dok };
}

export async function ubahWeb(token, { nama, markupPersen, aktif }) {
  const col = await resellerWebCol();
  const web = await col.findOne({ pemilik: token });
  if (!web) return gagal(404, "Kamu belum punya web reseller.");
  const set = {};
  if (nama !== undefined) {
    const merek = bersihNama(nama);
    if (merek.length < 2) return gagal(400, "Nama brand/merek web minimal 2 karakter.");
    set.nama = merek;
  }
  if (markupPersen !== undefined) {
    const maks = await rwMarkupMaks();
    const m = Number(markupPersen);
    if (!Number.isFinite(m) || m < 0 || m > maks) return gagal(400, `Markup harus 0–${maks}%.`);
    set.markupPersen = Math.round(m * 100) / 100;
  }
  if (aktif !== undefined) set.aktif = aktif === true;
  if (!Object.keys(set).length) return { ok: true, web };
  set.updatedAt = new Date();
  await col.updateOne({ pemilik: token }, { $set: set });
  lupakanWeb(web.slug);
  return { ok: true, web: { ...web, ...set } };
}

// ───────────────────────── HARGA ─────────────────────────
/** Harga jual di web reseller: markup di atas harga situs (sama dengan aturan bot reseller). */
export function hargaWeb(hargaSitus, web) {
  return hargaResellerDari(hargaSitus, Math.min(Number(web?.markupPersen) || 0, 500)).harga;
}

// ───────────────────────── KUNJUNGAN ─────────────────────────
export async function catatKunjungan(slug) {
  const w = await webDariSlug(slug);
  if (!w) return;
  const hari = tglWib(new Date()).replace(/-/g, "");
  await (await resellerWebCol()).updateOne({ slug: w.slug }, { $inc: { kunjungan: 1, [`kunjunganHarian.${hari}`]: 1 } }).catch(() => {});
}

// ───────────────────────── KOMISI (dipanggil resellerKomisi / resellerPaket) ─────────────────────────
export const adalahWebId = (botId) => String(botId || "").startsWith("web:");
const slugDariId = (botId) => String(botId).slice(4);

export async function komisiTertundaTambah(botId, nominal, hargaJual) {
  await (await resellerWebCol()).updateOne({ slug: slugDariId(botId) }, { $inc: { komisiTertunda: nominal, pesananTotal: 1 } });
  lupakanWeb(slugDariId(botId));
}

/** Komisi sebuah pesanan dibatalkan (refund). Bila sudah pernah dikreditkan ke dompet, ditarik dari dompet. */
export async function komisiTarik(log) {
  const slug = slugDariId(log.botId);
  const col = await resellerWebCol();
  if (log.selesai) {
    // Sudah jadi saldo: tarik dari dompet gateway SEKALI (penanda `komisiWebTarik`). Boleh menjadi minus: itu utang yang benar.
    const akunCol = await gatewayAccountsCol();
    const h = await akunCol.findOneAndUpdate(
      { token: log.pemilikToken, komisiWebTarik: { $ne: log.orderId } },
      { $inc: { balance: -log.komisi }, $push: { komisiWebTarik: { $each: [log.orderId], $slice: -PANJANG_TANDA } } },
      { returnDocument: "after" }
    );
    if (h) {
      await catatMutasi(log.pemilikToken, "komisi_web_batal", -log.komisi, `Komisi web ${slug} dibatalkan (pesanan ${log.orderId} direfund)`, h.balance);
      await col.updateOne({ slug }, { $inc: { komisiTotal: -log.komisi, pesananSelesai: -1, pesananTotal: -1, omzet: -(log.hargaJual || 0) } });
    }
  } else {
    await col.updateOne({ slug }, { $inc: { komisiTertunda: -log.komisi, pesananTotal: -1 } });
  }
  lupakanWeb(slug);
}

async function catatMutasi(token, jenis, amount, judul, saldoSetelah) {
  try { await (await gatewayLedgerCol()).insertOne({ token, jenis, invoiceId: null, amount, judul, saldoSetelah, createdAt: new Date() }); } catch (e) { console.error("[web-reseller] mutasi:", e?.message || e); }
}

/**
 * Kode OTP masuk → komisi jadi saldo pemilik. Urutan menjaga agar tidak pernah ganda maupun hilang:
 * kredit dompet dulu (idempoten lewat penanda `komisiWebKredit`), baru log ditandai selesai.
 * Dipanggil ulang dengan aman bila prosesnya mati di tengah.
 */
export async function komisiSelesai(log) {
  const slug = slugDariId(log.botId);
  await ambilAkun(log.pemilikToken);
  const akunCol = await gatewayAccountsCol();
  const h = await akunCol.findOneAndUpdate(
    { token: log.pemilikToken, komisiWebKredit: { $ne: log.orderId } },
    { $inc: { balance: log.komisi }, $push: { komisiWebKredit: { $each: [log.orderId], $slice: -PANJANG_TANDA } } },
    { returnDocument: "after" }
  );
  if (h) {
    await catatMutasi(log.pemilikToken, "komisi_web", log.komisi, `Komisi web ${slug} · ${log.serviceName || "nokos"}`, h.balance);
    // Statistik hanya bergerak bersama kredit yang BARU terjadi, jadi pengulangan tidak melipatgandakannya.
    await (await resellerWebCol()).updateOne(
      { slug },
      { $inc: { komisiTertunda: -log.komisi, komisiTotal: log.komisi, pesananSelesai: 1, omzet: log.hargaJual || 0 } }
    );
  }
  lupakanWeb(slug);
}

// ───────────────────────── PENARIKAN ─────────────────────────
/** Menarik komisi ke e-wallet lewat AustinPay (jalur gatewayWd). Minimal Rp11.000, biaya Rp1.000 dipotong dari nominal. */
export async function tarikKomisiWeb({ token, amount, ewallet, nomor, atasNama, ip = null }) {
  const web = await webMilik(token);
  if (!web) return gagal(404, "Kamu belum punya web reseller.");
  const n = Math.round(Number(amount));
  if (!Number.isFinite(n) || n < WD_MIN_WEB) return gagal(400, `Penarikan minimal Rp${WD_MIN_WEB.toLocaleString("id-ID")}.`);
  return ajukanPenarikan({ token, amount: n, ewallet, nomor, atasNama, ip });
}

// ───────────────────────── STATISTIK ─────────────────────────
export async function statistikWeb(web) {
  const botId = `web:${web.slug}`;
  const kol = await resellerKomisiCol();
  const sejak = new Date(awalWib(new Date()).getTime() - 13 * 86400_000);
  const baris = await kol.find({ botId, createdAt: { $gte: sejak }, ditarik: { $ne: true } }).toArray();
  const hari = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(awalWib(new Date()).getTime() - i * 86400_000);
    hari.push({ tanggal: tglWib(d), pesanan: 0, komisi: 0, kunjungan: 0 });
  }
  const idx = new Map(hari.map((h, i) => [h.tanggal, i]));
  for (const b of baris) {
    const t = tglWib(new Date(b.createdAt));
    const i = idx.get(t);
    if (i != null) { hari[i].pesanan += 1; hari[i].komisi += Number(b.komisi) || 0; }
  }
  for (const h of hari) h.kunjungan = Number(web.kunjunganHarian?.[h.tanggal.replace(/-/g, "")]) || 0;
  const terbaru = (await kol.find({ botId, ditarik: { $ne: true } }).sort({ createdAt: -1 }).limit(10).toArray()).map((b) => ({
    layanan: b.serviceName || "-", negara: b.countryName || "-", harga: b.hargaJual, komisi: b.komisi, selesai: !!b.selesai, waktu: b.createdAt
  }));
  const akun = await (await gatewayAccountsCol()).findOne({ token: web.pemilik }, { projection: { balance: 1 } });
  return {
    kunjungan: web.kunjungan || 0,
    pesananTotal: Math.max(0, web.pesananTotal || 0),
    pesananSelesai: Math.max(0, web.pesananSelesai || 0),
    omzet: Math.max(0, web.omzet || 0),
    komisiTertunda: Math.max(0, web.komisiTertunda || 0),
    komisiTotal: Math.max(0, web.komisiTotal || 0),
    saldo: Number(akun?.balance) || 0,
    hari,
    terbaru
  };
}

export const publikWeb = (w, tautan) => ({
  slug: w.slug, nama: w.nama, markupPersen: w.markupPersen, aktif: w.aktif !== false, dibekukan: !!w.dibekukan, tautan, createdAt: w.createdAt
});
