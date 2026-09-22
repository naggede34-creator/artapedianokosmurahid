// Laporan stok & harga nokos untuk dikirim ke channel Telegram.
//
// Satu baris = satu layanan pada satu server, berisi harga jual termurah
// (sudah termasuk markup server yang diatur admin) dan sisa stok untuk
// nomor Indonesia. Semua provider dipanggil paralel dan kegagalan satu
// provider tidak menggagalkan laporan.
import { getCountries } from "@/lib/rumahotp";
import { getRuangOtpCountries, isRuangOtpServer, ruangOtpConfigured } from "@/lib/ruangotp";
import { getDibananaPrices, dibananaConfigured } from "@/lib/dibanana";
import { OTP_SERVERS } from "@/lib/otpServers";
import { markupForServer } from "@/lib/settings";

// Layanan yang dilaporkan kalau admin belum menentukan daftarnya sendiri.
export const DEFAULT_REPORT_SERVICES = ["wa", "tg", "gojek", "shopee", "dana", "grab"];

function markupFn(settings, serverId) {
  const pct = markupForServer(settings, serverId);
  return (n) => Math.ceil(Number(n || 0) * (1 + pct / 100));
}

// Ambil baris termurah dari sekumpulan { price, stock }.
function cheapest(rows) {
  const valid = rows.filter((r) => Number(r.price) > 0);
  if (!valid.length) return null;
  return valid.reduce((a, b) => (Number(a.price) <= Number(b.price) ? a : b));
}

function sumStock(rows) {
  let total = 0;
  let known = false;
  for (const r of rows) {
    const n = Number(r.stock);
    if (Number.isFinite(n) && n >= 0) {
      total += n;
      known = true;
    }
  }
  return known ? total : null;
}

async function rumahotpRow(settings, service) {
  if (!process.env.RUMAHOTP_APIKEY) return null;
  const markup = markupFn(settings, "rumahotp");
  const result = await getCountries(process.env.RUMAHOTP_APIKEY, service);
  const list = result?.data || result || [];
  // RumahOTP mengembalikan semua negara; laporan fokus ke Indonesia.
  const id = (Array.isArray(list) ? list : []).find((c) =>
    /indonesia/i.test(c.name || "") || String(c.iso || "").toLowerCase() === "id"
  );
  if (!id) return null;
  const rows = (id.pricelist || []).map((p) => ({ price: Number(p.price || 0), stock: p.stock ?? null }));
  const best = cheapest(rows);
  if (!best) return null;
  return { server: "rumahotp", price: markup(best.price), stock: sumStock(rows) };
}

async function ruangOtpRow(settings, service, serverId) {
  if (!ruangOtpConfigured()) return null;
  const markup = markupFn(settings, serverId);
  const rows = await getRuangOtpCountries(serverId, service);
  // Laporan fokus ke nomor Indonesia, sama seperti provider lain.
  const id = rows.find((c) => /indonesia/i.test(c.name || ""));
  if (!id) return null;
  const usable = id.pricelist.filter((p) => p.stock === null || p.stock > 0);
  const best = cheapest(usable);
  if (!best) return null;
  return { server: serverId, price: markup(best.price), stock: sumStock(usable) };
}

async function dibananaRow(settings, service) {
  if (!dibananaConfigured()) return null;
  const markup = markupFn(settings, "dibanana");
  const list = await getDibananaPrices({ service, country: "id" });
  const rows = list
    .filter((p) => Number(p.stock) !== 0)
    .map((p) => ({ price: Number(p.price_idr || 0), stock: p.stock ?? null }));
  const best = cheapest(rows);
  if (!best) return null;
  return { server: "dibanana", price: markup(best.price), stock: sumStock(rows) };
}

// Bangun laporan. settings wajib diberikan supaya markup per server ikut terpakai.
export async function buildStockReport(settings, services = DEFAULT_REPORT_SERVICES) {
  const enabled = new Set(
    (Array.isArray(settings?.otpServers) ? settings.otpServers : [])
      .filter((s) => s.enabled !== false)
      .map((s) => s.id)
  );
  const activeServers = OTP_SERVERS.filter((s) => enabled.size === 0 || enabled.has(s.key));

  const jobs = [];
  for (const service of services) {
    for (const srv of activeServers) {
      jobs.push(
        (async () => {
          if (srv.key === "rumahotp") return rumahotpRow(settings, service);
          if (srv.key === "dibanana") return dibananaRow(settings, service);
          if (isRuangOtpServer(srv.key)) return ruangOtpRow(settings, service, srv.key);
          return null;
        })()
          .then((row) => (row ? { ...row, service } : null))
          .catch(() => null)
      );
    }
  }

  const settled = await Promise.all(jobs);
  const byService = new Map();
  for (const row of settled) {
    if (!row) continue;
    if (!byService.has(row.service)) byService.set(row.service, []);
    byService.get(row.service).push(row);
  }

  return services
    .filter((s) => byService.has(s))
    .map((service) => ({
      service,
      rows: byService.get(service).sort((a, b) => a.price - b.price)
    }));
}
