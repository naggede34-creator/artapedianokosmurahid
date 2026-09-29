// Bot reseller: pengguna biasa membuat botnya sendiri untuk jualan nokos.
//
// Botnya dilayani KODE YANG SAMA dengan bot toko (lib/botUpdateHandler.js dan
// lib/shopBotFlow.js). Yang berbeda cuma dua hal: menunya dibatasi, dan ada
// markup milik resellernya di atas harga situs.
//
// Dibuat begitu bukan demi hemat baris. Kalau bot reseller punya alur sendiri,
// alur itu akan tertinggal tiap kali alur utama diperbaiki — dan yang
// tertinggal di jalur beli nokos berarti saldo orang. Pembeli di bot reseller
// mendapat perbaikan yang sama pada hari yang sama.
//
// ─────────────────────────────────────────────────────────────────────────
// UANGNYA BAGAIMANA
//
// Pembeli di bot reseller punya akun Arta Pedia sendiri, seperti pembeli mana
// pun. Saldonya saldo Arta Pedia. Yang ditambahkan reseller cuma markup di
// atas harga situs, dan selisihnya masuk ke saldo komisi resellernya.
//
// Tidak ada dompet baru yang dibuat di sini. Dompet baru berarti uang yang
// sama tercatat di dua tempat, dan dua tempat yang harus selalu cocok adalah
// dua tempat yang suatu saat tidak cocok.
// ─────────────────────────────────────────────────────────────────────────
import { botsCol } from "@/lib/db";
import { ensureIndexes } from "@/lib/indexes";
import { bentukTokenSah, periksaToken, samarkanToken, pasangWebhook, lepasWebhook, botsUpdateWebhook } from "@/lib/bots";

/** Batas bot per akun. Bukan soal sumber daya — tiap bot adalah webhook yang harus dijaga. */
export const MAKS_BOT_PER_AKUN = 3;

/** Markup reseller, dalam persen di atas harga situs. */
export const MARKUP_MIN = 0;
export const MARKUP_MAKS = 100;

/** Penarikan komisi reseller. */
export const WD_RESELLER_MIN = 15000;

/**
 * Markup yang sah.
 *
 * Nilai kosong TIDAK boleh lolos. Number(null), Number("") dan Number(" ")
 * semuanya bernilai 0, jadi mengandalkan Number() saja membuat isian yang
 * kosong diam-diam tersimpan sebagai markup 0% — resellernya tidak dapat
 * komisi sepeser pun dan tidak ada yang memberitahunya kenapa.
 */
export function markupSah(v) {
  if (v === null || v === undefined) return false;
  const teks = String(v).trim();
  if (teks === "") return false;
  const m = Number(teks);
  return Number.isFinite(m) && m >= MARKUP_MIN && m <= MARKUP_MAKS;
}

/** Username Telegram: 5-32 karakter, huruf/angka/garis bawah. */
const USERNAME_OK = /^[A-Za-z0-9_]{4,32}$/;

export function bersihkanUsername(v) {
  return String(v || "").trim().replace(/^https?:\/\/t\.me\//i, "").replace(/^@/, "");
}

export function usernameSah(v) {
  return USERNAME_OK.test(bersihkanUsername(v));
}

/** Id Telegram selalu angka positif. Id grup (negatif) bukan pemilik. */
export function idTelegramSah(v) {
  return /^\d{5,}$/.test(String(v || "").trim());
}

/**
 * Memeriksa isian sebelum menyentuh Telegram sama sekali.
 * Mengembalikan daftar kesalahan supaya pengguna melihat SEMUANYA sekaligus,
 * bukan satu per satu tiap kali menekan Simpan.
 */
export function periksaIsian({ token, ownerTelegramId, botUsername, ownerUsername, markupPersen }) {
  const salah = [];
  if (!bentukTokenSah(token)) {
    salah.push("Token bot tidak berbentuk token Telegram. Salin ulang dari @BotFather — bentuknya 1234567890:AAH...");
  }
  if (!idTelegramSah(ownerTelegramId)) {
    salah.push("ID Telegram owner harus angka (lihat di @userinfobot). Id grup yang diawali minus tidak bisa dipakai.");
  }
  if (!usernameSah(botUsername)) {
    salah.push("Username bot tidak sah. Tulis tanpa @, misalnya tokosaya_bot.");
  }
  if (!usernameSah(ownerUsername)) {
    salah.push("Username owner tidak sah. Tulis tanpa @, misalnya namaku.");
  }
  if (!markupSah(markupPersen)) {
    salah.push(`Markup harus angka ${MARKUP_MIN}–${MARKUP_MAKS} persen.`);
  }
  return salah;
}

/** Bot milik satu akun, tanpa token asli. */
export async function botMilik(pemilikToken) {
  if (!pemilikToken) return [];
  const col = await botsCol();
  const rows = await col.find({ jenis: "reseller", pemilikToken }).sort({ createdAt: 1 }).limit(20).toArray();
  return rows.map(bentukUntukPemilik);
}

function bentukUntukPemilik(b) {
  return {
    botId: b.botId,
    username: b.username,
    nama: b.nama,
    aktif: b.aktif !== false,
    dimatikanAdmin: !!b.dimatikanAdmin,
    // Token TIDAK pernah dikirim ke peramban, bahkan ke pemiliknya sendiri.
    // Ia bisa saja menempelnya lagi kalau butuh; yang tidak pernah dikirim
    // tidak bisa bocor lewat riwayat peramban, ekstensi, atau berbagi layar.
    tokenSamar: samarkanToken(b.token),
    ownerTelegramId: b.ownerTelegramId || "",
    ownerUsername: b.ownerUsername || "",
    markupPersen: Number(b.markupPersen) || 0,
    komisi: Number(b.komisi) || 0,
    jumlahPembeli: Number(b.jumlahPembeli) || 0,
    webhookOk: !!b.webhookOk,
    webhookPesan: b.webhookPesan || "",
    createdAt: b.createdAt || null
  };
}

/**
 * Membuat bot reseller.
 *
 * Tokennya diperiksa ke Telegram DULU. Bot yang tokennya mati tidak boleh
 * masuk daftar: sesudah masuk ia terlihat seperti bot yang bekerja padahal
 * tidak pernah menjawab siapa pun, dan pemiliknya akan mengira sistemnya rusak.
 */
export async function buatBotReseller({ pemilikToken, calon, ...isian }) {
  const salah = periksaIsian(isian);
  if (salah.length) return { ok: false, salah };

  const tokenBot = String(isian.token).trim();
  const cek = await periksaToken(tokenBot);
  if (!cek.ok) return { ok: false, salah: [cek.alasan] };

  await ensureIndexes();
  const col = await botsCol();

  // Bot yang sama tidak boleh diklaim dua orang. Yang lebih dulu tetap
  // pemiliknya; kalau tidak, siapa pun yang tahu tokennya bisa mengambil alih
  // bot orang lain beserta komisinya.
  const sudah = await col.findOne({ botId: cek.botId });
  if (sudah && sudah.pemilikToken && sudah.pemilikToken !== pemilikToken) {
    return { ok: false, salah: ["Bot ini sudah didaftarkan akun lain."] };
  }
  // Bot yang dimatikan admin tidak bisa dihidupkan lewat jalur pendaftaran:
  // upsert di bawah memaksa aktif:true dan memasang webhook lagi, jadi tanpa
  // pemeriksaan ini "daftar ulang token yang sama" membatalkan keputusan admin.
  if (sudah?.dimatikanAdmin) {
    return { ok: false, salah: ["Bot ini dimatikan oleh admin. Hubungi admin kalau merasa ini keliru."] };
  }
  if (sudah && sudah.jenis === "toko") {
    return { ok: false, salah: ["Bot ini dipakai sebagai bot toko utama, tidak bisa dijadikan bot reseller."] };
  }

  const jumlah = await col.countDocuments({ jenis: "reseller", pemilikToken });
  if (!sudah && jumlah >= MAKS_BOT_PER_AKUN) {
    return { ok: false, salah: [`Satu akun maksimal ${MAKS_BOT_PER_AKUN} bot. Hapus salah satu dulu.`] };
  }

  // Username yang diketik pengguna hanya dipakai kalau cocok dengan yang
  // dikatakan Telegram. Kalau berbeda, yang dari Telegram yang dipakai —
  // tautan t.me ke username yang salah akan membawa pembelinya ke bot lain.
  const usernameAsli = cek.username || bersihkanUsername(isian.botUsername);

  const doc = {
    botId: cek.botId,
    token: tokenBot,
    username: usernameAsli,
    nama: cek.nama,
    jenis: "reseller",
    pemilikToken,
    ownerTelegramId: String(isian.ownerTelegramId).trim(),
    ownerUsername: bersihkanUsername(isian.ownerUsername),
    markupPersen: Math.round(Number(isian.markupPersen) || 0),
    aktif: true,
    updatedAt: new Date()
  };

  try {
    await col.updateOne(
      { botId: cek.botId },
      {
        $set: doc,
        $setOnInsert: {
          createdAt: new Date(),
          jumlahUpdate: 0,
          komisi: 0,
          jumlahPembeli: 0,
          webhookSecret: null
        }
      },
      { upsert: true }
    );
  } catch (err) {
    if (err?.code === 11000) return { ok: false, salah: ["Token ini sudah dipakai bot lain."] };
    throw err;
  }

  // Webhook dipasang SESUDAH tersimpan: kalau dibalik, Telegram bisa mulai
  // mengirim ke alamat bot yang belum ada di database dan update pertamanya
  // ditolak tanpa jejak.
  const webhook = await pasangWebhook(tokenBot, cek.botId, calon);
  await botsUpdateWebhook(cek.botId, webhook);

  const dibuat = await col.findOne({ botId: cek.botId });
  return {
    ok: true,
    baru: !sudah,
    bot: bentukUntukPemilik(dibuat),
    webhook
  };
}

/** Mengubah markup. Hanya pemiliknya, dan hanya dalam batas yang wajar. */
export async function setMarkupReseller(pemilikToken, botId, markupPersen) {
  if (!markupSah(markupPersen)) {
    return { ok: false, alasan: `Markup harus ${MARKUP_MIN}–${MARKUP_MAKS} persen.` };
  }
  const m = Number(String(markupPersen).trim());
  const col = await botsCol();
  // pemilikToken ada DI DALAM filter, bukan diperiksa lebih dulu: dengan
  // "periksa dulu", satu jalur yang lupa memeriksanya sudah cukup untuk
  // membuat siapa pun mengubah markup bot orang lain.
  const r = await col.updateOne(
    { botId: String(botId), jenis: "reseller", pemilikToken },
    { $set: { markupPersen: Math.round(m), updatedAt: new Date() } }
  );
  if (!r.matchedCount) return { ok: false, alasan: "Bot tidak ditemukan atau bukan milikmu." };
  return { ok: true };
}

export async function setAktifReseller(pemilikToken, botId, aktif) {
  const col = await botsCol();
  const b = await col.findOne({ botId: String(botId), jenis: "reseller", pemilikToken });
  if (!b) return { ok: false, alasan: "Bot tidak ditemukan atau bukan milikmu." };
  // Yang dimatikan admin hanya admin yang boleh menyalakan. Pemiliknya boleh
  // mematikan sendiri (itu tidak merugikan siapa pun), tapi tidak sebaliknya.
  if (aktif && b.dimatikanAdmin) {
    return { ok: false, terkunci: true, alasan: "Bot ini dimatikan oleh admin. Hubungi admin kalau merasa ini keliru." };
  }
  await col.updateOne({ botId: String(botId) }, { $set: { aktif: !!aktif, updatedAt: new Date() } });
  // Bot yang dimatikan juga dilepas webhooknya, supaya Telegram berhenti
  // mengirim. Kalau cuma ditandai nonaktif, updatenya tetap datang dan dibuang
  // diam-diam — pembelinya mengira botnya rusak, bukan sedang tutup.
  if (!aktif) await lepasWebhook(b.token);
  return { ok: true, token: b.token, webhookSecret: b.webhookSecret };
}

export async function hapusBotReseller(pemilikToken, botId) {
  const col = await botsCol();
  const b = await col.findOne({ botId: String(botId), jenis: "reseller", pemilikToken });
  if (!b) return { ok: false, alasan: "Bot tidak ditemukan atau bukan milikmu." };
  // Kalau boleh dihapus, "hapus lalu buat ulang" menghapus penandanya dan
  // membatalkan keputusan admin sama seperti daftar ulang.
  if (b.dimatikanAdmin) {
    return { ok: false, alasan: "Bot ini dimatikan oleh admin dan tidak bisa dihapus. Hubungi admin." };
  }
  if ((Number(b.komisi) || 0) > 0) {
    return {
      ok: false,
      alasan: `Masih ada komisi Rp${Number(b.komisi).toLocaleString("id-ID")} di bot ini. Tarik dulu sebelum menghapusnya.`
    };
  }
  await lepasWebhook(b.token);
  await col.deleteOne({ botId: String(botId) });
  return { ok: true };
}
