// Penarikan komisi reseller ke e-wallet.
//
// Manual: diperiksa admin dulu, baru dikirim. Bukan karena belum sempat
// diotomatiskan — uang yang terkirim ke nomor e-wallet yang salah ketik tidak
// bisa ditarik kembali, jadi lebih baik dilihat mata manusia dulu daripada
// cepat tapi salah.
import { randomUUID } from "node:crypto";
import { botsCol, resellerWdCol } from "@/lib/db";
import { EWALLET, ewalletValid } from "@/lib/gatewayConfig";

export const WD_MIN = 15000;

/**
 * Biaya admin penarikan.
 *
 * Dipotong dari nominal yang diminta, BUKAN ditambahkan di atasnya. Reseller
 * mengetik "20000" dan komisinya berkurang tepat 20.000 — kalau biayanya
 * ditambahkan, komisinya berkurang 21.500 dan angka yang ia ketik bukan angka
 * yang ia lihat hilang.
 */
export const BIAYA_WD = 1500;

/** Yang benar-benar dikirim ke e-wallet. */
export function bersihDariPenarikan(nominal) {
  return Math.max(0, Math.round(Number(nominal) || 0) - BIAYA_WD);
}

export { EWALLET, ewalletValid };

export function daftarEwallet() {
  return Object.entries(EWALLET).map(([kode, e]) => ({ kode, nama: e.nama, contoh: e.contoh }));
}

/**
 * Mengajukan penarikan.
 *
 * Komisinya dipotong DI DALAM filter, bukan diperiksa lebih dulu. Dengan
 * "periksa dulu", dua pengajuan yang datang bersamaan sama-sama melihat saldo
 * cukup dan keduanya lolos — resellernya menarik lebih banyak daripada yang
 * ia punya.
 */
export async function ajukanPenarikan({ pemilikToken, botId, nominal, ewallet, nomor, atasNama }) {
  const jumlah = Math.round(Number(nominal) || 0);
  if (!pemilikToken || !botId) return { ok: false, alasan: "Data kurang." };
  if (!Number.isFinite(jumlah) || jumlah < WD_MIN) {
    return { ok: false, alasan: `Penarikan minimal Rp${WD_MIN.toLocaleString("id-ID")}.` };
  }
  if (!EWALLET[ewallet]) return { ok: false, alasan: "E-wallet tidak dikenali." };
  if (!ewalletValid(ewallet, nomor)) {
    return { ok: false, alasan: `Nomor ${EWALLET[ewallet].nama} tidak sah. Contoh: ${EWALLET[ewallet].contoh}` };
  }
  const nama = String(atasNama || "").trim();
  if (nama.length < 2) return { ok: false, alasan: "Isi nama pemilik e-wallet." };

  const bots = await botsCol();
  // pemilikToken DI DALAM filter: tanpa itu, siapa pun yang tahu botId orang
  // lain bisa menarik komisinya.
  const sesudah = await bots.findOneAndUpdate(
    { botId: String(botId), jenis: "reseller", pemilikToken, komisi: { $gte: jumlah }, dibekukan: { $ne: true } },
    { $inc: { komisi: -jumlah } },
    { returnDocument: "after" }
  );
  if (!sesudah) {
    const b = await bots.findOne({ botId: String(botId), pemilikToken });
    if (!b) return { ok: false, alasan: "Bot tidak ditemukan atau bukan milikmu." };
    if (b.dibekukan) return { ok: false, alasan: "Bot ini sedang dibekukan admin." };
    return { ok: false, alasan: `Komisi kurang. Tersedia Rp${(Number(b.komisi) || 0).toLocaleString("id-ID")}.` };
  }

  const wdId = `rwd_${randomUUID()}`;
  try {
    const col = await resellerWdCol();
    await col.insertOne({
      wdId,
      botId: String(botId),
      botUsername: sesudah.username || "",
      pemilikToken,
      amount: jumlah,
      // Dua-duanya disimpan. Admin mengirim `diterima`, dan `biaya` ada
      // supaya selisihnya tidak perlu dihitung ulang dari konstanta yang
      // mungkin sudah berubah saat riwayatnya dibaca lagi nanti.
      biaya: BIAYA_WD,
      diterima: bersihDariPenarikan(jumlah),
      ewallet,
      ewalletNama: EWALLET[ewallet].nama,
      nomor: String(nomor).trim(),
      atasNama: nama.slice(0, 80),
      status: "pending",
      createdAt: new Date()
    });
  } catch (err) {
    // Pencatatannya gagal padahal komisinya sudah dipotong. Dikembalikan,
    // karena penarikan yang tidak tercatat tidak akan pernah dikirim admin —
    // uangnya cuma hilang dari saldo resellernya.
    console.error("[reseller-wd] gagal mencatat, komisi dikembalikan:", err?.message || err);
    await bots.updateOne({ botId: String(botId) }, { $inc: { komisi: jumlah } }).catch(() => {});
    return { ok: false, alasan: "Gagal menyimpan pengajuan. Komisi tidak terpotong, coba lagi." };
  }

  return { ok: true, wdId, sisa: sesudah.komisi, amount: jumlah, biaya: BIAYA_WD, diterima: bersihDariPenarikan(jumlah) };
}

/**
 * Penarikan yang ditolak admin mengembalikan komisi PENUH, termasuk biayanya.
 *
 * Biaya penarikan itu ongkos mengirim uang. Kalau uangnya tidak jadi dikirim,
 * memotong ongkosnya sama saja menagih orang untuk layanan yang tidak ia
 * terima.
 */
export async function tolakPenarikan(wdId, alasan = "") {
  const col = await resellerWdCol();
  const wd = await col.findOneAndUpdate(
    { wdId, status: "pending" },
    { $set: { status: "ditolak", alasan: String(alasan || "").slice(0, 300), selesaiAt: new Date() } },
    { returnDocument: "after" }
  );
  if (!wd) return { ok: false, alasan: "Penarikan tidak ditemukan atau sudah diproses." };

  const bots = await botsCol();
  await bots.updateOne({ botId: wd.botId }, { $inc: { komisi: wd.amount } });
  return { ok: true, wd };
}

export async function selesaikanPenarikan(wdId) {
  const col = await resellerWdCol();
  const wd = await col.findOneAndUpdate(
    { wdId, status: "pending" },
    { $set: { status: "selesai", selesaiAt: new Date() } },
    { returnDocument: "after" }
  );
  if (!wd) return { ok: false, alasan: "Penarikan tidak ditemukan atau sudah diproses." };
  return { ok: true, wd };
}

export async function daftarPenarikan({ pemilikToken = null, status = null, batas = 100 } = {}) {
  const col = await resellerWdCol();
  const filter = {};
  if (pemilikToken) filter.pemilikToken = pemilikToken;
  if (status && status !== "all") filter.status = status;
  const rows = await col.find(filter).sort({ createdAt: -1 }).limit(batas).toArray();
  return rows.map(({ _id, ...r }) => r);
}
