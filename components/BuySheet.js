"use client";

import { useEffect, useMemo, useState } from "react";
import { OTP_SERVERS, serverLabel } from "@/lib/otpServers";
import { onoOrderSukses } from "@/lib/ono";

// Ambil field yang mungkin berbeda nama antar respons API, tanpa merusak tampilan kalau tidak ada.
function pick(obj, keys, fallback) {
  for (const k of keys) {
    if (obj?.[k] !== undefined && obj?.[k] !== null && obj?.[k] !== "") return obj[k];
  }
  return fallback;
}

export default function BuySheet({ open, onClose, services, servicesLoading, token, balance, onOrderCreated, initialQuery = "" }) {
  // Kedua server memakai alur yang sama: pilih server -> aplikasi -> negara -> order.
  const [screen, setScreen] = useState("server"); // server | apps | countries | operators
  const [server, setServer] = useState(null); // rumahotp | warungnokos_s1 | warungnokos_s2 | dibanana
  const [available, setAvailable] = useState({ rumahotp: true });
  // Nama, label, dan keterangan server datang dari pengaturan admin. OTP_SERVERS
  // hanya dipakai sebagai cadangan kalau API-nya belum sempat menjawab.
  const [serverList, setServerList] = useState(() =>
    OTP_SERVERS.map((s) => ({ key: s.key, name: s.name, badge: s.badge, desc: s.desc, provider: s.provider, offlineMsg: "" }))
  );
  // Sudah dijawab API atau belum. Tanpa ini, daftar cadangan di atas tidak bisa
  // dibedakan dari daftar sungguhan — dan saat admin mematikan SEMUA server,
  // yang tampil justru daftar cadangan berisi server yang sudah dimatikan.
  const [serverDijawab, setServerDijawab] = useState(false);
  // Daftar aplikasi tiap server WarungNokos diambil saat server itu dipilih; daftar
  // Server Murah sudah dikirim halaman induk lewat prop `services`.
  const [remoteServices, setRemoteServices] = useState({});
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [remoteError, setRemoteError] = useState("");
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

  // Daftar aplikasi & status loading milik server yang sedang dipilih.
  const isRemote = server !== null && server !== "rumahotp";
  const activeServices = isRemote ? remoteServices[server] || [] : services;
  const activeLoading = isRemote ? remoteLoading : servicesLoading;

  useEffect(() => {
    if (!open) return;
    fetch("/api/otp/servers")
      .then((r) => r.json())
      .then((d) => {
        if (d?.available) setAvailable(d.available);
        // Daftar kosong tetap dipakai: itu jawaban yang sah, artinya admin
        // mematikan semua server. Memakai daftar cadangan di sini akan
        // menampilkan server yang justru baru saja dimatikan.
        if (Array.isArray(d?.items)) {
          setServerList(d.items);
          setServerDijawab(true);
        }
      })
      .catch(() => {});
  }, [open]);

  // Datang dari ?q= (cari layanan tertentu) -> langsung ke daftar aplikasi Server Murah.
  useEffect(() => {
    if (open && initialQuery) {
      setAppSearch(initialQuery);
      setServer("rumahotp");
      setScreen("apps");
    }
  }, [open, initialQuery]);

  // Reset total tiap kali sheet ditutup, biar buka lagi selalu mulai dari awal.
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setScreen("server");
        setServer(null);
        setRemoteError("");
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

  const popular = useMemo(() => activeServices.slice(0, 6), [activeServices]);
  const filteredApps = useMemo(() => {
    const q = appSearch.trim().toLowerCase();
    if (!q) return activeServices;
    return activeServices.filter((s) => (s.service_name || "").toLowerCase().includes(q));
  }, [activeServices, appSearch]);

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

  function chooseServer(key) {
    setBuyError("");
    setRemoteError("");
    setAppSearch("");
    setServer(key);
    setScreen("apps");
    if (key !== "rumahotp" && !remoteServices[key]) loadRemoteServices(key);
  }

  async function loadRemoteServices(key) {
    setRemoteLoading(true);
    setRemoteError("");
    try {
      const res = await fetch(`/api/otp/services?server=${encodeURIComponent(key)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memuat layanan.");
      setRemoteServices((prev) => ({ ...prev, [key]: Array.isArray(data.items) ? data.items : [] }));
    } catch (err) {
      setRemoteError(err.message || "Gagal memuat layanan.");
    } finally {
      setRemoteLoading(false);
    }
  }

  async function chooseService(svc) {
    setSelectedService(svc);
    setScreen("countries");
    setCountries([]);
    setExpandedCountry(null);
    setCountriesLoading(true);
    setBuyError("");
    try {
      const params = new URLSearchParams({ service_id: svc.service_code, server: server || "rumahotp" });
      const res = await fetch(`/api/otp/countries?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memuat negara.");
      setCountries(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      setCountries([]);
      setBuyError(e.message || "Gagal memuat negara.");
    } finally {
      setCountriesLoading(false);
    }
  }

  async function handleOrderClick(country, provider) {
    setBuyError("");
    setBuyingKey(provider.provider_id);
    try {
      const params =
        provider.server && provider.server !== "rumahotp"
          ? new URLSearchParams({ server: provider.server })
          : new URLSearchParams({ country: country.name, provider_id: provider.provider_id });
      const res = await fetch(`/api/otp/operators?${params}`);
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
        server: provider.server || server || "rumahotp"
      };
      // Server non-RumahOTP memakai kunci service + country_id (+ index tier harga
      // untuk dibanana, karena id produknya diambil ulang di server).
      if (body.server !== "rumahotp") {
        body.countryId = provider.country_id;
        if (provider.providerIndex !== undefined) body.providerIndex = provider.providerIndex;
      }
      const res = await fetch("/api/otp/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal membeli nomor.");
      onoOrderSukses();
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
        expiredAt: data.expiredAt || null,
        server: body.server
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
                {screen === "server"
                  ? "Langkah 1 · pilih server"
                  : `${serverLabel(server)} · ${screen === "apps" ? "pilih aplikasi" : "pilih negara"}`}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-muted">Saldo</p>
              <p className="text-sm font-bold tabular-nums text-ink">Rp{Number(balance || 0).toLocaleString("id-ID")}</p>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
          {screen === "server" && (
            <div className="fade-up anim-stagger space-y-3">
              {serverDijawab && serverList.length === 0 ? (
                <div className="card-flat p-6 text-center">
                  <p className="text-3xl">🛠️</p>
                  <p className="mt-2 text-sm font-bold text-ink">Semua server sedang ditutup</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted">
                    Admin sedang menonaktifkan seluruh server nokos. Coba lagi nanti, atau pantau channel
                    untuk info pembukaannya.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted">Mau pakai server yang mana?</p>
              )}
              {serverList.map((sv, i) => {
                const on = available[sv.key] !== false;
                // Tiap provider punya warna & ikonnya sendiri supaya mudah dibedakan sekilas.
                const look =
                  sv.key === "rumahotp"
                    ? { icon: "💸", ring: "rgb(var(--c-success))", soft: "bg-success-soft", text: "text-success" }
                    : sv.key === "dibanana"
                    ? { icon: "🍌", ring: "rgb(var(--c-amber))", soft: "bg-amber-soft", text: "text-amber-bright" }
                    : { icon: "⚡", ring: "rgb(var(--c-blue))", soft: "bg-blue-soft", text: "text-blue-bright" };
                return (
                  <button
                    key={sv.key}
                    onClick={() => on && chooseServer(sv.key)}
                    disabled={!on}
                    className={`press relative flex w-full items-start gap-3 overflow-hidden rounded-2xl border-2 px-4 py-4 text-left transition-all duration-200 ${
                      on ? `stagger-${(i % 5) + 1} fade-up border-ink/15 bg-surface hover:-translate-y-0.5` : "cursor-not-allowed border-line opacity-45"
                    }`}
                    style={on ? { boxShadow: `4px 4px 0 ${look.ring}33` } : undefined}
                  >
                    {/* Pita warna tipis sebagai penanda provider */}
                    <span className="absolute inset-y-0 left-0 w-1" style={{ background: look.ring }} />

                    <span
                      className={`float-slow flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-ink/10 text-2xl ${look.soft}`}
                      style={{ boxShadow: `2px 2px 0 ${look.ring}44` }}
                    >
                      {look.icon}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-[15px] font-extrabold tracking-tight text-ink">{sv.name}</span>
                        {sv.badge ? (
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${look.soft} ${look.text}`}>
                            {sv.badge}
                          </span>
                        ) : null}
                        {!on && (
                          <span className="rounded-full bg-rose-soft px-2 py-0.5 text-[10px] font-bold text-rose">nonaktif</span>
                        )}
                      </span>
                      <span className="mt-1 block text-xs leading-relaxed text-muted">
                        {!on && sv.offlineMsg ? sv.offlineMsg : sv.desc}
                      </span>
                      {sv.provider ? (
                        <span className="mt-1.5 block font-mono text-[10px] uppercase tracking-wider text-muted opacity-60">
                          via {sv.provider}
                        </span>
                      ) : null}
                    </span>

                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="mt-1 shrink-0 text-muted">
                      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                );
              })}
            </div>
          )}

          {screen === "apps" && (
            <div className="fade-up">
              <button onClick={() => setScreen("server")} className="underline-grow mb-3 text-xs text-muted hover:text-ink">
                ← Ganti server
              </button>
              <input
                value={appSearch}
                onChange={(e) => setAppSearch(e.target.value)}
                placeholder="Cari nama aplikasi..."
                className="field"
              />

              {activeLoading ? (
                <div className="mt-5 grid grid-cols-2 gap-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="skeleton h-[84px] rounded-2xl border border-line" />
                  ))}
                </div>
              ) : remoteError ? (
                <div className="mt-6 text-center">
                  <p className="text-sm text-rose">{remoteError}</p>
                  <button onClick={() => loadRemoteServices(server)} className="btn-ghost mt-3">Coba lagi</button>
                </div>
              ) : activeServices.length === 0 ? (
                <p className="mt-6 text-sm text-muted">Belum ada layanan di server ini.</p>
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
                  <div className="anim-stagger mt-3 grid grid-cols-2 gap-3">
                    {popular.map((s) => (
                      <button
                        key={s.service_code}
                        onClick={() => chooseService(s)}
                        className="pick-3d depth-pop flex flex-col items-center gap-2 px-3 py-4"
                      >
                        {s.service_img ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={s.service_img} alt="" className="h-10 w-10 rounded-xl object-contain shadow-[0_3px_0_rgb(var(--c-line))]" />
                        ) : (
                          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-soft text-base font-extrabold text-amber-bright shadow-[0_3px_0_rgb(var(--c-orange)/0.3)]">
                            {(s.service_name || "?")[0]}
                          </span>
                        )}
                        <span className="line-clamp-1 text-xs font-medium text-ink">{s.service_name}</span>
                      </button>
                    ))}
                  </div>

                  <p className="mt-6 text-sm font-semibold text-ink">Semua Aplikasi</p>
                  <div className="mt-3 divide-y divide-line">
                    {activeServices.slice(6).map((s) => (
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
                className="panel-3d flex w-full items-center gap-3 px-4 py-3 text-left"
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
                    data-on={sortMode === tab.id}
                    className={`chip-3d px-3 py-2.5 text-sm font-bold ${
                      sortMode === tab.id ? "text-amber-bright" : "text-muted"
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
                <div className="mt-4 space-y-3">
                  {filteredCountries.map((c) => {
                    const list = c.pricelist || [];
                    const minPrice = list.length ? Math.min(...list.map((p) => Number(p.sell_price ?? p.price ?? 0))) : null;
                    const isOpen = expandedCountry === c.number_id;
                    const dial = pick(c, ["dial_code", "phone_code", "calling_code", "code"], null);
                    const iso = pick(c, ["iso", "iso_code", "short_code", "country_code"], null);
                    const stocks = list.map((p) => Number(p.stock)).filter((n) => Number.isFinite(n));
                    const totalStock = stocks.length ? stocks.reduce((a, b) => a + b, 0) : null;
                    const maxStock = stocks.length ? Math.max(1, ...stocks) : 1;
                    return (
                      <div
                        key={c.number_id}
                        className={`overflow-hidden rounded-2xl border-2 transition-all duration-200 ${
                          isOpen ? "border-amber bg-surface" : "border-ink/15 bg-surface hover:border-amber/50"
                        }`}
                        style={{ boxShadow: isOpen ? "5px 5px 0 rgb(var(--c-amber) / 0.35)" : "3px 3px 0 rgb(var(--c-ink) / 0.12)" }}
                      >
                        <button
                          onClick={() => setExpandedCountry(isOpen ? null : c.number_id)}
                          className="press flex w-full items-center gap-3 px-3.5 py-3 text-left"
                        >
                          <span
                            className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-ink/20 bg-surface2 text-xl"
                            style={{ boxShadow: "2px 2px 0 rgb(var(--c-ink) / 0.15)" }}
                          >
                            {c.flag ? (
                              c.flag
                            ) : c.img ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={c.img} alt="" className="h-6 w-6 rounded-full object-cover" />
                            ) : (
                              <span className="text-xs font-bold text-muted">{iso || (c.name || "?")[0]}</span>
                            )}
                          </span>

                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-1.5">
                              <span className="truncate text-sm font-extrabold tracking-tight text-ink">{c.name}</span>
                              {dial && (
                                <span className="shrink-0 rounded-md bg-surface2 px-1.5 py-0.5 font-mono text-[10px] text-muted">
                                  +{String(dial).replace("+", "")}
                                </span>
                              )}
                            </span>
                            <span className="mt-1 flex items-center gap-1.5 text-[11px] text-muted">
                              <span className="font-semibold">{list.length} paket</span>
                              {totalStock != null && (
                                <>
                                  <span className="opacity-40">•</span>
                                  <span className="inline-flex items-center gap-1">
                                    <span className="h-1.5 w-1.5 rounded-full bg-success" />
                                    {totalStock.toLocaleString("id-ID")} stok
                                  </span>
                                </>
                              )}
                            </span>
                          </span>

                          {minPrice != null && (
                            <span className="shrink-0 text-right">
                              <span className="block text-[9px] font-bold uppercase tracking-wider text-muted">mulai</span>
                              <span className="block text-sm font-black tabular-nums text-amber-bright">
                                Rp{minPrice.toLocaleString("id-ID")}
                              </span>
                            </span>
                          )}

                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            className={`shrink-0 text-muted transition-transform duration-200 ${isOpen ? "rotate-180 text-amber-bright" : ""}`}
                          >
                            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>

                        {isOpen && (
                          <div className="expand-down border-t-2 border-dashed border-line bg-surface2/30">
                            {list.map((p, i) => {
                              const rate = pick(p, ["success_rate", "rate", "completion_rate", "percent"], null);
                              const providerLabel = pick(p, ["provider_name", "server_name", "name"], `Server ${p.provider_id}`);
                              const disabled = p.available === false || p.stock === 0;
                              const busy = buyingKey === p.provider_id;
                              const ratio = p.stockRatio ?? (Number.isFinite(Number(p.stock)) ? Number(p.stock) / maxStock : null);
                              const cheapest = p.cheapest === true || (list.length > 1 && i === 0 && p.cheapest === undefined && minPrice === Number(p.sell_price ?? p.price));
                              return (
                                <div
                                  key={p.provider_id}
                                  className="flex items-center gap-3 border-b border-line/60 px-3.5 py-3 last:border-0"
                                >
                                  <span
                                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-black ${
                                      cheapest ? "bg-amber text-white" : "bg-surface2 text-muted"
                                    }`}
                                    style={cheapest ? { boxShadow: "2px 2px 0 rgb(var(--c-ink) / 0.2)" } : undefined}
                                  >
                                    {i + 1}
                                  </span>

                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <span className="text-xs font-bold text-ink">{providerLabel}</span>
                                      {cheapest && (
                                        <span className="rounded-full bg-amber-soft px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-amber-bright">
                                          Termurah
                                        </span>
                                      )}
                                      {rate != null && (
                                        <span className="rounded-full bg-success-soft px-1.5 py-0.5 text-[9px] font-bold text-success">
                                          {Number(rate).toFixed(0)}% sukses
                                        </span>
                                      )}
                                    </div>

                                    {ratio != null && (
                                      <div className="mt-1.5 flex items-center gap-2">
                                        <span className="h-1.5 w-20 overflow-hidden rounded-full bg-surface3">
                                          <span
                                            className="block h-full rounded-full transition-all"
                                            style={{
                                              width: `${Math.max(6, Math.round(ratio * 100))}%`,
                                              background:
                                                ratio > 0.5
                                                  ? "linear-gradient(90deg, rgb(var(--c-success)), rgb(var(--c-success)))"
                                                  : "linear-gradient(90deg, rgb(var(--c-warn)), rgb(var(--c-amber-bright)))"
                                            }}
                                          />
                                        </span>
                                        <span className="text-[10px] font-medium text-muted">
                                          {p.stock != null ? `${Number(p.stock).toLocaleString("id-ID")} nomor` : "tersedia"}
                                        </span>
                                      </div>
                                    )}
                                  </div>

                                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                                    <span className="text-sm font-black tabular-nums text-ink">
                                      Rp{Number(p.sell_price ?? p.price ?? 0).toLocaleString("id-ID")}
                                    </span>
                                    <button
                                      onClick={() => handleOrderClick(c, p)}
                                      disabled={disabled || busy}
                                      className="shine press rounded-lg border-2 border-ink/15 bg-amber px-3.5 py-1.5 text-[11px] font-black uppercase tracking-wide text-white transition-colors hover:bg-amber-bright disabled:cursor-not-allowed disabled:opacity-40"
                                      style={{ boxShadow: "2px 2px 0 rgb(var(--c-ink) / 0.18)" }}
                                    >
                                      {busy ? "..." : "Order"}
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
