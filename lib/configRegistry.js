// Daftar semua isian konfigurasi yang bisa diisi dari dasbor admin ATAU dari
// Environment Variables Vercel.
//
// Aturannya satu, dan sengaja sederhana:
//   - diisi di web            → langsung jalan
//   - diisi di Vercel         → langsung jalan
//   - diisi di salah satunya  → cukup, tidak perlu mengisi di dua tempat
// Kalau keduanya terisi, yang dari web dipakai (lebih baru, dan yang sengaja
// diketik orang di dasbor menang atas yang sudah lama tertanam di Vercel).
//
// Berkas ini SENGAJA tidak mengimpor apa pun (tanpa database, tanpa crypto):
// panel admin adalah komponen klien dan butuh daftar ini untuk menggambar
// formulirnya, dan sekali database ikut terbawa ke bundel peramban, koneksinya
// ikut bocor ke sana.
//
// hanyaEnv: tidak boleh disimpan di web, dengan alasannya masing-masing —
//   MONGODB_URI  dipakai untuk MEMBUKA database; tidak bisa dibaca dari
//                database yang belum terbuka.
//   CRON_SECRET  Vercel Cron mengirim header dari Environment Variable-nya
//                sendiri. Nilai yang cuma ada di web tidak pernah dikirim ke
//                jadwalnya, jadi semua cron akan ditolak.
export const GRUP = [
  { id: "admin", judul: "🔐 Keamanan admin" },
  { id: "otp", judul: "📱 Penyedia nomor (OTP)" },
  { id: "bayar", judul: "💳 Pembayaran QRIS" },
  { id: "telegram", judul: "🤖 Telegram & bot" },
  { id: "lain", judul: "⚙️ Lainnya" }
];

const url = { cek: /^https:\/\/[^\s]+$/i, pesanCek: "Harus diawali https://" };
const angka = (maks) => ({
  cek: new RegExp("^\\d+(\\.\\d+)?$"),
  pesanCek: `Harus angka${maks ? ` (0–${maks})` : ""}`,
  maks
});
const tokenBot = { cek: /^\d{6,}:[A-Za-z0-9_-]{20,}$/, pesanCek: "Format token bot: 1234567890:AAH..." };
const idTelegram = { cek: /^(@[A-Za-z0-9_]{4,}|-?\d{5,})$/, pesanCek: "Isi ID angka (contoh -1001234567890) atau @username channel" };
const daftarId = { cek: /^\s*\d{5,}(\s*[,;\s]\s*\d{5,})*\s*$/, pesanCek: "Isi ID angka Telegram, pisahkan dengan koma" };

export const KONFIG = [
  // ── Keamanan admin ────────────────────────────────────────────────────────
  {
    nama: "ADMIN_CODE", grup: "admin", label: "Kode admin", rahasia: true, khusus: "kodeAdmin",
    bantuan:
      "Kode untuk masuk ke /admin. Kalau diisi di web, disimpan sebagai hash (tidak bisa dibaca balik). " +
      "Kode dari Vercel tetap berlaku sebagai kunci cadangan kalau kamu lupa kode dari web."
  },
  {
    nama: "ADMIN_SECRET", grup: "admin", label: "Rahasia tanda tangan sesi (opsional)", rahasia: true, lanjutan: true,
    bantuan: "Boleh dikosongkan. Kalau kosong, diturunkan otomatis dari kode admin."
  },
  {
    nama: "CRON_SECRET", grup: "admin", label: "Rahasia cron", rahasia: true, hanyaEnv: true,
    bantuan:
      "Hanya bisa lewat Vercel → Settings → Environment Variables. Vercel Cron mengirim header dari variabel itu sendiri; " +
      "nilai yang hanya ada di web tidak pernah dikirim, dan semua cron akan ditolak. Kosong = endpoint cron terbuka."
  },
  {
    nama: "MONGODB_URI", grup: "admin", label: "Alamat database MongoDB", rahasia: true, hanyaEnv: true,
    bantuan: "Hanya bisa lewat Vercel: ia dipakai untuk membuka database, jadi tidak bisa dibaca dari database itu sendiri."
  },

  // ── Penyedia nomor ────────────────────────────────────────────────────────
  { nama: "RUMAHOTP_APIKEY", grup: "otp", label: "RumahOTP — API key", rahasia: true, contoh: "otp_xxxxxxxx" },
  { nama: "WARUNGNOKOS_APIKEY", grup: "otp", label: "WarungNokos — API key", rahasia: true },
  { nama: "WARUNGNOKOS_BASE_URL", grup: "otp", label: "WarungNokos — alamat API", bawaan: "https://warungnokos.web.id", ...url, lanjutan: true },
  { nama: "DIBANANA_APIKEY", grup: "otp", label: "Dibanana — API key", rahasia: true },
  { nama: "NEOXR_API_KEY", grup: "otp", label: "Neoxr — API key", rahasia: true, lanjutan: true },

  // ── Pembayaran ────────────────────────────────────────────────────────────
  { nama: "PAKASIR_PROJECT", grup: "bayar", label: "Pakasir — slug proyek", contoh: "nama-proyek" },
  { nama: "PAKASIR_APIKEY", grup: "bayar", label: "Pakasir — API key", rahasia: true },
  { nama: "PAKASIR_MERCHANT_ID", grup: "bayar", label: "Pakasir — merchant ID (untuk cek kesehatan)", lanjutan: true },
  { nama: "PAKASIR_BASE_URL", grup: "bayar", label: "Pakasir — alamat API", bawaan: "https://app.pakasir.com", ...url, lanjutan: true },
  {
    nama: "ATLANTIC_APIKEY", grup: "bayar", label: "Atlantic H2H — API key", rahasia: true,
    bantuan: "PERINGATAN: kunci ini bisa memindahkan uang KELUAR lewat transfer. Jangan pernah dibagikan."
  },
  { nama: "ATLANTIC_BASE_URL", grup: "bayar", label: "Atlantic — alamat API", bawaan: "https://atlantich2h.com", ...url, lanjutan: true },

  // ── Telegram ──────────────────────────────────────────────────────────────
  { nama: "TELEGRAM_BOT_TOKEN", grup: "telegram", label: "Bot notifikasi admin — token", rahasia: true, ...tokenBot },
  { nama: "TELEGRAM_CHAT_ID", grup: "telegram", label: "Chat ID admin (tujuan notifikasi)", ...idTelegram },
  { nama: "TELEGRAM_CHANNEL_ID", grup: "telegram", label: "Channel publik (ID atau @username)", ...idTelegram },
  { nama: "TELEGRAM_OWNER_IDS", grup: "telegram", label: "ID Telegram owner (boleh banyak, pisah koma)", ...daftarId },
  { nama: "TELEGRAM_WEBHOOK_SECRET", grup: "telegram", label: "Secret webhook bot notifikasi", rahasia: true, lanjutan: true },
  { nama: "SHOP_BOT_TOKEN", grup: "telegram", label: "Bot toko — token", rahasia: true, ...tokenBot },
  { nama: "SHOP_BOT_WEBHOOK_SECRET", grup: "telegram", label: "Secret webhook bot toko", rahasia: true, lanjutan: true },
  { nama: "SHOP_BOT_OWNER_IDS", grup: "telegram", label: "ID owner bot toko (kosong = pakai owner notifikasi)", ...daftarId, lanjutan: true },
  { nama: "TELEGRAM_MONITOR_CHAT_ID", grup: "telegram", label: "Chat pemantau cron", bawaan: "@diskusiduniotp", ...idTelegram, lanjutan: true },
  { nama: "TELEGRAM_MONITOR_THREAD_ID", grup: "telegram", label: "Thread pemantau cron", bawaan: "2949", lanjutan: true },

  // ── Lainnya ───────────────────────────────────────────────────────────────
  {
    nama: "REFERRAL_BONUS_PERCENT", grup: "lain", label: "Bonus undang teman (% dari deposit pertama)",
    bawaan: "0", ...angka(100), bantuan: "0 = bonus undang teman dimatikan."
  }
];

export const PETA = Object.fromEntries(KONFIG.map((k) => [k.nama, k]));

/** Isi yang mungkin dikirim dari luar: hanya nama yang ada di daftar, dan bukan hanyaEnv. */
export function bolehDiweb(nama) {
  const k = PETA[nama];
  return !!k && !k.hanyaEnv;
}

/** Menyamarkan rahasia: cukup untuk mengenali, tidak cukup untuk memakainya. */
export function samarkan(nilai) {
  const s = String(nilai || "");
  if (!s) return "";
  return s.length > 10 ? `••••••••${s.slice(-4)}` : "••••••••";
}
