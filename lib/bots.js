// Daftar bot toko: menambah, memeriksa, dan memasang webhook-nya.
//
// Bot pertama tetap datang dari environment (SHOP_BOT_TOKEN). Bot yang
// ditambahkan admin disimpan di koleksi `bots`. Keduanya dilayani alur yang
// SAMA PERSIS — bukan salinan yang mirip, melainkan kode yang sama dijalankan
// dengan token berbeda. Salinan yang mirip akan berbeda pelan-pelan, dan bot
// kedua akan mulai berperilaku lain tanpa ada yang menyadarinya.
import { botsCol } from "@/lib/db";
import { ensureIndexes } from "@/lib/indexes";

const API = "https://api.telegram.org";

// Token bot Telegram: <angka id bot>:<35 karakter acak>. Diperiksa bentuknya
// lebih dulu supaya salah tempel (spasi, tanda petik ikut tersalin, atau URL
// lengkap) ditolak dengan pesan yang jelas, bukan dengan "gagal" dari
// Telegram yang tidak menjelaskan apa-apa.
const BENTUK_TOKEN = /^\d{6,}:[A-Za-z0-9_-]{30,}$/;

export function bentukTokenSah(token) {
  return BENTUK_TOKEN.test(String(token || "").trim());
}

/**
 * Token disamarkan sebelum meninggalkan server. Yang ditampilkan cukup untuk
 * MENGENALI bot mana ini (bagian id-nya memang sudah publik — ia ada di
 * username bot), tapi tidak cukup untuk memakainya.
 */
export function samarkanToken(token) {
  const t = String(token || "");
  const [id] = t.split(":");
  return `${id || "?"}:${"*".repeat(8)}${t.slice(-4)}`;
}

/** Secret webhook per bot. Telegram hanya menerima A-Z a-z 0-9 _ - */
function buatSecret() {
  const abjad = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
  const acak = new Uint8Array(48);
  crypto.getRandomValues(acak);
  return Array.from(acak, (b) => abjad[b % abjad.length]).join("");
}

async function panggil(token, method, body) {
  try {
    const res = await fetch(`${API}/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify(body || {})
    });
    return await res.json().catch(() => null);
  } catch (err) {
    // Pesan error TIDAK boleh memuat body-nya: di sanalah tokennya.
    return { ok: false, description: String(err?.message || err).slice(0, 200) };
  }
}

/** Tanya Telegram siapa pemilik token ini. Satu-satunya cara membuktikan token sah. */
export async function periksaToken(token) {
  const data = await panggil(token, "getMe");
  if (!data?.ok || !data.result?.id) {
    return { ok: false, alasan: data?.description || "Telegram menolak token ini." };
  }
  return {
    ok: true,
    botId: String(data.result.id),
    username: data.result.username || "",
    nama: data.result.first_name || data.result.username || "Bot"
  };
}

/** Alamat webhook untuk satu bot. */
export function alamatWebhook(baseUrl, botId) {
  return `${String(baseUrl || "").replace(/\/+$/, "")}/api/bot/webhook/${botId}`;
}

export async function pasangWebhook(token, url, secret) {
  return panggil(token, "setWebhook", {
    url,
    secret_token: secret,
    // Telegram menyimpan update yang belum terkirim. Untuk bot yang BARU
    // ditambahkan, antrean itu bisa memuat percakapan berbulan-bulan lalu yang
    // akan dibalas sekaligus begitu webhook menyala — membingungkan penerimanya
    // dan, di jalur deposit, berbahaya.
    drop_pending_updates: true,
    allowed_updates: ["message", "callback_query"]
  });
}

export async function lepasWebhook(token) {
  return panggil(token, "deleteWebhook", { drop_pending_updates: true });
}

/**
 * Menambahkan bot. Tokennya diperiksa ke Telegram DULU: bot yang tokennya
 * tidak sah tidak boleh pernah masuk daftar, karena sesudah masuk ia akan
 * terlihat seperti bot yang bekerja padahal tidak pernah menjawab siapa pun.
 */
export async function tambahBot({ token, baseUrl, ditambahOleh }) {
  const bersih = String(token || "").trim();
  if (!bentukTokenSah(bersih)) {
    return { ok: false, alasan: "Bentuk tokennya tidak seperti token bot Telegram. Salin ulang dari @BotFather — bentuknya 1234567890:AAH..." };
  }

  const cek = await periksaToken(bersih);
  if (!cek.ok) return { ok: false, alasan: cek.alasan };

  await ensureIndexes();
  const col = await botsCol();

  // Sudah terdaftar? Tokennya diperbarui (BotFather bisa mencabut token lama),
  // bukan ditolak — menolaknya memaksa admin menghapus lalu menambah lagi,
  // dan di antara keduanya botnya mati.
  const sudah = await col.findOne({ botId: cek.botId });
  const secret = sudah?.webhookSecret || buatSecret();

  const doc = {
    botId: cek.botId,
    token: bersih,
    username: cek.username,
    nama: cek.nama,
    webhookSecret: secret,
    aktif: true,
    ditambahOleh: ditambahOleh || null,
    updatedAt: new Date()
  };

  try {
    await col.updateOne(
      { botId: cek.botId },
      { $set: doc, $setOnInsert: { createdAt: new Date(), jumlahUpdate: 0 } },
      { upsert: true }
    );
  } catch (err) {
    if (err?.code === 11000) {
      return { ok: false, alasan: "Token ini sudah dipakai bot lain di daftar." };
    }
    throw err;
  }

  // Webhook dipasang SESUDAH tersimpan. Kalau urutannya dibalik, Telegram bisa
  // mulai mengirim update ke alamat bot yang belum ada di database, dan
  // update-update pertama itu ditolak tanpa jejak.
  let webhook = { ok: false, alasan: "Alamat situs belum diketahui, webhook belum dipasang." };
  if (baseUrl) {
    const r = await pasangWebhook(bersih, alamatWebhook(baseUrl, cek.botId), secret);
    webhook = r?.ok ? { ok: true } : { ok: false, alasan: r?.description || "setWebhook gagal." };
    await col.updateOne(
      { botId: cek.botId },
      { $set: { webhookOk: !!r?.ok, webhookUrl: alamatWebhook(baseUrl, cek.botId), webhookPesan: webhook.alasan || "" } }
    );
  }

  return { ok: true, baru: !sudah, bot: { botId: cek.botId, username: cek.username, nama: cek.nama }, webhook };
}

/** Bot aktif berdasarkan id. Dipakai webhook untuk tahu token mana yang dipakai membalas. */
export async function ambilBot(botId) {
  const col = await botsCol();
  return col.findOne({ botId: String(botId) });
}

/** Daftar untuk dasbor admin — TANPA token asli. */
export async function daftarBot() {
  const col = await botsCol();
  const rows = await col.find({}).sort({ createdAt: 1 }).limit(200).toArray();
  return rows.map((b) => ({
    botId: b.botId,
    username: b.username,
    nama: b.nama,
    aktif: b.aktif !== false,
    tokenSamar: samarkanToken(b.token),
    webhookOk: !!b.webhookOk,
    webhookPesan: b.webhookPesan || "",
    jumlahUpdate: b.jumlahUpdate || 0,
    terakhirDipakai: b.terakhirDipakai || null,
    createdAt: b.createdAt || null
  }));
}

export async function hapusBot(botId) {
  const col = await botsCol();
  const b = await col.findOne({ botId: String(botId) });
  if (!b) return { ok: false, alasan: "Bot tidak ada di daftar." };
  // Webhook dilepas DULU. Kalau dokumennya dihapus lebih dulu, Telegram masih
  // mengirim update ke alamat yang tidak lagi mengenali botnya, dan pembeli di
  // sana mengetuk tombol yang tidak pernah dijawab.
  await lepasWebhook(b.token);
  await col.deleteOne({ botId: String(botId) });
  return { ok: true };
}

export async function setAktif(botId, aktif) {
  const col = await botsCol();
  const b = await col.findOne({ botId: String(botId) });
  if (!b) return { ok: false, alasan: "Bot tidak ada di daftar." };
  await col.updateOne({ botId: String(botId) }, { $set: { aktif: !!aktif, updatedAt: new Date() } });
  // Bot yang dimatikan juga dilepas webhook-nya, supaya Telegram berhenti
  // mengirim. Kalau hanya ditandai nonaktif, updatenya tetap datang dan
  // dibuang diam-diam — pembelinya mengira botnya rusak, bukan sedang tutup.
  if (!aktif) await lepasWebhook(b.token);
  return { ok: true };
}
