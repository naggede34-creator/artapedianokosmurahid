// Pasang / lepas / cek webhook bot toko.
//
// Bisa dipakai dua cara:
//   1. Dari Dashboard Admin (tombol) — memakai cookie admin yang sudah login.
//   2. Manual lewat URL: /api/bot/setup?secret=ISI_CRON_SECRET
//
// Kalau dibuka tanpa keduanya, jawabannya menyebutkan apa yang kurang, bukan
// sekadar "Unauthorized" yang tidak menolong.
import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import {
  shopBotToken,
  shopBotConfigured,
  shopBotOwners,
  rawWebhookSecret,
  webhookSecret,
  webhookSecretValid
} from "@/lib/shopBot";
import { getSettings } from "@/lib/settings";

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
      "Butuh izin. Dua caranya: login dulu di /admin lalu buka halaman ini dari " +
      "Dashboard Admin, ATAU tambahkan ?secret=NILAI_CRON_SECRET di URL " +
      "(nilainya ada di Environment Variables Vercel, bukan ditebak).",
    hint: given ? "Secret yang kamu kirim tidak cocok dengan CRON_SECRET." : "Kamu belum mengirim ?secret= sama sekali."
  };
}

// Selalu mengembalikan objek, tidak pernah melempar. Kalau Telegram tidak bisa
// dihubungi, halaman ini harus tetap memberi jawaban yang bisa dibaca admin —
// bukan mati tanpa pesan.
// Dua alamat dianggap sama kalau cuma beda hal sepele: garis miring di ujung,
// huruf besar/kecil di host, atau "www." di depan. Perbedaan seperti itu tidak
// membuat webhook gagal, jadi tidak perlu dilaporkan sebagai masalah.
function sameUrl(a, b) {
  const norm = (v) => {
    try {
      const u = new URL(String(v));
      return `${u.protocol}//${u.host.toLowerCase().replace(/^www\./, "")}${u.pathname.replace(/\/+$/, "")}`;
    } catch {
      return String(v || "").trim().replace(/\/+$/, "").toLowerCase();
    }
  };
  return Boolean(a) && norm(a) === norm(b);
}

async function tg(method, body) {
  const token = shopBotToken();
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: body ? "POST" : "GET",
      signal: AbortSignal.timeout(15000),
      ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {})
    });
    const data = await res.json().catch(() => null);
    if (!data) return { ok: false, description: `Respons Telegram tidak terbaca (HTTP ${res.status})` };
    return data;
  } catch (err) {
    const reason = err?.name === "TimeoutError" ? "waktu tunggu habis" : err?.message || "jaringan gagal";
    return { ok: false, description: `Tidak bisa menghubungi api.telegram.org (${reason})`, unreachable: true };
  }
}

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

  // Cek token dulu: kalau tokennya salah, semua aksi lain pasti gagal dan
  // pesannya jadi membingungkan.
  const me = await tg("getMe");
  if (!me.ok) {
    if (me.unreachable) {
      return NextResponse.json(
        {
          error: "Server tidak bisa menghubungi Telegram.",
          telegram: me.description,
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
        telegram: me.description,
        langkah: [
          "Cek lagi SHOP_BOT_TOKEN di Vercel — pastikan tersalin utuh, tanpa spasi",
          "Kalau token lama sudah di-revoke, ambil token baru di @BotFather"
        ]
      },
      { status: 400 }
    );
  }

  const bot = { id: me.result?.id, username: me.result?.username, name: me.result?.first_name };

  if (action === "delete") {
    const d = await tg("deleteWebhook", { drop_pending_updates: false });
    return NextResponse.json({ ok: d.ok, action: "delete", bot, telegram: d.description || "webhook dilepas" });
  }

  // Diagnosa: merekam keadaan webhook sebelum dipasang, tepat sesudah dipasang,
  // dan beberapa detik kemudian. Kalau alamatnya terisi lalu hilang sendiri,
  // berarti ada program lain yang memakai token bot yang sama — memanggil
  // getUpdates (long polling) atau deleteWebhook akan menghapus webhook kita.
  if (action === "diagnosa") {
    const langkah = [];
    const snapshot = async (label) => {
      const i = await tg("getWebhookInfo");
      langkah.push({
        saat: label,
        url: i.result?.url || "(kosong)",
        pending: i.result?.pending_update_count ?? null,
        lastError: i.result?.last_error_message || null
      });
      return i.result?.url || "";
    };

    let settingsD = {};
    try {
      settingsD = await getSettings();
    } catch {}
    const baseD = (settingsD.siteUrl || process.env.NEXT_PUBLIC_SITE_URL || url.origin).replace(/\/+$/, "");
    const targetD = `${baseD}/api/bot/webhook`;

    await snapshot("sebelum dipasang");

    const setD = await tg("setWebhook", {
      url: targetD,
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: true,
      ...(webhookSecret() ? { secret_token: webhookSecret() } : {})
    });

    const seg0 = await snapshot("tepat setelah dipasang");
    await new Promise((r) => setTimeout(r, 3500));
    const seg3 = await snapshot("3,5 detik kemudian");

    let kesimpulan;
    if (!setD.ok) {
      kesimpulan = `Telegram menolak pemasangan: ${setD.description}`;
    } else if (!seg0) {
      kesimpulan =
        "Telegram menjawab berhasil, tapi alamatnya TIDAK pernah tersimpan walau dicek seketika. " +
        "Ini terjadi kalau ada program lain yang terus-menerus memakai token bot yang sama.";
    } else if (!seg3) {
      kesimpulan =
        "Webhook sempat terpasang lalu HILANG sendiri dalam hitungan detik. " +
        "Penyebabnya program lain yang memakai token bot yang sama: memanggil getUpdates " +
        "(long polling) atau deleteWebhook akan menghapus webhook ini. " +
        "Matikan bot lama itu, atau ambil token baru di @BotFather lewat /revoke.";
    } else {
      kesimpulan = "Webhook terpasang dan bertahan. Bot siap dipakai.";
    }

    return NextResponse.json({
      ok: true,
      action: "diagnosa",
      bot,
      alamatDituju: targetD,
      jawabanSetWebhook: setD.description || (setD.ok ? "berhasil" : "gagal"),
      langkah,
      kesimpulan
    });
  }

  if (action === "info") {
    const info = await tg("getWebhookInfo");
    const r = info.result || {};
    const expected = `${(
      (await getSettings().catch(() => ({}))).siteUrl ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      url.origin
    ).replace(/\/+$/, "")}/api/bot/webhook`;

    return NextResponse.json({
      ok: info.ok,
      action: "info",
      bot,
      webhook: r.url || "(belum dipasang)",
      verifikasi: !r.url
        ? "belum terpasang"
        : sameUrl(r.url, expected)
        ? "terpasang"
        : "terpasang ke alamat lain",
      saran: !r.url
        ? "Tekan Pasang Webhook."
        : sameUrl(r.url, expected)
        ? null
        : `Telegram menyimpan ${r.url}, sedangkan Site URL kamu ${expected}. Kalau yang tersimpan itu domain aktifmu, botnya tetap jalan.`,
      pendingUpdates: r.pending_update_count ?? 0,
      lastError: r.last_error_message || null,
      lastErrorAt: r.last_error_date ? new Date(r.last_error_date * 1000).toISOString() : null,
      ownerTerdaftar: shopBotOwners(),
      peringatanSecret:
        rawWebhookSecret().length > 0 && !webhookSecretValid()
          ? "SHOP_BOT_WEBHOOK_SECRET berisi karakter yang tidak diterima Telegram (hanya huruf, angka, _ dan -). Selama begitu, secretnya diabaikan."
          : null,
      // Kesalahan paling sering: owner id belum diisi, jadi /admin & /broadcast
      // ditolak padahal botnya sendiri sudah jalan.
      catatan: shopBotOwners().length ? null : "SHOP_BOT_OWNER_IDS masih kosong — /admin dan /broadcast tidak akan bisa dipakai."
    });
  }

  // action=set
  let settings = {};
  try {
    settings = await getSettings();
  } catch {}
  const base = (settings.siteUrl || process.env.NEXT_PUBLIC_SITE_URL || url.origin).replace(/\/+$/, "");
  const target = `${base}/api/bot/webhook`;

  if (!/^https:\/\//i.test(target)) {
    return NextResponse.json(
      {
        error: "Alamat webhook harus HTTPS.",
        alamatTerbaca: target,
        langkah: ["Isi Site URL yang benar di Dashboard Admin → Pengaturan Situs, mis. https://domainkamu.vercel.app"]
      },
      { status: 400 }
    );
  }

  // Secret yang formatnya salah membuat setWebhook DITOLAK — itu penyebab paling
  // sering webhook "sudah dipasang" tapi ternyata kosong. Daripada menggagalkan
  // seluruh pemasangan, secret yang tidak sah dilewati dan admin diberi tahu.
  const secret = webhookSecret();
  const secretBermasalah = rawWebhookSecret().length > 0 && !webhookSecretValid();

  const set = await tg("setWebhook", {
    url: target,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
    ...(secret ? { secret_token: secret } : {})
  });

  if (!set.ok) {
    return NextResponse.json(
      {
        error: "Telegram menolak pemasangan webhook.",
        telegram: set.description,
        alamat: target,
        langkah: [
          "Pastikan Site URL di Pengaturan Situs adalah domain yang benar-benar aktif",
          "Alamatnya harus bisa dibuka publik lewat HTTPS"
        ]
      },
      { status: 400 }
    );
  }

  // Telegram kadang belum langsung melaporkan webhook yang baru dipasang, jadi
  // verifikasinya diberi satu kesempatan kedua sebelum dinyatakan tidak cocok.
  let info = await tg("getWebhookInfo");
  let reported = info.result?.url || "";
  if (info.ok && !sameUrl(reported, target)) {
    await new Promise((r) => setTimeout(r, 1200));
    info = await tg("getWebhookInfo");
    reported = info.result?.url || "";
  }

  // Tiga keadaan yang berbeda, dan dulu ketiganya dilaporkan sama: "belum cocok".
  let verifikasi;
  let saran = null;
  if (!info.ok) {
    verifikasi = "terpasang, tapi belum bisa diverifikasi";
    saran = "Telegram menerima pemasangannya, hanya pengecekan ulangnya yang gagal. Tekan Cek Status sebentar lagi.";
  } else if (sameUrl(reported, target)) {
    verifikasi = "terpasang";
  } else if (!reported) {
    verifikasi = "belum terpasang";
    saran = "Telegram melaporkan webhook masih kosong. Coba tekan Pasang Webhook sekali lagi.";
  } else {
    verifikasi = "terpasang ke alamat lain";
    saran =
      `Telegram menyimpan ${reported}, sedangkan Site URL kamu mengarah ke ${target}. ` +
      `Kalau alamat yang tersimpan itu domain aktifmu, biarkan saja — botnya tetap jalan. ` +
      `Kalau bukan, perbaiki Site URL di Pengaturan Situs lalu pasang ulang.`;
  }

  return NextResponse.json({
    ok: true,
    action: "set",
    bot,
    webhook: target,
    webhookTersimpan: reported || "(kosong)",
    secretDipakai: Boolean(secret),
    verifikasi,
    saran,
    pendingUpdates: info.result?.pending_update_count ?? 0,
    lastError: info.result?.last_error_message || null,
    ownerTerdaftar: shopBotOwners(),
    catatan: shopBotOwners().length ? null : "SHOP_BOT_OWNER_IDS masih kosong — /admin dan /broadcast tidak akan bisa dipakai.",
    peringatanSecret: secretBermasalah
      ? "SHOP_BOT_WEBHOOK_SECRET berisi karakter yang tidak diterima Telegram (hanya boleh huruf, angka, _ dan -), jadi webhook dipasang TANPA secret. Bot tetap jalan. Kalau mau memakainya, ganti nilainya jadi seperti artapedia_bot_2026 lalu pasang ulang."
      : null,
    telegram: set.description || "webhook dipasang",
    langkahSelanjutnya: `Buka Telegram, cari @${bot.username}, kirim /start`
  });
}
