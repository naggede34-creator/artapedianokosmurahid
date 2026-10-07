"use client";

// Popup "Yang baru": ringkasan semua pembaruan terbaru. Muncul sekali per versi
// (setelah popup pembuka selesai), bisa ditutup dengan tombol X, tombol
// "Mengerti", tombol Esc, atau ketukan di luar kartu. Bisa dibuka lagi dari
// menu samping ("✨ Yang baru").
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { onOpenersFree } from "@/lib/introGate";

// Isi popup datang dari server (diatur admin di tab Pembaruan); `versi` berubah
// setiap admin mengubah daftar aktif, sehingga popup muncul lagi.
import { ITEM_BAWAAN, JUDUL_BAWAAN, SUB_BAWAAN, VERSI_BAWAAN } from "@/lib/pembaruanBawaan";

const KUNCI = "artapedia_pembaruan_dilihat";
const BAWAAN = { versi: VERSI_BAWAAN, otomatis: true, judul: JUDUL_BAWAAN, sub: SUB_BAWAAN, item: ITEM_BAWAAN.map((x, n) => ({ id: `b${n}`, ...x })) };

export default function PembaruanModal({ langsung = false }) {
  const [buka, setBuka] = useState(false);
  const [data, setData] = useState(BAWAAN);
  const versiRef = useRef(BAWAAN.versi);

  useEffect(() => {
    let batal = false;
    let off = () => {};
    let nanti = null;
    const manual = () => setBuka(true);
    window.addEventListener("buka-pembaruan", manual);
    fetch("/api/pembaruan", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((j) => {
        if (batal) return;
        const d = j && Array.isArray(j.item) ? j : BAWAAN;
        versiRef.current = d.versi;
        setData(d);
        let sudah = false;
        try { sudah = localStorage.getItem(KUNCI) === d.versi; } catch {}
        if (sudah || !d.otomatis || !d.item.length) return;
        mulaiTampil();
      });
    function mulaiTampil() {
    // Menunggu popup pembuka lain (mis. Tutorial & Informasi) ditutup dulu supaya tidak bertumpuk; paling lama 25 detik.
    const tampil = () => {
      const mulai = Date.now();
      const cek = () => {
        if (batal) return;
        const adaLain = document.querySelector("div.fixed.inset-0.z-\\[90\\]");
        if (adaLain && Date.now() - mulai < 25_000) setTimeout(cek, 600);
        else setBuka(true);
      };
      cek();
    };
    // Halaman tanpa popup pembuka (WEARTA CHAT layar penuh) tidak punya antrean yang ditunggu.
      off = langsung ? (() => { const id = setTimeout(tampil, 1200); return () => clearTimeout(id); })() : onOpenersFree(() => { nanti = setTimeout(tampil, 700); });
    }
    return () => { batal = true; off?.(); clearTimeout(nanti); window.removeEventListener("buka-pembaruan", manual); };
  }, [langsung]);

  const tutup = useCallback(() => {
    setBuka(false);
    try { localStorage.setItem(KUNCI, versiRef.current); } catch {}
  }, []);

  useEffect(() => {
    if (!buka) return undefined;
    const k = (e) => { if (e.key === "Escape") tutup(); };
    window.addEventListener("keydown", k);
    const lama = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = lama; };
  }, [buka, tutup]);

  if (!buka) return null;
  return (
    <div className={`fixed inset-0 ${langsung ? "z-[10000]" : "z-[95]"} flex items-end justify-center px-3 pb-3 sm:items-center sm:pb-0`} role="dialog" aria-modal="true" aria-labelledby="pembaruan-judul">
      <button aria-label="Tutup pembaruan" className="animate-fade-in absolute inset-0" style={{ background: "rgb(var(--c-ink) / 0.55)" }} onClick={tutup} />
      <div className="animate-scale-in relative flex max-h-[88dvh] w-full max-w-md flex-col overflow-hidden rounded-3xl border-2 border-ink/15 bg-surface shadow-lift">
        <div className="relative shrink-0 bg-ink px-5 pb-4 pt-5 text-white">
          <div className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full bg-amber/30 blur-3xl" />
          <button onClick={tutup} className="press absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 hover:bg-white/25" aria-label="Tutup">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
          </button>
          <p className="text-[11px] font-black uppercase tracking-widest text-amber-bright">Pembaruan terbaru</p>
          <h2 id="pembaruan-judul" className="mt-1 font-display text-2xl">{data.judul}</h2>
          {data.sub && <p className="mt-1 text-xs text-white/75">{data.sub}</p>}
        </div>

        <ul className="gulir-aman min-h-0 flex-1 space-y-2.5 overflow-y-auto p-4">
          {!data.item.length && <li className="rounded-2xl border border-line bg-surface2/50 p-4 text-center text-xs text-muted">Belum ada pembaruan untuk ditampilkan.</li>}
          {data.item.map((d) => (
            <li key={d.id || d.judul} className="rounded-2xl border border-line bg-surface2/50 p-3.5">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-soft text-xl" aria-hidden="true">{d.ikon}</span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5 text-sm font-extrabold text-ink">
                    {d.judul}
                    {d.baru && <span className="rounded-full bg-rose px-2 py-0.5 text-[10px] font-black text-white">BARU</span>}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted">{d.isi}</p>
                  {d.href && (
                    <Link href={d.href} onClick={tutup} className="btn-3d mt-2 inline-block rounded-lg border border-amber/60 bg-amber-soft px-3 py-1.5 text-xs font-black text-amber-bright">
                      {d.tombol} →
                    </Link>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>

        <div className="shrink-0 border-t border-line bg-surface p-3">
          <button onClick={tutup} className="btn-3d w-full rounded-xl border-2 border-blue bg-blue-bright py-3 text-sm font-black text-white">Mengerti, tutup</button>
        </div>
      </div>
    </div>
  );
}
