"use client";

import Image from "next/image";

// Maskot elang di hero.
//
// Sebelumnya karakter ini cuma muncul sebagai tombol bulat kecil di pojok
// layar, padahal dia satu-satunya hal di situs ini yang tidak dimiliki toko
// nokos lain. Di sini dia berdiri di panel utama, tempat mata orang jatuh
// pertama kali.
//
// Hanya dari lebar lg ke atas: di layar sempit hero-nya menumpuk vertikal dan
// menambah gambar setinggi ini berarti tombol belinya terdorong jauh ke bawah
// lipatan layar — menukar penjualan dengan hiasan.
//
// Ditempatkan di sudut bawah PANEL hero, bukan di dalam kolom kanan: kolom itu
// tingginya hanya setinggi kartu saldo, jadi maskot di dalamnya pasti menimpa
// kartunya. Ruang kosong yang sebenarnya ada di sudut bawah panel, sisa dari
// kolom kiri yang lebih panjang.
//
// data-lean membuatnya condong ke arah kursor (lihat components/Depth3D.js),
// data-parallax membuatnya bergerak sedikit lebih lambat dari isi di depannya.
export default function HeroMascot() {
  return (
    <div
      className="hero-mascot pointer-events-none absolute bottom-0 right-2 hidden w-[185px] select-none lg:block xl:right-6 xl:w-[210px]"
      data-parallax="0.45"
      aria-hidden="true"
    >
      {/* Sorot di belakang badan, memisahkannya dari raster latar. */}
      <span className="hero-mascot-halo" />

      {/* Bayangan lantai. Tanpa ini maskotnya terlihat mengambang, bukan
          berdiri di dalam panel. */}
      <span className="hero-mascot-floor" />

      <span className="hero-mascot-lean block" data-lean="1">
        <Image
          src="/maskot.webp"
          alt=""
          width={528}
          height={750}
          priority={false}
          className="hero-mascot-img h-auto w-full"
        />
      </span>
    </div>
  );
}
