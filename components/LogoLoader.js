"use client";

import { useEffect, useRef, useState } from "react";
import { markIntroDone } from "@/lib/introGate";

// Durasi intro penuh (detik pertama kali dibuka) dan versi singkat untuk
// kunjungan berikutnya dalam sesi yang sama. Ubah angka ini kalau mau.
const FULL_MS = 25000;
const QUICK_MS = 1400;
const SEEN_KEY = "artapedia_intro_seen";
// Tombol lewati baru muncul setelah animasinya sempat terlihat.
const SKIP_AFTER_MS = 2500;

export default function LogoLoader() {
  const [percent, setPercent] = useState(1);
  const [showSkip, setShowSkip] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);
  const rafRef = useRef(0);
  const doneRef = useRef(false);
  // Diisi di dalam effect supaya tombol "Lewati" memakai penutup yang sama.
  const finishRef = useRef(null);

  useEffect(() => {
    let full = true;
    try {
      full = sessionStorage.getItem(SEEN_KEY) !== "1";
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      // sessionStorage diblokir (mode privat) — anggap kunjungan pertama.
    }
    const duration = full ? FULL_MS : QUICK_MS;

    const reduce =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const total = reduce ? Math.min(duration, 1200) : duration;

    const started = performance.now();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const skipTimer = setTimeout(() => setShowSkip(true), Math.min(SKIP_AFTER_MS, total));

    const tick = (now) => {
      const p = Math.min(1, (now - started) / total);
      // Mulai dari 1, bukan 0, supaya angkanya langsung terlihat hidup.
      setPercent(Math.max(1, Math.round(p * 100)));
      if (p >= 1) finish();
      else rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    function finish() {
      if (doneRef.current) return;
      doneRef.current = true;
      cancelAnimationFrame(rafRef.current);
      setPercent(100);
      setLeaving(true);
      setTimeout(() => {
        setGone(true);
        // Beri aba-aba ke sapaan maskot & popup lain bahwa layar sudah bebas.
        markIntroDone();
      }, 560);
    }

    finishRef.current = finish;

    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(skipTimer);
      document.body.style.overflow = prevOverflow;
      markIntroDone();
    };
  }, []);

  useEffect(() => {
    if (gone) document.body.style.overflow = "";
  }, [gone]);

  if (gone) return null;

  return (
    <div
      className={`apl-root ${leaving ? "apl-out" : ""}`}
      role="status"
      aria-live="polite"
      aria-label={`Memuat Arta Pedia ID, ${percent} persen`}
    >
      <span className="apl-rays" aria-hidden="true" />
      <span className="apl-glow" aria-hidden="true" />
      <span className="apl-dots" aria-hidden="true" />

      <div className="apl-scene">
        <div className="apl-stage">
          <span className="apl-ring apl-ring-1" aria-hidden="true" />
          <span className="apl-ring apl-ring-2" aria-hidden="true" />
          <span className="apl-spark apl-spark-1" aria-hidden="true" />
          <span className="apl-spark apl-spark-2" aria-hidden="true" />
          <span className="apl-spark apl-spark-3" aria-hidden="true" />

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="ARTA PEDIA ID" className="apl-logo" width="620" height="390" />
        </div>
      </div>

      <p className="apl-percent" aria-hidden="true">
        <span className="apl-percent-num">{percent}</span>
        <span className="apl-percent-sign">%</span>
      </p>

      <div className="apl-bar" aria-hidden="true">
        <span className="apl-bar-fill" style={{ width: `${percent}%` }} />
      </div>

      <p className="apl-text">MENYIAPKAN NOKOS TERMURAH&hellip;</p>

      <button
        type="button"
        onClick={() => finishRef.current?.()}
        className={`apl-skip ${showSkip ? "apl-skip-on" : ""}`}
      >
        Lewati →
      </button>
    </div>
  );
}
