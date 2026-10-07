"use client";

import { tautanKaget, teksBagikan } from "@/lib/kagetUi";

/** Tombol bagikan paket Kaget: WhatsApp, Telegram, dan menu bagikan bawaan perangkat. */
export default function TombolBagikan({ data }) {
  const teks = teksBagikan(data);
  const url = tautanKaget(data.kid);
  const kecil = "btn-3d flex-1 min-w-[96px] rounded-xl border border-line bg-surface px-3 py-2.5 text-center text-xs font-black text-ink hover:border-amber";
  return (
    <div className="flex flex-wrap gap-2">
      <a className={kecil} target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${encodeURIComponent(teks)}`}>WhatsApp</a>
      <a className={kecil} target="_blank" rel="noopener noreferrer" href={`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(teks.split("\n")[0])}`}>Telegram</a>
      {typeof navigator !== "undefined" && navigator.share && (
        <button type="button" className={kecil} onClick={() => navigator.share({ title: "Saldo Kaget", text: teks, url }).catch(() => {})}>Lainnya…</button>
      )}
    </div>
  );
}

