"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

// Perpindahan halaman ala pergantian panel komik: satu bidang menyapu miring
// melintasi layar, lalu halaman barunya masuk dari bawah.
//
// Dijalankan dari perubahan pathname, bukan dari klik tautan. Kalau dipicu
// klik, sapuannya akan jalan juga untuk navigasi yang batal — tautan yang
// gagal dimuat, klik tengah yang membuka tab baru — dan layarnya tersapu
// tanpa ada halaman yang berganti.
//
// Ada batas waktu keras: kalau kelasnya tidak pernah dilepas (tab disembunyikan
// di tengah animasi, animationend yang tidak pernah datang), layarnya akan
// tertutup selamanya. Untuk halaman toko, itu artinya tidak bisa berbelanja.

const DURASI = 620;

export default function PanelTransition() {
  const pathname = usePathname();
  const pertama = useRef(true);
  const [menyapu, setMenyapu] = useState(false);

  useEffect(() => {
    // Muat pertama bukan perpindahan — pengunjung baru saja membuka situsnya.
    if (pertama.current) {
      pertama.current = false;
      return;
    }
    try {
      if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    } catch {}

    setMenyapu(true);
    const t = setTimeout(() => setMenyapu(false), DURASI);
    return () => clearTimeout(t);
  }, [pathname]);

  if (!menyapu) return null;

  return (
    <div className="panel-wipe" aria-hidden="true">
      <span className="panel-wipe-sheet" />
      <span className="panel-wipe-edge" />
    </div>
  );
}
