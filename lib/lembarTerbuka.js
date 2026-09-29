"use client";

// Menandai bahwa ada lembar/popup layar penuh yang sedang terbuka.
//
// Bilah navigasi bawah dan gelembung Bantuan melayang di atas halaman. Selama
// sebuah lembar menutupi layar, keduanya tidak berguna — dan lebih buruk:
// keduanya menutupi isi lembarnya, persis yang dikeluhkan pengguna pada daftar
// server di lembar Beli Nokos.
//
// Kenapa TIDAK cukup menaikkan z-index lembarnya:
//
// z-index hanya berlaku di dalam konteks penumpukan yang sama. Satu leluhur
// yang punya transform, filter, opacity < 1, atau will-change — apa pun yang
// ditambahkan setahun lagi demi animasi — mengurung lembarnya, dan angka
// berapa pun yang ditulis di situ jadi tidak berarti. Menyembunyikan yang
// melayang tidak bergantung pada itu sama sekali: elemen yang display:none
// tidak bisa menutupi apa pun, di konteks penumpukan mana pun.
//
// Pencacah, bukan bendera boolean: dua lembar bisa terbuka bertumpuk (mis.
// konfirmasi di atas lembar beli). Dengan boolean, yang ditutup duluan akan
// memunculkan kembali bilah navigasi di atas lembar yang masih terbuka.
import { useEffect } from "react";

const ATRIBUT = "data-lembar-terbuka";
let terbuka = 0;

function perbarui() {
  if (typeof document === "undefined") return;
  if (terbuka > 0) document.body.setAttribute(ATRIBUT, "1");
  else document.body.removeAttribute(ATRIBUT);
}

/**
 * Menandai satu lembar terbuka. Mengembalikan fungsi untuk melepasnya.
 *
 * Dipisah dari kaitnya supaya bisa diuji langsung: kalau pencacahnya salah,
 * bilah navigasi hilang permanen sampai halaman dimuat ulang — bug yang jauh
 * lebih sulit ditelusuri daripada yang sedang diperbaiki di sini.
 */
export function tandaiTerbuka() {
  terbuka += 1;
  perbarui();
  let sudahDilepas = false;
  return function lepas() {
    // Penjaga sekali-lepas. React bisa memanggil pembersih efek lebih dari
    // sekali (Strict Mode di pengembangan memasang-melepas efek dua kali),
    // dan tanpa penjaga ini satu lembar bisa mengurangi pencacah dua kali —
    // membuat lembar LAIN yang masih terbuka kehilangan penandanya.
    if (sudahDilepas) return;
    sudahDilepas = true;
    terbuka = Math.max(0, terbuka - 1);
    perbarui();
  };
}

/** Khusus pengujian: jumlah lembar yang sedang tercatat terbuka. */
export function jumlahTerbuka() {
  return terbuka;
}

export function useLembarTerbuka(aktif) {
  useEffect(() => {
    if (!aktif) return undefined;
    return tandaiTerbuka();
  }, [aktif]);
}
