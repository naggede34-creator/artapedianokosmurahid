import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { getSettings, updateSettings } from "@/lib/settings";
import { sendTelegramNotif, markupUpdateNotif, maintenanceToggleNotif } from "@/lib/telegram";

export const dynamic = "force-dynamic";

export async function GET(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const settings = await getSettings();
  return NextResponse.json(settings);
}

export async function POST(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const before = await getSettings();
    const body = await req.json().catch(() => ({}));
    // Sebagian form admin mengirim { action: "update", patch: {...} } dan sebagian
    // mengirim patch langsung. Terima dua-duanya supaya tidak ada form yang
    // tersimpan diam-diam tanpa efek.
    const patch = body && typeof body.patch === "object" && body.patch !== null ? body.patch : body;
    const after = await updateSettings(patch);

    if (patch.markupPercent !== undefined && Number(patch.markupPercent) !== before.markupPercent) {
      sendTelegramNotif(markupUpdateNotif({ oldPercent: before.markupPercent, newPercent: after.markupPercent }));
    }
    if (patch.maintenance !== undefined && Boolean(patch.maintenance) !== Boolean(before.maintenance)) {
      sendTelegramNotif(maintenanceToggleNotif({ maintenance: after.maintenance }));
    }

    return NextResponse.json(after);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal menyimpan pengaturan." }, { status: 500 });
  }
}
