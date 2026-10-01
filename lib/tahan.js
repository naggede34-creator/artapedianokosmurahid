// Menahan pekerjaan latar tetap hidup sampai selesai di Vercel.
//
// Di fungsi serverless, begitu respons dikirim proses bisa langsung dibekukan — kiriman Telegram yang tidak
// di-await (notif admin, channel, bot) sering ikut mati: itulah sebab "saldo sudah masuk tapi notif di bot
// tidak muncul". `waitUntil` meminta Vercel menunggu promise-nya selesai. Di luar Vercel (lokal/uji) tidak
// melakukan apa-apa dan promise tetap berjalan normal.
export function tahan(promise) {
  try {
    const p = Promise.resolve(promise).catch(() => {});
    const konteks = globalThis[Symbol.for("@vercel/request-context")]?.get?.();
    konteks?.waitUntil?.(p);
  } catch {}
  return promise;
}
