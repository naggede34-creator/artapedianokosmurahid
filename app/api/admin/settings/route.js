import { NextResponse } from "next/server";
import { adminSah } from "@/lib/adminAuth";
import { getSettings, updateSettings } from "@/lib/settings";
import { sendTelegramNotif, markupUpdateNotif, maintenanceToggleNotif } from "@/lib/telegram";

export const dynamic = "force-dynamic";

// Token dan ID Telegram sekarang dikelola di /api/admin/config (terenkripsi).
// Salinan lama di dokumen pengaturan tidak boleh ikut dikirim ke peramban:
// token bot yang terbaca di respons JSON ikut ke riwayat peramban, ekstensi,
// dan berbagi layar.
function tanpaRahasia(s) {
  const { telegramBotToken, telegramChatId, telegramChannelId, ...aman } = s || {};
  return aman;
}

export async function GET(req) {
  if (!await adminSah(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const settings = await getSettings();
  return NextResponse.json(tanpaRahasia(settings));
}

export async function POST(req) {
  if (!await adminSah(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const before = await getSettings();
    const body = await req.json().catch(() => ({}));
    // Sebagian form admin mengirim { action: "update", patch: {...} } dan sebagian
    // mengirim patch langsung. Terima dua-duanya supaya tidak ada form yang
    // tersimpan diam-diam tanpa efek.
    const patch = { ...(body && typeof body.patch === "object" && body.patch !== null ? body.patch : body) };
    // Form lama yang masih terbuka di peramban tidak boleh menimpa konfigurasi baru.
    delete patch.telegramBotToken;
    delete patch.telegramChatId;
    delete patch.telegramChannelId;
    const after = await updateSettings(patch);

    if (patch.markupPercent !== undefined && Number(patch.markupPercent) !== before.markupPercent) {
      sendTelegramNotif(markupUpdateNotif({ oldPercent: before.markupPercent, newPercent: after.markupPercent }));
    }
    if (patch.maintenance !== undefined && Boolean(patch.maintenance) !== Boolean(before.maintenance)) {
      sendTelegramNotif(maintenanceToggleNotif({ maintenance: after.maintenance }));
    }

    return NextResponse.json(tanpaRahasia(after));
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal menyimpan pengaturan." }, { status: 500 });
  }
}
