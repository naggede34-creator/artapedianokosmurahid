// Menu Admin Reseller di dalam bot buatan pengguna.
//
// Hanya pemilik botnya yang bisa membukanya. Pemeriksaannya diulang di SETIAP
// fungsi, bukan sekali di menunya: tombol inline Telegram bisa ditekan siapa
// pun yang pernah melihat pesannya, termasuk sesudah diteruskan ke orang lain.
// Menaruh pemeriksaannya hanya di menu berarti semua isinya terbuka lewat
// callback langsung.
import { botsCol } from "@/lib/db";
import { botAktif } from "@/lib/botContext";
import { editMessage, sendMessage, getSession, setSession, clearStep, rupiah, esc, RULE, head, panel, panelRow, foot } from "@/lib/shopBot";
import { ajukanPenarikan, daftarEwallet, daftarPenarikan, EWALLET, WD_MIN } from "@/lib/resellerWd";
import { MARKUP_MAKS, markupSah } from "@/lib/resellerBot";

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
  const col = await botsCol();
  await col.updateOne({ botId: bot.botId }, { $set: { markupPersen: Math.round(Number(String(teks).trim())) } });
  const r = await sendMessage(chatId, `✅ Markup jadi <b>${Math.round(Number(String(teks).trim()))}%</b>.`);
  return panelReseller(chatId, r?.result?.message_id);
}

export async function mintaPenarikan(chatId, messageId) {
  const bot = await botMilikSaya(chatId);
  if (!bot) return tolak(chatId, messageId);
  const komisi = Number(bot.komisi) || 0;
  if (komisi < WD_MIN) {
    return editMessage(chatId, messageId, `Komisi minimal ${rupiah(WD_MIN)} untuk menarik.`, [
      [{ text: "← Kembali", callback_data: "radm" }]
    ]);
  }
  await setSession(chatId, { step: "r_wd" });
  const contoh = daftarEwallet().map((e) => e.nama).join(" · ");
  return editMessage(
    chatId,
    messageId,
    `🏦  <b>TARIK KOMISI</b>\n${RULE}\n\n` +
      `Tersedia: <b>${rupiah(komisi)}</b>\n` +
      `Minimal: ${rupiah(WD_MIN)}\n\n` +
      `Kirim dalam SATU pesan, dipisah tanda titik dua:\n\n` +
      `<code>nominal:ewallet:nomor:nama</code>\n\n` +
      `Contoh:\n<code>20000:dana:08123456789:Budi Santoso</code>\n\n` +
      `E-wallet yang bisa: ${esc(contoh)}\n\n` +
      `⚠️ <b>Nomor yang salah ketik tidak bisa ditarik kembali.</b> Periksa dua kali sebelum kirim.`,
    [[{ text: "← Batal", callback_data: "radm" }]]
  );
}

export async function prosesPenarikan(chatId, teks) {
  const bot = await botMilikSaya(chatId);
  if (!bot) return;
  await clearStep(chatId);

  const bagian = String(teks).split(":").map((x) => x.trim());
  if (bagian.length < 4) {
    return sendMessage(
      chatId,
      "Formatnya belum benar. Kirim seperti ini:\n<code>20000:dana:08123456789:Budi Santoso</code>",
      [[{ text: "🏦 Coba lagi", callback_data: "rwd" }]]
    );
  }
  const [nominalTeks, ewalletTeks, nomor, ...sisaNama] = bagian;
  const nominal = Number(String(nominalTeks).replace(/[^\d]/g, ""));
  const ewallet = String(ewalletTeks).toLowerCase();
  // Nama boleh memuat titik dua (gelar, dsb) — bagian sisanya disatukan lagi.
  const atasNama = sisaNama.join(":").trim();

  const r = await ajukanPenarikan({
    pemilikToken: bot.pemilikToken,
    botId: bot.botId,
    nominal,
    ewallet,
    nomor,
    atasNama
  });

  if (!r.ok) {
    return sendMessage(chatId, `❌ ${esc(r.alasan)}`, [[{ text: "🏦 Coba lagi", callback_data: "rwd" }]]);
  }

  return sendMessage(
    chatId,
    head("✅", "PENARIKAN DIAJUKAN") +
      `\n💸  <b>${rupiah(r.amount)}</b>\n\n` +
      panel([
        panelRow("E-wallet", EWALLET[ewallet].nama),
        panelRow("Nomor", nomor),
        panelRow("Atas nama", atasNama),
        panelRow("Sisa komisi", rupiah(r.sisa))
      ]) +
      `\n` +
      foot("Diperiksa admin dulu, lalu dikirim. Kalau ditolak, komisimu kembali penuh."),
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
