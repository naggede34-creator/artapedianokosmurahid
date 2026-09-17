"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

function rupiah(n) {
  return `Rp${Number(n || 0).toLocaleString("id-ID")}`;
}

export default function OTPPriceWidget() {
  const [services, setServices] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  function load() {
    if (loaded) return;
    setLoading(true);
    fetch("/api/otp/services")
      .then((r) => r.json())
      .then((d) => {
        const list = Array.isArray(d.items) ? d.items : [];
        setServices(list);
        setLoaded(true);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  const filtered = query.length < 2
    ? services.slice(0, 8)
    : services.filter((s) =>
        (s.name || s.service || "").toLowerCase().includes(query.toLowerCase())
      ).slice(0, 12);

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-ink">🔍 Cek Harga Layanan</h2>
          <p className="text-xs text-muted mt-0.5">Cari harga OTP sebelum beli</p>
        </div>
        {!loaded && (
          <button
            onClick={load}
            disabled={loading}
            className="btn-3d rounded-xl bg-amber hover:bg-amber-bright px-4 py-2 text-xs font-semibold text-white shadow-3d disabled:opacity-60"
          >
            {loading ? "Memuat..." : "Tampilkan"}
          </button>
        )}
      </div>

      {loaded && (
        <div className="mt-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ketik nama layanan (WhatsApp, Google, dll)"
            className="w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm text-ink outline-none focus:border-amber"
          />
          {services.length === 0 ? (
            <p className="mt-3 text-sm text-muted text-center py-4">Gagal memuat daftar layanan.</p>
          ) : filtered.length === 0 ? (
            <p className="mt-3 text-sm text-muted text-center py-4">Layanan tidak ditemukan.</p>
          ) : (
            <div className="mt-3 space-y-1.5 max-h-56 overflow-y-auto">
              {filtered.map((s, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl border border-line bg-surface px-3.5 py-2.5 hover:border-amber/50 hover:bg-amber-soft/30 transition-colors">
                  <div>
                    <p className="text-sm font-semibold text-ink">{s.name || s.service}</p>
                    {s.country && <p className="text-xs text-muted">{s.country}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-bold tabular-nums text-amber-bright text-sm">{rupiah(s.price)}</span>
                    <Link
                      href={`/otp?service=${encodeURIComponent(s.name || s.service || "")}`}
                      className="rounded-lg bg-amber px-2.5 py-1 text-[11px] font-bold text-white hover:bg-amber-bright"
                    >
                      Beli
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
          {query.length < 2 && services.length > 8 && (
            <p className="mt-2 text-center text-xs text-muted">Ketik untuk cari dari {services.length} layanan tersedia</p>
          )}
        </div>
      )}
    </div>
  );
}
