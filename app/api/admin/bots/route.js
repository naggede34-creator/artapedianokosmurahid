// Bot toko tambahan: daftar, tambah, matikan, hapus.
//
// Tokennya adalah KREDENSIAL PENUH bot itu. Siapa pun yang memegangnya bisa
// membaca seluruh percakapan pembeli, mengirim pesan atas nama toko, dan
// mengambil alih botnya. Karena itu rute ini TIDAK PERNAH mengirim token asli
// ke peramban — yang keluar hanya versi tersamarnya.
import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { getSettings } from "@/lib/settings";
import { daftarBot, tambahBot, hapusBot, setAktif, ambilBot, pasangWebhook, alamatWebhook } from "@/lib/bots";

export const dynamic = "force-dynamic";

// Alamat situs untuk webhook. Urutannya: pengaturan admin, lalu env Vercel.
// Bukan header Host permintaan ini: header itu berasal dari peramban, dan
// webhook yang dipasang dari header palsu akan mengirim seluruh percakapan
// pembeli ke alamat orang lain.
function baseUrl(settings) {
  const dari = (settings?.siteUrl || process.env.SITE_URL || "").trim();
  if (dari) return dari.replace(/\/+$/, "");
  const vercel = (process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || "").trim();
  return vercel ? `https://${vercel.replace(/\/+$/, "")}` : "";
}

export async function GET(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const settings = await getSettings();
    return NextResponse.json({
      base: baseUrl(settings),
      // Bot pertama ditampilkan apa adanya: ia dari environment, tidak bisa
      // diubah dari sini, dan menyembunyikannya membuat admin mengira
      // botnya hilang.
      botPertama: {
        dariEnv: true,
        terpasang: !!(process.env.SHOP_BOT_TOKEN || "").trim(),
        catatan: "Bot pertama diatur lewat SHOP_BOT_TOKEN di environment, bukan dari sini."
      },
      items: await daftarBot()
    });
  } catch (err) {
    console.error("[admin/bots GET]", err?.message || err);
    return NextResponse.json({ error: "Gagal memuat daftar bot." }, { status: 500 });
  }
}

export async function POST(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body tidak sah." }, { status: 400 });
  }

  const aksi = String(body?.aksi || "tambah");

  try {
    const settings = await getSettings();
    const base = baseUrl(settings);

    if (aksi === "tambah") {
      if (!base) {
        return NextResponse.json(
          { error: "Isi dulu Site URL di Pengaturan. Tanpa itu webhook bot tidak bisa dipasang dan botnya tidak akan menjawab." },
          { status: 400 }
        );
      }
      const r = await tambahBot({ token: body?.token, baseUrl: base });
      if (!r.ok) return NextResponse.json({ error: r.alasan }, { status: 400 });
      return NextResponse.json({
        ok: true,
        baru: r.baru,
        bot: r.bot,
        webhook: r.webhook,
        pesan: r.webhook.ok
          ? `Bot @${r.bot.username} siap. Coba kirim /start ke botnya.`
          : `Bot @${r.bot.username} tersimpan, tapi webhook-nya gagal dipasang: ${r.webhook.alasan}`
      });
    }

    const botId = String(body?.botId || "");
    if (!botId) return NextResponse.json({ error: "botId kosong." }, { status: 400 });

    if (aksi === "hapus") {
      const r = await hapusBot(botId);
      if (!r.ok) return NextResponse.json({ error: r.alasan }, { status: 404 });
      return NextResponse.json({ ok: true, pesan: "Bot dihapus dan webhook-nya dilepas." });
    }

    if (aksi === "aktif" || aksi === "nonaktif") {
      const r = await setAktif(botId, aksi === "aktif");
      if (!r.ok) return NextResponse.json({ error: r.alasan }, { status: 404 });
      // Menyalakan kembali berarti memasang ulang webhook-nya: saat dimatikan
      // webhook-nya dilepas, jadi tanpa ini botnya tetap bisu meski tertulis aktif.
      if (aksi === "aktif") {
        const bot = await ambilBot(botId);
        if (bot?.token && base) await pasangWebhook(bot.token, alamatWebhook(base, botId), bot.webhookSecret);
      }
      return NextResponse.json({ ok: true, pesan: aksi === "aktif" ? "Bot dinyalakan." : "Bot dimatikan." });
    }

    if (aksi === "pasang-ulang") {
      const bot = await ambilBot(botId);
      if (!bot?.token) return NextResponse.json({ error: "Bot tidak ada di daftar." }, { status: 404 });
      if (!base) return NextResponse.json({ error: "Site URL belum diisi di Pengaturan." }, { status: 400 });
      const r = await pasangWebhook(bot.token, alamatWebhook(base, botId), bot.webhookSecret);
      return NextResponse.json(
        r?.ok ? { ok: true, pesan: "Webhook dipasang ulang." } : { error: r?.description || "setWebhook gagal." },
        { status: r?.ok ? 200 : 400 }
      );
    }

    return NextResponse.json({ error: "Aksi tidak dikenali." }, { status: 400 });
  } catch (err) {
    console.error("[admin/bots POST]", err?.message || err);
    return NextResponse.json({ error: "Gagal memproses." }, { status: 500 });
  }
}
