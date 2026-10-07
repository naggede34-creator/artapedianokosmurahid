// Teks notifikasi giveaway, dibuat dengan blok rich (lib/rich.js). Bentuk
// klasiknya untuk fallback dibuat otomatis dari blok yang sama.
import { rich } from "@/lib/rich";
import { samarToken } from "@/lib/giveaway";

const hadiahTeks = (ev) => `Rp${Number(ev.nilaiHadiah).toLocaleString("id-ID")}`;

const jam = (d) =>
  new Date(d).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export function giveawayBaruNotif(ev) {
  // Event yang jadwalnya masih di depan diumumkan sebagai "akan dibuka", bukan
  // "dibuka": pembaca yang langsung menekan Ikut akan ditolak dan mengira
  // giveawaynya rusak.
  const belumMulai = ev.mulaiAt && new Date(ev.mulaiAt).getTime() > Date.now();
  return rich([
    { h2: belumMulai ? "🎁 GIVEAWAY AKAN DIBUKA!" : "🎁 GIVEAWAY DIBUKA!" },
    { h3: ev.judul },
    ...(ev.keterangan ? [{ p: [{ i: ev.keterangan }] }] : []),
    { h1: `🏆 ${hadiahTeks(ev)}` },
    { p: [{ i: "hadiah per pemenang" }] },
    {
      table: {
        rows: [
          ["👥 Pemenang", `${ev.jumlahPemenang} orang`],
          ["🎟 Kuota", ev.maksPeserta > 0 ? `${ev.maksPeserta} peserta` : "tanpa batas"],
          ...(belumMulai ? [["🟢 Buka", `${jam(ev.mulaiAt)} WIB`]] : []),
          ["🕐 Tutup", `${jam(ev.selesaiAt)} WIB`]
        ]
      }
    },
    { hr: true },
    {
      footer: belumMulai
        ? "Pendaftaran baru bisa dilakukan mulai jam buka di atas. Gratis, pemenangnya diundi acak."
        : "Buka menu Giveaway di web, tekan Ikut. Gratis, pemenangnya diundi acak."
    }
  ]);
}

/**
 * Kuota pesertanya habis. Diumumkan sekali saja, tepat saat kursi terakhir
 * terisi — bukan tiap kali ada yang mencoba mendaftar sesudah penuh.
 */
export function giveawayPenuhNotif(ev) {
  return rich([
    { h2: "🎟 KUOTA GIVEAWAY PENUH" },
    { h3: ev.judul },
    {
      table: {
        rows: [
          ["👥 Peserta", `${ev.maksPeserta} orang (penuh)`],
          ["🏆 Hadiah", `${hadiahTeks(ev)} untuk ${ev.jumlahPemenang} pemenang`],
          ["🕐 Undian", `${jam(ev.selesaiAt)} WIB`]
        ]
      }
    },
    { hr: true },
    { footer: "Pendaftaran ditutup. Pemenangnya diundi acak dan diumumkan di sini." }
  ]);
}

export function giveawayBatalNotif(ev) {
  return rich([
    { h2: "🚫 GIVEAWAY DIBATALKAN" },
    { h3: ev.judul },
    { table: { rows: [["👥 Peserta terdaftar", `${Number(ev.jumlahPeserta) || 0} orang`]] } },
    { hr: true },
    { footer: "Tidak ada undian untuk event ini. Tidak ada saldo siapa pun yang terpotong — ikut giveaway memang gratis." }
  ]);
}

export function giveawayMenangNotif({ event, pemenang }) {
  const berhasil = (pemenang || []).filter((p) => !p.gagal);
  if (!berhasil.length) {
    return rich([
      { h2: "🎁 GIVEAWAY SELESAI" },
      { h3: event.judul },
      { p: "Tidak ada peserta yang ikut." }
    ]);
  }
  // Kode akun DISAMARKAN. Pengumuman ini dibaca semua orang, dan kode akun
  // adalah kredensial — menampilkannya utuh sama saja membagikan kunci akun
  // pemenangnya ke seluruh pembaca channel.
  return rich([
    { h2: "🎉 PEMENANG GIVEAWAY" },
    { h3: event.judul },
    { h1: `🏆 ${hadiahTeks(event)}` },
    { p: [{ i: "per orang" }] },
    {
      table: {
        headers: ["#", "Pemenang", "Akun"],
        rows: berhasil.map((p, i) => [String(i + 1), p.nama || "Tanpa nama", [{ code: samarToken(p.token) }]])
      }
    },
    { hr: true },
    { footer: "Hadiahnya sudah masuk otomatis ke akun masing-masing. Selamat! 🎊" }
  ]);
}
