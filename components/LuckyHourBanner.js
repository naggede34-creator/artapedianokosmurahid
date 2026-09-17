"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function LuckyHourBanner() {
  const [data, setData] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetch("/api/lucky-hours").then((r) => r.json()).then(setData);
    const t = setInterval(() => {
      fetch("/api/lucky-hours").then((r) => r.json()).then(setData);
    }, 60000);
    return () => clearInterval(t);
  }, []);

  if (dismissed || !data) return null;

  // Not active: show next lucky hour teaser
  if (!data.active) {
    if (!data.next) return null;
    return (
      <div className="flex items-center gap-3 rounded-xl border border-line bg-surface2/70 px-4 py-2.5">
        <span className="text-lg shrink-0">⏰</span>
        <div className="flex-1 min-w-0">
          <span className="text-xs text-muted">
            Lucky Hour berikutnya:{" "}
            <span className="font-bold text-ink">{data.next.label}</span>
            <span className="text-muted"> · {data.next.startHour}:00–{data.next.endHour}:00 WIB</span>
          </span>
        </div>
        <span className="text-xs font-bold text-amber-bright shrink-0">-{data.next.discountPercent}%</span>
      </div>
    );
  }

  // Active: prominent banner
  return (
    <div className="relative rounded-2xl overflow-hidden border-2 border-amber">
      {/* Dismiss */}
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-2 right-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-amber/10 text-amber/60 hover:bg-amber/20 hover:text-amber text-xs"
        aria-label="Tutup"
      >✕</button>

      {/* Animated gradient bg */}
      <div className="absolute inset-0 bg-gradient-to-r from-amber/10 via-amber/5 to-amber/10 animate-pulse pointer-events-none" />

      <div className="relative flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3.5">
        {/* Icon + text */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber text-xl shadow-md shadow-amber/30">
            ⚡
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-extrabold text-amber-bright">Lucky Hour Aktif!</span>
              <span className="rounded-lg bg-amber text-white text-[11px] font-extrabold px-2.5 py-0.5 shadow-sm">
                -{data.discountPercent}% OFF
              </span>
            </div>
            <p className="text-xs text-muted mt-0.5">
              {data.label}
              {data.minutesLeft > 0 && (
                <span className="ml-1 text-amber-bright font-semibold">
                  · Berakhir {data.minutesLeft < 60
                    ? `dalam ${data.minutesLeft} menit`
                    : `jam ${new Date(Date.now() + data.minutesLeft * 60000).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* CTA */}
        <Link
          href="/otp"
          className="shrink-0 rounded-xl bg-amber px-4 py-2 text-xs font-extrabold text-white press shadow-md shadow-amber/30 whitespace-nowrap self-start sm:self-auto"
        >
          Beli Sekarang ⚡
        </Link>
      </div>

      {/* Bottom progress bar (time remaining) */}
      {data.minutesLeft > 0 && data.totalMinutes > 0 && (
        <div className="h-1 bg-amber/20">
          <div
            className="h-full bg-amber/70 transition-all"
            style={{ width: `${Math.min(100, (data.minutesLeft / data.totalMinutes) * 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}
