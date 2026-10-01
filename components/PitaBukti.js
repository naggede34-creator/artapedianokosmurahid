"use client";

// Pita "baru saja beli / menang" — bukti sosial yang bergulir pelan. Nama disamarkan di server.
import { useEffect, useState } from "react";

const lalu = (t) => { const m = Math.max(0, Math.round((Date.now() - t) / 60000)); return m < 1 ? "baru saja" : m < 60 ? `${m} mnt lalu` : m < 1440 ? `${Math.floor(m / 60)} jam lalu` : `${Math.floor(m / 1440)} hari lalu`; };

export default function PitaBukti({ className = "" }) {
  const [items, setItems] = useState([]);
  const [i, setI] = useState(0);
  useEffect(() => {
    let batal = false;
    const muat = () => fetch("/api/pita").then((r) => r.json()).then((d) => { if (!batal && Array.isArray(d.items)) setItems(d.items); }).catch(() => {});
    muat();
    const t = setInterval(muat, 60_000);
    return () => { batal = true; clearInterval(t); };
  }, []);
  useEffect(() => {
    if (items.length < 2) return undefined;
    const t = setInterval(() => setI((x) => (x + 1) % items.length), 4200);
    return () => clearInterval(t);
  }, [items.length]);
  if (!items.length) return null;
  const it = items[i % items.length];
  return (
    <div className={`pita-bukti ${className}`} role="status" aria-live="polite" data-testid="pita-bukti">
      <span className="pita-ikon" aria-hidden="true">{it.tipe === "menang" ? "🏆" : "🛒"}</span>
      <span key={i} className="pita-teks"><b>{it.user}</b> {it.teks} <small>· {lalu(it.at)}</small></span>
    </div>
  );
}
