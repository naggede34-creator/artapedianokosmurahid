// Helper untuk mengambil API key dari DB (settings) dengan fallback ke env vars.
// Ini memungkinkan API key diisi dari Dashboard Admin tanpa perlu redeploy.
import { getSettings } from "@/lib/settings";

export async function getApiKeys() {
  try {
    const s = await getSettings();
    return {
      rumahOtp: s.rumahOtpApiKey || process.env.RUMAHOTP_APIKEY || "",
      simuru: s.simuruApiKey || process.env.SIMURU_APIKEY || "",
      pakasirProject: s.pakasirProject || process.env.PAKASIR_PROJECT || "",
      pakasirApiKey: s.pakasirApiKey || process.env.PAKASIR_APIKEY || "",
      cronSecret: s.cronSecret || process.env.CRON_SECRET || "",
      adminCode: s.adminCode || process.env.ADMIN_CODE || "arta12123",
      referralBonusPercent: s.referralBonusPercent ?? Number(process.env.REFERRAL_BONUS_PERCENT || 10),
    };
  } catch {
    return {
      rumahOtp: process.env.RUMAHOTP_APIKEY || "",
      simuru: process.env.SIMURU_APIKEY || "",
      pakasirProject: process.env.PAKASIR_PROJECT || "",
      pakasirApiKey: process.env.PAKASIR_APIKEY || "",
      cronSecret: process.env.CRON_SECRET || "",
      adminCode: process.env.ADMIN_CODE || "arta12123",
      referralBonusPercent: Number(process.env.REFERRAL_BONUS_PERCENT || 10),
    };
  }
}
