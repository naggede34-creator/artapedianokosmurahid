"use client";

// Komponen penjelas untuk dasbor admin.
//   <Bantuan />   penjelasan kecil di bawah satu kolom isian
//   <PanduanTab/> kartu panduan yang bisa dibuka-tutup di atas tiap tab
import { useState } from "react";
import { panduanTab } from "@/lib/panduanAdmin";

/** Penjelasan ringkas satu kolom: fungsi, harus diisi apa, contoh, di mana tampil, kalau kosong. */
export function Bantuan({ fungsi, isi, contoh, dimana, kosong }) {
  const baris = [
    ["Fungsi", fungsi],
    ["Isi", isi],
    ["Contoh", contoh],
    ["Tampil di", dimana],
    ["Kalau kosong", kosong]
  ].filter(([, v]) => v);
  return (
    <div className="mt-1.5 rounded-lg border border-line bg-surface2 px-3 py-2 text-[11px] leading-relaxed text-muted">
      {baris.map(([k, v]) => (
        <p key={k}>
          <b className="text-ink">{k}:</b>{" "}
          {k === "Contoh" ? <code className="font-mono text-ink">{v}</code> : v}
        </p>
      ))}
    </div>
  );
}

/** Panduan satu tab: ringkas + daftar fungsi/isian. Tertutup bawaannya agar tidak memenuhi layar. */
export default function PanduanTab({ id }) {
  const [buka, setBuka] = useState(false);
  const p = panduanTab(id);
  if (!p) return null;
  return (
    <div className="mt-4 rounded-2xl border border-blue/30 bg-blue-soft p-4" data-testid="panduan-tab">
      <button
        type="button"
        onClick={() => setBuka((b) => !b)}
        className="flex w-full items-center justify-between gap-2 text-left"
        aria-expanded={buka}
      >
        <span className="text-sm font-black text-ink">📖 Panduan: {p.judul}</span>
        <span className="shrink-0 rounded-lg bg-surface px-2.5 py-1 text-[11px] font-bold text-ink">{buka ? "Tutup" : "Buka"}</span>
      </button>
      <p className="mt-1 text-xs leading-relaxed text-ink">{p.ringkas}</p>

      {buka && (
        <div className="mt-3 space-y-2">
          {p.item.map((it) => (
            <div key={it.nama} className="rounded-xl border border-line bg-surface px-3 py-2.5">
              <p className="text-xs font-black text-ink">{it.nama}</p>
              <Bantuan fungsi={it.fungsi} isi={it.isi} contoh={it.contoh} />
              {it.catatan && (
                <p className="mt-1.5 rounded-lg border border-amber/30 bg-amber/10 px-2.5 py-1.5 text-[11px] leading-relaxed text-ink">
                  ⚠️ {it.catatan}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
