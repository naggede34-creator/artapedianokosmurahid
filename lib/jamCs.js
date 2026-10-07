// Jam kerja Customer Service: 09.00 – 22.00 WIB. Di luar jam itu tombol CS tidak bisa diklik dan hanya
// menampilkan "sedang di luar jam kerja". Tanpa impor apa pun: dipakai server, bot, dan komponen klien.
export const CS_BUKA_JAM = 9;
export const CS_TUTUP_JAM = 22;
export const CS_JAM_TEKS = "09.00–22.00 WIB";
export const CS_PESAN_TUTUP = `Sedang di luar jam kerja. Customer Service melayani setiap hari ${CS_JAM_TEKS}.`;

/** Jam & menit sekarang di WIB (UTC+7) — tidak bergantung zona waktu perangkat. */
function wib(date = new Date()) {
  const w = new Date(date.getTime() + 7 * 3600_000);
  return { jam: w.getUTCHours(), menit: w.getUTCMinutes() };
}

/** true bila CS sedang bekerja (09.00 ≤ waktu < 22.00 WIB). */
export function csBuka(date = new Date()) {
  const { jam } = wib(date);
  return jam >= CS_BUKA_JAM && jam < CS_TUTUP_JAM;
}

/** Teks "buka lagi ..." untuk ditampilkan saat tutup. */
export function csBukaLagi(date = new Date()) {
  const { jam } = wib(date);
  return jam >= CS_TUTUP_JAM ? "besok pukul 09.00 WIB" : "hari ini pukul 09.00 WIB";
}
