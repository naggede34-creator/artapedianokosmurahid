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
  { id: "reseller", judul: "🏪 Reseller & kreator" },
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
    nama: "RICH_MESSAGE", grup: "lain", label: "Rich Message Telegram (1 = nyala, 0 = mati)", bawaan: "1",
    cek: /^[01]$/, pesanCek: "Isi 1 (nyala) atau 0 (mati)",
    bantuan:
      "Pesan bot tampil dengan judul, tabel, dan tombol berwarna lewat sendRichMessage (Bot API 10.1+). " +
      "Kalau Telegram menolaknya, pesan otomatis dikirim dalam bentuk biasa. Isi 0 untuk mematikan sepenuhnya."
  },
  // ── Reseller & kreator ────────────────────────────────────────────────────
  {
    nama: "RESELLER_SLOT_HARGA", grup: "reseller", label: "Slot bot tambahan — harga per slot (Rp)", bawaan: "10000", ...angka(),
    bantuan: "Reseller bisa membeli slot bot di luar jatah 3 bot, dibayar dari saldo. 0 = penjualan slot dimatikan."
  },
  {
    nama: "RESELLER_SLOT_MAKS", grup: "reseller", label: "Slot bot tambahan — maksimal yang boleh dibeli", bawaan: "5", ...angka(50), lanjutan: true
  },
  {
    nama: "RESELLER_PREMIUM_HARGA", grup: "reseller", label: "Paket Premium reseller — harga (Rp)", bawaan: "30000", ...angka(),
    bantuan: "Premium: slot bot tambahan, batas markup lebih tinggi, dan tambahan potongan harga grosir. 0 = paket dimatikan."
  },
  { nama: "RESELLER_PREMIUM_HARI", grup: "reseller", label: "Paket Premium — masa berlaku (hari)", bawaan: "30", ...angka(365), lanjutan: true },
  { nama: "RESELLER_PREMIUM_SLOT", grup: "reseller", label: "Paket Premium — tambahan slot bot", bawaan: "2", ...angka(20), lanjutan: true },
  { nama: "RESELLER_PREMIUM_MARKUP_MAKS", grup: "reseller", label: "Paket Premium — batas markup (%)", bawaan: "200", ...angka(1000), lanjutan: true },
  { nama: "RESELLER_PREMIUM_DISKON", grup: "reseller", label: "Paket Premium — tambahan potongan grosir (%)", bawaan: "1", ...angka(20), lanjutan: true },
  {
    nama: "RESELLER_TIER", grup: "reseller", label: "Level reseller (omzet bulanan : potongan grosir % : bonus target Rp)",
    bawaan: "1000000:2:10000,5000000:4:50000,20000000:6:250000",
    cek: /^\s*(\d+:\d+(\.\d+)?:\d+)(\s*,\s*\d+:\d+(\.\d+)?:\d+)*\s*$/,
    pesanCek: "Format omzet:potongan:bonus, pisahkan koma. Contoh 1000000:2:10000,5000000:4:50000",
    bantuan:
      "Tiap level: omzet penjualan BERHASIL bulan itu (Rp) : potongan harga grosir untuk komisi (%) : bonus target sekali per bulan (Rp, masuk saldo). " +
      "Level dipertahankan sampai bulan berikutnya. Potongan tidak pernah membuat harga di bawah modal."
  },
  {
    nama: "AFILIASI_PERSEN", grup: "reseller", label: "Program kreator — komisi bawaan (% dari untung toko)", bawaan: "20", ...angka(90),
    bantuan:
      "Kreator yang disetujui admin mendapat persen ini dari UNTUNG toko (harga jual − modal) tiap nomor yang berhasil dibeli teman yang mereka undang, " +
      "selamanya. Admin bisa mengatur persen berbeda per kreator. 0 = program dimatikan."
  },
  {
    nama: "VAPID_PUBLIC_KEY", grup: "lain", label: "Push web — kunci publik VAPID", lanjutan: true,
    bantuan: "Kosongkan: kunci dibuat otomatis saat pertama dipakai. Isi (bersama kunci privat) hanya kalau mau memakai kunci sendiri."
  },
  {
    nama: "VAPID_PRIVATE_KEY", grup: "lain", label: "Push web — kunci privat VAPID", rahasia: true, lanjutan: true,
    bantuan: "Pasangan kunci publik di atas. Mengganti kunci membuat semua langganan lama tidak berlaku."
  },
  {
    nama: "VAPID_SUBJECT", grup: "lain", label: "Push web — kontak (mailto: atau https://)", bawaan: "mailto:admin@artapedia.id",
    cek: /^(mailto:[^\s@]+@[^\s@]+|https:\/\/\S+)$/, pesanCek: "Isi mailto:email@domain atau alamat https://", lanjutan: true
  },
  {
    nama: "JAMINAN_PERSEN", grup: "lain", label: "Jaminan OTP — biaya (% dari harga nomor)", bawaan: "10", ...angka(50),
    bantuan:
      "Pembeli boleh menambah jaminan: kalau kode OTP belum masuk sesudah beberapa menit, nomornya diganti otomatis. " +
      "Biaya jaminan hanya ditahan kalau kode akhirnya masuk; kalau gagal, seluruhnya dikembalikan. 0 = fitur mati."
  },
  {
    nama: "JAMINAN_MENIT", grup: "lain", label: "Jaminan OTP — tunggu berapa menit sebelum ganti", bawaan: "4", ...angka(15),
    lanjutan: true, bantuan: "Minimal 4: provider baru mau membatalkan nomor sesudah sekitar 3 menit."
  },
  {
    nama: "REFERRAL_MIN_DEPOSIT", grup: "lain", label: "Bonus undang teman — minimal deposit teman (Rp)", bawaan: "10000", ...angka(),
    lanjutan: true, bantuan: "Deposit teman di bawah ini tidak memicu bonus. Anti-farming: akun palsu biasanya deposit receh."
  },
  {
    nama: "REFERRAL_MAKS_BONUS", grup: "lain", label: "Bonus undang teman — maksimal per teman (Rp)", bawaan: "50000", ...angka(),
    lanjutan: true, bantuan: "Bonus dijepit ke angka ini. 0 = tanpa batas."
  },
  {
    nama: "REFERRAL_MAKS_HARIAN", grup: "lain", label: "Bonus undang teman — maksimal per pengundang per 24 jam", bawaan: "10", ...angka(),
    lanjutan: true, bantuan: "Lewat dari ini, bonus ditahan untuk ditinjau admin (tab Referral). 0 = tanpa batas."
  },
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
