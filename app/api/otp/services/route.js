import { NextResponse } from "next/server";
import { getServices } from "@/lib/rumahotp";
import { getSimuruOtpServices } from "@/lib/simuru";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const settings = await getSettings();
    const servers = Array.isArray(settings.otpServers) ? settings.otpServers : [];

    const rumahotpEnabled = servers.find((s) => s.id === "rumahotp")?.enabled !== false;
    const simuruEnabled = servers.find((s) => s.id === "simuru")?.enabled === true;

    const [rumahotpResult, simuruResult] = await Promise.allSettled([
      rumahotpEnabled ? getServices(process.env.RUMAHOTP_APIKEY) : Promise.resolve(null),
      simuruEnabled ? getSimuruOtpServices() : Promise.resolve(null)
    ]);

    const nameMap = new Map();

    if (rumahotpEnabled && rumahotpResult.status === "fulfilled" && rumahotpResult.value) {
      const list = rumahotpResult.value.data || rumahotpResult.value.services || rumahotpResult.value || [];
      for (const item of Array.isArray(list) ? list : []) {
        const key = (item.service_name || "").toLowerCase().trim();
        if (!key) continue;
        nameMap.set(key, { ...item, rumahotp_code: item.service_code, server: "rumahotp" });
      }
    }

    if (simuruEnabled && simuruResult.status === "fulfilled" && Array.isArray(simuruResult.value)) {
      for (const svc of simuruResult.value) {
        const key = (svc.service_name || "").toLowerCase().trim();
        if (!key) continue;
        if (nameMap.has(key)) {
          nameMap.get(key).simuru_code = svc.service_id;
        } else {
          nameMap.set(key, {
            service_code: `simuru:${svc.service_id}`,
            service_name: svc.service_name,
            simuru_code: svc.service_id,
            server: "simuru"
          });
        }
      }
    }

    return NextResponse.json({ items: Array.from(nameMap.values()) });
  } catch (err) {
    console.error(err?.response?.data || err);
    return NextResponse.json({ error: "Gagal mengambil daftar layanan." }, { status: 500 });
  }
}
