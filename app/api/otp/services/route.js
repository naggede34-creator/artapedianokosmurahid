import { NextResponse } from "next/server";
import { getServices } from "@/lib/rumahotp";
import { getSimuruPricelistCached } from "@/lib/simuru";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

function serverEnabled(settings, id) {
  const list = Array.isArray(settings.otpServers) ? settings.otpServers : [];
  return list.find((s) => s.id === id)?.enabled !== false;
}

// Daftar aplikasi untuk satu server. Bentuk item sengaja sama untuk kedua server
// (service_code, service_name, service_img) supaya UI-nya identik.
export async function GET(req) {
  const server = new URL(req.url).searchParams.get("server") || "rumahotp";
  try {
    const settings = await getSettings();

    if (server === "simuru") {
      if (!serverEnabled(settings, "simuru")) {
        return NextResponse.json({ error: "Server OTP Fast sedang dinonaktifkan admin." }, { status: 503 });
      }
      const rows = await getSimuruPricelistCached();
      // Satu baris per layanan (pricelist memuat satu baris per layanan × negara).
      const byService = new Map();
      for (const r of rows) {
        const code = String(r.service_id ?? "");
        if (!code || byService.has(code)) continue;
        byService.set(code, {
          service_code: code,
          service_name: r.service_name || code,
          service_img: null,
          server: "simuru"
        });
      }
      const items = Array.from(byService.values()).sort((a, b) => {
        const wa = (s) => (/whats\s*app/i.test(s.service_name) ? 0 : 1);
        return wa(a) - wa(b) || a.service_name.localeCompare(b.service_name, "id");
      });
      return NextResponse.json({ items });
    }

    if (!serverEnabled(settings, "rumahotp")) {
      return NextResponse.json({ error: "Server Nokos Murah sedang dinonaktifkan admin." }, { status: 503 });
    }
    const result = await getServices(process.env.RUMAHOTP_APIKEY);
    const list = result?.data || result?.services || result || [];
    const items = (Array.isArray(list) ? list : []).map((s) => ({ ...s, server: "rumahotp" }));
    return NextResponse.json({ items });
  } catch (err) {
    console.error("[otp/services]", err?.response?.data || err?.message || err);
    const msg = server === "simuru" ? err?.message : null;
    return NextResponse.json({ error: msg || "Gagal mengambil daftar layanan." }, { status: 502 });
  }
}
