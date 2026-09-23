"use client";

// Filter SVG yang membuat garis tepi bergoyang seperti ditarik pakai pena.
//
// Kenapa ini ada: semua border di situs ini lurus sempurna, dan justru itu
// yang membuat tampilannya terbaca "dibuat komputer" alih-alih "komik".
// feTurbulence menghasilkan derau halus, feDisplacementMap memakai derau itu
// untuk menggeser piksel tepinya sedikit — hasilnya garis yang bergelombang
// pelan, persis seperti tinta tangan.
//
// Satu <svg> tersembunyi di root, dipakai berulang lewat url(#id). Menaruh
// filternya di tiap komponen berarti puluhan definisi yang sama di DOM.
//
// Dua angka yang menentukan hasilnya:
//   baseFrequency kecil  = gelombang panjang & lembut. Terlalu besar dan
//                          garisnya bergerigi seperti rusak, bukan digambar.
//   scale kecil          = geseran kecil. Kalau geserannya mendekati tebal
//                          garisnya, garisnya putus-putus — persis seperti
//                          percobaan pertama yang terlihat patah, bukan
//                          tangan yang bergetar.
//
// Daerah filternya sengaja dilebihkan jauh (-20% sampai 140%). Piksel yang
// tergeser keluar dari daerah filter akan hilang, dan itu penyebab kedua
// garis tadi terlihat terpotong di tengah sisi atas dan bawah.

export default function InkFilters() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
    >
      <defs>
        {/* Goyangan halus — untuk kartu kecil, di mana gerakan besar akan
            membuat sudut membulatnya terlihat penyok. */}
        <filter id="ink-wobble" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.008" numOctaves="2" seed="7" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="1.8" xChannelSelector="R" yChannelSelector="G" />
        </filter>

        {/* Goyangan lebih berani — untuk panel besar, yang butuh amplitudo
            lebih besar supaya efeknya terbaca pada garis sepanjang itu. */}
        <filter id="ink-wobble-lg" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.006" numOctaves="2" seed="19" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="2.6" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
  );
}
