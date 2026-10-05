// Dijalankan Next.js sekali saat server hidup. Dipakai untuk penjadwal internal
// di host yang prosesnya HIDUP TERUS (Render, VPS, Docker). Di Vercel/Netlify/
// Cloudflare tidak aktif — di sana jadwalnya dari vercel.json / cron eksternal.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.INTERNAL_CRON !== "1") return;
  const { mulaiJadwalInternal } = await import("./lib/jadwalInternal");
  mulaiJadwalInternal();
}
