import { settingsCol } from "@/lib/db";

const SETTINGS_ID = "config";

const DEFAULTS = {
  markupPercent: Number(process.env.OTP_MARKUP_PERCENT || 0),
  maintenance: false,
  maintenanceMsg: "Website sedang maintenance. Kami akan segera kembali, mohon coba lagi beberapa saat lagi."
};

// Diambil dari DB supaya bisa diubah admin tanpa deploy ulang. Kalau dokumennya
// belum ada (misal baru pertama kali jalan), otomatis dibuat dari nilai default.
export async function getSettings() {
  const col = await settingsCol();
  const doc = await col.findOne({ _id: SETTINGS_ID });
  if (!doc) {
    const fresh = { _id: SETTINGS_ID, ...DEFAULTS, updatedAt: new Date() };
    await col.insertOne(fresh);
    return fresh;
  }
  return { ...DEFAULTS, ...doc };
}

export async function updateSettings(patch) {
  const col = await settingsCol();
  const allowed = {};
  if (patch.markupPercent !== undefined) allowed.markupPercent = Number(patch.markupPercent) || 0;
  if (patch.maintenance !== undefined) allowed.maintenance = Boolean(patch.maintenance);
  if (patch.maintenanceMsg !== undefined) allowed.maintenanceMsg = String(patch.maintenanceMsg).slice(0, 300);

  await col.updateOne(
    { _id: SETTINGS_ID },
    { $set: { ...allowed, updatedAt: new Date() }, $setOnInsert: { _id: SETTINGS_ID } },
    { upsert: true }
  );
  return getSettings();
}
