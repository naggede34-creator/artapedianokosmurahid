# Deploy ke Cloudflare (Workers + OpenNext)

Cloudflare tidak menjalankan Next.js secara langsung; dipakai adaptor resmi
**OpenNext** (`@opennextjs/cloudflare`). Vercel dan Netlify TIDAK butuh langkah ini.

Berkas `wrangler.jsonc` dan `open-next.config.ts` sudah ada di akar proyek, dan
`@opennextjs/cloudflare` + `wrangler` sudah terdaftar di devDependencies.

**Lewat Cloudflare Workers Builds (hubungkan repo GitHub):** biarkan Build command
`npm run build` dan Deploy command `npx wrangler deploy`. `wrangler.jsonc` menjalankan
`opennextjs-cloudflare build` otomatis lewat skrip `postbuild` (hanya aktif di Cloudflare, env `WORKERS_CI=1`).
Nama proyek di dashboard Cloudflare harus sama dengan `"name"` di `wrangler.jsonc`
(`artapedianokosmurahid`). Kalau mau ganti nama, ubah `name` DAN `services[0].service`.

**Dari komputer sendiri:**
```bash
npm install
npx opennextjs-cloudflare build
CF_OPENNEXT=1 npm run build   # atau: npx opennextjs-cloudflare build
npx wrangler deploy
```

Isi variabel lewat dashboard Cloudflare (Workers → Settings → Variables and Secrets)
atau `npx wrangler secret put NAMA`. Yang WAJIB: `MONGODB_URI`. Sisanya boleh diisi
dari dasbor admin situs (Konfigurasi).

## Batasan yang perlu diketahui (belum diuji di sini)

- **Ukuran Worker**: batas 3 MiB (gratis) / 10 MiB (berbayar) setelah kompresi. Build terakhir
  ±3,3 MiB (gzip) — di atas batas gratis, jadi butuh paket Workers berbayar.
- **Modul native/WASM** tidak jalan di Workers: OCR bukti transfer (`tesseract.js`) dan
  pembuat gambar struk (`@resvg/resvg-js`). OCR otomatis gagal dan bukti diserahkan ke
  pengecekan admin (sudah begitu desain kodenya).
- **MongoDB lewat TCP**: driver resmi butuh `nodejs_compat`; koneksi tidak boleh dipakai
  lintas-permintaan di Workers pada beberapa versi runtime. Kalau muncul galat
  "Cannot perform I/O on behalf of a different request", jalankan di Vercel/Netlify.
- **Cron**: tidak ada `vercel.json`. Pakai Cron Trigger / cron eksternal yang memanggil
  `https://DOMAINMU/api/cron/tick?secret=RAHASIA_CRON` (rahasia diisi di dasbor admin).
- IP pengunjung: perlindungan IP situs membaca `x-forwarded-for`.
