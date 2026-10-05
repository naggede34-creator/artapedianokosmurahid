# Deploy ke Cloudflare (Workers + OpenNext)

Cloudflare tidak menjalankan Next.js secara langsung; dipakai adaptor resmi
**OpenNext** (`@opennextjs/cloudflare`). Vercel dan Netlify TIDAK butuh langkah ini.

```bash
# dari akar proyek
cp deploy/cloudflare/wrangler.jsonc .
cp deploy/cloudflare/open-next.config.ts .
npm install
npm install -D @opennextjs/cloudflare wrangler

npx opennextjs-cloudflare build
npx opennextjs-cloudflare deploy      # atau: npx opennextjs-cloudflare preview
```

Isi variabel lewat dashboard Cloudflare (Workers → Settings → Variables and Secrets)
atau `npx wrangler secret put NAMA`. Yang WAJIB: `MONGODB_URI`. Sisanya boleh diisi
dari dasbor admin situs (Konfigurasi).

## Batasan yang perlu diketahui (belum diuji di sini)

- **Ukuran Worker**: batas 3 MiB (gratis) / 10 MiB (berbayar) setelah kompresi. Situs ini
  besar; kemungkinan besar butuh paket berbayar.
- **Modul native/WASM** tidak jalan di Workers: OCR bukti transfer (`tesseract.js`) dan
  pembuat gambar struk (`@resvg/resvg-js`). OCR otomatis gagal dan bukti diserahkan ke
  pengecekan admin (sudah begitu desain kodenya).
- **MongoDB lewat TCP**: driver resmi butuh `nodejs_compat`; koneksi tidak boleh dipakai
  lintas-permintaan di Workers pada beberapa versi runtime. Kalau muncul galat
  "Cannot perform I/O on behalf of a different request", jalankan di Vercel/Netlify.
- **Cron**: tidak ada `vercel.json`. Pakai Cron Trigger / cron eksternal yang memanggil
  `https://DOMAINMU/api/cron/tick?secret=RAHASIA_CRON` (rahasia diisi di dasbor admin).
- IP pengunjung: perlindungan IP situs membaca `x-forwarded-for`.
