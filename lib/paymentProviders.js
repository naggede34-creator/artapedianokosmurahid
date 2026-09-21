// Daftar metode deposit QRIS. File ini aman di-import dari server maupun browser
// (tidak berisi secret). Urutan array = urutan tampil di halaman deposit.
export const DEPOSIT_PROVIDERS = [
  {
    key: "pakasir",
    name: "QRIS Pakasir",
    short: "Pakasir",
    speed: "± 1 menit",
    desc: "Semua e-wallet & m-banking."
  },
  {
    key: "rumahotp",
    name: "QRIS RumahOTP",
    short: "RumahOTP",
    speed: "± 20 detik",
    desc: "Semua e-wallet & m-banking."
  },
  {
    key: "virtusim",
    name: "QRIS VirtuSIM",
    short: "VirtuSIM",
    speed: "± 30 detik",
    desc: "Semua e-wallet & m-banking."
  }
];

export const PROVIDER_KEYS = DEPOSIT_PROVIDERS.map((p) => p.key);

export function providerName(key) {
  return DEPOSIT_PROVIDERS.find((p) => p.key === key)?.name || key || "-";
}

export const DEPOSIT_STATUS_LABEL = {
  pending: "Menunggu bayar",
  completed: "Berhasil",
  canceled: "Dibatalkan",
  expired: "Kedaluwarsa",
  failed: "Gagal"
};

// Status SMM (Simuru) -> label bahasa Indonesia.
export const SMM_STATUS_LABEL = {
  submitting: "Mengirim",
  pending: "Antre",
  processing: "Diproses",
  in_progress: "Berjalan",
  completed: "Selesai",
  partial: "Sebagian",
  canceled: "Dibatalkan",
  refunded: "Dikembalikan",
  error: "Gagal",
  failed: "Gagal"
};

// Jenis link yang harus dikirim user, dari field target_type Simuru.
export const SMM_TARGET_HINT = {
  profile: { label: "Link profil / username", placeholder: "https://instagram.com/username" },
  post: { label: "Link postingan", placeholder: "https://instagram.com/p/xxxx" },
  comment: { label: "Link komentar", placeholder: "Link komentar yang dituju" },
  story: { label: "Link story / profil", placeholder: "https://instagram.com/stories/username" },
  live: { label: "Link siaran live", placeholder: "Link live yang sedang berjalan" },
  track: { label: "Link lagu / track", placeholder: "https://open.spotify.com/track/xxxx" },
  app: { label: "Link aplikasi", placeholder: "https://play.google.com/store/apps/details?id=xxx" },
  keyword: { label: "Kata kunci", placeholder: "Kata kunci pencarian" },
  website: { label: "Link website", placeholder: "https://domain-kamu.com" },
  tg_channel: { label: "Link channel Telegram", placeholder: "https://t.me/namachannel" },
  tg_post: { label: "Link postingan Telegram", placeholder: "https://t.me/namachannel/123" }
};
