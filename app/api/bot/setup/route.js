// Pasang / lepas / cek webhook bot toko.
//
// Bisa dipakai tiga cara:
//   1. Dari Dashboard Admin (tombol) — memakai cookie admin yang sudah login.
//   2. Manual lewat URL: /api/bot/setup?action=set&secret=ISI_CRON_SECRET
//   3. Lewat bot OWNER: /pasangwebhook, /cekwebhook, /diagnosabot
//
// Logika pemasangannya sendiri ada di lib/botWebhook.js supaya jalur tombol dan
// jalur bot owner tidak punya versi masing-masing yang lama-lama berbeda.
import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { shopBotConfigured, shopBotOwners, rawWebhookSecret, webhookSecretValid } from "@/lib/shopBot";
import {
  shopBotIdentity,
  setShopWebhook,
  shopWebhookInfo,
  deleteShopWebhook,
  diagnoseShopWebhook
} from "@/lib/botWebhook";

export const dynamic = "force-dynamic";

function authorize(req) {
  if (isAdminRequest(req)) return { ok: true, via: "admin" };

  const secret = (process.env.CRON_SECRET || "").trim();
  const given = new URL(req.url).searchParams.get("secret");
  const header = req.headers.get("authorization");

  if (!secret) return { ok: true, via: "terbuka" };
  if (given === secret || header === `Bearer ${secret}`) return { ok: true, via: "secret" };

  return {
    ok: false,
    error:
      "Butuh izin. Tiga caranya: login dulu di /admin lalu pakai tombol di Dashboard Admin, " +
      "tambahkan ?secret=NILAI_CRON_SECRET di URL (nilainya ada di Environment Variables " +
      "Vercel, bukan ditebak), atau kirim /pasangwebhook ke bot owner.",
    hint: given ? "Secret yang kamu kirim tidak cocok dengan CRON_SECRET." : "Kamu belum mengirim ?secret= sama sekali."
  };
}

const catatanOwner = () =>
  shopBotOwners().length ? null : "SHOP_BOT_OWNER_IDS masih kosong — /admin dan /broadcast tidak akan bisa dipakai.";

const peringatanSecret = () =>
  rawWebhookSecret().length > 0 && !webhookSecretValid()
    ? "SHOP_BOT_WEBHOOK_SECRET berisi karakter yang tidak diterima Telegram (hanya huruf, angka, _ dan -). Selama begitu, secretnya diabaikan dan webhook dipasang tanpa secret. Bot tetap jalan."
    : null;

export async function GET(req) {
  const auth = authorize(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error, hint: auth.hint }, { status: 401 });

  if (!shopBotConfigured()) {
    return NextResponse.json(
      {
        error: "SHOP_BOT_TOKEN belum diisi.",
        langkah: [
          "Buka Vercel → Settings → Environment Variables",
          "Tambah SHOP_BOT_TOKEN berisi token dari @BotFather",
          "Redeploy, lalu buka halaman ini lagi"
        ]
      },
      { status: 400 }
    );
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "set";
  const origin = url.origin;

  // Cek token dulu: kalau tokennya salah, semua aksi lain pasti gagal dan
  // pesannya jadi membingungkan.
  const id = await shopBotIdentity();
  if (!id.ok) {
    if (id.unreachable) {
      return NextResponse.json(
        {
          error: "Server tidak bisa menghubungi Telegram.",
          telegram: id.error,
          langkah: [
            "Coba lagi sebentar — biasanya gangguan sementara",
            "Kalau terus gagal, cek apakah deployment-mu bisa mengakses internet keluar"
          ]
        },
        { status: 502 }
      );
    }
    return NextResponse.json(
      {
        error: "Token bot ditolak Telegram.",
        telegram: id.error,
        langkah: [
          "Cek lagi SHOP_BOT_TOKEN di Vercel — pastikan tersalin utuh, tanpa spasi",
          "Kalau token lama sudah di-revoke, ambil token baru di @BotFather"
        ]
      },
      { status: 400 }
    );
  }

  const bot = { id: id.id, username: id.username, name: id.name };

  if (action === "delete") {
    const d = await deleteShopWebhook();
    return NextResponse.json({ ok: d.ok, action: "delete", bot, telegram: d.telegram });
  }

  if (action === "diagnosa") {
    const d = await diagnoseShopWebhook(origin);
    return NextResponse.json({
      ok: true,
      action: "diagnosa",
      bot,
      alamatDituju: d.target,
      jawabanSetWebhook: d.jawabanSetWebhook,
      ujiBentrokPolling: d.ujiBentrokPolling,
      antreanTidakBergerak: d.antreanTidakBergerak,
      langkah: d.langkah,
      kesimpulan: d.kesimpulan,
      langkahPerbaikan: d.langkahPerbaikan
    });
  }

  if (action === "info") {
    const r = await shopWebhookInfo(origin);
    return NextResponse.json({
      ok: r.ok,
      action: "info",
      bot,
      webhook: r.url || "(belum dipasang)",
      verifikasi: !r.url ? "belum terpasang" : r.terpasang ? "terpasang" : "terpasang ke alamat lain",
      saran: !r.url
        ? "Tekan Pasang Webhook."
        : r.terpasang
        ? null
        : `Telegram menyimpan ${r.url}, sedangkan Site URL kamu ${r.expected}. Kalau yang tersimpan itu domain aktifmu, botnya tetap jalan.`,
      pendingUpdates: r.pending,
      lastError: r.lastError,
      lastErrorAt: r.lastErrorAt,
      ownerTerdaftar: r.owners,
      peringatanSecret: peringatanSecret(),
      // Kesalahan paling sering: owner id belum diisi, jadi /admin & /broadcast
      // ditolak padahal botnya sendiri sudah jalan.
      catatan: catatanOwner()
    });
  }

  // action=set
  const r = await setShopWebhook(origin);
  if (!r.ok) {
    return NextResponse.json(
      {
        error: r.error,
        alamatTerbaca: r.target || null,
        langkah: [
          "Isi Site URL yang benar di Dashboard Admin → Pengaturan Situs, mis. https://domainkamu.vercel.app",
          "Alamatnya harus bisa dibuka publik lewat HTTPS"
        ]
      },
      { status: 400 }
    );
  }

  // Tiga keadaan yang berbeda, dan dulu ketiganya dilaporkan sama: "belum cocok".
  let verifikasi;
  let saran = null;
  if (r.terpasang) {
    verifikasi = "terpasang";
  } else if (!r.reported) {
    verifikasi = "belum terpasang";
    saran =
      "Telegram melaporkan webhook masih kosong padahal pemasangannya diterima. " +
      "Jalankan ?action=diagnosa (atau /diagnosabot di bot owner) — biasanya ada program lain " +
      "yang masih memakai token bot yang sama.";
  } else {
    verifikasi = "terpasang ke alamat lain";
    saran =
      `Telegram menyimpan ${r.reported}, sedangkan Site URL kamu mengarah ke ${r.target}. ` +
      `Kalau alamat yang tersimpan itu domain aktifmu, biarkan saja — botnya tetap jalan. ` +
      `Kalau bukan, perbaiki Site URL di Pengaturan Situs lalu pasang ulang.`;
  }

  return NextResponse.json({
    ok: true,
    action: "set",
    bot,
    webhook: r.target,
    webhookTersimpan: r.reported || "(kosong)",
    secretDipakai: r.secretDipakai,
    verifikasi,
    saran,
    pendingUpdates: r.pending,
    lastError: r.lastError,
    ownerTerdaftar: shopBotOwners(),
    catatan: catatanOwner(),
    peringatanSecret: peringatanSecret(),
    telegram: r.telegram,
    langkahSelanjutnya: `Buka Telegram, cari @${bot.username}, kirim /start`
  });
}
