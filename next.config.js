/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  // Paket native/WASM tidak ikut dibundel Next.js, dimuat langsung oleh Node saat jalan
  // (butuh @resvg/resvg-js dan HarfBuzz WASM milik satori). Next 15: opsi ini sudah
  // stabil di tingkat atas (dulu experimental.serverComponentsExternalPackages).
  serverExternalPackages: ["@resvg/resvg-js", "satori", "harfbuzzjs", "tesseract.js", "tesseract.js-core"],
  // Berkas yang dimuat lewat path dinamis tidak terlacak otomatis, jadi harus disebut agar
  // ikut terbawa ke fungsi serverless (Vercel/Netlify). Dulu experimental.outputFileTracingIncludes.
  outputFileTracingIncludes: {
    // OCR bukti transfer: pekerja tesseract, inti WASM, dan data bahasa.
    "/api/deposit/confirm": ["./node_modules/tesseract.js/**/*", "./node_modules/tesseract.js-core/**/*", "./lib/ocr/data/*"],
    "/api/bot/webhook/[botId]": ["./node_modules/tesseract.js/**/*", "./node_modules/tesseract.js-core/**/*", "./lib/ocr/data/*"],
    // Banner sambutan bot dikirim ke Telegram sebagai berkas, bukan lewat URL.
    "/api/bot/webhook": ["./public/bot-welcome.jpg", "./node_modules/tesseract.js/**/*", "./node_modules/tesseract.js-core/**/*", "./lib/ocr/data/*"],
  },
  // Browser bawaan Telegram (dibuka lewat tombol link biasa, bukan web_app) suka
  // nyimpen cache halaman HTML lebih agresif daripada Chrome/Safari biasa, jadi
  // setelah redeploy user masih lihat tampilan lama sampai mereka clear cache
  // manual. Header di bawah ini maksa setiap halaman (bukan file statis di
  // /_next/static, itu tetap boleh di-cache lama karena namanya sudah pakai hash
  // unik per build) untuk selalu dicek ulang ke server, bukan diambil dari cache.
  async headers() {
    // Rute yang sengaja di-cache publik (gambar versi-di-URL, status ringan): Cache-Control-nya diatur rutenya sendiri.
    // Di Next 15 header dari config MENIMPA header rute, jadi rute-rute ini dikecualikan dari aturan no-store di bawah
    // (header keamanan tetap dipasang lewat aturan kedua).
    const CACHE_SENDIRI = "api/ban-tampilan/gambar|api/status";
    const keamanan = [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https:",
              // Catatan suara diputar dari data:/blob:. Tanpa media-src, aturan
              // default-src 'self' memblokirnya dan tombol putar diam saja.
              "media-src 'self' data: blob:",
              "connect-src 'self'",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "object-src 'none'",
            ].join("; ")
          },
          { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }
    ];
    return [
      { source: `/((?!_next/static|_next/image|favicon.ico|${CACHE_SENDIRI}).*)`, headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }, ...keamanan] },
      { source: `/:path((?:${CACHE_SENDIRI}).*)`, headers: keamanan }
    ];
  }
};
module.exports = nextConfig;
