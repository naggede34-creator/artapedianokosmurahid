// Dijalankan otomatis setelah `npm run build` (skrip "postbuild"), HANYA di Cloudflare Workers Builds
// (env WORKERS_CI=1) atau bila CF_OPENNEXT=1. Di Vercel/Netlify/lokal tidak melakukan apa-apa.
// Perlu karena `npx wrangler deploy` memanggil `opennextjs-cloudflare deploy`, yang mensyaratkan
// build OpenNext sudah ada — sementara dashboard Cloudflare hanya menjalankan `npm run build`.
import { spawnSync } from "node:child_process";

const di_cf = process.env.WORKERS_CI === "1" || process.env.CF_OPENNEXT === "1";
if (!di_cf || process.env.ARTA_OPENNEXT_SEDANG_BUILD) process.exit(0); // penjaga: build OpenNext memanggil `npm run build` lagi

console.log("[postbuild] Cloudflare terdeteksi → opennextjs-cloudflare build");
const r = spawnSync("npx", ["opennextjs-cloudflare", "build"], {
  stdio: "inherit",
  env: { ...process.env, ARTA_OPENNEXT_SEDANG_BUILD: "1" }
});
process.exit(r.status ?? 1);
