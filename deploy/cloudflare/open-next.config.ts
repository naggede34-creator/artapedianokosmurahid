// Salin ke akar proyek. Konfigurasi minimal OpenNext untuk Cloudflare (tanpa R2/KV cache:
// situs ini dinamis penuh, tidak memakai ISR).
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({});
