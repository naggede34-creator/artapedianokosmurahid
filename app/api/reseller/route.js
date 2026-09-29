// Bot reseller milik pengguna. Semua aksi di sini WAJIB membawa kode akun
// pemiliknya, dan kepemilikannya diperiksa di dalam kueri — bukan dipercaya
// dari body permintaan.
import { NextResponse } from "next/server";
import { usersCol } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { calonBase } from "@/lib/webhookBase";
import {
  botMilik,
  buatBotReseller,
  setMarkupReseller,
  setAktifReseller,
  hapusBotReseller,
  MAKS_BOT_PER_AKUN,
  MARKUP_MAKS,
  WD_RESELLER_MIN
} from "@/lib/resellerBot";
import { umumkan } from "@/lib/notifyHub";
import { botResellerBaruNotif } from "@/lib/resellerNotif";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function pemilik(token) {
  if (!token) return null;
  const users = await usersCol();
  return users.findOne({ token }, { projection: { token: 1, name: 1, suspended: 1 } });
}

export async function GET(req) {
  const token = new URL(req.url).searchParams.get("token");
  const user = await pemilik(token);
  if (!user) return NextResponse.json({ error: "Kode akun tidak dikenali." }, { status: 401 });

  return NextResponse.json({
    items: await botMilik(user.token),
    maks: MAKS_BOT_PER_AKUN,
    markupMaks: MARKUP_MAKS,
    tarikMin: WD_RESELLER_MIN
  });
}

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body tidak sah." }, { status: 400 });
  }

  const user = await pemilik(body?.token);
  if (!user) return NextResponse.json({ error: "Kode akun tidak dikenali." }, { status: 401 });
  if (user.suspended) return NextResponse.json({ error: "Akun kamu sedang ditangguhkan." }, { status: 403 });

  const aksi = String(body?.aksi || "buat");

  try {
    if (aksi === "buat") {
      const settings = await getSettings();
      const calon = calonBase(settings);
      if (!calon.length) {
        return NextResponse.json(
          { error: "Alamat situs belum diatur admin, jadi webhook bot belum bisa dipasang. Hubungi admin." },
          { status: 503 }
        );
      }

      const r = await buatBotReseller({
        pemilikToken: user.token,
        calon,
        token: body.botToken,
        ownerTelegramId: body.ownerTelegramId,
        botUsername: body.botUsername,
        ownerUsername: body.ownerUsername,
        markupPersen: body.markupPersen
      });
      if (!r.ok) return NextResponse.json({ error: r.salah[0], salah: r.salah }, { status: 400 });

      if (r.baru) {
        // Notifikasi admin. Kode akun pemiliknya TIDAK ikut ke channel publik —
        // itu kredensial. Yang publik cuma kabar bahwa ada bot baru.
        const teks = botResellerBaruNotif({
          username: r.bot.username,
          nama: r.bot.nama,
          ownerUsername: r.bot.ownerUsername,
          ownerTelegramId: r.bot.ownerTelegramId,
          markupPersen: r.bot.markupPersen,
          pemilikToken: user.token,
          pemilikNama: user.name
        });
        umumkan({ jenis: "bot_reseller_baru", admin: teks });
      }

      return NextResponse.json({
        ok: true,
        bot: r.bot,
        webhook: r.webhook,
        pesan: r.webhook?.ok
          ? `Bot @${r.bot.username} siap! Kirim /start ke botnya untuk mencoba.`
          : `Bot @${r.bot.username} tersimpan, tapi webhooknya belum terpasang: ${r.webhook?.alasan || "gagal"}`
      });
    }

    const botId = String(body?.botId || "");
    if (!botId) return NextResponse.json({ error: "botId kosong." }, { status: 400 });

    if (aksi === "markup") {
      const r = await setMarkupReseller(user.token, botId, body.markupPersen);
      if (!r.ok) return NextResponse.json({ error: r.alasan }, { status: 400 });
      return NextResponse.json({ ok: true, pesan: "Markup diperbarui." });
    }

    if (aksi === "aktif" || aksi === "nonaktif") {
      const r = await setAktifReseller(user.token, botId, aksi === "aktif");
      if (!r.ok) return NextResponse.json({ error: r.alasan }, { status: r.terkunci ? 403 : 404 });
      // Menyalakan kembali berarti memasang ulang webhooknya: saat dimatikan
      // webhooknya dilepas, jadi tanpa ini botnya tetap bisu meski tertulis aktif.
      if (aksi === "aktif" && r.token) {
        const settings = await getSettings();
        const { pasangWebhook, botsUpdateWebhook } = await import("@/lib/bots");
        const w = await pasangWebhook(r.token, botId, calonBase(settings));
        await botsUpdateWebhook(botId, w);
      }
      return NextResponse.json({ ok: true, pesan: aksi === "aktif" ? "Bot dinyalakan." : "Bot dimatikan." });
    }

    if (aksi === "hapus") {
      const r = await hapusBotReseller(user.token, botId);
      if (!r.ok) return NextResponse.json({ error: r.alasan }, { status: 400 });
      return NextResponse.json({ ok: true, pesan: "Bot dihapus dan webhooknya dilepas." });
    }

    return NextResponse.json({ error: "Aksi tidak dikenali." }, { status: 400 });
  } catch (err) {
    console.error("[api/reseller]", err?.message || err);
    return NextResponse.json({ error: "Gagal memproses. Coba lagi sebentar lagi." }, { status: 500 });
  }
}
