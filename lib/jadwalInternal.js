// Penjadwal internal: memanggil rute /api/cron/* milik server ini sendiri lewat
// localhost, dengan rahasia cron yang sah (dari dasbor admin atau env).
// Aktif hanya kalau INTERNAL_CRON=1 (render.yaml sudah mengisinya).
//
// Jadwal sama dengan vercel.json, ditambah tick tiap menit dan cleanup tiap 5 menit.
// CATATAN: kalau layanan tidur (paket gratis Render tidur setelah 15 menit tanpa
// trafik), jadwal ikut berhenti. Tugas harian yang jamnya terlewat saat tidur
// tidak dikejar. Untuk selalu hidup: paket berbayar, atau ping /api/cron/tick
// tiap menit dari cron-job.org / UptimeRobot.
import { rahasiaCronUtama } from "@/lib/cronAuth";

// [jalur, tiap berapa menit] atau [jalur, "HH:MM" UTC, sekali sehari]
const TUGAS = [
  ["/api/cron/tick", 1],
  ["/api/cron/cleanup", 5],
  ["/api/cron/security-scan", 10],
  ["/api/cron/stock-report", "01:00"],
  ["/api/cron/weekly-leaderboard", "03:00"],
  ["/api/cron/backup", "19:20"]
];

const S = (globalThis.__artaJadwal ||= { mulai: false, jalan: new Set(), terakhir: {} });

export function jatuhTempo(tugas, menitKe, hhmm, hariKey) {
  const [jalur, aturan] = tugas;
  if (typeof aturan === "number") return menitKe % aturan === 0 && S.terakhir[jalur] !== `m${menitKe}`;
  return aturan === hhmm && S.terakhir[jalur] !== `d${hariKey}`;
}

async function panggil(jalur) {
  if (S.jalan.has(jalur)) return; // jangan menumpuk kalau yang sebelumnya belum selesai
  S.jalan.add(jalur);
  try {
    const rahasia = await rahasiaCronUtama();
    const port = process.env.PORT || 3000;
    const r = await fetch(`http://127.0.0.1:${port}${jalur}`, {
      headers: rahasia ? { authorization: `Bearer ${rahasia}` } : {},
      signal: AbortSignal.timeout(280_000)
    });
    if (!r.ok) console.error(`[jadwal] ${jalur} → HTTP ${r.status}`);
  } catch (err) {
    console.error(`[jadwal] ${jalur} gagal:`, err?.message || err);
  } finally {
    S.jalan.delete(jalur);
  }
}

export function mulaiJadwalInternal() {
  if (S.mulai) return;
  S.mulai = true;
  console.log("[jadwal] penjadwal internal aktif");
  setInterval(() => {
    const now = new Date();
    const menitKe = Math.floor(now.getTime() / 60_000);
    const hhmm = now.toISOString().slice(11, 16);
    const hariKey = now.toISOString().slice(0, 10);
    for (const t of TUGAS) {
      if (!jatuhTempo(t, menitKe, hhmm, hariKey)) continue;
      S.terakhir[t[0]] = typeof t[1] === "number" ? `m${menitKe}` : `d${hariKey}`;
      panggil(t[0]);
    }
  }, 20_000).unref?.();
}
