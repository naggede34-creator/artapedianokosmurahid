/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  // Exclude native/WASM packages from Next.js bundling so Node.js resolves them
  // directly at runtime (required for @resvg/resvg-js and satori's HarfBuzz WASM).
  experimental: {
    serverComponentsExternalPackages: ["@resvg/resvg-js", "satori", "harfbuzzjs"],
    // Banner sambutan bot dikirim ke Telegram sebagai berkas, bukan lewat URL,
    // supaya tidak bergantung pada alamat situs yang bisa salah isi. Berkas di
    // public/ tidak ikut terbawa ke fungsi serverless kecuali disebut di sini.
    outputFileTracingIncludes: {
      "/api/bot/webhook": ["./public/bot-welcome.jpg"],
    },
  },
  // Browser bawaan Telegram (dibuka lewat tombol link biasa, bukan web_app) suka
  // nyimpen cache halaman HTML lebih agresif daripada Chrome/Safari biasa, jadi
  // setelah redeploy user masih lihat tampilan lama sampai mereka clear cache
  // manual. Header di bawah ini maksa setiap halaman (bukan file statis di
  // /_next/static, itu tetap boleh di-cache lama karena namanya sudah pakai hash
  // unik per build) untuk selalu dicek ulang ke server, bukan diambil dari cache.
  async headers() {
    return [
      {
        source: "/((?!_next/static|_next/image|favicon.ico).*)",
        headers: [
          { key: "Cache-Control", value: "no-store, must-revalidate" },
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
              "connect-src 'self'",
              "frame-ancestors 'none'",
            ].join("; ")
          },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }
        ]
      }
    ];
  }
};
module.exports = nextConfig;
