"use client";

// Popup buatan admin (Admin → Popup & Tampilan): foto, judul, teks, dan tombol ke dasbor/halaman. Dimunculkan satu per satu
// setelah popup pembuka bawaan selesai. Frekuensi: sekali per versi, sekali per sesi, atau sekali sehari.
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { onOpenersFree } from "@/lib/introGate";

const KUNCI = "artapedia_popup_admin";
const hariIni = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

function sudahDilihat(p) {
  try {
    if (p.frekuensi === "sesi") return sessionStorage.getItem(`${KUNCI}:${p.id}:${p.versi}`) === "1";
    const lihat = JSON.parse(localStorage.getItem(KUNCI) || "{}");
    const v = lihat[p.id];
    if (!v || v.versi !== p.versi) return false;
    return p.frekuensi === "hari" ? v.hari === hariIni() : true;
  } catch { return false; }
}
function tandai(p) {
  try {
    if (p.frekuensi === "sesi") { sessionStorage.setItem(`${KUNCI}:${p.id}:${p.versi}`, "1"); return; }
    const lihat = JSON.parse(localStorage.getItem(KUNCI) || "{}");
    lihat[p.id] = { versi: p.versi, hari: hariIni() };
    localStorage.setItem(KUNCI, JSON.stringify(lihat));
  } catch {}
}

export default function PopupAdmin({ langsung = false }) {
  const [antre, setAntre] = useState([]);
  const [sedang, setSedang] = useState(null);
  const siap = useRef(false);

  useEffect(() => {
    let batal = false, off = () => {}, nanti = null;
    fetch("/api/popup", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null).then((j) => {
      if (batal || !j || !Array.isArray(j.items)) return;
      const baru = j.items.filter((p) => !sudahDilihat(p));
      if (!baru.length) return;
      setAntre(baru);
      const mulai = () => {
        const t0 = Date.now();
        const cek = () => {
          if (batal) return;
          // menunggu popup pembuka/pembaruan bawaan ditutup dulu (maks 40 dtk) supaya tidak bertumpuk
          const lain = document.querySelector("div.fixed.inset-0.z-\\[90\\], div.fixed.inset-0.z-\\[95\\]");
          if (lain && Date.now() - t0 < 40_000) nanti = setTimeout(cek, 700); else { siap.current = true; setSedang((x) => x || 0); }
        };
        cek();
      };
      off = langsung ? (() => { const id = setTimeout(mulai, 1500); return () => clearTimeout(id); })() : onOpenersFree(() => { nanti = setTimeout(mulai, 1200); });
    });
    return () => { batal = true; off?.(); clearTimeout(nanti); };
  }, [langsung]);

  const p = sedang !== null ? antre[sedang] : null;
  const tutup = useCallback(() => {
    if (p) tandai(p);
    setSedang((i) => (i !== null && i + 1 < antre.length ? i + 1 : null));
  }, [p, antre.length]);

  useEffect(() => {
    if (!p) return undefined;
    const k = (e) => { if (e.key === "Escape") tutup(); };
    window.addEventListener("keydown", k);
    const lama = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = lama; };
  }, [p, tutup]);

  if (!p) return null;
  const luar = /^https:/i.test(p.tombolHref || "");
  return (
    <div className="fixed inset-0 z-[96] flex items-end justify-center px-3 pb-3 sm:items-center sm:pb-0" role="dialog" aria-modal="true" aria-label={p.judul || "Pengumuman"} data-testid="popup-admin">
      <button aria-label="Tutup" className="animate-fade-in absolute inset-0" style={{ background: "rgb(var(--c-ink) / 0.6)" }} onClick={tutup} />
      <div className="animate-scale-in relative flex max-h-[90dvh] w-full max-w-sm flex-col overflow-hidden rounded-3xl border-2 border-ink/15 bg-surface shadow-lift">
        <button onClick={tutup} className="press absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur hover:bg-black/60" aria-label="Tutup" data-testid="popup-admin-tutup">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
        </button>
        {p.gambar && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.gambar} alt="" className="max-h-64 w-full shrink-0 object-cover" data-testid="popup-admin-gambar" />
        )}
        <div className="gulir-aman min-h-0 flex-1 overflow-y-auto p-5 text-center">
          {p.judul && <h2 className="font-display text-2xl leading-tight text-ink" data-testid="popup-admin-judul">{p.judul}</h2>}
          {p.teks && <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted" data-testid="popup-admin-teks">{p.teks}</p>}
        </div>
        <div className="flex shrink-0 flex-col gap-2 border-t border-line bg-surface p-3">
          {p.tombolTeks && p.tombolHref && (luar
            ? <a href={p.tombolHref} target="_blank" rel="noopener noreferrer" onClick={tutup} className="btn-primary w-full text-center" data-testid="popup-admin-tombol">{p.tombolTeks}</a>
            : <Link href={p.tombolHref} onClick={tutup} className="btn-primary w-full text-center" style={{ backgroundColor: "rgb(var(--c-blue))" }} data-testid="popup-admin-tombol">{p.tombolTeks}</Link>)}
          <button onClick={tutup} className="rounded-xl px-3 py-2 text-xs font-bold text-muted hover:bg-surface2" data-testid="popup-admin-nanti">{p.tombolTeks && p.tombolHref ? "Nanti saja" : "Mengerti, tutup"}</button>
        </div>
      </div>
    </div>
  );
}
