// "Kabari saya kalau stok ada".
//
// Pembeli yang menemukan layanan kosong biasanya pergi dan tidak kembali.
// Permintaan pantau menyimpan niat itu, dan denyut cron (app/api/cron/tick)
// mengecek stoknya: begitu ada, pemintanya dikabari sekali (push web + bot
// Telegram) lalu permintaannya dinonaktifkan — bukan dikabari terus-menerus.
import { stokWatchCol } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { listCountries } from "@/lib/otpCatalog";
import { kirimPush } from "@/lib/webPush";
import { notifyBotUser } from "@/lib/shopBot";
import { rich } from "@/lib/rich";

const MAKS_AKTIF_PER_AKUN = 10;
const MAKS_KOMBINASI_PER_DENYUT = 25;
const BATAS_CEK_MS = 8000;
const KEDALUWARSA_MS = 30 * 24 * 3600 * 1000;

const kunciDari = (token, server, serviceId) => `${token}|${server}|${serviceId}`;
const rp = (n) => `Rp${Number(n || 0).toLocaleString("id-ID")}`;

/** Membuat/menghidupkan permintaan pantau. */
export async function pantauStok({ token, server = "rumahotp", serviceId, serviceName }) {
  const sid = String(serviceId || "").trim();
  const nama = String(serviceName || "").trim().slice(0, 60);
  const srv = String(server || "rumahotp").slice(0, 40);
  if (!token || !sid || !nama) return { ok: false, error: "Data layanan tidak lengkap." };

  const col = await stokWatchCol();
  const kunci = kunciDari(token, srv, sid);
  const ada = await col.findOne({ kunci });
  if (ada?.aktif) return { ok: true, sudahAda: true };

  if ((await col.countDocuments({ token, aktif: true })) >= MAKS_AKTIF_PER_AKUN) {
    return { ok: false, error: `Maksimal ${MAKS_AKTIF_PER_AKUN} layanan yang dipantau sekaligus.` };
  }
  await col.updateOne(
    { kunci },
    {
      $set: { token, server: srv, serviceId: sid, serviceName: nama, aktif: true, notifiedAt: null, updatedAt: new Date() },
      $setOnInsert: { kunci, createdAt: new Date() }
    },
    { upsert: true }
  );
  return { ok: true };
}

export async function batalkanPantau({ token, server = "rumahotp", serviceId }) {
  const col = await stokWatchCol();
  await col.updateOne({ kunci: kunciDari(token, server, String(serviceId)) }, { $set: { aktif: false, updatedAt: new Date() } });
  return { ok: true };
}

export async function daftarPantau(token) {
  const col = await stokWatchCol();
  const r = await col.find({ token, aktif: true }).sort({ createdAt: -1 }).limit(MAKS_AKTIF_PER_AKUN).toArray();
  return r.map((d) => ({ server: d.server, serviceId: d.serviceId, serviceName: d.serviceName, createdAt: d.createdAt }));
}

const denganBatas = (p, ms) =>
  Promise.race([p, new Promise((_, tolak) => setTimeout(() => tolak(new Error("waktu habis")), ms))]);

/**
 * Dipanggil tiap denyut cron. Mengecek stok tiap kombinasi (server, layanan)
 * yang punya peminta, dan mengabari mereka kalau sudah ada.
 * @returns {Promise<{dicek:number, tersedia:number, dikabari:number, galat:string[]}>}
 */
export async function periksaStokWatch() {
  const hasil = { dicek: 0, tersedia: 0, dikabari: 0, galat: [] };
  const col = await stokWatchCol();

  // Permintaan yang sudah sebulan tidak berhasil dihapus supaya daftarnya tidak menumpuk.
  await col.updateMany?.({ aktif: true, createdAt: { $lt: new Date(Date.now() - KEDALUWARSA_MS) } }, { $set: { aktif: false } });

  const semua = await col.find({ aktif: true }).limit(500).toArray();
  const kelompok = new Map();
  for (const d of semua) {
    const k = `${d.server}|${d.serviceId}`;
    if (!kelompok.has(k)) kelompok.set(k, []);
    kelompok.get(k).push(d);
  }
  if (!kelompok.size) return hasil;

  const settings = await getSettings();
  for (const [k, peminta] of [...kelompok].slice(0, MAKS_KOMBINASI_PER_DENYUT)) {
    const [server, serviceId] = k.split("|");
    hasil.dicek++;
    let negara;
    try {
      negara = await denganBatas(listCountries(settings, server, serviceId), BATAS_CEK_MS);
    } catch (err) {
      // Gagal mengecek BUKAN berarti stok ada: dilewati, dicoba lagi denyut berikutnya.
      hasil.galat.push(`${k}: ${err?.message || err}`);
      continue;
    }
    const tersedia = (negara || []).filter((c) => (c.pricelist || []).length > 0);
    if (!tersedia.length) continue;
    hasil.tersedia++;

    const termurah = Math.min(
      ...tersedia.flatMap((c) => c.pricelist.map((p) => Number(p.sell_price) || Infinity))
    );
    for (const d of peminta) {
      // Klaim atomik: dua denyut yang tumpang tindih tidak mengabari orang yang sama dua kali.
      const klaim = await col.findOneAndUpdate(
        { kunci: d.kunci, aktif: true },
        { $set: { aktif: false, notifiedAt: new Date() } }
      );
      if (!klaim) continue;
      hasil.dikabari++;
      await kabariStokAda({ ...d, harga: Number.isFinite(termurah) ? termurah : null, jumlahNegara: tersedia.length });
    }
  }
  return hasil;
}

export function stokAdaText({ serviceName, harga, jumlahNegara, server }) {
  return rich([
    { h2: "🔔 STOK SUDAH ADA!" },
    { h3: serviceName },
    {
      table: {
        rows: [
          ["🌍 Negara tersedia", `${jumlahNegara}`],
          ...(harga ? [["💵 Mulai dari", rp(harga)]] : [])
        ]
      }
    },
    { hr: true },
    { footer: "Stok bisa cepat habis lagi — ambil sekarang. Permintaan pantau ini sudah selesai." },
    { buttons: [[{ text: `🛒 Beli ${serviceName}`, callback_data: `rek:${server}:${String(serviceName).slice(0, 30)}`, style: "primary" }]] }
  ]);
}

async function kabariStokAda(d) {
  await kirimPush(d.token, {
    judul: `Stok ${d.serviceName} sudah ada 🔔`,
    isi: d.harga ? `Mulai dari ${rp(d.harga)}. Ketuk untuk membeli.` : "Ketuk untuk membeli sebelum habis lagi.",
    url: `/otp?q=${encodeURIComponent(d.serviceName)}`,
    tag: `stok-${d.serviceId}`
  });
  try {
    await notifyBotUser(d.token, stokAdaText(d));
  } catch (err) {
    console.error("[stokWatch] bot gagal:", err?.message || err);
  }
}
