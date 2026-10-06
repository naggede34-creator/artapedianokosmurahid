// Dijalankan Next.js sekali saat server hidup. Dipakai untuk penjadwal internal
// di host yang prosesnya HIDUP TERUS (Render, VPS, Docker). Di Vercel/Netlify/
// Cloudflare tidak aktif — di sana jadwalnya dari vercel.json / cron eksternal.
//
// PENTING: import-nya HARUS berada di dalam blok `if (NEXT_RUNTIME === "nodejs")` (bukan early-return).
// Next menyusun instrumentation untuk runtime Node DAN Edge; dengan early-return, bundler Edge tetap mencoba
// membundel lib/jadwalInternal → mongodb dan gagal ("Can't resolve 'net' / 'crypto' / 'child_process'").
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.INTERNAL_CRON === "1") {
    const { mulaiJadwalInternal } = await import("./lib/jadwalInternal");
    mulaiJadwalInternal();
  }
}
