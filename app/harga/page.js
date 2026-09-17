"use client";

import { useEffect, useMemo, useState } from "react";

export default function HargaPage() {
  const [services, setServices] = useState([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [countries, setCountries] = useState([]);
  const [countriesLoading, setCountriesLoading] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/otp/services")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setServices(d.items || []);
      })
      .catch(() => setError("Gagal memuat daftar layanan."))
      .finally(() => setServicesLoading(false));
  }, []);

  useEffect(() => {
    if (!selected) return;
    setCountriesLoading(true);
    setError("");
    fetch(`/api/otp/countries?service_id=${encodeURIComponent(selected.service_code)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setCountries(d.items || []);
      })
      .catch(() => setError("Gagal memuat daftar harga negara."))
      .finally(() => setCountriesLoading(false));
  }, [selected]);

  const filteredServices = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return services;
    return services.filter((s) => (s.service_name || "").toLowerCase().includes(q));
  }, [services, search]);

  const filteredCountries = useMemo(() => {
    const q = countrySearch.trim().toLowerCase();
    if (!q) return countries;
    return countries.filter((c) => (c.name || "").toLowerCase().includes(q));
  }, [countries, countrySearch]);

  return (
    <div className="mx-auto max-w-content px-4 py-6 sm:px-5 sm:py-10">
      <p className="fade-up text-sm font-semibold text-amber-bright">🏷️ Daftar Harga</p>
      <h1 className="fade-up delay-1 mt-2 text-[26px] font-extrabold tracking-tight text-ink sm:text-[32px]">
        Cek harga nomor OTP
      </h1>
      <p className="fade-up delay-2 mt-3 max-w-xl text-sm leading-relaxed text-muted">
        Pilih layanan aplikasi untuk melihat daftar harga nomor per negara. Harga sudah termasuk
        markup layanan dan diperbarui otomatis dari provider.
      </p>

      <div className="fade-up delay-3 mt-6 grid gap-4 lg:grid-cols-[280px_1fr]">
        {/* Service list */}
        <div className="card-shadow rounded-2xl border border-line bg-surface p-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari aplikasi..."
            className="w-full rounded-xl border border-line bg-surface2 px-3 py-2 text-sm text-ink outline-none focus:border-amber"
          />
          <div className="mt-3 max-h-[420px] space-y-1 overflow-y-auto pr-1">
            {servicesLoading
              ? Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-10 rounded-lg" />)
              : filteredServices.map((s) => (
                  <button
                    key={s.service_code}
                    onClick={() => setSelected(s)}
                    className={`press flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                      selected?.service_code === s.service_code
                        ? "bg-amber-soft font-medium text-amber-bright"
                        : "text-ink hover:bg-surface2"
                    }`}
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface2 text-xs">
                      {(s.service_name || "?")[0]}
                    </span>
                    <span className="truncate">{s.service_name}</span>
                  </button>
                ))}
            {!servicesLoading && filteredServices.length === 0 && (
              <p className="p-3 text-center text-sm text-muted">Layanan tidak ditemukan.</p>
            )}
          </div>
        </div>

        {/* Price table */}
        <div className="card-shadow rounded-2xl border border-line bg-surface p-4">
          {!selected ? (
            <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-2 text-center">
              <span className="text-2xl">👈</span>
              <p className="text-sm text-muted">Pilih aplikasi di sebelah kiri untuk melihat harga per negara.</p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-ink">Harga untuk {selected.service_name}</p>
                <input
                  value={countrySearch}
                  onChange={(e) => setCountrySearch(e.target.value)}
                  placeholder="Cari negara..."
                  className="rounded-lg border border-line bg-surface2 px-3 py-1.5 text-xs text-ink outline-none focus:border-amber"
                />
              </div>
              {error && <p className="mt-3 text-sm text-rose">{error}</p>}
              <div className="mt-3 overflow-hidden rounded-xl border border-line">
                {countriesLoading ? (
                  <div className="space-y-2 p-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="skeleton h-10 rounded-lg" />
                    ))}
                  </div>
                ) : filteredCountries.length === 0 ? (
                  <p className="p-6 text-center text-sm text-muted">Belum ada data harga untuk negara ini.</p>
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead className="bg-surface2 text-xs uppercase text-muted">
                      <tr>
                        <th className="px-4 py-2.5">Negara</th>
                        <th className="px-4 py-2.5">Mulai dari</th>
                        <th className="px-4 py-2.5">Stok</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {filteredCountries.map((c, i) => {
                        const prices = (c.pricelist || []).map((p) => Number(p.sell_price ?? p.price ?? 0));
                        const minPrice = prices.length ? Math.min(...prices) : 0;
                        const stock = (c.pricelist || []).reduce((sum, p) => sum + Number(p.stock || p.count || 0), 0);
                        return (
                          <tr key={i} className="transition-colors hover:bg-surface2/60">
                            <td className="px-4 py-2.5 text-ink">{c.name}</td>
                            <td className="px-4 py-2.5 font-medium text-amber-bright">
                              Rp{minPrice.toLocaleString("id-ID")}
                            </td>
                            <td className="px-4 py-2.5 text-muted">{stock || "-"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
