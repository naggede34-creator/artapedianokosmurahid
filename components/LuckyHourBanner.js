"use client";

import { useEffect, useState } from "react";

export default function LuckyHourBanner() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch("/api/lucky-hours").then((r) => r.json()).then(setData);
    const t = setInterval(() => {
      fetch("/api/lucky-hours").then((r) => r.json()).then(setData);
    }, 60000);
    return () => clearInterval(t);
  }, []);

  if (!data?.active) {
    if (!data?.next) return null;
    return (
      <div className="rounded-xl border border-line bg-surface2 px-4 py-2.5 flex items-center gap-3 text-sm">
        <span className="text-lg">⏰</span>
        <span className="text-muted">Lucky Hour berikutnya: <span className="font-bold text-ink">{data.next.label}</span> ({data.next.startHour}:00–{data.next.endHour}:00)</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border-2 border-amber bg-amber-soft px-4 py-3 flex items-center gap-3 animate-pulse-slow">
      <span className="text-2xl">⚡</span>
      <div className="flex-1">
        <p className="text-sm font-bold text-amber-bright">Lucky Hour Aktif! {data.discountPercent}% OFF</p>
        <p className="text-xs text-amber/80">{data.label} — Berakhir dalam {data.minutesLeft} menit</p>
      </div>
      <span className="text-xs font-bold bg-amber text-white px-2 py-1 rounded-lg shrink-0">
        -{data.discountPercent}%
      </span>
    </div>
  );
}
