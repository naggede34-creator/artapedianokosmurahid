"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const WELCOMED_KEY = "artapedia_welcomed";

const BURST_COLORS = ["#F0B429", "#0F172A", "#DC2626", "#22C55E", "#3B82F6", "#F0B429"];

function Firework({ left, top, delay, colorIndex }) {
  const particles = Array.from({ length: 10 });
  return (
    <div
      className="firework-burst absolute"
      style={{ left: `${left}%`, top: `${top}%`, animationDelay: `${delay}s` }}
    >
      {particles.map((_, i) => {
        const angle = (360 / particles.length) * i;
        return (
          <span
            key={i}
            className="firework-particle"
            style={{
              backgroundColor: BURST_COLORS[(colorIndex + i) % BURST_COLORS.length],
              "--r": `${angle}deg`,
              animationDelay: `${delay}s`
            }}
          />
        );
      })}
    </div>
  );
}

export default function WelcomeIntro() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const already = typeof window !== "undefined" ? localStorage.getItem(WELCOMED_KEY) : "1";
    if (!already) setShow(true);
  }, []);

  function close() {
    setShow(false);
    localStorage.setItem(WELCOMED_KEY, "1");
  }

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-ink/60 px-5 backdrop-blur-sm">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <Firework left={18} top={22} delay={0} colorIndex={0} />
        <Firework left={78} top={18} delay={0.3} colorIndex={2} />
        <Firework left={50} top={12} delay={0.6} colorIndex={4} />
        <Firework left={30} top={65} delay={0.9} colorIndex={1} />
        <Firework left={72} top={62} delay={1.2} colorIndex={3} />
      </div>

      <div className="glow-ring animate-scale-in relative w-full max-w-sm rounded-3xl">
        <div className="glass relative overflow-hidden rounded-3xl px-7 py-8 text-center shadow-card-3d">
          <span className="float-slow mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber to-amber-bright text-3xl shadow-3d">
            🎉
          </span>
          <h1 className="mt-5 font-display text-xl font-semibold text-ink sm:text-2xl">
            Welcome to Artapedia!
          </h1>
          <p className="mt-2 text-sm font-medium text-amber-bright">Solusi nokos murah 🇮🇩</p>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Selamat menggunakan web yaa! Kalau ada yang tidak dimengerti, klik menu Panduan atau hubungi admin.
            Happy shopping, guys! 🛍️
          </p>

          <div className="mt-6 flex flex-col gap-2">
            <Link
              href="/cara-pakai"
              onClick={close}
              className="btn-3d rounded-lg bg-gradient-to-r from-amber to-amber-bright px-4 py-2.5 text-sm font-medium text-white shadow-3d"
            >
              📖 Buka Menu Panduan
            </Link>
            <button
              onClick={close}
              className="btn-3d rounded-lg border border-line bg-surface px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:border-amber/40 hover:text-amber-bright"
            >
              Mulai Belanja
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
