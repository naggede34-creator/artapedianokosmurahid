// Pemasangan & pemeriksaan webhook BOT TOKO, dipakai bersama oleh:
//   - app/api/bot/setup/route.js   (tombol di Dashboard Admin)
//   - app/api/telegram/webhook     (perintah di bot OWNER)
//
// Sengaja satu tempat: kalau dua jalur ini punya logika sendiri-sendiri,
// suatu saat yang satu memasang dengan secret dan yang lain tidak, lalu semua
// update ditolak diam-diam.
import { shopBotToken, shopBotConfigured, shopBotOwners, rawWebhookSecret, webhookSecret, webhookSecretValid } from "@/lib/shopBot";
import { getSettings } from "@/lib/settings";

// Dua alamat dianggap sama kalau cuma beda hal sepele: garis miring di ujung,
// huruf besar/kecil di host, atau "www." di depan.
export function sameUrl(a, b) {
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

// Selalu mengembalikan objek, tidak pernah melempar.
export async function tg(method, body) {
  const token = shopBotToken();
  if (!token) return { ok: false, description: "SHOP_BOT_TOKEN belum diisi." };
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

// Alamat webhook yang seharusnya dipakai, dari Site URL di pengaturan.
export async function webhookUrl(fallbackOrigin = "") {
  let settings = {};
  try {
    settings = await getSettings();
  } catch {}
  const base = (settings.siteUrl || process.env.NEXT_PUBLIC_SITE_URL || fallbackOrigin || "").replace(/\/+$/, "");
  return base ? `${base}/api/bot/webhook` : "";
}

export async function shopBotIdentity() {
  const me = await tg("getMe");
  if (!me.ok) return { ok: false, error: me.description, unreachable: Boolean(me.unreachable) };
  return { ok: true, id: me.result?.id, username: me.result?.username, name: me.result?.first_name };
}

export async function setShopWebhook(fallbackOrigin = "") {
  if (!shopBotConfigured()) return { ok: false, error: "SHOP_BOT_TOKEN belum diisi di environment variables." };

  const target = await webhookUrl(fallbackOrigin);
  if (!/^https:\/\//i.test(target)) {
    return { ok: false, error: `Alamat webhook harus HTTPS. Terbaca: ${target || "(kosong)"}`, target };
  }

  const secret = webhookSecret();
  const secretBermasalah = rawWebhookSecret().length > 0 && !webhookSecretValid();

  const set = await tg("setWebhook", {
    url: target,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
    ...(secret ? { secret_token: secret } : {})
  });
  if (!set.ok) return { ok: false, error: set.description || "Telegram menolak pemasangan.", target };

  // Telegram kadang belum langsung melaporkan webhook baru, jadi diberi
  // kesempatan kedua sebelum dinyatakan tidak terpasang.
  let info = await tg("getWebhookInfo");
  let reported = info.result?.url || "";
  if (info.ok && !sameUrl(reported, target)) {
    await new Promise((r) => setTimeout(r, 1500));
    info = await tg("getWebhookInfo");
    reported = info.result?.url || "";
  }

  return {
    ok: true,
    target,
    reported,
    terpasang: sameUrl(reported, target),
    telegram: set.description || "Webhook was set",
    secretDipakai: Boolean(secret),
    secretBermasalah,
    pending: info.result?.pending_update_count ?? 0,
    lastError: info.result?.last_error_message || null
  };
}

export async function shopWebhookInfo(fallbackOrigin = "") {
  const info = await tg("getWebhookInfo");
  const r = info.result || {};
  const expected = await webhookUrl(fallbackOrigin);
  return {
    ok: info.ok,
    url: r.url || "",
    expected,
    terpasang: sameUrl(r.url, expected),
    pending: r.pending_update_count ?? 0,
    lastError: r.last_error_message || null,
    lastErrorAt: r.last_error_date ? new Date(r.last_error_date * 1000).toISOString() : null,
    owners: shopBotOwners()
  };
}

// Bukti paling menentukan: panggil getUpdates sekali.
//
// Telegram hanya mengizinkan SATU getUpdates berjalan untuk satu token. Kalau
// ada program lain yang sedang long polling dengan token yang sama, panggilan
// ini dibalas 409 Conflict — dan itu bukan dugaan lagi, itu Telegram sendiri
// yang bilang ada dua program memperebutkan bot yang sama.
//
// getUpdates memang menghapus webhook, jadi ini hanya dipakai di diagnosa, dan
// webhooknya dipasang ulang sesudahnya.
export async function probePolling() {
  const r = await tg("getUpdates", { offset: -1, limit: 1, timeout: 0 });
  if (r.error_code === 409) {
    return { bentrok: true, pesan: r.description || "Conflict", jumlahUpdate: null };
  }
  if (!r.ok) return { bentrok: false, gagal: true, pesan: r.description || "gagal", jumlahUpdate: null };
  return { bentrok: false, pesan: "tidak ada program lain yang sedang long polling", jumlahUpdate: r.result?.length ?? 0 };
}

// Merekam keadaan webhook sebelum dipasang, tepat sesudah, dan beberapa detik
// kemudian, plus satu uji bentrok getUpdates.
//
// Tiga tanda yang dibaca bersama:
//   - 409 dari getUpdates          -> pasti ada program lain memakai token ini
//   - url selalu kosong            -> pemasangan tidak pernah bertahan
//   - pending tidak pernah jadi 0  -> padahal drop_pending_updates dikirim, jadi
//                                     setWebhook-nya memang tidak menempel
export async function diagnoseShopWebhook(fallbackOrigin = "") {
  const langkah = [];
  const snapshot = async (saat) => {
    const i = await tg("getWebhookInfo");
    const rec = {
      saat,
      url: i.result?.url || "(kosong)",
      pending: i.result?.pending_update_count ?? null,
      lastError: i.result?.last_error_message || null
    };
    langkah.push(rec);
    return rec;
  };

  const target = await webhookUrl(fallbackOrigin);
  const awal = await snapshot("sebelum dipasang");

  // Dijalankan sebelum setWebhook, karena getUpdates menghapus webhook.
  const polling = await probePolling();

  const set = await tg("setWebhook", {
    url: target,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
    ...(webhookSecret() ? { secret_token: webhookSecret() } : {})
  });

  const seg0 = await snapshot("tepat setelah dipasang");
  await new Promise((r) => setTimeout(r, 3500));
  const seg3 = await snapshot("3,5 detik kemudian");

  // drop_pending_updates:true membuat antrean jadi 0 kalau pemasangannya benar-
  // benar menempel. Antrean yang tidak bergerak berarti setWebhook-nya diterima
  // di atas kertas saja.
  const antreanTidakBergerak =
    set.ok && awal.pending != null && seg0.pending != null && awal.pending > 0 && seg0.pending === awal.pending;

  let kesimpulan;
  let langkahPerbaikan = [];

  if (!set.ok) {
    kesimpulan = `Telegram menolak pemasangan: ${set.description}`;
  } else if (polling.bentrok) {
    kesimpulan =
      "TERBUKTI: ada program lain yang sedang memakai token bot yang sama. " +
      `Telegram membalas 409 Conflict ("${polling.pesan}") saat dicoba. ` +
      "Selama program itu masih jalan, webhook akan terus dihapus beberapa milidetik " +
      "setelah dipasang, berapa kali pun dipasang ulang.";
    langkahPerbaikan = [
      "Buka @BotFather, kirim /revoke, pilih bot ini. Token lama langsung mati, jadi program lain itu ikut berhenti walau kamu tidak tahu dia jalan di mana.",
      "Salin token BARU ke SHOP_BOT_TOKEN di Vercel (Settings -> Environment Variables).",
      "Redeploy, lalu pasang webhook lagi."
    ];
  } else if (!seg0.url && !seg3.url) {
    kesimpulan =
      "Telegram menjawab berhasil, tapi alamatnya TIDAK pernah tersimpan walau dicek seketika" +
      (antreanTidakBergerak
        ? ", dan antrean update tidak berkurang sama sekali padahal pemasangan ini meminta antreannya dikosongkan. Dua-duanya menunjukkan pemasangannya tidak benar-benar menempel ke bot ini"
        : "") +
      ". Uji bentrok tidak menangkap program lain pada detik itu, tapi program yang polling-nya tersendat-sendat bisa lolos dari uji sebentar itu.";
    langkahPerbaikan = [
      "Cara paling pasti: /revoke di @BotFather untuk mendapat token baru, lalu ganti SHOP_BOT_TOKEN di Vercel dan redeploy. Token lama mati seketika berikut program apa pun yang memakainya.",
      "Kalau kamu tahu bot lama itu jalan di mana (hosting lain, laptop, atau layanan pembuat bot), matikan dulu di sana lalu pasang ulang."
    ];
  } else if (!seg3.url) {
    kesimpulan =
      "Webhook sempat terpasang lalu HILANG sendiri dalam hitungan detik. " +
      "Penyebabnya program lain yang memakai token bot yang sama: getUpdates (long polling) " +
      "maupun deleteWebhook akan menghapus webhook ini.";
    langkahPerbaikan = [
      "Matikan program lama itu, atau ambil token baru lewat /revoke di @BotFather lalu ganti SHOP_BOT_TOKEN di Vercel."
    ];
  } else {
    kesimpulan = "Webhook terpasang dan bertahan. Bot siap dipakai.";
  }

  return {
    target,
    jawabanSetWebhook: set.description || (set.ok ? "berhasil" : "gagal"),
    ujiBentrokPolling: polling.bentrok
      ? `BENTROK — ${polling.pesan}`
      : polling.gagal
      ? `tidak bisa diuji — ${polling.pesan}`
      : polling.pesan,
    antreanTidakBergerak,
    langkah,
    kesimpulan,
    langkahPerbaikan
  };
}

export async function deleteShopWebhook() {
  const d = await tg("deleteWebhook", { drop_pending_updates: false });
  return { ok: Boolean(d.ok), telegram: d.description || (d.ok ? "webhook dilepas" : "gagal") };
}
