import { NextResponse } from "next/server";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { maintenance, maintenanceMsg } = await getSettings();
    return NextResponse.json({ maintenance: !!maintenance, maintenanceMsg });
  } catch (err) {
    console.error(err);
    // Kalau DB lagi bermasalah, jangan sampai malah mengunci seluruh web.
    return NextResponse.json({ maintenance: false });
  }
}
