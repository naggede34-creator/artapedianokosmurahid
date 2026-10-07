"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

function useCountdown(endAt) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (!endAt) return;
    const tick = () => setSecs(Math.max(0, Math.floor((new Date(endAt) - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [endAt]);
  return {
    h: Math.floor(secs / 3600),
    m: Math.floor((secs % 3600) / 60),
    s: secs % 60,
    total: secs,
  };
}

function TimeBlock({ val, label }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-rose/90 shadow-md shadow-rose/30">
        <span className="text-lg font-extrabold font-mono tabular-nums text-white leading-none">
          {String(val).padStart(2, "0")}
        </span>
      </div>
      <span className="text-[9px] font-bold text-muted uppercase tracking-wide">{label}</span>
    </div>
  );
}

export default function FlashSaleTimer() {
  const [sale, setSale] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetch("/api/flashsale").then((r) => r.json()).then(setSale);
    const t = setInterval(() => {
      fetch("/api/flashsale").then((r) => r.json()).then(setSale);
    }, 60000);
    return () => clearInterval(t);
  }, []);

  const { h, m, s, total } = useCountdown(sale?.endAt);
  const isUrgent = total > 0 && total <= 600; // < 10 menit

  if (!sale?.active || total === 0 || dismissed) return null;

  return (
    <div className={`relative rounded-2xl overflow-hidden transition-all
      ${isUrgent
        ? "border-2 border-rose animate-pulse"
        : "border border-rose/60"}`}
      style={{ background: "linear-gradient(135deg, rgb(var(--c-rose-bright) / 0.08) 0%, rgb(var(--c-navy-bright) / 0.03) 100%)" }}
    >
      {/* Dismiss */}
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-2 right-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-rose/10 text-rose/60 hover:bg-rose/20 hover:text-rose text-xs"
        aria-label="Tutup"
      >✕</button>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3.5">
        {/* Left: label */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose text-xl shadow-md shadow-rose/30">
            🔥
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-extrabold text-rose">FLASH SALE</span>
              <span className="rounded-lg bg-rose text-white text-[11px] font-extrabold px-2 py-0.5">
                -{sale.discountPercent}%
              </span>
              {isUrgent && (
                <span className="text-[10px] font-bold text-rose animate-pulse">⚠ Hampir habis!</span>
              )}
            </div>
            <p className="text-xs text-muted mt-0.5 truncate">
              {sale.title}
              {sale.serviceFilter ? ` · Khusus: ${sale.serviceFilter}` : " · Semua layanan"}
            </p>
          </div>
        </div>

        {/* Right: countdown + CTA */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1">
            <TimeBlock val={h} label="Jam" />
            <span className="text-rose font-extrabold text-lg mb-4 leading-none">:</span>
            <TimeBlock val={m} label="Mnt" />
            <span className="text-rose font-extrabold text-lg mb-4 leading-none">:</span>
            <TimeBlock val={s} label="Dtk" />
          </div>
          <Link href="/otp" className="rounded-xl bg-rose px-3 py-2 text-xs font-extrabold text-white press shadow-md shadow-rose/30 whitespace-nowrap">
            Beli Sekarang →
          </Link>
        </div>
      </div>
    </div>
  );
}
