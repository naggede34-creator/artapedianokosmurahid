"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Memicu animasi masuk TEPAT saat elemennya terlihat, bukan saat halaman dirender.
//
// Sebelumnya .fade-up dan kawan-kawannya adalah animasi CSS biasa: begitu
// elemennya ada di DOM, animasinya jalan. Untuk apa pun di bawah layar, itu
// berarti animasinya sudah selesai sebelum ada yang menggulir ke sana — yang
// dilihat pengunjung cuma elemen diam.
//
// Dikerjakan lewat satu pengamat global, bukan mengubah ratusan pemanggilan:
// kelas yang sudah dipakai di seluruh situs tetap seperti apa adanya.
//
// Kalau JS mati atau gagal, kelas `reveal-ready` tidak pernah terpasang dan
// CSS-nya kembali ke perilaku lama — animasinya jalan langsung, isinya tetap
// terlihat. Tidak ada keadaan di mana halaman jadi kosong gara-gara ini.

const TARGETS = [
  ".fade-up",
  ".anim-drop",
  ".anim-slide",
  ".anim-stagger",
  ".manga-enter",
  ".bounce-in",
  ".scale-in",
  ".slide-up"
].join(",");

export default function RevealOnScroll() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof IntersectionObserver !== "function") return;

    // Yang memilih diam tidak ditahan sama sekali: isinya langsung tampil utuh.
    const diam = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (diam?.matches) return;

    const root = document.documentElement;
    root.classList.add("reveal-ready");

    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add("is-visible");
          obs.unobserve(e.target);
        }
      },
      // rootMargin bawah negatif: animasinya mulai sedikit SEBELUM elemennya
      // benar-benar di tengah layar, jadi terasa menyambut, bukan terlambat.
      { threshold: 0.08, rootMargin: "0px 0px -8% 0px" }
    );

    const amati = () => {
      for (const el of document.querySelectorAll(TARGETS)) {
        if (el.classList.contains("is-visible") || el.dataset.revealBound) continue;
        el.dataset.revealBound = "1";
        obs.observe(el);
      }
    };

    amati();

    // Banyak bagian situs ini baru muncul setelah datanya tiba dari API, jadi
    // sekali pindai di awal tidak cukup.
    let tunda = null;
    const mo = new MutationObserver(() => {
      clearTimeout(tunda);
      tunda = setTimeout(amati, 120);
    });
    mo.observe(document.body, { childList: true, subtree: true });

    // Jaring pengaman: kalau pengamatnya tidak pernah terpicu — layar sangat
    // tinggi, halaman dirender jadi gambar, atau browser lama yang aneh —
    // semuanya tetap ditampilkan daripada tertahan tidak terlihat selamanya.
    const jaring = setTimeout(() => {
      for (const el of document.querySelectorAll(TARGETS)) el.classList.add("is-visible");
    }, 4000);

    return () => {
      clearTimeout(tunda);
      clearTimeout(jaring);
      mo.disconnect();
      obs.disconnect();
      root.classList.remove("reveal-ready");
    };
  }, [pathname]);

  return null;
}
