// Nama-nama merek situs, di satu tempat. Berkas ini SENGAJA tanpa impor apa pun
// supaya aman dipakai komponen klien maupun server.
//
// Bawaannya "Arta Pedia". Admin bisa mengubah semuanya dari dasbor
// (Pengaturan Umum → Nama & merek) tanpa deploy ulang. Kolom kosong = kembali
// ke bawaan di bawah.
export const BRAND_BAWAAN = {
  nama: "Arta Pedia",            // nama utama, mis. "Arta Pedia"
  sufiks: "ID",                  // ditempel di nama lengkap: "Arta Pedia ID" (kosongkan bila tak perlu)
  slogan: "Nokos Termurah dan Fast",
  maskot: "Arta Pedia Support",  // nama maskot / asisten bantuan
  chat: "WEARTA CHAT"            // nama fitur chat
};

const bersih = (v, maks) => String(v ?? "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, maks);

function logoSah(l) {
  return l && Number(l.v) > 0 && typeof l.tipe === "string" ? { v: Number(l.v), tipe: l.tipe } : null;
}

/** Alamat gambar logo: unggahan admin bila ada, kalau tidak berkas bawaan. */
export function urlLogo(brand, jenis, bawaan, varian = jenis) {
  const l = brand?.logo?.[jenis];
  return l ? `/api/logo/${varian}?v=${l.v}` : bawaan;
}

/** Mengubah isian mentah (boleh kosong/sebagian) menjadi objek merek lengkap. */
export function rakitBrand(mentah = {}) {
  const m = mentah && typeof mentah === "object" ? mentah : {};
  const nama = bersih(m.nama, 40) || BRAND_BAWAAN.nama;
  // sufiks: undefined/null = bawaan; string kosong yang SENGAJA diisi admin = tanpa sufiks.
  const sufiks = m.sufiks === undefined || m.sufiks === null ? BRAND_BAWAAN.sufiks : bersih(m.sufiks, 12);
  const namaLengkap = sufiks ? `${nama} ${sufiks}` : nama;
  const maskot = bersih(m.maskot, 40) || BRAND_BAWAAN.maskot;
  const chat = bersih(m.chat, 30) || BRAND_BAWAAN.chat;
  const slogan = bersih(m.slogan, 80) || BRAND_BAWAAN.slogan;
  return {
    nama,
    sufiks,
    namaLengkap,
    slogan,
    maskot,
    chat,
    // Varian siap pakai.
    NAMA: nama.toUpperCase(),
    NAMA_LENGKAP: namaLengkap.toUpperCase(),
    MASKOT: maskot.toUpperCase(),
    rapat: nama.replace(/\s+/g, ""), // "ArtaPedia"
    // Logo unggahan admin: { v, tipe } atau null (= logo bawaan). Lihat lib/logo.js.
    logo: { utama: logoSah(m.logo?.utama), ikon: logoSah(m.logo?.ikon) }
  };
}

/** Isian merek dari dokumen settings (siteName + brand). */
export function brandDariSettings(s = {}, logo = null) {
  const b = s.brand && typeof s.brand === "object" ? s.brand : {};
  const sn = String(s.siteName || "").trim();
  // "Nokos Murah" adalah nama bawaan lama; jangan dianggap pilihan admin.
  const nama = sn && sn !== "Nokos Murah" ? sn : "";
  return rakitBrand({ nama, sufiks: b.sufiks, slogan: b.slogan, maskot: b.maskot, chat: b.chat, logo });
}
