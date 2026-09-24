// Bot toko tambahan: daftar, tambah, matikan, hapus.
//
// Tokennya adalah KREDENSIAL PENUH bot itu. Siapa pun yang memegangnya bisa
// membaca seluruh percakapan pembeli, mengirim pesan atas nama toko, dan
// mengambil alih botnya. Karena itu rute ini TIDAK PERNAH mengirim token asli
// ke peramban — yang keluar hanya versi tersamarnya.
import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { getSettings } from "@/lib/settings";
import { daftarBot, tambahBot, hapusBot, setAktif, ambilBot, pasangWebhook, botsUpdateWebhook } from "@/lib/bots";
import { calonBase } from "@/lib/webhookBase";

export const dynamic = "force-dynamic";

// Alamat situs untuk webhook: DAFTAR calon, bukan satu.
//
// Satu sumber berarti satu huruf salah di Pengaturan mematikan seluruh fitur,
// dan yang muncul cuma "Failed to resolve host" dari Telegram tanpa
// menyebutkan alamat apa yang dicoba.
//
// Header Host permintaan ini sengaja TIDAK dipakai sebagai sumber: header itu
// berasal dari peramban, dan webhook yang dipasang dari Host palsu akan
// mengirim seluruh percakapan pembeli ke alamat orang lain.

export async function GET(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const settings = await getSettings();
    const calon = calonBase(settings);
    return NextResponse.json({
      base: calon[0]?.base || "",
      // Seluruh calon ikut dikirim supaya admin bisa MELIHAT alamat apa yang
      // akan dipakai, sebelum menambah bot dan kebingungan kenapa gagal.
      calon,
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
    const calon = calonBase(settings);

    if (aksi === "tambah") {
      if (!calon.length) {
        return NextResponse.json(
          { error: "Tidak ada alamat situs yang bisa dipakai. Isi Site URL di tab Pengaturan dengan alamat situs ini yang benar-benar bisa dibuka di peramban (mis. https://namasitus.vercel.app)." },
          { status: 400 }
        );
      }
      const r = await tambahBot({ token: body?.token, calon });
      if (!r.ok) return NextResponse.json({ error: r.alasan }, { status: 400 });
      return NextResponse.json({
        ok: true,
        baru: r.baru,
        bot: r.bot,
        webhook: r.webhook,
        pesan: r.webhook.ok
          ? (r.webhook.peringatanSumber
              ? `Bot @${r.bot.username} siap lewat ${r.webhook.url} \u2014 tapi ${r.webhook.peringatanSumber}`
              : `Bot @${r.bot.username} siap. Coba kirim /start ke botnya.`)
          : `Bot @${r.bot.username} tersimpan, tapi webhook-nya belum terpasang. ${r.webhook.alasan}`
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
        if (bot?.token && calon.length) {
          const w = await pasangWebhook(bot.token, botId, calon);
          await botsUpdateWebhook(botId, w);
        }
      }
      return NextResponse.json({ ok: true, pesan: aksi === "aktif" ? "Bot dinyalakan." : "Bot dimatikan." });
    }

    if (aksi === "pasang-ulang") {
      const bot = await ambilBot(botId);
      if (!bot?.token) return NextResponse.json({ error: "Bot tidak ada di daftar." }, { status: 404 });
      if (!calon.length) {
        return NextResponse.json({ error: "Tidak ada alamat situs yang bisa dipakai. Isi Site URL di tab Pengaturan." }, { status: 400 });
      }
      const r = await pasangWebhook(bot.token, botId, calon);
      // Hasilnya disimpan apa pun ujungnya, supaya lencana WEBHOOK OK / BELUM
      // di daftar ikut berubah dan tidak menunjukkan keadaan lama.
      await botsUpdateWebhook(botId, r);
      return NextResponse.json(
        r.ok
          ? { ok: true, pesan: r.peringatanSumber ? `Webhook terpasang di ${r.url}. ${r.peringatanSumber}` : `Webhook terpasang di ${r.url}.` }
          : { error: r.alasan, percobaan: r.percobaan },
        { status: r.ok ? 200 : 400 }
      );
    }

    return NextResponse.json({ error: "Aksi tidak dikenali." }, { status: 400 });
  } catch (err) {
    console.error("[admin/bots POST]", err?.message || err);
    return NextResponse.json({ error: "Gagal memproses." }, { status: 500 });
  }
}
