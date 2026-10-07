"use client";

import Link from "next/link";
import { useState } from "react";
import { OTP_SERVERS } from "@/lib/otpServers";

function rupiah(n) {
  return `Rp${Number(n || 0).toLocaleString("id-ID")}`;
}

export default function OTPPriceWidget() {
  const [server, setServer] = useState("rumahotp");
  const [services, setServices] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadedServer, setLoadedServer] = useState(null);
  const [error, setError] = useState("");
  // Harga termurah per layanan, diambil saat baris ditekan (1 request per klik).
  const [prices, setPrices] = useState({});
  const [pricing, setPricing] = useState(null);

  async function load(key = server) {
    setLoading(true);
    setError("");
    setPrices({});
    try {
      const res = await fetch(`/api/otp/services?server=${encodeURIComponent(key)}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Gagal memuat layanan.");
      setServices(Array.isArray(d.items) ? d.items : []);
      setLoadedServer(key);
    } catch (e) {
      setServices([]);
      setError(e.message || "Gagal memuat layanan.");
    } finally {
      setLoading(false);
    }
  }

  // Harga dari API sudah termasuk markup yang diatur admin untuk server ini.
  async function checkPrice(svc) {
    const code = svc.service_code;
    if (prices[code] !== undefined || pricing) return;
    setPricing(code);
    try {
      const params = new URLSearchParams({ service_id: code, server: loadedServer });
      const res = await fetch(`/api/otp/countries?${params}`);
      const d = await res.json();
      const all = (Array.isArray(d.items) ? d.items : []).flatMap((c) =>
        (c.pricelist || []).map((p) => Number(p.sell_price ?? p.price ?? 0)).filter((n) => n > 0)
      );
      setPrices((prev) => ({ ...prev, [code]: all.length ? Math.min(...all) : null }));
    } catch {
      setPrices((prev) => ({ ...prev, [code]: null }));
    } finally {
      setPricing(null);
    }
  }

  function switchServer(key) {
    setServer(key);
    setQuery("");
    if (loadedServer) load(key);
  }

  const filtered =
    query.length < 2
      ? services.slice(0, 8)
      : services.filter((s) => (s.service_name || "").toLowerCase().includes(query.toLowerCase())).slice(0, 12);

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-ink">🔍 Cek Harga Layanan</h2>
          <p className="mt-0.5 text-xs text-muted">Harga sudah termasuk markup, tinggal bayar segitu</p>
        </div>
        {!loadedServer && (
          <button
            onClick={() => load()}
            disabled={loading}
            className="btn-3d shrink-0 rounded-xl bg-amber px-4 py-2 text-xs font-semibold text-white shadow-3d hover:bg-amber-bright disabled:opacity-60"
          >
            {loading ? "Memuat..." : "Tampilkan"}
          </button>
        )}
      </div>

      {loadedServer && (
        <div className="mt-3">
          <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {OTP_SERVERS.map((sv) => (
              <button
                key={sv.key}
                onClick={() => switchServer(sv.key)}
                className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition-colors ${
                  server === sv.key ? "border-amber bg-amber-soft text-amber-bright" : "border-line text-muted hover:text-ink"
                }`}
              >
                {sv.name}
              </button>
            ))}
          </div>

          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ketik nama layanan (WhatsApp, Google, dll)"
            className="mt-2 w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm text-ink outline-none focus:border-amber"
          />

          {loading ? (
            <div className="mt-3 space-y-1.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton h-[46px] rounded-xl border border-line" />
              ))}
            </div>
          ) : error ? (
            <div className="py-4 text-center">
              <p className="text-sm text-rose">{error}</p>
              <button onClick={() => load()} className="btn-ghost mt-2 text-xs">Coba lagi</button>
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted">Layanan tidak ditemukan.</p>
          ) : (
            <div className="mt-3 max-h-56 space-y-1.5 overflow-y-auto">
              {filtered.map((s) => {
                const price = prices[s.service_code];
                return (
                  <div
                    key={s.service_code}
                    className="flex items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3.5 py-2.5 transition-colors hover:border-amber/50 hover:bg-amber-soft/30"
                  >
                    <p className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{s.service_name}</p>
                    <div className="flex shrink-0 items-center gap-2">
                      {price === undefined ? (
                        <button
                          onClick={() => checkPrice(s)}
                          disabled={pricing !== null}
                          className="rounded-lg border border-line px-2.5 py-1 text-[11px] font-semibold text-muted hover:border-amber hover:text-amber-bright disabled:opacity-50"
                        >
                          {pricing === s.service_code ? "..." : "Cek harga"}
                        </button>
                      ) : price === null ? (
                        <span className="text-[11px] text-muted">stok kosong</span>
                      ) : (
                        <span className="text-sm font-black tabular-nums text-amber-bright">{rupiah(price)}</span>
                      )}
                      <Link
                        href={`/otp?q=${encodeURIComponent(s.service_name || "")}`}
                        className="rounded-lg bg-amber px-2.5 py-1 text-[11px] font-bold text-white hover:bg-amber-bright"
                      >
                        Beli
                      </Link>
                    </div>
                  </div>
                );
              })}
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
