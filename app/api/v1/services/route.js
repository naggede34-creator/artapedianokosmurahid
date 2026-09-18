import { NextResponse } from "next/server";
import { resolveApiKey } from "@/lib/apiKeyAuth";
import { getServices } from "@/lib/rumahotp";
import { getApiKeys } from "@/lib/apiKeys";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const { error } = await resolveApiKey(req);
  if (error) return error;

  try {
    const { rumahOtp } = await getApiKeys();
    const data = await getServices(rumahOtp);
    const items = data.data || data.services || data || [];
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ error: "Failed to fetch services." }, { status: 500 });
  }
}
