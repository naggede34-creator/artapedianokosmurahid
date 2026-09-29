// Menu Admin Reseller di dalam bot buatan pengguna.
//
// Hanya pemilik botnya yang bisa membukanya. Pemeriksaannya diulang di SETIAP
// fungsi, bukan sekali di menunya: tombol inline Telegram bisa ditekan siapa
// pun yang pernah melihat pesannya, termasuk sesudah diteruskan ke orang lain.
// Menaruh pemeriksaannya hanya di menu berarti semua isinya terbuka lewat
// callback langsung.
import { botsCol, botSessionsCol } from "@/lib/db";
import { botAktif } from "@/lib/botContext";
import { editMessage, sendMessage, getSession, setSession, clearStep, rupiah, esc, RULE, head, panel, panelRow, foot } from "@/lib/shopBot";
import {
  ajukanPenarikan,
  daftarEwallet,
  daftarPenarikan,
  bersihDariPenarikan,
  EWALLET,
  WD_MIN,
  BIAYA_WD
} from "@/lib/resellerWd";
import { MARKUP_MAKS, markupSah } from "@/lib/resellerBot";
import { umumkan } from "@/lib/notifyHub";
import { resellerMarkupNotif, resellerBroadcastNotif } from "@/lib/resellerNotif";

/** Bot reseller yang sedang melayani, kalau chat ini pemiliknya. */
async function botMilikSaya(chatId) {
  const b = botAktif();
  if (b?.jenis !== "reseller") return null;
  if (!b.ownerTelegramId || String(b.ownerTelegramId) !== String(chatId)) return null;
  const col = await botsCol();
  return col.findOne({ botId: String(b.botId) });
}

const tolak = (chatId, messageId) =>
  editMessage(chatId, messageId, "Menu ini khusus pemilik bot.", [[{ text: "← Menu", callback_data: "home" }]]);

export async function panelReseller(chatId, messageId) {
  const bot = await botMilikSaya(chatId);
  if (!bot) return tolak(chatId, messageId);
  await clearStep(chatId);

  const komisi = Number(bot.komisi) || 0;
  const bisaTarik = komisi >= WD_MIN;

  const teks =
    head("🛠", "ADMIN RESELLER", `@${esc(bot.username)}`) +
    `\n💰  <b>${rupiah(komisi)}</b>\n<i>komisi siap ditarik</i>\n\n` +
    panel([
      panelRow("Markup", `${Number(bot.markupPersen) || 0}%`),
      panelRow("Terjual", String(Number(bot.jumlahTerjual) || 0)),
      panelRow("Pembeli", String(Number(bot.jumlahPembeli) || 0)),
      panelRow("Status", bot.aktif === false ? "NONAKTIF" : "aktif")
    ]) +
    `\n` +
    (bisaTarik
      ? `Komisimu sudah cukup untuk ditarik.\n`
      : `Penarikan mulai ${rupiah(WD_MIN)}. Kurang ${rupiah(WD_MIN - komisi)} lagi.\n`) +
    `\n` +
    foot("Markup dihitung di atas harga Arta Pedia. Selisihnya jadi komisimu.");

  const tombol = [
    [{ text: "📈 Ubah Markup", callback_data: "rmk" }],
    ...(bisaTarik ? [[{ text: "🏦 Tarik Komisi", callback_data: "rwd" }]] : []),
    [{ text: "📢 Broadcast ke Pembeli", callback_data: "rbc" }],
    [{ text: "🧾 Riwayat Penarikan", callback_data: "rwl" }],
    [{ text: "← Menu", callback_data: "home" }]
  ];
  return editMessage(chatId, messageId, teks, tombol);
}

export async function mintaMarkup(chatId, messageId) {
  const bot = await botMilikSaya(chatId);
  if (!bot) return tolak(chatId, messageId);
  await setSession(chatId, { step: "r_markup" });
  return editMessage(
    chatId,
    messageId,
    `📈  <b>UBAH MARKUP</b>\n${RULE}\n\n` +
      `Sekarang: <b>${Number(bot.markupPersen) || 0}%</b>\n\n` +
      `Kirim angka baru di chat ini, 0 sampai ${MARKUP_MAKS}.\n\n` +
      `Contoh: kirim <code>15</code> berarti harga di botmu 15% di atas harga Arta Pedia, ` +
      `dan 15% itu jadi komisimu.`,
    [[{ text: "← Batal", callback_data: "radm" }]]
  );
}

export async function simpanMarkup(chatId, teks) {
  const bot = await botMilikSaya(chatId);
  if (!bot) return;
  await clearStep(chatId);
  if (!markupSah(teks)) {
    return sendMessage(chatId, `Markup harus angka 0–${MARKUP_MAKS}. Coba lagi dari menu.`, [
      [{ text: "🛠 Admin Reseller", callback_data: "radm" }]
    ]);
  }
  const baru = Math.round(Number(String(teks).trim()));
  const col = await botsCol();
  await col.updateOne({ botId: bot.botId }, { $set: { markupPersen: baru } });

  umumkan({
    admin: resellerMarkupNotif({
      botUsername: bot.username,
      botNama: bot.nama,
      ownerUsername: bot.ownerUsername,
      lama: bot.markupPersen,
      baru
    })
  }).catch(() => {});

  const r = await sendMessage(chatId, `✅ Markup jadi <b>${baru}%</b>.`);
  return panelReseller(chatId, r?.result?.message_id);
}

/**
 * Penarikan dituntun langkah demi langkah.
 *
 * Sebelumnya semuanya diminta dalam satu pesan berformat
 * "nominal:ewallet:nomor:nama". Format seperti itu selalu salah ketik di
 * lapangan — dan di sini, salah ketik pada bagian nomor berarti uang terkirim
 * ke orang lain dan tidak bisa ditarik kembali.
 *
 * Satu pertanyaan satu langkah: tiap jawaban bisa diperiksa saat itu juga,
 * dan yang salah diulang tanpa mengetik ulang semuanya.
 */
export async function mintaPenarikan(chatId, messageId) {
  const bot = await botMilikSaya(chatId);
  if (!bot) return tolak(chatId, messageId);
  const komisi = Number(bot.komisi) || 0;
  if (komisi < WD_MIN) {
    return editMessage(chatId, messageId, `Komisi minimal ${rupiah(WD_MIN)} untuk menarik.`, [
      [{ text: "← Kembali", callback_data: "radm" }]
    ]);
  }

  // Sisa langkah sebelumnya dibuang. Tanpa itu, penarikan yang ditinggal di
  // tengah jalan akan memakai nomor e-wallet dari percobaan sebelumnya.
  await setSession(chatId, { step: "r_wd_nominal", rwd: null });

  return editMessage(
    chatId,
    messageId,
    `🏦  <b>TARIK KOMISI</b>\n${RULE}\n\n` +
      `Komisi tersedia: <b>${rupiah(komisi)}</b>\n\n` +
      `<b>Langkah 1 dari 4 — Nominal</b>\n` +
      `Ketik nominal yang mau ditarik.\n\n` +
      panel([
        panelRow("Minimal", rupiah(WD_MIN)),
        panelRow("Biaya admin", rupiah(BIAYA_WD)),
        panelRow("Maksimal", rupiah(komisi))
      ]) +
      `\n` +
      `Contoh: ketik <code>20000</code> \u2192 komisimu berkurang ${rupiah(20000)}, ` +
      `yang masuk ke e-wallet ${rupiah(bersihDariPenarikan(20000))}.\n\n` +
      foot("Biaya admin dipotong dari nominal, bukan ditambahkan."),
    [[{ text: "← Batal", callback_data: "radm" }]]
  );
}

/** Langkah 1: nominal. */
export async function wdNominal(chatId, teks) {
  const bot = await botMilikSaya(chatId);
  if (!bot) return;
  const komisi = Number(bot.komisi) || 0;
  const nominal = Number(String(teks).replace(/[^\d]/g, ""));

  if (!Number.isFinite(nominal) || nominal < WD_MIN) {
    return sendMessage(chatId, `Minimal ${rupiah(WD_MIN)}. Ketik angkanya saja, misal <code>20000</code>.`, [
      [{ text: "← Batal", callback_data: "radm" }]
    ]);
  }
  if (nominal > komisi) {
    return sendMessage(chatId, `Komisimu cuma ${rupiah(komisi)}. Ketik nominal yang lebih kecil.`, [
      [{ text: "← Batal", callback_data: "radm" }]
    ]);
  }

  await setSession(chatId, { step: "r_wd_ewallet", rwd: { nominal } });

  const tombol = daftarEwallet().map((e) => [{ text: e.nama, callback_data: `rwe:${e.kode}` }]);
  tombol.push([{ text: "← Batal", callback_data: "radm" }]);

  return sendMessage(
    chatId,
    `🏦  <b>TARIK KOMISI</b>\n${RULE}\n\n` +
      panel([
        panelRow("Nominal", rupiah(nominal)),
        panelRow("Biaya admin", `- ${rupiah(BIAYA_WD)}`),
        panelRow("Kamu terima", rupiah(bersihDariPenarikan(nominal)))
      ]) +
      `\n<b>Langkah 2 dari 4 — E-wallet</b>\nPilih tujuannya di bawah.`,
    tombol
  );
}

/** Langkah 2: e-wallet dipilih lewat tombol, bukan diketik. */
export async function wdEwallet(chatId, messageId, kode) {
  const bot = await botMilikSaya(chatId);
  if (!bot) return tolak(chatId, messageId);
  const sesi = await getSession(chatId);
  const nominal = sesi?.rwd?.nominal;
  if (!nominal || !EWALLET[kode]) {
    return editMessage(chatId, messageId, "Sesi penarikannya sudah tidak berlaku. Mulai lagi ya.", [
      [{ text: "🏦 Tarik Komisi", callback_data: "rwd" }]
    ]);
  }

  await setSession(chatId, { step: "r_wd_nomor", rwd: { nominal, ewallet: kode } });

  return editMessage(
    chatId,
    messageId,
    `🏦  <b>TARIK KOMISI</b>\n${RULE}\n\n` +
      panel([panelRow("Nominal", rupiah(nominal)), panelRow("E-wallet", EWALLET[kode].nama)]) +
      `\n<b>Langkah 3 dari 4 — Nomor</b>\n` +
      `Ketik nomor ${EWALLET[kode].nama} kamu.\n\n` +
      `Contoh: <code>${EWALLET[kode].contoh}</code>\n\n` +
      `\u26a0\ufe0f <b>Periksa dua kali.</b> Nomor yang salah ketik berarti uangnya terkirim ` +
      `ke orang lain, dan tidak bisa ditarik kembali.`,
    [[{ text: "← Batal", callback_data: "radm" }]]
  );
}

/** Langkah 3: nomor. */
export async function wdNomor(chatId, teks) {
  const bot = await botMilikSaya(chatId);
  if (!bot) return;
  const sesi = await getSession(chatId);
  const { nominal, ewallet } = sesi?.rwd || {};
  if (!nominal || !EWALLET[ewallet]) {
    return sendMessage(chatId, "Sesi penarikannya sudah tidak berlaku. Mulai lagi ya.", [
      [{ text: "🏦 Tarik Komisi", callback_data: "rwd" }]
    ]);
  }

  const nomor = String(teks).trim();
  if (!ewalletValidLokal(ewallet, nomor)) {
    return sendMessage(
      chatId,
      `Nomor ${EWALLET[ewallet].nama} belum benar. Bentuknya seperti <code>${EWALLET[ewallet].contoh}</code>.`,
      [[{ text: "← Batal", callback_data: "radm" }]]
    );
  }

  await setSession(chatId, { step: "r_wd_nama", rwd: { nominal, ewallet, nomor } });

  return sendMessage(
    chatId,
    `🏦  <b>TARIK KOMISI</b>\n${RULE}\n\n` +
      panel([
        panelRow("Nominal", rupiah(nominal)),
        panelRow("E-wallet", EWALLET[ewallet].nama),
        panelRow("Nomor", nomor)
      ]) +
      `\n<b>Langkah 4 dari 4 — Nama pemilik</b>\n` +
      `Ketik nama pemilik e-wallet itu, persis seperti yang terdaftar.`,
    [[{ text: "← Batal", callback_data: "radm" }]]
  );
}

/** Langkah 4: nama, lalu diajukan. */
export async function wdNama(chatId, teks) {
  const bot = await botMilikSaya(chatId);
  if (!bot) return;
  const sesi = await getSession(chatId);
  const { nominal, ewallet, nomor } = sesi?.rwd || {};
  if (!nominal || !ewallet || !nomor) {
    return sendMessage(chatId, "Sesi penarikannya sudah tidak berlaku. Mulai lagi ya.", [
      [{ text: "🏦 Tarik Komisi", callback_data: "rwd" }]
    ]);
  }

  await clearStep(chatId);
  await setSession(chatId, { rwd: null });

  const r = await ajukanPenarikan({
    pemilikToken: bot.pemilikToken,
    botId: bot.botId,
    nominal,
    ewallet,
    nomor,
    atasNama: String(teks).trim()
  });

  if (!r.ok) {
    return sendMessage(chatId, `\u274c ${esc(r.alasan)}`, [[{ text: "🏦 Coba lagi", callback_data: "rwd" }]]);
  }

  return sendMessage(
    chatId,
    head("✅", "PENARIKAN DIAJUKAN") +
      `\n💸  <b>${rupiah(r.diterima)}</b>\n<i>yang akan kamu terima</i>\n\n` +
      panel([
        panelRow("Nominal", rupiah(r.amount)),
        panelRow("Biaya admin", `- ${rupiah(r.biaya)}`),
        panelRow("Diterima", rupiah(r.diterima)),
        panelRow("E-wallet", EWALLET[ewallet].nama),
        panelRow("Nomor", nomor),
        panelRow("Atas nama", String(teks).trim()),
        panelRow("Sisa komisi", rupiah(r.sisa))
      ]) +
      `\n` +
      foot("Diperiksa admin dulu, lalu dikirim. Kalau ditolak, komisimu kembali PENUH termasuk biayanya."),
    [[{ text: "🛠 Admin Reseller", callback_data: "radm" }]]
  );
}

// Dipakai di langkah nomor. Diimpor terpisah supaya berkas ini tidak perlu
// tahu bentuk regexnya.
function ewalletValidLokal(kode, nomor) {
  const e = EWALLET[kode];
  if (!e) return false;
  return e.pola.test(String(nomor || "").trim());
}

/**
 * Broadcast ke pembeli bot ini saja.
 *
 * Bot tidak bisa mengirim pesan ke orang yang belum pernah memulai bot itu.
 * Menyiarkan ke sesi milik bot lain bukan cuma sia-sia — setiap kirimannya
 * gagal, lalu laporannya berbunyi "gagal: 4.000" dan pemiliknya menyimpulkan
 * broadcast-nya rusak.
 */
export async function mintaBroadcast(chatId, messageId) {
  const bot = await botMilikSaya(chatId);
  if (!bot) return tolak(chatId, messageId);

  const sessions = await botSessionsCol();
  const jumlah = await sessions.countDocuments({ botId: String(bot.botId) });

  await setSession(chatId, { step: "r_bc" });
  return editMessage(
    chatId,
    messageId,
    `📢  <b>BROADCAST</b>\n${RULE}\n\n` +
      `Pesanmu akan dikirim ke <b>${jumlah}</b> pembeli yang pernah membuka @${esc(bot.username)}.\n\n` +
      `Ketik pesannya di chat ini.\n\n` +
      `<i>Bisa pakai HTML sederhana: &lt;b&gt;tebal&lt;/b&gt;, &lt;i&gt;miring&lt;/i&gt;.</i>\n\n` +
      foot("Broadcast yang terlalu sering membuat orang memblokir botmu. Pakai seperlunya."),
    [[{ text: "← Batal", callback_data: "radm" }]]
  );
}

export async function kirimBroadcast(chatId, teks) {
  const bot = await botMilikSaya(chatId);
  if (!bot) return;
  await clearStep(chatId);

  const isi = String(teks || "").trim();
  if (isi.length < 3) {
    return sendMessage(chatId, "Pesannya terlalu pendek.", [[{ text: "📢 Coba lagi", callback_data: "rbc" }]]);
  }

  const sessions = await botSessionsCol();
  const semua = await sessions.find({ botId: String(bot.botId) }, { projection: { chatId: 1 } }).toArray();

  await sendMessage(chatId, `📤 Mengirim ke ${semua.length} chat…`);

  let ok = 0;
  let gagal = 0;
  for (const s of semua) {
    // Pemiliknya sendiri dilewati: ia sudah membaca pesannya saat mengetik.
    if (String(s.chatId) === String(chatId)) continue;
    const r = await sendMessage(
      s.chatId,
      `📢  <b>PENGUMUMAN</b>\n<i>dari @${esc(bot.username)}</i>\n${RULE}\n\n${isi}`
    );
    if (r?.ok) ok += 1;
    else gagal += 1;
  }

  // Admin situs dikabari: pesannya keluar lewat infrastruktur situs ini, jadi
  // laporan spam apa pun nantinya akan sampai ke sini, bukan ke resellernya.
  umumkan({
    admin: resellerBroadcastNotif({
      botUsername: bot.username,
      botNama: bot.nama,
      ownerUsername: bot.ownerUsername,
      terkirim: ok,
      gagal,
      cuplikan: isi
    })
  }).catch(() => {});

  return sendMessage(
    chatId,
    head("📢", "BROADCAST SELESAI") +
      `\n` +
      panel([panelRow("Terkirim", String(ok)), panelRow("Gagal", String(gagal))]) +
      `\n` +
      foot("Yang gagal biasanya sudah memblokir botmu atau menghapus chatnya."),
    [[{ text: "🛠 Admin Reseller", callback_data: "radm" }]]
  );
}

export async function riwayatPenarikan(chatId, messageId) {
  const bot = await botMilikSaya(chatId);
  if (!bot) return tolak(chatId, messageId);
  const rows = (await daftarPenarikan({ pemilikToken: bot.pemilikToken, batas: 10 })).filter(
    (w) => w.botId === bot.botId
  );

  if (!rows.length) {
    return editMessage(chatId, messageId, "Belum ada penarikan dari bot ini.", [
      [{ text: "← Kembali", callback_data: "radm" }]
    ]);
  }

  const ikon = { pending: "⏳", selesai: "✅", ditolak: "❌" };
  const isi = rows
    .map(
      (w) =>
        `${ikon[w.status] || "•"} <b>${rupiah(w.amount)}</b> · ${esc(w.ewalletNama)}\n` +
        `   ${new Date(w.createdAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}` +
        (w.status === "ditolak" && w.alasan ? `\n   <i>${esc(w.alasan)}</i>` : "")
    )
    .join("\n\n");

  return editMessage(chatId, messageId, `🧾  <b>RIWAYAT PENARIKAN</b>\n${RULE}\n\n${isi}`, [
    [{ text: "← Kembali", callback_data: "radm" }]
  ]);
}
