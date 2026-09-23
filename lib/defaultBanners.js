// Sepuluh banner bawaan bergaya komik, bergambar maskot.
//
// Dipakai saat admin BELUM membuat banner sendiri untuk satu tempat. Tanpa ini,
// tempat banner yang sudah disiapkan di beranda, halaman beli, halaman deposit
// dan dashboard hanya kosong sampai ada yang sempat mengunggah sesuatu — dan
// tempat kosong tidak menjual apa pun.
//
// Begitu admin membuat satu banner aktif untuk sebuah tempat, banner bawaan di
// tempat itu berhenti tampil dengan sendirinya. Tidak ada tombol yang harus
// ditekan untuk "mematikan bawaan", dan tidak ada keadaan setengah-setengah di
// mana punyanya admin bercampur dengan punya bawaan.
export const DEFAULT_BANNERS = [
  // ── Beranda: janji utama toko ────────────────────────────────────────
  { id: "bawaan-promo", title: "Nokos murah mulai Rp2.000", label: "PROMO", imageUrl: "/banners/promo-nokos-murah.webp", linkUrl: "/otp", placement: "homepage" },
  { id: "bawaan-otp", title: "OTP masuk otomatis", label: "TERCEPAT", imageUrl: "/banners/otp-instan.webp", linkUrl: "/otp", placement: "homepage" },
  { id: "bawaan-garansi", title: "Gagal? Saldo balik", label: "AMAN", imageUrl: "/banners/garansi-refund.webp", linkUrl: "/faq", placement: "homepage" },
  { id: "bawaan-24jam", title: "Buka 24 jam nonstop", label: "24/7", imageUrl: "/banners/buka-24-jam.webp", linkUrl: "/otp", placement: "homepage" },

  // ── Halaman beli nokos ───────────────────────────────────────────────
  { id: "bawaan-juara", title: "Pembeli terbanyak dapat hadiah", label: "HADIAH", imageUrl: "/banners/juara-mingguan.webp", linkUrl: "/leaderboard", placement: "order" },
  { id: "bawaan-tanpa-daftar", title: "Tanpa daftar, tanpa email", label: "GAMPANG", imageUrl: "/banners/tanpa-daftar.webp", linkUrl: "/cara-pakai", placement: "order" },

  // ── Halaman isi saldo ────────────────────────────────────────────────
  { id: "bawaan-qris", title: "QRIS semua e-wallet", label: "QRIS", imageUrl: "/banners/qris-semua.webp", linkUrl: "/deposit", placement: "deposit" },
  { id: "bawaan-manual", title: "QRIS manual tanpa biaya", label: "HEMAT", imageUrl: "/banners/deposit-manual.webp", linkUrl: "/deposit", placement: "deposit" },

  // ── Dashboard pengguna ───────────────────────────────────────────────
  { id: "bawaan-referral", title: "Ajak teman, dapat bonus", label: "REFERRAL", imageUrl: "/banners/undang-teman.webp", linkUrl: "/referral", placement: "dashboard" },
  { id: "bawaan-chat", title: "Gabung Room Chat komunitas", label: "BARU", imageUrl: "/banners/room-chat.webp", linkUrl: "/chat", placement: "dashboard" }
];

export function defaultBannersFor(placement) {
  return DEFAULT_BANNERS.filter((b) => b.placement === placement);
}
