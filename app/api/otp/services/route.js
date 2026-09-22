import { NextResponse } from "next/server";
import { getServices } from "@/lib/rumahotp";
import { getOtpmaniaServices, isOtpmaniaServer } from "@/lib/otpmania";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

function serverEnabled(settings, id) {
  const list = Array.isArray(settings.otpServers) ? settings.otpServers : [];
  return list.find((s) => s.id === id)?.enabled !== false;
}

// Daftar aplikasi untuk satu server. Bentuk item sengaja sama untuk semua server
// (service_code, service_name, service_img) supaya UI-nya identik.
export async function GET(req) {
  const server = new URL(req.url).searchParams.get("server") || "rumahotp";
  try {
    const settings = await getSettings();
    if (!serverEnabled(settings, server)) {
      return NextResponse.json({ error: "Server ini sedang dinonaktifkan admin." }, { status: 503 });
    }

    if (isOtpmaniaServer(server)) {
      const list = await getOtpmaniaServices();
      const items = list
        .map((s) => ({ service_code: s.id, service_name: s.name, service_img: null, server }))
        .sort((a, b) => {
          const wa = (x) => (/whats\s*app|^wa$/i.test(x.service_name) || x.service_code === "wa" ? 0 : 1);
          return wa(a) - wa(b) || a.service_name.localeCompare(b.service_name, "id");
        });
      return NextResponse.json({ items });
    }

    const result = await getServices(process.env.RUMAHOTP_APIKEY);
    const list = result?.data || result?.services || result || [];
    const items = (Array.isArray(list) ? list : []).map((s) => ({ ...s, server: "rumahotp" }));
    return NextResponse.json({ items });
  } catch (err) {
    console.error("[otp/services]", err?.response?.data || err?.message || err);
    return NextResponse.json({ error: err?.message || "Gagal mengambil daftar layanan." }, { status: 502 });
  }
}
