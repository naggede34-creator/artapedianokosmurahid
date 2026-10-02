// Tingkat OTP masuk yang DIUKUR dari pesanan di toko ini (bukan klaim penyedia): per server + layanan + negara, 14 hari terakhir.
//   sukses = status "done"/ada kode OTP; gagal = kedaluwarsa/dibatalkan tanpa kode. Pesanan yang masih berjalan tidak dihitung.
// Hanya dipakai bila ≥ MIN_ORDER pesanan selesai, supaya persentase dari 1–2 order tidak menyesatkan.
import { otpOrdersCol } from "@/lib/db";

const HARI = 14;
const MIN_ORDER = 5;
const cache = new Map(); // `${server}|${serviceId}` → { t, peta }

export async function rateSendiri(server, serviceId) {
  const kunci = `${server}|${serviceId}`;
  const c = cache.get(kunci);
  if (c && Date.now() - c.t < 60000) return c.peta;
  const peta = {};
  try {
    const col = await otpOrdersCol();
    const rows = await col
      .find({ server, serviceId: String(serviceId), createdAt: { $gte: new Date(Date.now() - HARI * 86400000) }, status: { $in: ["done", "expired", "canceled", "cancelled", "refund", "refunded"] } }, { projection: { countryName: 1, status: 1, otpCode: 1 } })
      .limit(4000).toArray();
    const agg = {};
    for (const r of rows) {
      const k = String(r.countryName || "").toLowerCase();
      if (!k) continue;
      const a = (agg[k] ||= { ok: 0, n: 0 });
      a.n++;
      if (r.status === "done" || r.otpCode) a.ok++;
    }
    for (const [k, a] of Object.entries(agg)) if (a.n >= MIN_ORDER) peta[k] = { persen: Math.round((a.ok / a.n) * 100), n: a.n };
  } catch { /* data ukur hanya pelengkap */ }
  cache.set(kunci, { t: Date.now(), peta });
  return peta;
}
