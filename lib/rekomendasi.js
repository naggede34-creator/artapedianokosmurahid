// Saran "butuh nomor lain?" yang muncul sesudah OTP masuk.
//
// Sumbernya data sendiri: layanan yang paling sering BERHASIL dibeli orang
// sebulan terakhir, di luar layanan yang baru saja dipakai. Tidak ada aturan
// yang harus dirawat admin, dan daftarnya ikut bergeser sesuai tren.
import { DEFAULT_SERVER } from "@/lib/otpServers";
import { otpOrdersCol } from "@/lib/db";

const HARI = 30;
const TTL_MS = 10 * 60 * 1000;
let cache = { waktu: 0, daftar: [] };

async function layananTeratas() {
  if (Date.now() - cache.waktu < TTL_MS && cache.daftar.length) return cache.daftar;
  const orders = await otpOrdersCol();
  const sejak = new Date(Date.now() - HARI * 24 * 3600 * 1000);
  const baris = await orders
    .aggregate([
      { $match: { otpCode: { $exists: true, $nin: [null, ""] }, createdAt: { $gte: sejak }, serviceName: { $type: "string" } } },
      { $group: { _id: "$serviceName", jumlah: { $sum: 1 } } },
      { $sort: { jumlah: -1 } },
      { $limit: 12 }
    ])
    .toArray();
  cache = { waktu: Date.now(), daftar: baris.map((b) => String(b._id)).filter(Boolean) };
  return cache.daftar;
}

const sama = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();

// callback_data Telegram maksimal 64 byte: "rek:" + server + ":" + nama.
function potongNama(nama, sisaByte) {
  let out = "";
  for (const ch of nama) {
    if (Buffer.byteLength(out + ch) > sisaByte) break;
    out += ch;
  }
  return out;
}

/**
 * @returns {Promise<{nama:string, callback:string}[]>} paling banyak `batas` saran
 */
export async function rekomendasiLayanan({ serviceName, server = DEFAULT_SERVER, batas = 3 } = {}) {
  try {
    const daftar = await layananTeratas();
    const awal = `rek:${server}:`;
    return daftar
      .filter((n) => !sama(n, serviceName))
      .slice(0, batas)
      .map((nama) => ({ nama, callback: awal + potongNama(nama, 64 - Buffer.byteLength(awal)) }));
  } catch {
    // Saran hanya pemanis. Gagal mengambilnya tidak boleh menahan kode OTP.
    return [];
  }
}

export const _uji = { reset: () => { cache = { waktu: 0, daftar: [] }; } };
