// Pasang / lepas webhook bot toko. Dilindungi CRON_SECRET supaya tidak bisa
// dipakai orang lain untuk membajak alamat webhook.
import { NextResponse } from "next/server";
import { shopBotToken, shopBotConfigured } from "@/lib/shopBot";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

function authorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const url = new URL(req.url);
  if (url.searchParams.get("secret") === secret) return true;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!shopBotConfigured()) {
    return NextResponse.json({ error: "SHOP_BOT_TOKEN belum diisi di environment variables." }, { status: 400 });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "set";
  const token = shopBotToken();

  if (action === "delete") {
    const res = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`);
    return NextResponse.json(await res.json());
  }

  if (action === "info") {
    const res = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
    const d = await res.json();
    // URL webhook berisi domain saja, bukan token — aman ditampilkan.
    return NextResponse.json(d);
  }

  const settings = await getSettings().catch(() => ({}));
  const base = (settings.siteUrl || process.env.NEXT_PUBLIC_SITE_URL || url.origin).replace(/\/+$/, "");
  const secret = (process.env.SHOP_BOT_WEBHOOK_SECRET || "").trim();

  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: `${base}/api/bot/webhook`,
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: true,
      ...(secret ? { secret_token: secret } : {})
    })
  });
  const data = await res.json();
  return NextResponse.json({ ...data, webhook: `${base}/api/bot/webhook` });
}
