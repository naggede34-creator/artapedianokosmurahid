"use client";

import { useBrand } from "@/app/providers";

// Halaman status layanan publik: lampu per layanan, diperbarui otomatis tiap 30 detik.
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/ui";
import { Skel } from "@/components/Skeleton";

const TAMPIL = {
  normal: { l: "Normal", cls: "bg-success-soft text-success border-success/30", titik: "bg-success" },
  kurang: { l: "Kurang stabil", cls: "bg-amber-soft text-amber-bright border-amber/40", titik: "bg-amber" },
  gangguan: { l: "Gangguan", cls: "bg-rose-soft text-rose border-rose/40", titik: "bg-rose" },
  tutup: { l: "Tutup", cls: "bg-surface2 text-muted border-line", titik: "bg-muted" }
};
const UMUM = {
  normal: { j: "Semua layanan berjalan normal", e: "✅", cls: "border-success/40 bg-success-soft" },
  kurang: { j: "Sebagian layanan kurang stabil", e: "⚠️", cls: "border-amber/40 bg-amber-soft" },
  gangguan: { j: "Ada layanan yang sedang gangguan", e: "🚨", cls: "border-rose/40 bg-rose-soft" },
  maintenance: { j: "Website sedang maintenance", e: "🛠️", cls: "border-amber/40 bg-amber-soft" },
  darurat: { j: "Mode darurat: transaksi dihentikan sementara", e: "⛔", cls: "border-rose/40 bg-rose-soft" }
};

export default function StatusPage() {
  const brand = useBrand();
  const [d, setD] = useState(null);
  const [galat, setGalat] = useState("");
  const muat = useCallback(async () => {
    try { const r = await fetch("/api/status", { cache: "no-store" }); const j = await r.json(); if (!r.ok) throw new Error(j.error || "Gagal"); setD(j); setGalat(""); }
    catch (e) { setGalat(e.message); }
  }, []);
  useEffect(() => { muat(); const t = setInterval(muat, 30000); return () => clearInterval(t); }, [muat]);
  const u = d ? UMUM[d.umum] || UMUM.normal : null;
  return (
    <div className="mx-auto max-w-content px-4 py-6 sm:px-5 sm:py-10">
      <PageHeader title="Status Layanan" desc={`Kondisi layanan ${brand.nama} saat ini, dihitung dari transaksi nyata 60 menit terakhir.`} />
      {galat && !d && <p className="mt-4 rounded-xl border border-rose/30 bg-rose-soft px-3 py-2 text-sm font-bold text-rose" data-testid="status-galat">{galat}</p>}
      {!d && !galat && (
        <div className="mt-5 space-y-3" role="status" aria-label="Memuat status" data-testid="status-skeleton">
          <Skel className="h-20 rounded-2xl" />
          {[1, 2, 3, 4].map((i) => <Skel key={i} className="h-16 rounded-2xl" />)}
        </div>
      )}
      {d && (
        <>
          <div className={`mt-5 flex items-center gap-3 rounded-2xl border-2 px-4 py-4 ${u.cls}`} data-testid="status-umum" data-umum={d.umum}>
            <span className="text-3xl" aria-hidden="true">{u.e}</span>
            <div><p className="text-base font-black text-ink">{u.j}</p><p className="text-[11px] text-muted">Diperbarui {new Date(d.diperbarui).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })} · otomatis tiap 30 detik</p></div>
          </div>
          <ul className="mt-4 grid gap-2.5 sm:grid-cols-2" data-testid="status-daftar">
            {d.layanan.map((l) => {
              const t = TAMPIL[l.status] || TAMPIL.normal;
              return (
                <li key={l.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-3.5 py-3" data-testid="status-layanan" data-status={l.status}>
                  <span className="text-2xl" aria-hidden="true">{l.ikon}</span>
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-sm text-ink">{l.nama}</b>
                    <span className="block text-[11px] text-muted">{l.ket || (l.n >= 4 ? `${l.persen}% berhasil dari ${l.n} transaksi` : "Belum ada gangguan terdeteksi")}</span>
                  </span>
                  <span className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-black ${t.cls}`}><span className={`h-2 w-2 rounded-full ${t.titik}`} />{t.l}</span>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 text-[11px] leading-relaxed text-muted">Status "Kurang stabil" / "Gangguan" muncul bila sebagian besar transaksi satu jenis gagal dalam 60 menit terakhir. Saldo tidak pernah terpotong untuk transaksi yang gagal. Butuh bantuan? Hubungi CS lewat tombol kontak di dasbor.</p>
        </>
      )}
    </div>
  );
}
