"use client";

// Banner event musiman (tanggal kembar, gajian, Ramadan, …) lengkap dengan hitung mundur, besar diskon & bonus cashback.
// Tidak merender apa pun bila tidak ada event yang berjalan. Data dari /api/musim (di-cache 30 detik di server).
import Link from "next/link";
import { useEffect, useState } from "react";

function sisaTeks(ms) {
  const m = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(m / 60), d = Math.floor(h / 24);
  if (d >= 1) return `${d} hari ${h % 24} jam lagi`;
  if (h >= 1) return `${h} jam ${m % 60} menit lagi`;
  return `${m} menit lagi`;
}

export function useMusim() {
  const [m, setM] = useState(null);
  useEffect(() => {
    let batal = false;
    fetch("/api/musim").then((r) => r.json()).then((d) => { if (!batal) setM(d); }).catch(() => {});
    return () => { batal = true; };
  }, []);
  return m;
}

export default function MusimBanner({ className = "" }) {
  const m = useMusim();
  const [kini, setKini] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setKini(Date.now()), 30_000); return () => clearInterval(t); }, []);
  const u = m?.utama;
  if (!m?.aktif || !u) return null;
  const warna = u.warna || "#ED5A0F";
  const sisa = Math.max(0, (u.sampai || 0) - kini);
  return (
    <section className={`musim-banner relative overflow-hidden rounded-2xl border-2 border-ink/80 p-4 text-white ${className}`} style={{ background: `linear-gradient(120deg, ${warna}, ${warna}cc 55%, #0b1b44)` }} data-testid="musim-banner" aria-label={`Event ${u.nama}`}>
      <span className="musim-kilau" aria-hidden="true" />
      <div className="relative flex flex-wrap items-center gap-3">
        <span className="musim-ikon flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-3xl">{u.ikon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-black uppercase tracking-widest text-white/80">Event spesial · {sisaTeks(sisa)}</p>
          <h2 className="truncate text-lg font-black leading-tight text-white" style={{ textShadow: "none" }}>{u.nama}</h2>
          <p className="mt-0.5 text-xs leading-snug text-white/90">{u.banner}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-1.5">
          {u.diskonPersen > 0 && <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-ink" data-testid="musim-diskon">🏷️ Diskon {u.diskonPersen}%</span>}
          {u.cashbackBonus > 0 && <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-ink" data-testid="musim-cashback">💸 Cashback +{u.cashbackBonus}%</span>}
        </div>
        <Link href="/otp" className="shrink-0 rounded-xl border-2 border-ink bg-white px-3.5 py-2 text-xs font-black text-ink transition-transform active:translate-y-0.5">Belanja sekarang →</Link>
      </div>
    </section>
  );
}
