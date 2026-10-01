import { resolveApiKey, jsonV1 } from "@/lib/apiKeyAuth";
import { getSettings, depositLimits, depositDisplay } from "@/lib/settings";
import { PROVIDER_KEYS, MANUAL_DEPOSIT_KEY } from "@/lib/paymentProviders";
import { warungNokosConfigured } from "@/lib/warungnokos";
import { rumahOtpConfigured } from "@/lib/rumahotp";
import { atlanticConfigured } from "@/lib/atlantic";
import { austinConfigured } from "@/lib/austinpay";

export const dynamic = "force-dynamic";

// GET /api/v1/deposit/methods — metode deposit OTOMATIS yang sedang aktif (QRIS manual tidak ikut: dicek manusia).
export async function GET(req) {
  const { error } = await resolveApiKey(req);
  if (error) return error;
  const settings = await getSettings();
  const aktif = { ...(settings.depositProviders || {}) };
  if (!(await warungNokosConfigured())) aktif.warungnokos = false;
  if (!(await rumahOtpConfigured())) aktif.rumahotp = false;
  if (!(await atlanticConfigured())) aktif.atlantic = false;
  if (!(await austinConfigured())) aktif.qrisfast = false;
  const { min, max } = depositLimits();
  const methods = PROVIDER_KEYS.filter((k) => k !== MANUAL_DEPOSIT_KEY && aktif[k]).map((k) => {
    const d = depositDisplay(settings, k);
    return { provider: k, name: d.name, speed: d.speed || null };
  });
  return jsonV1(req, { min, max, currency: "IDR", methods });
}
