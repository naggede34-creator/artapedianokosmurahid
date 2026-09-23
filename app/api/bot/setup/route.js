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
import { shopBotToken, shopBotConfigured, shopBotOwners } from "@/lib/shopBot";
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

  if (action === "info") {
    const info = await tg("getWebhookInfo");
    const r = info.result || {};
    return NextResponse.json({
      ok: info.ok,
      action: "info",
      bot,
      webhook: r.url || "(belum dipasang)",
      pendingUpdates: r.pending_update_count ?? 0,
      lastError: r.last_error_message || null,
      lastErrorAt: r.last_error_date ? new Date(r.last_error_date * 1000).toISOString() : null,
      ownerTerdaftar: shopBotOwners(),
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

  const secret = (process.env.SHOP_BOT_WEBHOOK_SECRET || "").trim();
  const set = await tg("setWebhook", {
    url: target,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
    ...(secret ? { secret_token: secret } : {})
  });

  if (!set.ok) {
    return NextResponse.json(
      { error: "Telegram menolak pemasangan webhook.", telegram: set.description, alamat: target },
      { status: 400 }
    );
  }

  const info = await tg("getWebhookInfo");
  return NextResponse.json({
    ok: true,
    action: "set",
    bot,
    webhook: target,
    secretDipakai: Boolean(secret),
    verifikasi: info.result?.url === target ? "terpasang" : "belum cocok, cek lagi",
    ownerTerdaftar: shopBotOwners(),
    catatan: shopBotOwners().length ? null : "SHOP_BOT_OWNER_IDS masih kosong — /admin dan /broadcast tidak akan bisa dipakai.",
    langkahSelanjutnya: `Buka Telegram, cari @${bot.username}, kirim /start`
  });
}
