"use client";

import { useEffect, useState } from "react";

// Layar pembuka bergaya komik. Tampil saat halaman pertama kali dimuat, lalu
// menghilang setelah aset siap — dengan durasi minimum supaya tidak berkedip.
const MIN_MS = 900;
const MAX_MS = 2600;

export default function LogoLoader() {
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const started = Date.now();
    let hideTimer;
    let outTimer;

    const finish = () => {
      const waited = Date.now() - started;
      hideTimer = setTimeout(() => {
        setLeaving(true);
        outTimer = setTimeout(() => setGone(true), 520);
      }, Math.max(0, MIN_MS - waited));
    };

    // Selesai begitu halaman siap, tapi jangan sampai menggantung kalau ada
    // aset yang lambat.
    if (document.readyState === "complete") finish();
    else window.addEventListener("load", finish, { once: true });
    const cap = setTimeout(finish, MAX_MS);

    // Jangan biarkan halaman di belakang ikut bergulir selama loader tampil.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("load", finish);
      clearTimeout(cap);
      clearTimeout(hideTimer);
      clearTimeout(outTimer);
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    if (gone) document.body.style.overflow = "";
  }, [gone]);

  if (gone) return null;

  return (
    <div className={`apl-root ${leaving ? "apl-out" : ""}`} role="status" aria-label="Memuat Arta Pedia ID">
      {/* garis kecepatan komik yang berputar pelan */}
      <span className="apl-rays" aria-hidden="true" />
      {/* titik halftone */}
      <span className="apl-dots" aria-hidden="true" />

      <div className="apl-stage">
        {/* percikan mengorbit logo */}
        <span className="apl-spark apl-spark-1" aria-hidden="true" />
        <span className="apl-spark apl-spark-2" aria-hidden="true" />
        <span className="apl-spark apl-spark-3" aria-hidden="true" />

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="ARTA PEDIA ID" className="apl-logo" width="620" height="390" />
      </div>

      <div className="apl-bar" aria-hidden="true">
        <span className="apl-bar-fill" />
      </div>
      <p className="apl-text">MEMUAT&hellip;</p>
    </div>
  );
}
