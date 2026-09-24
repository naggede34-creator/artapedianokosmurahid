import { NextResponse } from "next/server";
import { gantiApiKey, setCallbackUrl } from "@/lib/gateway";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

export async function POST(req) {
  const { token, aksi, callbackUrl } = await req.json().catch(() => ({}));
  if (!token) return NextResponse.json({ error: "Kode akun kosong." }, { status: 400 });
  if (!rateLimit(`gwkey:${token}`, 10, 60_000)) {
    return NextResponse.json({ error: "Terlalu cepat. Tunggu sebentar." }, { status: 429 });
  }

  if (aksi === "callback") {
    const r = await setCallbackUrl(token, callbackUrl);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status || 400 });
    return NextResponse.json({ ok: true, callbackUrl: r.callbackUrl });
  }

  if (aksi === "ganti") {
    const r = await gantiApiKey(token);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status || 400 });
    return NextResponse.json({ ok: true, apiKey: r.apiKey });
  }

  return NextResponse.json({ error: "Aksi tidak dikenal." }, { status: 400 });
}
