import { NextResponse } from "next/server";
import { resolveApiKey } from "@/lib/apiKeyAuth";
import { getServices } from "@/lib/rumahotp";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const { error } = await resolveApiKey(req);
  if (error) return error;

  try {
    const data = await getServices(process.env.RUMAHOTP_APIKEY);
    const items = data.data || data.services || data || [];
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ error: "Failed to fetch services." }, { status: 500 });
  }
}
