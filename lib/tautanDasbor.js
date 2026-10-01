// Daftar tujuan tombol popup (dasbor / halaman pengguna). Tanpa impor apa pun: dipakai server DAN komponen klien.
export const TAUTAN_DASBOR = [
  { href: "/dashboard", label: "Dasbor utama" },
  { href: "/otp", label: "Beli Nokos" },
  { href: "/deposit", label: "Isi Saldo Nokos" },
  { href: "/game-deposit", label: "Isi Saldo Game" },
  { href: "/chat", label: "WEARTA CHAT" },
  { href: "/chat?game=1", label: "Game" },
  { href: "/setor-gmail", label: "Stor Gmail" },
  { href: "/tarik", label: "Tarik Saldo" },
  { href: "/transfer", label: "Transfer" },
  { href: "/mutasi", label: "Mutasi" },
  { href: "/riwayat", label: "Riwayat" },
  { href: "/saldo-gratis", label: "Saldo Gratis" },
  { href: "/misi", label: "Misi & Poin" },
  { href: "/toko-poin", label: "Toko Poin" },
  { href: "/klan", label: "Klan" },
  { href: "/referral", label: "Undang Teman" },
  { href: "/giveaway", label: "Giveaway" },
  { href: "/pet", label: "Pet Arta Pedia" },
  { href: "/produk", label: "Toko Produk" },
  { href: "/reseller", label: "Bot Reseller" },
  { href: "/apikey", label: "API Key" },
  { href: "/leaderboard", label: "Papan Peringkat" },
  { href: "/bonus", label: "Bonus" },
  { href: "/profil", label: "Profil Akun" },
  { href: "/informasi", label: "Informasi" },
  { href: "/faq", label: "FAQ" }
];

/** Tujuan tombol yang aman: jalur internal ("/…", bukan "//") atau alamat https. Selain itu ditolak. */
export function tautanAman(v) {
  const s = String(v || "").trim().slice(0, 500);
  if (!s) return "";
  if (/^\/(?!\/)[A-Za-z0-9\-._~/?=&%#:+@!$'()*,;]*$/.test(s)) return s;
  if (/^https:\/\/[^\s<>"']+$/i.test(s)) return s;
  return "";
}
