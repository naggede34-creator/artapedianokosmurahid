// Daftar tujuan tombol popup (dasbor / halaman pengguna). Tanpa impor apa pun: dipakai server DAN komponen klien.
export const TAUTAN_DASBOR = [
  { href: "/dashboard", label: "Dasbor utama" },
  { href: "/otp", label: "Beli Nokos" },
  { href: "/deposit", label: "Isi Saldo" },
  { href: "/tarik", label: "Tarik Saldo" },
  { href: "/transfer", label: "Transfer" },
  { href: "/mutasi", label: "Mutasi" },
  { href: "/riwayat", label: "Riwayat" },
  { href: "/referral", label: "Undang Teman" },
  { href: "/giveaway", label: "Giveaway" },
  { href: "/reseller", label: "Bot Reseller" },
  { href: "/gateway", label: "QRIS Gateway" },
  { href: "/apikey", label: "API Key" },
  { href: "/leaderboard", label: "Papan Peringkat" },
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
