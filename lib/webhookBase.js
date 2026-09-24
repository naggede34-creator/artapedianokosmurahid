// Alamat dasar untuk webhook Telegram, dan kenapa ia tidak boleh cuma satu.
//
// Dulu alamatnya diambil dari satu tempat saja: Site URL di Pengaturan. Satu
// huruf salah di sana, atau domain lama yang sudah tidak dipakai, membuat
// Telegram menjawab "Failed to resolve host" — dan admin tidak punya cara
// tahu alamat apa yang sebenarnya dikirim, karena alamatnya tidak pernah
// ditampilkan di mana pun.
//
// Sekarang ada daftar calon, dicoba berurutan. Yang terakhir selalu alamat
// deployment Vercel, yang pasti bisa di-DNS karena Vercel sendiri yang
// membuatnya.

/**
 * Membersihkan alamat yang diketik manusia jadi bentuk yang diterima Telegram.
 * Mengembalikan "" kalau alamatnya tidak mungkin dipakai — lebih baik dilewati
 * daripada dikirim dan ditolak.
 */
export function normalkanBase(v) {
  let s = String(v || "").trim();
  if (!s) return "";

  // Lupa menulis skema itu kesalahan paling sering. Ditambahkan, bukan
  // ditolak: yang dimaksud orangnya jelas.
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = `https://${s}`;

  let u;
  try {
    u = new URL(s);
  } catch {
    return "";
  }

  // Telegram MENOLAK webhook non-HTTPS. Alamat http:// yang diketik admin
  // dinaikkan, bukan dibuang: nyaris selalu situs yang sama.
  if (u.protocol === "http:") u.protocol = "https:";
  if (u.protocol !== "https:") return "";

  const host = u.hostname.toLowerCase();
  // Host tanpa titik (mis. "localhost"), alamat IP, dan nama .local tidak
  // pernah bisa dijangkau Telegram dari internet.
  if (!host.includes(".")) return "";
  if (host.endsWith(".local") || host.endsWith(".localhost")) return "";
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return "";

  // Path, query, dan tanda pagar dibuang. Admin sering menempel alamat
  // halaman ("…/admin/dashboard"), dan webhook-nya akan jadi
  // "…/admin/dashboard/api/bot/webhook/123" yang membalas 404 — kegagalan
  // yang jauh lebih membingungkan daripada DNS gagal.
  return `https://${u.host.toLowerCase()}`;
}

/**
 * Daftar alamat yang layak dicoba, berurutan, tanpa duplikat.
 * Tiap entri membawa ASALNYA supaya pesan kegagalannya bisa menyebut
 * tempat yang harus diperbaiki admin.
 */
export function calonBase(settings) {
  const daftar = [];
  const tambah = (nilai, asal) => {
    const base = normalkanBase(nilai);
    if (base && !daftar.some((d) => d.base === base)) daftar.push({ base, asal });
  };

  tambah(settings?.siteUrl, "Site URL di Pengaturan");
  tambah(process.env.NEXT_PUBLIC_SITE_URL, "NEXT_PUBLIC_SITE_URL");
  tambah(process.env.SITE_URL, "SITE_URL");
  // Dua yang terakhir dibuat Vercel sendiri, jadi selalu bisa di-DNS.
  tambah(process.env.VERCEL_PROJECT_PRODUCTION_URL, "URL produksi Vercel");
  tambah(process.env.VERCEL_URL, "URL deployment Vercel");

  return daftar;
}

/**
 * Menerjemahkan kegagalan setWebhook jadi kalimat yang menyebut apa yang
 * harus DIPERBAIKI, bukan cuma apa yang salah.
 */
export function jelaskanGagal(description, url) {
  const d = String(description || "");
  const alamat = url ? ` (${url})` : "";

  if (/failed to resolve host|name resolution|getaddrinfo/i.test(d)) {
    return `Telegram tidak menemukan alamat${alamat} di internet — DNS-nya gagal. Biasanya Site URL di Pengaturan salah ketik, atau domainnya sudah tidak dipakai lagi. Isi Site URL dengan alamat situs ini yang benar-benar bisa dibuka di peramban.`;
  }
  if (/https url must be provided|must be https|invalid url/i.test(d)) {
    return `Alamat webhook harus diawali https://${alamat}. Perbaiki Site URL di Pengaturan.`;
  }
  if (/ssl|certificate/i.test(d)) {
    return `Sertifikat HTTPS alamat${alamat} ditolak Telegram. Kalau ini domain sendiri, pastikan SSL-nya sudah aktif dan tidak kedaluwarsa.`;
  }
  if (/wrong response|404|not found/i.test(d)) {
    return `Alamat${alamat} bisa dihubungi, tapi membalas "tidak ditemukan". Biasanya Site URL memuat path tambahan (mis. diakhiri /admin) — isi domainnya saja.`;
  }
  if (/too many requests|flood/i.test(d)) {
    return `Telegram sedang membatasi permintaan. Tunggu sebentar lalu tekan "Pasang ulang webhook".`;
  }
  if (/unauthorized/i.test(d)) {
    return `Token bot ini ditolak Telegram. Kemungkinan sudah dicabut lewat /revoke di @BotFather — ambil token baru dan tambahkan lagi.`;
  }
  return d || "setWebhook gagal tanpa keterangan dari Telegram.";
}
