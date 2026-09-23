"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Dua efek kedalaman yang dijalankan satu pengelola, bukan satu komponen per
// kartu: kartu di situs ini ratusan, dan memasang event listener di tiap kartu
// jauh lebih mahal daripada satu listener di dokumen.
//
//  1. .card-tilt  — kartunya miring MENGIKUTI posisi kursor di dalam kartu itu.
//     Sebelumnya sudutnya tetap (-3deg/4deg) ke mana pun kursornya; kartu yang
//     sudutnya ikut bergerak terbaca sebagai benda yang diputar, bukan gambar
//     yang diangkat.
//
//  2. [data-parallax] — lapisan hiasan bergerak dengan kecepatan berbeda
//     mengikuti gulungan dan posisi kursor. Ini yang membuat mata membacanya
//     sebagai ruang berkedalaman.
//
// Keduanya HANYA untuk penunjuk presisi (mouse/trackpad). Di layar sentuh
// tidak ada kursor untuk diikuti, dan memaksakannya cuma menghabiskan baterai.

const MAX_TILT = 9; // derajat

export default function Depth3D() {
  const pathname = usePathname();

  useEffect(() => {
    const halus = window.matchMedia?.("(pointer: fine)");
    const diam = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!halus?.matches || diam?.matches) return;

    document.documentElement.classList.add("depth-ready");

    // ── 1. tilt mengikuti kursor ─────────────────────────────────────────
    let kartuAktif = null;

    const onMove = (e) => {
      const kartu = e.target?.closest?.(".card-tilt");
      if (kartu !== kartuAktif) {
        if (kartuAktif) reset(kartuAktif);
        kartuAktif = kartu || null;
      }
      if (!kartu) return;

      const r = kartu.getBoundingClientRect();
      // -1 … 1 dari titik tengah kartu
      const px = (e.clientX - r.left) / r.width * 2 - 1;
      const py = (e.clientY - r.top) / r.height * 2 - 1;
      kartu.style.setProperty("--tilt-x", `${(-py * MAX_TILT).toFixed(2)}deg`);
      kartu.style.setProperty("--tilt-y", `${(px * MAX_TILT).toFixed(2)}deg`);
      // Titik kilau ikut kursor, supaya sorotannya terasa datang dari arah
      // yang sama dengan kemiringannya.
      kartu.style.setProperty("--glare-x", `${((px + 1) / 2 * 100).toFixed(1)}%`);
      kartu.style.setProperty("--glare-y", `${((py + 1) / 2 * 100).toFixed(1)}%`);
    };

    const reset = (el) => {
      el.style.setProperty("--tilt-x", "0deg");
      el.style.setProperty("--tilt-y", "0deg");
    };

    const onLeave = () => {
      if (kartuAktif) reset(kartuAktif);
      kartuAktif = null;
    };

    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave, { passive: true });

    // ── 2. parallax ──────────────────────────────────────────────────────
    // Satu rAF untuk semua lapisan. Menulis transform langsung di dalam
    // handler scroll akan memaksa layout berkali-kali per gulungan.
    let mx = 0, my = 0, sy = 0, antri = false;

    const terapkan = () => {
      antri = false;
      for (const el of document.querySelectorAll("[data-parallax]")) {
        const k = Number(el.dataset.parallax) || 0;         // kedalaman: - jauh, + dekat
        const induk = el.closest("[data-parallax-root]") || el.parentElement;
        const r = induk?.getBoundingClientRect();
        // Hanya lapisan yang sedang di layar yang dihitung.
        if (!r || r.bottom < -200 || r.top > window.innerHeight + 200) continue;
        const geserScroll = (sy - (window.scrollY + r.top)) * k * 0.06;
        el.style.transform = `translate3d(${(mx * k * 14).toFixed(1)}px, ${(my * k * 10 + geserScroll).toFixed(1)}px, 0)`;
      }
    };

    const jadwalkan = () => {
      if (antri) return;
      antri = true;
      requestAnimationFrame(terapkan);
    };

    const onPointer = (e) => {
      mx = e.clientX / window.innerWidth * 2 - 1;
      my = e.clientY / window.innerHeight * 2 - 1;
      jadwalkan();
    };
    const onScroll = () => {
      sy = window.scrollY;
      jadwalkan();
    };

    document.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("pointermove", onPointer);
      window.removeEventListener("scroll", onScroll);
      document.documentElement.classList.remove("depth-ready");
      for (const el of document.querySelectorAll("[data-parallax]")) el.style.transform = "";
    };
  }, [pathname]);

  return null;
}
