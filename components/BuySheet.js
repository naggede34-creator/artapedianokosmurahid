"use client";

import { useEffect, useMemo, useState } from "react";

// Ambil field yang mungkin berbeda nama antar respons API, tanpa merusak tampilan kalau tidak ada.
function pick(obj, keys, fallback) {
  for (const k of keys) {
    if (obj?.[k] !== undefined && obj?.[k] !== null && obj?.[k] !== "") return obj[k];
  }
  return fallback;
}

export default function BuySheet({ open, onClose, services, servicesLoading, token, balance, onOrderCreated, initialQuery = "" }) {
  const [screen, setScreen] = useState("apps"); // apps | countries | operators
  const [appSearch, setAppSearch] = useState("");
  const [countrySearch, setCountrySearch] = useState("");
  const [sortMode, setSortMode] = useState("rate"); // rate | harga

  const [selectedService, setSelectedService] = useState(null);
  const [countries, setCountries] = useState([]);
  const [countriesLoading, setCountriesLoading] = useState(false);
  const [expandedCountry, setExpandedCountry] = useState(null);

  const [operatorTarget, setOperatorTarget] = useState(null); // { country, provider, operators }
  const [buyingKey, setBuyingKey] = useState(null);
  const [buyError, setBuyError] = useState("");

  useEffect(() => {
    if (open && initialQuery) setAppSearch(initialQuery);
  }, [open, initialQuery]);

  // Reset total tiap kali sheet ditutup, biar buka lagi selalu mulai dari awal.
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setScreen("apps");
        setAppSearch("");
        setCountrySearch("");
        setSelectedService(null);
        setCountries([]);
        setExpandedCountry(null);
        setOperatorTarget(null);
        setBuyError("");
      }, 250);
      return () => clearTimeout(t);
    }
  }, [open]);

  const popular = useMemo(() => services.slice(0, 6), [services]);
  const filteredApps = useMemo(() => {
    const q = appSearch.trim().toLowerCase();
    if (!q) return services;
    return services.filter((s) => (s.service_name || "").toLowerCase().includes(q));
  }, [services, appSearch]);

  const filteredCountries = useMemo(() => {
    const q = countrySearch.trim().toLowerCase();
    const base = q ? countries.filter((c) => (c.name || "").toLowerCase().includes(q)) : countries;
    const minPrice = (c) => Math.min(Infinity, ...(c.pricelist || []).map((p) => Number(p.sell_price ?? p.price ?? Infinity)));
    const maxRate = (c) =>
      Math.max(-1, ...(c.pricelist || []).map((p) => Number(pick(p, ["success_rate", "rate", "completion_rate", "percent"], -1))));
    return [...base].sort((a, b) => {
      if (sortMode === "harga") return minPrice(a) - minPrice(b);
      const r = maxRate(b) - maxRate(a);
      return r !== 0 ? r : minPrice(a) - minPrice(b);
    });
  }, [countries, countrySearch, sortMode]);

  async function chooseService(svc) {
    setSelectedService(svc);
    setScreen("countries");
    setCountries([]);
    setExpandedCountry(null);
    setCountriesLoading(true);
    try {
      const params = new URLSearchParams({ service_id: svc.service_code });
      if (svc.simuru_code) params.set("simuru_code", svc.simuru_code);
      const res = await fetch(`/api/otp/countries?${params}`);
      const data = await res.json();
      setCountries(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      setCountries([]);
    } finally {
      setCountriesLoading(false);
    }
  }

  async function handleOrderClick(country, provider) {
    setBuyError("");
    setBuyingKey(provider.provider_id);
    // Server OTO Fast (Simuru) tidak membutuhkan pemilihan operator — langsung order.
    if (provider.server === "simuru") {
      await submitOrder(country, provider, null, null);
      return;
    }
    try {
      const res = await fetch(
        `/api/otp/operators?country=${encodeURIComponent(country.name)}&provider_id=${encodeURIComponent(provider.provider_id)}`
      );
      const data = await res.json();
      const ops = Array.isArray(data.items) ? data.items : [];
      if (ops.length > 1) {
        setOperatorTarget({ country, provider, operators: ops });
        setScreen("operators");
        setBuyingKey(null);
        return;
      }
      await submitOrder(country, provider, ops[0]?.id || null, ops[0]?.name || null);
    } catch (e) {
      setBuyError("Gagal memuat operator. Coba lagi.");
      setBuyingKey(null);
    }
  }

  async function submitOrder(country, provider, operatorId, operatorName) {
    setBuyError("");
    setBuyingKey(provider.provider_id);
    try {
      const body = {
        token,
        serviceId: selectedService.service_code,
        numberId: country.number_id,
        providerId: provider.provider_id,
        operatorId: operatorId || null,
        operatorName: operatorName || null,
        serviceName: selectedService.service_name,
        countryName: country.name,
        server: provider.server || "rumahotp"
      };
      // Parameter khusus Server OTO Fast (Simuru)
      if (provider.server === "simuru") {
        body.countryId = provider.country_id;
        body.operator = provider.operator || "any";
        body.simuruServiceId = selectedService.simuru_code || selectedService.service_code.replace(/^simuru:/, "");
      }
      const res = await fetch("/api/otp/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal membeli nomor.");
      onOrderCreated({
        orderId: data.orderId,
        phoneNumber: data.phoneNumber,
        price: data.price,
        createdAt: data.createdAt,
        serviceName: selectedService.service_name,
        countryName: country.name,
        status: "pending",
        otpCode: null,
        otpMsg: null,
        expiredAt: data.expiredAt || null
      });
    } catch (err) {
      setBuyError(err.message);
      setScreen("countries");
    } finally {
      setBuyingKey(null);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70]">
      <div className="animate-fade-in absolute inset-0" style={{ background: "rgb(var(--c-navy-bright) / 0.5)" }} onClick={onClose} />

      <div className="animate-sheet-up absolute inset-x-0 bottom-0 mx-auto flex max-h-[88vh] max-w-2xl flex-col rounded-t-[28px] border border-line bg-surface shadow-lift">
        <div className="mx-auto mt-2.5 h-1.5 w-12 shrink-0 rounded-full bg-line" />

        <div className="shrink-0 px-5 pb-3 pt-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-extrabold tracking-tight text-ink">Beli nomor virtual</h3>
              <p className="text-xs text-muted">
                {screen === "apps" ? "Langkah 1 dari 2 · pilih aplikasi" : "Langkah 2 dari 2 · pilih negara & server"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-muted">Saldo</p>
              <p className="text-sm font-bold tabular-nums text-ink">Rp{Number(balance || 0).toLocaleString("id-ID")}</p>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
          {screen === "apps" && (
            <div className="fade-up">
              <input
                value={appSearch}
                onChange={(e) => setAppSearch(e.target.value)}
                placeholder="Cari nama aplikasi..."
                className="field"
              />

              {servicesLoading ? (
                <div className="mt-5 grid grid-cols-2 gap-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="skeleton h-[84px] rounded-2xl border border-line" />
                  ))}
                </div>
              ) : appSearch.trim() ? (
                <div className="mt-4 divide-y divide-line">
                  {filteredApps.length === 0 && <p className="py-6 text-sm text-muted">Aplikasi tidak ditemukan.</p>}
                  {filteredApps.map((s) => (
                    <AppRow key={s.service_code} s={s} onClick={() => chooseService(s)} />
                  ))}
                </div>
              ) : (
                <>
                  <p className="mt-5 text-sm font-semibold text-ink">Aplikasi Populer</p>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    {popular.map((s) => (
                      <button
                        key={s.service_code}
                        onClick={() => chooseService(s)}
                        className="btn-3d flex flex-col items-center gap-2 rounded-2xl border border-line bg-surface2/50 px-3 py-4 hover:border-amber/40"
                      >
                        {s.service_img ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={s.service_img} alt="" className="h-9 w-9 rounded object-contain" />
                        ) : (
                          <span className="flex h-9 w-9 items-center justify-center rounded bg-surface2 text-sm text-muted">
                            {(s.service_name || "?")[0]}
                          </span>
                        )}
                        <span className="line-clamp-1 text-xs font-medium text-ink">{s.service_name}</span>
                      </button>
                    ))}
                  </div>

                  <p className="mt-6 text-sm font-semibold text-ink">Semua Aplikasi</p>
                  <div className="mt-3 divide-y divide-line">
                    {services.slice(6).map((s) => (
                      <AppRow key={s.service_code} s={s} onClick={() => chooseService(s)} />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {screen === "countries" && selectedService && (
            <div className="fade-up">
              <button
                onClick={() => setScreen("apps")}
                className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface2/60 px-4 py-3 text-left"
              >
                {selectedService.service_img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selectedService.service_img} alt="" className="h-8 w-8 rounded object-contain" />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded bg-surface2 text-xs text-muted">
                    {(selectedService.service_name || "?")[0]}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink">{selectedService.service_name}</span>
                  <span className="block text-xs text-muted">Aplikasi yang dipilih</span>
                </span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0 text-muted">
                  <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              <input
                value={countrySearch}
                onChange={(e) => setCountrySearch(e.target.value)}
                placeholder="Cari nama negara..."
                className="field mt-3"
              />

              <div className="mt-3 grid grid-cols-2 gap-2">
                {[
                  { id: "rate", label: "Paling sukses", icon: "" },
                  { id: "harga", label: "Termurah", icon: "" }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setSortMode(tab.id)}
                    className={`btn-3d rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                      sortMode === tab.id ? "border-amber bg-amber-soft text-amber-bright" : "border-line text-muted"
                    }`}
                  >
                    {tab.icon} {tab.label}
                  </button>
                ))}
              </div>

              {buyError && <p className="mt-3 rounded-xl bg-rose-soft px-3 py-2 text-sm text-rose">{buyError}</p>}

              {countriesLoading ? (
                <div className="mt-4 space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="skeleton h-[68px] rounded-2xl border border-line" />
                  ))}
                </div>
              ) : filteredCountries.length === 0 ? (
                <p className="mt-6 text-sm text-muted">Belum ada stok untuk layanan ini.</p>
              ) : (
                <div className="mt-4 space-y-2.5">
                  {filteredCountries.map((c) => {
                    const list = c.pricelist || [];
                    const minPrice = list.length ? Math.min(...list.map((p) => Number(p.sell_price ?? p.price ?? 0))) : null;
                    const isOpen = expandedCountry === c.number_id;
                    const dial = pick(c, ["dial_code", "phone_code", "calling_code", "code"], null);
                    const iso = pick(c, ["iso", "iso_code", "short_code", "country_code"], null);
                    return (
                      <div key={c.number_id} className="overflow-hidden rounded-2xl border border-line bg-surface">
                        <button
                          onClick={() => setExpandedCountry(isOpen ? null : c.number_id)}
                          className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
                        >
                          {c.img ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={c.img} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" />
                          ) : (
                            <span className="h-6 w-6 shrink-0 rounded-full bg-surface2" />
                          )}
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{c.name}</span>
                          {dial && (
                            <span className="shrink-0 rounded-full bg-surface2 px-2 py-0.5 text-[11px] text-muted">+{String(dial).replace("+", "")}</span>
                          )}
                          {iso && <span className="shrink-0 rounded-full bg-surface2 px-2 py-0.5 text-[11px] text-muted">{iso}</span>}
                          {minPrice != null && (
                            <span className="shrink-0 rounded-full bg-amber-soft px-2.5 py-0.5 text-[11px] font-medium text-amber-bright">
                              Mulai Rp{minPrice.toLocaleString("id-ID")}
                            </span>
                          )}
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            className={`shrink-0 text-muted transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                          >
                            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>

                        {isOpen && (
                          <div className="expand-down divide-y divide-line border-t border-line">
                            {list.map((p) => {
                              const rate = pick(p, ["success_rate", "rate", "completion_rate", "percent"], null);
                              const providerLabel = pick(p, ["provider_name", "server_name", "name"], `Server ${p.provider_id}`);
                              const providerNum = pick(p, ["id"], p.provider_id);
                              const disabled = p.available === false || p.stock === 0;
                              return (
                                <div key={p.provider_id} className="flex items-center justify-between gap-2 px-4 py-3">
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <span className="text-xs font-medium text-ink">{providerLabel}</span>
                                      <span className="rounded-full bg-surface2 px-1.5 py-0.5 text-[10px] text-muted">ID: {providerNum}</span>
                                      {rate != null && (
                                        <span className="rounded-full bg-success-soft px-1.5 py-0.5 text-[10px] font-semibold text-success">
                                          {Number(rate).toFixed(0)}% sukses
                                        </span>
                                      )}
                                    </div>
                                    <p className="mt-0.5 text-[11px] text-muted">stok {p.stock ?? "-"}</p>
                                  </div>
                                  <div className="flex shrink-0 items-center gap-2">
                                    <span className="text-sm font-semibold text-ink">
                                      Rp{Number(p.sell_price ?? p.price ?? 0).toLocaleString("id-ID")}
                                    </span>
                                    <button
                                      onClick={() => handleOrderClick(c, p)}
                                      disabled={disabled || buyingKey === p.provider_id}
                                      className="btn-3d rounded-lg border border-amber px-3 py-1.5 text-xs font-medium text-amber-bright transition-colors hover:bg-amber-soft disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                      {buyingKey === p.provider_id ? "..." : "Order"}
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {screen === "operators" && operatorTarget && (
            <div className="fade-up">
              <button onClick={() => setScreen("countries")} className="underline-grow text-xs text-muted hover:text-ink">
                ← Kembali
              </button>
              <h4 className="mt-3 font-display text-base font-medium text-ink">Pilih operator</h4>
              <p className="mt-1 text-xs text-muted">
                {operatorTarget.country.name} · Rp{Number(operatorTarget.provider.sell_price ?? operatorTarget.provider.price).toLocaleString("id-ID")}
              </p>
              {buyError && <p className="mt-3 rounded-xl bg-rose-soft px-3 py-2 text-sm text-rose">{buyError}</p>}
              <div className="mt-4 grid grid-cols-2 gap-2">
                {operatorTarget.operators.map((op) => (
                  <button
                    key={op.id}
                    onClick={() => submitOrder(operatorTarget.country, operatorTarget.provider, op.id, op.name)}
                    disabled={buyingKey === operatorTarget.provider.provider_id}
                    className="btn-ghost"
                  >
                    {buyingKey === operatorTarget.provider.provider_id ? "Memproses..." : op.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="h-[env(safe-area-inset-bottom)] shrink-0" />
      </div>
    </div>
  );
}

function AppRow({ s, onClick }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 py-3 text-left transition-colors hover:text-amber-bright">
      {s.service_img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={s.service_img} alt="" className="h-8 w-8 rounded object-contain" />
      ) : (
        <span className="flex h-8 w-8 items-center justify-center rounded bg-surface2 text-xs text-muted">{(s.service_name || "?")[0]}</span>
      )}
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{s.service_name}</span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0 text-muted">
        <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
