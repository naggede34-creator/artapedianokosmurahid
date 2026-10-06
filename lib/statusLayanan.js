// Status layanan PUBLIK (/status): dihitung dari kejadian nyata 60 menit terakhir — tanpa nama penyedia, tanpa data pengguna.
//   normal  : lancar / belum ada gangguan terdeteksi     kurang : sebagian gagal     gangguan : sebagian besar gagal
//   tutup   : dimatikan admin / di luar jam layanan      darurat: mode baca-saja darurat
import { DEFAULT_SERVER } from "@/lib/otpServers";
import { getSettings, manualDepositReady, manualDepositHours } from "@/lib/settings";
import { otpOrdersCol, wdInstanCol, depositRuteLogCol } from "@/lib/db";
import { OTP_SERVERS } from "@/lib/otpServers";
import { bacaSajaAktif } from "@/lib/gerbangUang";

const JENDELA_MS = 60 * 60 * 1000;
const MIN_DATA = 4; // di bawah ini terlalu sedikit untuk menilai → dianggap normal

export function tingkat(sukses, gagal) {
  const n = sukses + gagal;
  if (n < MIN_DATA) return { status: "normal", n };
  const rasio = sukses / n;
  return { status: rasio >= 0.7 ? "normal" : rasio >= 0.4 ? "kurang" : "gangguan", n, persen: Math.round(rasio * 100) };
}

let cache = null;
export async function statusLayanan() {
  if (cache && Date.now() - cache.t < 30000) return cache.v;
  const sejak = new Date(Date.now() - JENDELA_MS);
  const s = await getSettings();
  const darurat = await bacaSajaAktif();
  const layanan = [];

  // Deposit QRIS (gabungan semua jalur) — dari percobaan rute; tanpa nama penyedia.
  try {
    const rows = await (await depositRuteLogCol()).find({ at: { $gte: sejak } }, { projection: { ok: 1 } }).limit(3000).toArray();
    const t = tingkat(rows.filter((r) => r.ok).length, rows.filter((r) => !r.ok).length);
    layanan.push({ id: "deposit", nama: "Deposit QRIS", ikon: "💳", ...t });
  } catch { layanan.push({ id: "deposit", nama: "Deposit QRIS", ikon: "💳", status: "normal", n: 0 }); }

  if (s.depositProviders?.manual && manualDepositReady(s)) {
    const jam = manualDepositHours(s);
    layanan.push({ id: "manual", nama: "QRIS Manual", ikon: "🧾", status: jam.open ? "normal" : "tutup", ket: jam.open ? "" : `Buka lagi pukul ${String(jam.openHour).padStart(2, "0")}.00 WIB`, n: 0 });
  }

  // Nokos per server — dari pesanan yang sudah selesai (berhasil vs kedaluwarsa/dibatalkan tanpa kode).
  try {
    const rows = await (await otpOrdersCol()).find({ createdAt: { $gte: sejak }, status: { $in: ["done", "expired", "canceled", "cancelled", "refund", "refunded"] } }, { projection: { server: 1, status: 1, otpCode: 1 } }).limit(5000).toArray();
    for (const srv of s.otpServers || OTP_SERVERS.map((x) => ({ id: x.key, enabled: true }))) {
      const info = OTP_SERVERS.find((x) => x.key === (srv.id || srv.key));
      if (!info) continue;
      if (srv.enabled === false) { layanan.push({ id: info.key, nama: info.name, ikon: "📱", status: "tutup", ket: "Sedang ditutup", n: 0 }); continue; }
      const mine = rows.filter((r) => (r.server || DEFAULT_SERVER) === info.key);
      const ok = mine.filter((r) => r.status === "done" || r.otpCode).length;
      layanan.push({ id: info.key, nama: info.name, ikon: "📱", ...tingkat(ok, mine.length - ok) });
    }
  } catch { /* abaikan */ }

  // Penarikan otomatis.
  try {
    const rows = await (await wdInstanCol()).find({ createdAt: { $gte: sejak }, status: { $in: ["sukses", "gagal"] } }, { projection: { status: 1 } }).limit(3000).toArray();
    layanan.push({ id: "tarik", nama: "Penarikan saldo", ikon: "🏧", ...tingkat(rows.filter((r) => r.status === "sukses").length, rows.filter((r) => r.status === "gagal").length) });
  } catch { /* abaikan */ }

  const semua = layanan.map((l) => l.status);
  const umum = s.maintenance ? "maintenance" : darurat ? "darurat" : semua.includes("gangguan") ? "gangguan" : semua.includes("kurang") ? "kurang" : "normal";
  const v = { umum, maintenance: !!s.maintenance, darurat, layanan, diperbarui: new Date().toISOString(), jendelaMenit: 60 };
  cache = { t: Date.now(), v };
  return v;
}
