/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  // Exclude native/WASM packages from Next.js bundling so Node.js resolves them
  // directly at runtime (required for @resvg/resvg-js and satori's HarfBuzz WASM).
  experimental: {
    serverComponentsExternalPackages: ["@resvg/resvg-js", "satori", "harfbuzzjs"],
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
          { key: "Cache-Control", value: "no-store, must-revalidate" }
        ]
      }
    ];
  }
};
module.exports = nextConfig;
