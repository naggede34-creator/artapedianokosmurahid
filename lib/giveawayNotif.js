// Teks notifikasi giveaway.
import { esc } from "@/lib/shopBot";
import { samarToken } from "@/lib/giveaway";

const RULE = "━━━━━━━━━━━━━━━━━━━";
const hadiahTeks = (ev) =>
  ev.jenisHadiah === "poin"
    ? `${Number(ev.nilaiHadiah).toLocaleString("id-ID")} poin`
    : `Rp${Number(ev.nilaiHadiah).toLocaleString("id-ID")}`;

const jam = (d) =>
  new Date(d).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export function giveawayBaruNotif(ev) {
  // Event yang jadwalnya masih di depan diumumkan sebagai "akan dibuka", bukan
  // "dibuka": pembaca yang langsung menekan Ikut akan ditolak dan mengira
  // giveawaynya rusak.
  const belumMulai = ev.mulaiAt && new Date(ev.mulaiAt).getTime() > Date.now();
  return (
    `🎁  <b>${belumMulai ? "GIVEAWAY AKAN DIBUKA!" : "GIVEAWAY DIBUKA!"}</b>\n${RULE}\n\n` +
    `<b>${esc(ev.judul)}</b>\n` +
    (ev.keterangan ? `<i>${esc(ev.keterangan)}</i>\n` : "") +
    `\n` +
    `🏆 Hadiah   ╸ <b>${hadiahTeks(ev)}</b>\n` +
    `👥 Pemenang ╸ ${ev.jumlahPemenang} orang\n` +
    `🎟 Kuota    ╸ ${ev.maksPeserta > 0 ? `${ev.maksPeserta} peserta` : "tanpa batas"}\n` +
    (belumMulai ? `🟢 Buka     ╸ ${jam(ev.mulaiAt)} WIB\n` : "") +
    `🕐 Tutup    ╸ ${jam(ev.selesaiAt)} WIB\n\n` +
    (belumMulai
      ? `Pendaftaran baru bisa dilakukan mulai jam buka di atas. Gratis, pemenangnya diundi acak.`
      : `Buka menu <b>Giveaway</b> di web, tekan <b>Ikut</b>. Gratis, pemenangnya diundi acak.`)
  );
}

/**
 * Kuota pesertanya habis.
 *
 * Diumumkan sekali saja, tepat saat kursi terakhir terisi — bukan tiap kali
 * ada yang mencoba mendaftar sesudah penuh. Kalau dikirim tiap percobaan,
 * giveaway yang ramai akan membanjiri channel dengan pesan yang sama.
 */
export function giveawayPenuhNotif(ev) {
  return (
    `🎟  <b>KUOTA GIVEAWAY PENUH</b>\n${RULE}\n\n` +
    `<b>${esc(ev.judul)}</b>\n\n` +
    `👥 Peserta  ╸ <b>${ev.maksPeserta} orang</b> (penuh)\n` +
    `🏆 Hadiah   ╸ <b>${hadiahTeks(ev)}</b> untuk ${ev.jumlahPemenang} pemenang\n` +
    `🕐 Undian   ╸ ${jam(ev.selesaiAt)} WIB\n\n` +
    `Pendaftaran ditutup. Pemenangnya diundi acak dan diumumkan di sini.`
  );
}

export function giveawayBatalNotif(ev) {
  return (
    `🚫  <b>GIVEAWAY DIBATALKAN</b>\n${RULE}\n\n` +
    `<b>${esc(ev.judul)}</b>\n\n` +
    `👥 Peserta terdaftar ╸ ${Number(ev.jumlahPeserta) || 0} orang\n\n` +
    `Tidak ada undian untuk event ini. Tidak ada saldo atau poin siapa pun yang terpotong — ikut giveaway memang gratis.`
  );
}

export function giveawayMenangNotif({ event, pemenang }) {
  const berhasil = (pemenang || []).filter((p) => !p.gagal);
  if (!berhasil.length) {
    return `🎁  <b>GIVEAWAY SELESAI</b>\n${RULE}\n\n<b>${esc(event.judul)}</b>\n\nTidak ada peserta yang ikut.`;
  }
  // Kode akun DISAMARKAN. Pengumuman ini dibaca semua orang, dan kode akun
  // adalah kredensial — menampilkannya utuh sama saja membagikan kunci akun
  // pemenangnya ke seluruh pembaca channel.
  const daftar = berhasil
    .map((p, i) => `${i + 1}. ${esc(p.nama || "Tanpa nama")} · <code>${esc(samarToken(p.token))}</code>`)
    .join("\n");
  return (
    `🎉  <b>PEMENANG GIVEAWAY</b>\n${RULE}\n\n` +
    `<b>${esc(event.judul)}</b>\n` +
    `Hadiah: <b>${hadiahTeks(event)}</b> per orang\n\n` +
    `${daftar}\n\n` +
    `Hadiahnya sudah masuk otomatis ke akun masing-masing. Selamat! 🎊`
  );
}
