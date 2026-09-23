"use client";

import { useEffect, useState } from "react";

// Banner iklan yang diatur admin. Satu komponen dipakai di semua tempat
// pemasangannya supaya bentuknya konsisten, dan supaya menambah tempat baru
// cukup satu baris di halaman yang bersangkutan.
//
// Dua keputusan yang membuatnya tidak mengganggu:
//   1. Kalau tidak ada banner aktif, komponen ini TIDAK merender apa pun —
//      bukan kotak kosong atau judul yang menggantung tanpa isi.
//   2. Tingginya dikunci lewat rasio, bukan dibiarkan mengikuti gambar. Banner
//      dengan rasio aneh kalau tidak dikunci akan mendorong seluruh isi halaman
//      ke bawah saat gambarnya selesai diunduh.
export default function BannerRail({ placement = "homepage", title = "", className = "" }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    let alive = true;
    fetch(`/api/banners/public?placement=${encodeURIComponent(placement)}`)
      .then((r) => r.json())
      .then((d) => {
        if (alive) setItems(Array.isArray(d.items) ? d.items : []);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [placement]);

  if (items.length === 0) return null;

  const satu = items.length === 1;

  return (
    <section className={`reveal ${className}`} aria-label="Banner">
      {title && (
        <div className="mb-2 flex items-center gap-2">
          <span className="text-xs font-black uppercase tracking-widest text-muted">{title}</span>
          <span className="h-px flex-1 bg-line" />
        </div>
      )}

      <div
        className={
          satu
            ? "grid grid-cols-1"
            : // Satu baris yang bisa digeser di layar kecil, kisi rapi di layar besar.
              "flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 scrollbar-none md:grid md:grid-cols-2 md:overflow-visible"
        }
      >
        {items.map((b) => {
          const isi = (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={b.imageUrl}
                alt={b.title || "Banner"}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
              />
              {b.label && (
                <span className="absolute left-3 top-3 rounded-full bg-amber px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white shadow-[0_2px_0_rgb(var(--c-orange-bright))]">
                  {b.label}
                </span>
              )}
              {b.title && (
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2.5 pt-8 text-left text-xs font-bold text-white">
                  {b.title}
                </span>
              )}
            </>
          );

          // banner-3d memberi bingkai komik dan kedalaman yang sama dengan
          // kartu lain di situs. Ditulis sebagai kelas, bukan utilitas
          // panjang, karena bayangan berlapis dan gerakan tekannya tidak bisa
          // diungkapkan rapi dengan kelas utilitas.
          const kelas =
            "banner-3d group relative block aspect-[16/6] shrink-0 snap-start overflow-hidden " +
            (satu ? "w-full" : "w-[86%] md:w-full");

          return b.linkUrl ? (
            <a
              key={b.id}
              href={b.linkUrl}
              target={b.linkUrl.startsWith("http") ? "_blank" : undefined}
              rel="noopener noreferrer"
              className={`${kelas} press hover:border-amber`}
            >
              {isi}
            </a>
          ) : (
            <div key={b.id} className={kelas}>
              {isi}
            </div>
          );
        })}
      </div>
    </section>
  );
}
