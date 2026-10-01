// ARENA PENDEKAR — data bersama 5 petarung, gerak dasar, dan arena.
// Dipakai server (mesin duel lib/game/tarung.js, aturan sah) DAN klien (mode solo real-time, tampilan).
// Berkas ini murni data: tanpa impor alias "@/" supaya bisa dimuat langsung oleh skrip uji Node.

/**
 * Gerak dasar (sama untuk semua petarung). Sifat yang dipakai mesin duel:
 *  jenis  : serang | banting | tangkis
 *  level  : atas (kepala; meleset bila lawan jongkok) · overhead (dari atas; tembus tangkis bawah) · bawah (sapuan;
 *           tembus tangkis atas)
 *  cepat  : makin besar makin dulu mengenai (yang lebih cepat memotong yang lambat; sama cepat = saling kena)
 *  blok   : (tangkis) level yang ditahan; hindari: level yang lewat di atas kepala (lalu dibalas)
 */
export const GERAK = {
  pukul: { id: "pukul", nama: "Pukulan Kilat", ikon: "👊", jenis: "serang", level: "atas", cepat: 3, dmg: 9, ket: "Paling cepat — memotong tendangan & bantingan, aman bila ditangkis atas. Kalah dari sapuan; meleset bila lawan jongkok." },
  tendang: { id: "tendang", nama: "Tendangan Kapak", ikon: "🦵", jenis: "serang", level: "overhead", cepat: 2, dmg: 13, ket: "Menghantam dari atas — mengalahkan sapuan & tangkis bawah. Kalah cepat dari pukulan; ditahan tangkis atas." },
  sapu: { id: "sapu", nama: "Sapuan Bawah", ikon: "🌀", jenis: "serang", level: "bawah", cepat: 2, dmg: 11, ket: "Menunduk di bawah pukulan & menembus tangkis atas. Kalah dari tendangan kapak & tangkis bawah." },
  banting: { id: "banting", nama: "Bantingan", ikon: "🤼", jenis: "banting", level: "banting", cepat: 1, dmg: 20, ket: "Tak bisa ditangkis — menghukum lawan yang bertahan. Kalah dari semua serangan." },
  tangkis: { id: "tangkis", nama: "Tangkis Atas", ikon: "🛡️", jenis: "tangkis", blok: ["atas", "overhead", "udara", "proyektil"], balas: { atas: 0, overhead: 11 }, ket: "Menahan pukulan, tendangan kapak (lalu membalas keras), serangan udara & tembakan. Kena sapuan & bantingan." },
  rendah: { id: "rendah", nama: "Tangkis Bawah", ikon: "⬇️", jenis: "tangkis", blok: ["bawah", "proyektil"], hindari: ["atas"], balas: { atas: 12, bawah: 12 }, ket: "Jongkok: pukulan lewat di atas kepala & sapuan tertahan — lalu kamu balas keras. Kena tendangan kapak & bantingan." }
};
export const URUTAN_GERAK = ["pukul", "tendang", "sapu", "banting", "tangkis", "rendah"];
export const BIAYA_JURUS = 35;
export const BIAYA_PAMUNGKAS = 100;

/** Arena (latar). Klien yang menggambar; server hanya memilih id. */
export const ARENA = {
  candi: { id: "candi", nama: "Candi Senja", ket: "Pelataran candi batu saat matahari terbenam" },
  salju: { id: "salju", nama: "Kuil Salju", ket: "Kuil di puncak gunung bersalju" },
  tambang: { id: "tambang", nama: "Tambang Raksasa", ket: "Ngarai tambang berdebu" },
  neon: { id: "neon", nama: "Atap Neon", ket: "Atap gedung kota saat hujan malam" },
  kawah: { id: "kawah", nama: "Kawah Merapi", ket: "Bibir kawah gunung berapi" }
};
export const URUTAN_ARENA = ["candi", "salju", "tambang", "neon", "kawah"];

/**
 * Lima petarung. `stat` dipakai mesin (duel & solo):
 *  hp      : nyawa per ronde        kuat : pengali damage keluar      tahan : pengali damage masuk
 *  energi  : pengali isi energi     cepat: tambahan kecepatan serangan biasa
 *  pukulCepat: kecepatan pukulan khusus (raksasa lebih lambat)
 * `jurus` (biaya 35 energi) dan `pamungkas` (100 energi) berbeda tiap petarung.
 * `rupa.sprite` = nama gambar petarung (public/tarung/<sprite>.webp, potret-<sprite>.webp); `tinggi` = ukuran relatif
 * (1 = 300 satuan); `lebar` = lebar badan (kotak kena & jarak dorong); `kaki` = proporsi kaki kerangka agar pas dengan
 * gambar chibi; `kuda` = sudut lengan kuda-kuda yang cocok dengan gambar; `tukarLengan` = tangan depan kerangka
 * menggerakkan lengan belakang gambar (golok ninja).
 */
export const KARAKTER = {
  garuda: {
    id: "garuda", nama: "Raka", gelar: "Si Rakun", gaya: "Karate Garuda", asal: "Hutan Merbabu",
    cerita: "Rakun karateka bersabuk hitam pewaris jurus Garuda. Seimbang, lincah di udara, dan cepat mengisi energi.",
    stat: { hp: 90, kuat: 1, tahan: 1, energi: 1.15, cepat: 0 },
    nilai: { nyawa: 3, kekuatan: 3, kecepatan: 4, pertahanan: 3, teknik: 5 },
    jurus: {
      id: "tendanganGaruda", nama: "Tendangan Garuda", ikon: "🦅", jenis: "serang", level: "udara", cepat: 3, dmg: 15, kebal: ["bawah", "banting", "proyektil"],
      ket: "Menerjang dari udara: melompati sapuan, bantingan & tembakan, menembus tangkis bawah. Ditahan tangkis atas."
    },
    pamungkas: { id: "amukanGaruda", nama: "Amukan Garuda", dmg: 32, ket: "Sayap emas mengembang, serbuan tendangan bertubi-tubi." },
    arena: "candi",
    rupa: {
      kulit: "#c98d5a", kulitGelap: "#8a5a34", rambut: "#1b1410", rambutGaya: "pendek",
      baju: "#1d1d26", bajuTerang: "#3a3a4a", celana: "#16161d", celanaTerang: "#33333f",
      aksen: "#d4202a", aksenTerang: "#ff5a4e", emas: "#f2b233", sarung: "#d4202a",
      ikat: "#c81d25", aura: "#ffcc33", tinggi: 1, lebar: 1.32, ciri: "ikat",
      // Sprite HD (render 3D) + proporsi kaki chibi & kuda-kuda lengan yang cocok dengan gambarnya.
      sprite: "rakun", kaki: 0.485, kuda: { ad1: 72, ad2: 80 }
    }
  },
  naga: {
    id: "naga", nama: "Yuki", gelar: "Ninja Es", gaya: "Ninjutsu Es", asal: "Kuil Salju Utara",
    cerita: "Ninja kuil salju bertudung biru yang membekukan lawan. Tombak esnya memperlambat serangan musuh.",
    stat: { hp: 90, kuat: 1, tahan: 1, energi: 1.1, cepat: 0 },
    nilai: { nyawa: 2, kekuatan: 3, kecepatan: 4, pertahanan: 3, teknik: 4 },
    jurus: {
      id: "tombakEs", nama: "Tombak Es", ikon: "❄️", jenis: "proyektil", level: "proyektil", cepat: 2, dmg: 12, efek: { beku: 2 },
      ket: "Tembakan es jarak jauh: mengalahkan semua serangan & bantingan, membekukan lawan (serangannya melambat 2 giliran). Bisa ditangkis."
    },
    pamungkas: { id: "nagaEsAbadi", nama: "Naga Es Abadi", dmg: 27, efek: { beku: 2 }, ket: "Naga es raksasa melilit dan membekukan lawan." },
    arena: "salju",
    rupa: {
      kulit: "#f0c7a0", kulitGelap: "#b98c66", rambut: "#14121a", rambutGaya: "cepol",
      baju: "#2557c9", bajuTerang: "#5d8bf2", celana: "#e8eef9", celanaTerang: "#ffffff",
      aksen: "#7fe7ff", aksenTerang: "#c8f6ff", emas: "#e9f2ff", sarung: "#7fe7ff",
      ikat: "#7fe7ff", aura: "#7fe7ff", tinggi: 1, lebar: 1.3, ciri: "cepol",
      sprite: "ninja-es", kaki: 0.569, tukarLengan: true, kuda: { ad1: -98, ad2: 6 }
    }
  },
  raksasa: {
    id: "raksasa", nama: "Bima", gelar: "Beruang Raksasa", gaya: "Gulat Beruang", asal: "Ngarai Kapur",
    cerita: "Beruang pegulat bersabuk tambang. Lambat, tetapi bantingannya tak tertahan dan nyawanya paling tebal.",
    stat: { hp: 100, kuat: 1.1, tahan: 0.92, energi: 1, cepat: 0, pukulCepat: 2 },
    nilai: { nyawa: 5, kekuatan: 5, kecepatan: 1, pertahanan: 5, teknik: 2 },
    jurus: {
      id: "bantinganGempa", nama: "Bantingan Gempa", ikon: "💥", jenis: "banting", level: "banting", cepat: 1, dmg: 26, perintah: true, armor: ["atas"],
      ket: "Bantingan perintah berlapis baja: menahan pukulan lalu membanting, mengalahkan bantingan biasa & kedua tangkisan. Kalah dari tendangan & sapuan."
    },
    pamungkas: { id: "gempaRaksasa", nama: "Gempa Raksasa", dmg: 34, ket: "Menghantam bumi hingga batu-batu meledak dari tanah." },
    arena: "tambang",
    rupa: {
      kulit: "#9a5a35", kulitGelap: "#5e3218", rambut: "#120c08", rambutGaya: "botak",
      baju: null, bajuTerang: null, celana: "#7a1414", celanaTerang: "#b02a24",
      aksen: "#f2b233", aksenTerang: "#ffd96b", emas: "#f2b233", sarung: "#f2b233",
      ikat: "#2b1a10", aura: "#ff8a3d", tinggi: 1.1, lebar: 1.5, ciri: "jenggot",
      sprite: "beruang", kaki: 0.62, kuda: { ad1: 58, ad2: 120 }
    }
  },
  bayangan: {
    id: "bayangan", nama: "Kaito", gelar: "Ninja Bayangan", gaya: "Ninjutsu Golok", asal: "Kota Neon",
    cerita: "Ninja bertudung merah bersenjata golok. Paling cepat di arena, tetapi tubuhnya paling rapuh.",
    stat: { hp: 76, kuat: 0.95, tahan: 1.05, energi: 1, cepat: 1 },
    nilai: { nyawa: 1, kekuatan: 3, kecepatan: 5, pertahanan: 2, teknik: 5 },
    jurus: {
      id: "teleportBayangan", nama: "Teleport Bayangan", ikon: "🌑", jenis: "serang", level: "tembus", cepat: 2, dmg: 12, tembus: true,
      kebal: ["atas", "overhead", "udara", "proyektil"], rentan: ["bawah", "banting"],
      ket: "Menghilang lalu muncul di belakang lawan: menghindari pukulan, tendangan & tembakan, tak bisa ditangkis. Kalah dari sapuan & bantingan."
    },
    pamungkas: { id: "seribuBayangan", nama: "Seribu Bayangan", dmg: 29, ket: "Lima bayangan menyayat lawan dari segala arah." },
    arena: "neon",
    rupa: {
      kulit: "#e8b98c", kulitGelap: "#a8784e", rambut: "#0e0e14", rambutGaya: "topeng",
      baju: "#15151d", bajuTerang: "#2c2c3a", celana: "#15151d", celanaTerang: "#2c2c3a",
      aksen: "#9b5cff", aksenTerang: "#c9a3ff", emas: "#b9b9c9", sarung: "#9b5cff",
      ikat: "#d1222f", aura: "#ff3b5c", tinggi: 1, lebar: 1.3, ciri: "syal",
      sprite: "ninja", kaki: 0.569, tukarLengan: true, kuda: { ad1: -98, ad2: 6 }
    }
  },
  merapi: {
    id: "merapi", nama: "Sari", gelar: "Rubah Api", gaya: "Silat Api", asal: "Kawah Merapi",
    cerita: "Rubah penjaga kawah yang mengendalikan api. Bola apinya membakar lawan beberapa giliran.",
    stat: { hp: 88, kuat: 1.05, tahan: 1, energi: 1.05, cepat: 0 },
    nilai: { nyawa: 3, kekuatan: 4, kecepatan: 3, pertahanan: 3, teknik: 4 },
    jurus: {
      id: "bolaApi", nama: "Bola Api", ikon: "🔥", jenis: "proyektil", level: "proyektil", cepat: 2, dmg: 10, efek: { bakar: 3 },
      ket: "Tembakan api: mengalahkan semua serangan & bantingan dan membakar lawan 3 giliran. Bisa ditangkis."
    },
    pamungkas: { id: "letusanMerapi", nama: "Letusan Merapi", dmg: 27, efek: { bakar: 3 }, ket: "Pilar lahar meletus dari tanah dan membakar lawan." },
    arena: "kawah",
    rupa: {
      kulit: "#d9a070", kulitGelap: "#9c6a40", rambut: "#2a0c08", rambutGaya: "panjang",
      baju: "#c62a1a", bajuTerang: "#f2552e", celana: "#3a1410", celanaTerang: "#6a2418",
      aksen: "#f2b233", aksenTerang: "#ffd96b", emas: "#f2b233", sarung: "#f2b233",
      ikat: "#ff7a1a", aura: "#ff5a1f", tinggi: 1, lebar: 1.32, ciri: "rambutApi",
      sprite: "rubah-api", kaki: 0.485, kuda: { ad1: 72, ad2: 80 }
    }
  }
};
export const URUTAN_KARAKTER = ["garuda", "naga", "raksasa", "bayangan", "merapi"];

/** Deskripsi aksi sah untuk petarung `kid` (dipakai mesin duel & tombol UI). */
export function daftarAksi(kid) {
  const k = KARAKTER[kid];
  const dasar = URUTAN_GERAK.map((id) => ({ ...GERAK[id], biaya: 0 }));
  if (!k) return dasar;
  return [
    ...dasar,
    { id: "jurus", nama: k.jurus.nama, ikon: k.jurus.ikon, jenis: k.jurus.jenis, biaya: BIAYA_JURUS, ket: k.jurus.ket },
    { id: "pamungkas", nama: k.pamungkas.nama, ikon: "⚡", jenis: "pamungkas", biaya: BIAYA_PAMUNGKAS, ket: `${k.pamungkas.ket} Mengalahkan semua aksi; ditangkis = setengah damage.` }
  ];
}
