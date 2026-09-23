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

// Merekam keadaan webhook sebelum dipasang, tepat sesudah, dan beberapa detik
// kemudian. Kalau alamatnya terisi lalu hilang sendiri, berarti ada program lain
// yang memakai token bot yang sama — getUpdates maupun deleteWebhook akan
// menghapus webhook ini.
export async function diagnoseShopWebhook(fallbackOrigin = "") {
  const langkah = [];
  const snapshot = async (saat) => {
    const i = await tg("getWebhookInfo");
    langkah.push({
      saat,
      url: i.result?.url || "(kosong)",
      pending: i.result?.pending_update_count ?? null,
      lastError: i.result?.last_error_message || null
    });
    return i.result?.url || "";
  };

  const target = await webhookUrl(fallbackOrigin);
  await snapshot("sebelum dipasang");

  const set = await tg("setWebhook", {
    url: target,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
    ...(webhookSecret() ? { secret_token: webhookSecret() } : {})
  });

  const seg0 = await snapshot("tepat setelah dipasang");
  await new Promise((r) => setTimeout(r, 3500));
  const seg3 = await snapshot("3,5 detik kemudian");

  let kesimpulan;
  if (!set.ok) {
    kesimpulan = `Telegram menolak pemasangan: ${set.description}`;
  } else if (!seg0) {
    kesimpulan =
      "Telegram menjawab berhasil, tapi alamatnya TIDAK pernah tersimpan walau dicek seketika. " +
      "Ini terjadi kalau ada program lain yang terus memakai token bot yang sama.";
  } else if (!seg3) {
    kesimpulan =
      "Webhook sempat terpasang lalu HILANG sendiri dalam hitungan detik. " +
      "Penyebabnya program lain yang memakai token bot yang sama: getUpdates (long polling) " +
      "maupun deleteWebhook akan menghapus webhook ini. Matikan bot lama itu, " +
      "atau ambil token baru lewat /revoke di @BotFather.";
  } else {
    kesimpulan = "Webhook terpasang dan bertahan. Bot siap dipakai.";
  }

  return { target, jawabanSetWebhook: set.description || (set.ok ? "berhasil" : "gagal"), langkah, kesimpulan };
}

export async function deleteShopWebhook() {
  const d = await tg("deleteWebhook", { drop_pending_updates: false });
  return { ok: Boolean(d.ok), telegram: d.description || (d.ok ? "webhook dilepas" : "gagal") };
}
