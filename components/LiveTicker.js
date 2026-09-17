"use client";

import { useEffect, useRef, useState } from "react";

function rupiah(n) {
  return `Rp${Number(n || 0).toLocaleString("id-ID")}`;
}

const FALLBACK = [
  { user: "AP•••", service: "WhatsApp", country: "Indonesia", price: 2500 },
  { user: "BX•••", service: "Telegram", country: "Malaysia", price: 3000 },
  { user: "CK•••", service: "Google", country: "Singapore", price: 4000 },
  { user: "DN•••", service: "WhatsApp", country: "Thailand", price: 2800 },
  { user: "EZ•••", service: "TikTok", country: "Indonesia", price: 3500 },
];

export default function LiveTicker() {
  const [items, setItems] = useState(FALLBACK);
  const trackRef = useRef(null);

  useEffect(() => {
    fetch("/api/stats/recent")
      .then((r) => r.json())
      .then((d) => { if (d.items?.length > 0) setItems(d.items); })
      .catch(() => {});
  }, []);

  const doubled = [...items, ...items];

  return (
    <div className="overflow-hidden py-1" aria-hidden="true">
      <div
        ref={trackRef}
        className="flex gap-3 animate-ticker"
        style={{ width: "max-content" }}
      >
        {doubled.map((item, i) => (
          <div
            key={i}
            className="flex shrink-0 items-center gap-2 rounded-xl border border-line bg-surface px-3.5 py-2 text-xs shadow-soft"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-teal-soft text-teal-bright text-[11px] font-bold">✓</span>
            <span className="font-semibold text-ink">{item.user}</span>
            <span className="text-muted">beli</span>
            <span className="font-semibold text-amber-bright">{item.service}</span>
            {item.country && <span className="text-muted">{item.country}</span>}
            <span className="font-bold tabular-nums text-teal-bright">{rupiah(item.price)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
