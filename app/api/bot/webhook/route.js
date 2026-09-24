// Webhook BOT TOKO PERTAMA (token dari SHOP_BOT_TOKEN).
//
// Bot yang DITAMBAHKAN ADMIN punya alamatnya sendiri per bot, di
// app/api/bot/webhook/[botId]/route.js. Keduanya memanggil penangan yang sama
// (lib/botUpdateHandler.js) — hanya tokennya yang berbeda.
//
// Bot owner yang lama tetap di app/api/telegram/webhook/route.js.
// Pasang webhook-nya lewat GET /api/bot/setup?secret=CRON_SECRET
import { NextResponse } from "next/server";
import { shopBotConfigured, webhookSecret } from "@/lib/shopBot";
import { tanganiUpdate } from "@/lib/botUpdateHandler";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Telegram mengirim header ini kalau webhook dipasang dengan secret_token.
// Memakai webhookSecret() yang sama dengan pemasang webhook: kalau secretnya
// tidak sah, webhook dipasang TANPA secret, jadi di sini pun tidak boleh
// menuntutnya — kalau berbeda, semua update akan ditolak 401 dan menumpuk.
function verified(req) {
  const expected = webhookSecret();
  if (!expected) return true;
  return req.headers.get("x-telegram-bot-api-secret-token") === expected;
}

// Dibuka lewat browser (GET) hanya untuk memastikan alamatnya benar. Telegram
// selalu memakai POST, jadi di sini tidak ada pemrosesan apa pun.
export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "webhook bot toko (bot pertama)",
    tokenTerpasang: shopBotConfigured(),
    catatan: "Alamat ini menerima update dari Telegram lewat POST. Untuk memasangnya, buka /api/bot/setup"
  });
}

export async function POST(req) {
  if (!shopBotConfigured()) return NextResponse.json({ ok: true });
  if (!verified(req)) return NextResponse.json({ ok: false }, { status: 401 });

  let update;
  try {
    update = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  try {
    // Tanpa konteks bot: shopBotToken() jatuh ke SHOP_BOT_TOKEN, yang memang
    // bot yang dituju alamat ini.
    await tanganiUpdate(update);
  } catch (err) {
    console.error("[bot/webhook]", err?.message || err);
  }

  // Selalu 200: Telegram akan mengirim ulang update kalau dibalas error, dan
  // pengiriman ulang di jalur uang justru berbahaya.
  return NextResponse.json({ ok: true });
}
