// Webhook untuk BOT YANG DITAMBAHKAN ADMIN. Satu alamat per bot.
//
// Alamatnya harus per bot karena setWebhook Telegram bersifat per bot: satu
// alamat bersama tidak bisa memberi tahu bot mana yang mengirim update, dan
// menebaknya dari isi update berarti sesekali menjawab dari bot yang salah.
//
// Penanganannya kode yang SAMA dengan bot pertama (lib/botUpdateHandler.js).
// Yang berbeda cuma token yang dipasang di konteks.
import { NextResponse } from "next/server";
import { ambilBot } from "@/lib/bots";
import { jalankanDenganBot } from "@/lib/botContext";
import { tanganiUpdate } from "@/lib/botUpdateHandler";
import { botsCol } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req, { params }) {
  const bot = await ambilBot(params?.botId);
  return NextResponse.json({
    ok: true,
    endpoint: "webhook bot toko tambahan",
    // Sengaja tidak menyebut apa pun dari tokennya. Alamat ini terbuka di
    // internet, dan "bot ini ada" sudah cukup untuk memastikan alamatnya benar.
    terdaftar: !!bot,
    aktif: bot ? bot.aktif !== false : false
  });
}

export async function POST(req, { params }) {
  const botId = String(params?.botId || "");
  const bot = await ambilBot(botId);

  // Bot tidak terdaftar atau sudah dihapus: dibalas 200 supaya Telegram
  // berhenti mengirim ulang. Membalas error hanya membuat antreannya menumpuk
  // untuk bot yang memang sudah tidak ada.
  if (!bot?.token) return NextResponse.json({ ok: true });
  if (bot.aktif === false) return NextResponse.json({ ok: true });

  // Secret WAJIB untuk bot tambahan, dan tidak ada jalur tanpa secret.
  //
  // Bedanya dengan bot pertama: secret bot pertama berasal dari environment
  // yang bisa saja tidak diisi, jadi di sana harus ada jalur tanpa secret.
  // Secret bot tambahan dibuat sendiri oleh sistem saat ditambahkan, jadi ia
  // selalu ada — dan tanpa penjagaan ini siapa pun yang menebak alamatnya
  // bisa mengirim update palsu: "pembeli" yang menekan tombol atas nama
  // orang lain, di jalur yang memotong saldo.
  if (req.headers.get("x-telegram-bot-api-secret-token") !== bot.webhookSecret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let update;
  try {
    update = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  try {
    await jalankanDenganBot(
      { botId: bot.botId, token: bot.token, username: bot.username, nama: bot.nama },
      () => tanganiUpdate(update)
    );
  } catch (err) {
    console.error(`[bot/webhook/${botId}]`, err?.message || err);
  }

  // Catatan pemakaian, dan kegagalannya tidak boleh menggagalkan balasan:
  // statistik bukan alasan Telegram mengirim ulang update pembeli.
  try {
    const col = await botsCol();
    await col.updateOne({ botId }, { $set: { terakhirDipakai: new Date() }, $inc: { jumlahUpdate: 1 } });
  } catch {}

  // Selalu 200: Telegram mengirim ulang update kalau dibalas error, dan
  // pengiriman ulang di jalur uang justru berbahaya.
  return NextResponse.json({ ok: true });
}
