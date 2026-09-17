"use client";

import { useEffect, useState } from "react";

function useCountdown(endAt) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (!endAt) return;
    const tick = () => setSecs(Math.max(0, Math.floor((new Date(endAt) - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [endAt]);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return { h, m, s, done: secs === 0 };
}

function Block({ val, label }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-2xl font-extrabold font-mono tabular-nums text-amber-bright leading-none">
        {String(val).padStart(2, "0")}
      </span>
      <span className="text-[10px] text-muted mt-0.5">{label}</span>
    </div>
  );
}

export default function FlashSaleTimer() {
  const [sale, setSale] = useState(null);

  useEffect(() => {
    fetch("/api/flashsale").then((r) => r.json()).then(setSale);
    const t = setInterval(() => {
      fetch("/api/flashsale").then((r) => r.json()).then(setSale);
    }, 30000);
    return () => clearInterval(t);
  }, []);

  const { h, m, s, done } = useCountdown(sale?.endAt);

  if (!sale?.active || done) return null;

  return (
    <div className="rounded-xl border-2 border-rose bg-rose-soft overflow-hidden">
      <div className="bg-rose px-4 py-2 flex items-center gap-2">
        <span className="text-white text-sm font-extrabold animate-pulse">🔥 FLASH SALE</span>
        <span className="text-white/80 text-xs font-semibold ml-auto">{sale.title}</span>
      </div>
      <div className="px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-xl font-extrabold text-rose">{sale.discountPercent}% OFF</p>
          <p className="text-xs text-muted mt-0.5">{sale.serviceFilter ? `Khusus: ${sale.serviceFilter}` : "Semua layanan"}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Block val={h} label="JAM" />
          <span className="text-rose font-extrabold mb-4">:</span>
          <Block val={m} label="MNT" />
          <span className="text-rose font-extrabold mb-4">:</span>
          <Block val={s} label="DTK" />
        </div>
      </div>
    </div>
  );
}
