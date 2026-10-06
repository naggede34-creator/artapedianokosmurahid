"use client";

import { useEffect, useMemo, useState } from "react";
import { useLembarTerbuka } from "@/lib/lembarTerbuka";
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
  // Negara favorit (disimpan di perangkat): selalu tampil paling atas di daftar negara.
  const [favNegara, setFavNegara] = useState([]);
  useEffect(() => { try { setFavNegara(JSON.parse(localStorage.getItem("artapedia_favorite_otp_countries") || "[]")); } catch {} }, []);
  function togelFavNegara(nama) {
    setFavNegara((prev) => {
      const k = String(nama || "").toLowerCase();
      const next = prev.includes(k) ? prev.filter((x) => x !== k) : [k, ...prev].slice(0, 20);
      try { localStorage.setItem("artapedia_favorite_otp_countries", JSON.stringify(next)); } catch {}
      return next;
    });
  }

  const [selectedService, setSelectedService] = useState(null);
  const [countries, setCountries] = useState([]);
  const [countriesLoading, setCountriesLoading] = useState(false);
  const [expandedCountry, setExpandedCountry] = useState(null);

  const [operatorTarget, setOperatorTarget] = useState(null); // { country, provider, operators }
  const [buyingKey, setBuyingKey] = useState(null);
  const [buyError, setBuyError] = useState("");
  // Diisi saat order ditolak karena saldo kurang: nominal top-up yang menutup selisihnya.
  const [topupNominal, setTopupNominal] = useState(0);
  // Jaminan OTP: pilihan ini diingat di browser supaya tidak perlu dicentang tiap beli.
  const [jaminanInfo, setJaminanInfo] = useState({ aktif: false, persen: 0, menit: 4 });
  const [pakaiJaminan, setPakaiJaminan] = useState(false);
  useEffect(() => {
    fetch("/api/settings/public")
      .then((r) => r.json())
      .then((d) => d?.jaminan && setJaminanInfo(d.jaminan))
      .catch(() => {});
    try { setPakaiJaminan(localStorage.getItem("ap_jaminan") === "1"); } catch {}
  }, []);
  // "Kabari saya kalau stok ada": tersimpan di server, dikabari lewat push web / bot.
  const [pantau, setPantau] = useState({ sibuk: false, ok: false, pesan: "" });
  useEffect(() => { setPantau({ sibuk: false, ok: false, pesan: "" }); }, [selectedService?.service_code, server]);
  async function pantauStok() {
    if (!selectedService || !token) return;
    setPantau({ sibuk: true, ok: false, pesan: "" });
    try {
      const res = await fetch("/api/stok/watch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, server: server || "rumahotp", serviceId: selectedService.service_code, serviceName: selectedService.service_name })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Gagal menyimpan.");
      setPantau({
        sibuk: false,
        ok: true,
        pesan: "Aktifkan notifikasi di lonceng (🔔 di atas) supaya kabarnya masuk ke perangkat ini, atau kami kabari lewat bot Telegram."
      });
    } catch (e) {
      setPantau({ sibuk: false, ok: false, pesan: e.message });
    }
  }
  function ubahJaminan(v) {
    setPakaiJaminan(v);
    try { localStorage.setItem("ap_jaminan", v ? "1" : "0"); } catch {}
  }

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
        setBuyError(""); setTopupNominal(0);
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
      Math.max(c.rate_sendiri ? c.rate_sendiri.persen : -1, ...(c.pricelist || []).map((p) => Number(pick(p, ["success_rate", "rate", "completion_rate", "percent"], -1))));
    const fav = (c) => (favNegara.includes(String(c.name || "").toLowerCase()) ? 0 : 1);
    return [...base].sort((a, b) => {
      if (fav(a) !== fav(b)) return fav(a) - fav(b);
      if (sortMode === "harga") return minPrice(a) - minPrice(b);
      const r = maxRate(b) - maxRate(a);
      return r !== 0 ? r : minPrice(a) - minPrice(b);
    });
  }, [countries, countrySearch, sortMode, favNegara]);

  function chooseServer(key) {
    setBuyError(""); setTopupNominal(0);
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
    setBuyError(""); setTopupNominal(0);
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
    setBuyError(""); setTopupNominal(0);
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
    setBuyError(""); setTopupNominal(0);
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
        server: provider.server || server || "rumahotp",
        jaminan: jaminanInfo.aktif && pakaiJaminan
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
      if (!res.ok) {
        const e = new Error(data.error || "Gagal membeli nomor.");
        e.nominalTopup = Number(data.nominalTopup) || 0;
        throw e;
      }
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
      setTopupNominal(err.nominalTopup || 0);
      setScreen("countries");
    } finally {
      setBuyingKey(null);
    }
  }

  // Dipanggil SEBELUM "if (!open) return null" — kait React harus berjalan di
  // urutan yang sama setiap render, dan menaruhnya sesudah return awal akan
  // melempar begitu lembarnya ditutup.
  useLembarTerbuka(open);

  if (!open) return null;

  // Langkah yang sedang aktif untuk penunjuk di header. Layar operator masih
  // bagian dari langkah negara.
  const langkahAktif = screen === "server" ? 0 : screen === "apps" ? 1 : 2;
  const LANGKAH = ["Server", "Aplikasi", "Negara"];
  function loncatKe(n) {
    if (n === 0) setScreen("server");
    else if (n === 1 && server) setScreen("apps");
  }

  return (
    <div className="fixed inset-0 z-[70]">
      <div
        className="animate-fade-in absolute inset-0 backdrop-blur-[3px]"
        style={{ background: "rgb(var(--c-navy-bright) / 0.55)" }}
        onClick={onClose}
      />

      <div className="animate-sheet-up absolute inset-x-0 bottom-0 mx-auto flex max-h-[90dvh] max-w-2xl flex-col overflow-hidden rounded-t-[32px] border border-line/10 bg-surface shadow-lift">
        {/* ───────── Header ───────── */}
        <div className="relative shrink-0 overflow-hidden px-5 pb-4 pt-3">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full opacity-70 blur-2xl"
            style={{ background: "radial-gradient(circle, rgb(var(--c-blue) / 0.28), transparent 65%)" }}
          />
          <div className="relative mx-auto mb-3 h-1 w-10 rounded-full bg-line/20" />

          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-xl font-extrabold tracking-tight text-ink">Beli nomor virtual</h3>
              <p className="mt-0.5 truncate text-xs text-muted">
                {screen === "server"
                  ? "Pilih server yang mau dipakai"
                  : screen === "apps"
                  ? `${serverLabel(server)} · pilih aplikasi`
                  : screen === "operators"
                  ? `${selectedService?.service_name || ""} · pilih operator`
                  : `${serverLabel(server)} · ${selectedService?.service_name || "pilih negara"}`}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-full border border-line/10 bg-surface2 py-1.5 pl-2.5 pr-3">
                <IkonDompet />
                <span className="text-xs font-bold tabular-nums text-ink">Rp{Number(balance || 0).toLocaleString("id-ID")}</span>
              </div>
              <button
                onClick={onClose}
                aria-label="Tutup"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-surface2 text-muted transition-colors hover:text-ink"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /></svg>
              </button>
            </div>
          </div>

          {/* Penunjuk langkah: urutannya memang berurutan, jadi diberi nomor. */}
          <ol className="relative mt-4 flex items-center" aria-label="Langkah pembelian">
            {LANGKAH.map((nama, n) => {
              const selesai = n < langkahAktif;
              const aktif = n === langkahAktif;
              const bisaKlik = selesai && (n === 0 || (n === 1 && server));
              return (
                <li key={nama} className="flex flex-1 items-center last:flex-none">
                  <button
                    type="button"
                    disabled={!bisaKlik}
                    onClick={() => loncatKe(n)}
                    aria-current={aktif ? "step" : undefined}
                    className="flex items-center gap-2 disabled:cursor-default"
                  >
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black transition-all ${
                        selesai
                          ? "bg-success text-white"
                          : aktif
                          ? "bg-blue text-white ring-4 ring-blue/20"
                          : "bg-surface2 text-muted"
                      }`}
                    >
                      {selesai ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" /></svg> : n + 1}
                    </span>
                    <span className={`text-xs font-bold ${aktif ? "text-ink" : selesai ? "text-ink/80" : "text-muted"}`}>{nama}</span>
                  </button>
                  {n < LANGKAH.length - 1 && (
                    <span className={`mx-2 h-0.5 min-w-[16px] flex-1 rounded-full transition-colors ${n < langkahAktif ? "bg-success" : "bg-line/10"}`} />
                  )}
                </li>
              );
            })}
          </ol>
        </div>

        {/* ───────── Isi ───────── */}
        <div className="gulir-aman min-h-0 flex-1 border-t border-line/10 px-5 pb-6 pt-4">
          {/* — Pilih server — */}
          {screen === "server" && (
            <div className="fade-up space-y-3">
              {serverDijawab && serverList.length === 0 && (
                <div className="rounded-2xl border border-line/10 bg-surface2 p-6 text-center">
                  <p className="text-sm font-bold text-ink">Semua server sedang ditutup</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted">
                    Admin sedang menonaktifkan seluruh server nokos. Coba lagi nanti, atau pantau channel untuk info pembukaannya.
                  </p>
                </div>
              )}
              {serverList.map((sv) => {
                const on = available[sv.key] !== false;
                const look =
                  sv.key === "rumahotp"
                    ? { warna: "--c-success", ikon: <IkonDaun /> }
                    : sv.key === "dibanana"
                    ? { warna: "--c-orange", ikon: <IkonPetir /> }
                    : { warna: "--c-blue", ikon: <IkonRoket /> };
                return (
                  <button
                    key={sv.key}
                    onClick={() => on && chooseServer(sv.key)}
                    disabled={!on}
                    className={`group relative flex w-full items-center gap-4 overflow-hidden rounded-2xl border bg-surface p-4 text-left transition-all duration-200 ${
                      on
                        ? "border-line/10 hover:-translate-y-0.5 hover:border-line/25 hover:shadow-lift active:scale-[0.99]"
                        : "cursor-not-allowed border-line/10 opacity-50"
                    }`}
                  >
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                      style={{ background: `linear-gradient(110deg, rgb(var(${look.warna}) / 0.09), transparent 55%)` }}
                    />
                    <span
                      className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
                      style={{
                        background: `linear-gradient(145deg, rgb(var(${look.warna}) / 0.22), rgb(var(${look.warna}) / 0.08))`,
                        color: `rgb(var(${look.warna}))`
                      }}
                    >
                      {look.ikon}
                    </span>

                    <span className="relative min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="min-w-0 break-words text-base font-extrabold tracking-tight text-ink">{sv.name}</span>
                        {sv.badge ? (
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                            style={{ background: `rgb(var(${look.warna}) / 0.14)`, color: `rgb(var(${look.warna}))` }}
                          >
                            {sv.badge}
                          </span>
                        ) : null}
                        {!on && <span className="rounded-full bg-rose-soft px-2 py-0.5 text-[10px] font-bold text-rose">Nonaktif</span>}
                      </span>
                      <span className="mt-1 block text-xs leading-relaxed text-muted">{!on && sv.offlineMsg ? sv.offlineMsg : sv.desc}</span>
                    </span>

                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="relative shrink-0 text-muted transition-transform group-hover:translate-x-0.5">
                      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                );
              })}
            </div>
          )}

          {/* — Pilih aplikasi — */}
          {screen === "apps" && (
            <div className="fade-up">
              <KolomCari value={appSearch} onChange={setAppSearch} placeholder="Cari aplikasi, misalnya WhatsApp" />

              {activeLoading ? (
                <div className="mt-5 grid grid-cols-3 gap-3">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <div key={i} className="skeleton h-[92px] rounded-2xl" />
                  ))}
                </div>
              ) : remoteError ? (
                <div className="mt-6 rounded-2xl bg-rose-soft p-5 text-center">
                  <p className="text-sm font-semibold text-rose">{remoteError}</p>
                  <button onClick={() => loadRemoteServices(server)} className="btn-ghost mt-3">Coba lagi</button>
                </div>
              ) : activeServices.length === 0 ? (
                <p className="mt-6 text-center text-sm text-muted">Belum ada layanan di server ini.</p>
              ) : appSearch.trim() ? (
                <div className="mt-4">
                  {filteredApps.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted">Tidak ada aplikasi bernama “{appSearch.trim()}”.</p>
                  ) : (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {filteredApps.map((sv) => (
                        <AppRow key={sv.service_code} s={sv} onClick={() => chooseService(sv)} />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <p className="mb-3 mt-5 text-sm font-bold text-ink">Paling sering dibeli</p>
                  <div className="grid grid-cols-3 gap-3">
                    {popular.map((sv) => (
                      <button
                        key={sv.service_code}
                        onClick={() => chooseService(sv)}
                        className="group flex flex-col items-center gap-2.5 rounded-2xl border border-line/10 bg-surface px-2 py-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-blue/40 hover:shadow-lift active:scale-[0.97]"
                      >
                        <LogoApp s={sv} ukuran={44} />
                        <span className="line-clamp-1 w-full text-center text-xs font-semibold text-ink">{sv.service_name}</span>
                      </button>
                    ))}
                  </div>

                  {activeServices.length > 6 && (
                    <>
                      <p className="mb-3 mt-7 text-sm font-bold text-ink">
                        Semua aplikasi <span className="font-medium text-muted">({activeServices.length})</span>
                      </p>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {activeServices.slice(6).map((sv) => (
                          <AppRow key={sv.service_code} s={sv} onClick={() => chooseService(sv)} />
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {/* — Pilih negara & paket — */}
          {screen === "countries" && selectedService && (
            <div className="fade-up">
              <button
                onClick={() => setScreen("apps")}
                className="flex w-full items-center gap-3 rounded-2xl border border-line/10 bg-surface2 px-3.5 py-2.5 text-left transition-colors hover:border-line/25"
              >
                <LogoApp s={selectedService} ukuran={36} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-ink">{selectedService.service_name}</span>
                  <span className="block text-[11px] text-muted">Ketuk untuk ganti aplikasi</span>
                </span>
                <span className="rounded-full bg-surface px-2.5 py-1 text-[11px] font-bold text-muted">Ganti</span>
              </button>

              <KolomCari value={countrySearch} onChange={setCountrySearch} placeholder="Cari negara" className="mt-3" />

              {/* Pengurutan sebagai kontrol segmen */}
              <div className="mt-3 flex rounded-xl bg-surface2 p-1" role="tablist" aria-label="Urutkan negara">
                {[
                  { id: "rate", label: "Paling sukses" },
                  { id: "harga", label: "Termurah" }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    role="tab"
                    aria-selected={sortMode === tab.id}
                    onClick={() => setSortMode(tab.id)}
                    className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${
                      sortMode === tab.id ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {jaminanInfo.aktif && (
                <label
                  className={`mt-3 flex cursor-pointer items-start gap-3 rounded-2xl border px-3.5 py-3 transition-colors ${
                    pakaiJaminan ? "border-success/40 bg-success-soft" : "border-line/10 bg-surface2"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={pakaiJaminan}
                    onChange={(e) => ubahJaminan(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-[rgb(var(--c-success))]"
                  />
                  <span className="text-xs leading-relaxed text-muted">
                    <b className="text-ink">Jaminan OTP · +{jaminanInfo.persen}% dari harga</b>
                    <br />
                    Kode belum masuk dalam {jaminanInfo.menit} menit? Nomor diganti otomatis. Kalau tetap gagal, semuanya
                    dikembalikan — biaya jaminan hanya terpakai kalau kodenya masuk.
                  </span>
                </label>
              )}

              {buyError && <GalatBeli pesan={buyError} topup={topupNominal} />}

              {countriesLoading ? (
                <div className="mt-4 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="skeleton h-[72px] rounded-2xl" />
                  ))}
                </div>
              ) : filteredCountries.length === 0 ? (
                <div className="mt-6 rounded-2xl border border-dashed border-line/20 p-6 text-center">
                  <p className="text-sm font-bold text-ink">
                    {countries.length === 0 ? "Stok sedang kosong" : "Negara tidak ditemukan"}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {countries.length === 0
                      ? "Belum ada nomor untuk aplikasi ini di server ini. Coba server lain, atau minta kabar saat stok kembali."
                      : "Coba ketik nama negara dengan ejaan lain."}
                  </p>
                  {countries.length === 0 && (
                    <div className="mt-4">
                      <button
                        type="button"
                        disabled={pantau.sibuk || pantau.ok}
                        onClick={pantauStok}
                        className="rounded-xl bg-blue px-4 py-2.5 text-sm font-bold text-white transition-opacity disabled:opacity-70"
                      >
                        {pantau.ok ? "Oke, kami kabari saat stok ada" : pantau.sibuk ? "Menyimpan…" : "Kabari saya saat stok ada"}
                      </button>
                      {pantau.pesan && <p className="mt-2 text-xs text-muted">{pantau.pesan}</p>}
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-4 space-y-2.5">
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
                        className={`relative overflow-hidden rounded-2xl border bg-surface transition-all duration-200 ${
                          isOpen ? "border-blue/50 shadow-lift" : "border-line/10 hover:border-line/25"
                        }`}
                        data-testid="negara-kartu"
                      >
                        <button
                          type="button"
                          onClick={() => togelFavNegara(c.name)}
                          aria-label={favNegara.includes(String(c.name || "").toLowerCase()) ? "Hapus dari favorit" : "Jadikan favorit"}
                          aria-pressed={favNegara.includes(String(c.name || "").toLowerCase())}
                          data-testid="negara-fav"
                          className="absolute left-1 top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full text-[13px] leading-none"
                        >
                          {favNegara.includes(String(c.name || "").toLowerCase()) ? "⭐" : "☆"}
                        </button>
                        <button
                          onClick={() => setExpandedCountry(isOpen ? null : c.number_id)}
                          aria-expanded={isOpen}
                          className="flex w-full items-center gap-3 px-3.5 py-3 text-left active:bg-surface2/60"
                        >
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface2 text-2xl">
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
                                <span className="shrink-0 rounded-md bg-surface2 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted">
                                  +{String(dial).replace("+", "")}
                                </span>
                              )}
                            </span>
                            <span className="mt-1 flex items-center gap-2 text-[11px] text-muted">
                              <span>{list.length} paket</span>
                              {c.rate_sendiri && (
                                <span
                                  data-testid="negara-rate"
                                  title={`Dari ${c.rate_sendiri.n} pesanan di toko ini (14 hari)`}
                                  className={`font-bold ${c.rate_sendiri.persen >= 80 ? "text-success" : c.rate_sendiri.persen >= 50 ? "text-amber-bright" : "text-rose"}`}
                                >
                                  📊 {c.rate_sendiri.persen}% OTP masuk
                                </span>
                              )}
                              {totalStock != null && (
                                <span className="inline-flex items-center gap-1">
                                  <span className="h-1.5 w-1.5 rounded-full bg-success" />
                                  {totalStock.toLocaleString("id-ID")} nomor
                                </span>
                              )}
                            </span>
                          </span>

                          {minPrice != null && (
                            <span className="shrink-0 text-right">
                              <span className="block text-[10px] font-medium text-muted">Mulai dari</span>
                              <span className="block text-[15px] font-black tabular-nums text-amber-bright">Rp{minPrice.toLocaleString("id-ID")}</span>
                            </span>
                          )}

                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className={`shrink-0 text-muted transition-transform duration-200 ${isOpen ? "rotate-180 text-blue" : ""}`}>
                            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>

                        {isOpen && (
                          <div className="expand-down border-t border-line/10 bg-surface2/40 p-2">
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
                                  className={`flex items-center gap-3 rounded-xl bg-surface px-3 py-2.5 ${i > 0 ? "mt-2" : ""} ${cheapest ? "ring-1 ring-amber/40" : ""}`}
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <span className="text-[13px] font-bold text-ink">{providerLabel}</span>
                                      {cheapest && <span className="rounded-full bg-amber-soft px-2 py-0.5 text-[10px] font-bold text-amber-bright">Termurah</span>}
                                      {rate != null && (
                                        <span className="rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-bold text-success">
                                          {Number(rate).toFixed(0)}% sukses
                                        </span>
                                      )}
                                    </div>
                                    <div className="mt-1.5 flex items-center gap-2">
                                      {ratio != null && (
                                        <span className="h-1.5 w-16 overflow-hidden rounded-full bg-surface3">
                                          <span
                                            className="block h-full rounded-full"
                                            style={{
                                              width: `${Math.max(8, Math.round(Math.min(1, ratio) * 100))}%`,
                                              background: ratio > 0.5 ? "rgb(var(--c-success))" : "rgb(var(--c-warn))"
                                            }}
                                          />
                                        </span>
                                      )}
                                      <span className="text-[11px] text-muted">
                                        {p.stock != null ? `${Number(p.stock).toLocaleString("id-ID")} nomor` : "Tersedia"}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex shrink-0 items-center gap-3">
                                    <span className="text-[15px] font-black tabular-nums text-ink">
                                      Rp{Number(p.sell_price ?? p.price ?? 0).toLocaleString("id-ID")}
                                    </span>
                                    <button
                                      onClick={() => handleOrderClick(c, p)}
                                      disabled={disabled || busy}
                                      className="min-w-[68px] rounded-xl bg-amber px-4 py-2 text-xs font-extrabold text-white shadow-sm transition-all hover:bg-amber-bright active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                      {busy ? "Memproses" : disabled ? "Habis" : "Beli"}
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

          {/* — Pilih operator — */}
          {screen === "operators" && operatorTarget && (
            <div className="fade-up">
              <button onClick={() => setScreen("countries")} className="flex items-center gap-1 text-xs font-semibold text-muted hover:text-ink">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                Kembali ke negara
              </button>
              <div className="mt-3 rounded-2xl border border-line/10 bg-surface2 px-4 py-3">
                <p className="text-sm font-bold text-ink">{operatorTarget.country.name}</p>
                <p className="mt-0.5 text-xs text-muted">
                  Harga Rp{Number(operatorTarget.provider.sell_price ?? operatorTarget.provider.price).toLocaleString("id-ID")}
                </p>
              </div>
              <p className="mb-2 mt-5 text-sm font-bold text-ink">Pilih operator nomor</p>
              {buyError && <GalatBeli pesan={buyError} topup={topupNominal} />}
              <div className="grid grid-cols-2 gap-2.5">
                {operatorTarget.operators.map((op) => {
                  const sibuk = buyingKey === operatorTarget.provider.provider_id;
                  return (
                    <button
                      key={op.id}
                      onClick={() => submitOrder(operatorTarget.country, operatorTarget.provider, op.id, op.name)}
                      disabled={sibuk}
                      className="rounded-2xl border border-line/10 bg-surface px-4 py-3.5 text-sm font-bold capitalize text-ink transition-all hover:-translate-y-0.5 hover:border-blue/40 hover:shadow-lift active:scale-[0.97] disabled:opacity-50"
                    >
                      {sibuk ? "Memproses…" : op.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="h-[env(safe-area-inset-bottom)] shrink-0" />
      </div>
    </div>
  );
}

// ───────────────────────── Komponen kecil ─────────────────────────

function LogoApp({ s, ukuran = 40 }) {
  const gaya = { width: ukuran, height: ukuran };
  return s.service_img ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={s.service_img} alt="" style={gaya} className="shrink-0 rounded-xl object-contain" />
  ) : (
    <span
      style={{ ...gaya, fontSize: Math.round(ukuran * 0.4) }}
      className="flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue/25 to-blue/10 font-extrabold text-blue-bright"
    >
      {(s.service_name || "?")[0].toUpperCase()}
    </span>
  );
}

function KolomCari({ value, onChange, placeholder, className = "" }) {
  return (
    <div className={`relative ${className}`}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">
        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2.2" />
        <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full rounded-xl border border-line/10 bg-surface2 py-3 pl-10 pr-4 text-sm text-ink outline-none transition-colors placeholder:text-muted focus:border-blue/60 focus:bg-surface"
      />
    </div>
  );
}

function GalatBeli({ pesan, topup }) {
  return (
    <div className="mt-3 rounded-2xl bg-rose-soft px-4 py-3 text-sm text-rose" role="alert">
      <p className="font-medium">{pesan}</p>
      {topup > 0 && (
        <a href={`/deposit?nominal=${topup}`} className="mt-2 inline-flex items-center rounded-lg bg-rose px-3 py-1.5 text-xs font-bold text-white">
          Isi saldo Rp{topup.toLocaleString("id-ID")}
        </a>
      )}
    </div>
  );
}

function AppRow({ s, onClick }) {
  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-xl border border-line/10 bg-surface px-3 py-2.5 text-left transition-all hover:border-blue/40 hover:bg-surface2/50 active:scale-[0.98]"
    >
      <LogoApp s={s} ukuran={34} />
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{s.service_name}</span>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5">
        <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

function IkonDompet() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-muted">
      <path d="M4 7.5A2.5 2.5 0 016.5 5H18a1 1 0 011 1v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <rect x="3.5" y="7.5" width="17" height="12" rx="2.5" stroke="currentColor" strokeWidth="2" />
      <circle cx="16.5" cy="13.5" r="1.2" fill="currentColor" />
    </svg>
  );
}
function IkonDaun() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
      <path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M5 19c3-4 6-6 9-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function IkonPetir() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
      <path d="M13 3L5 13.5h6L10 21l8-10.5h-6L13 3z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}
function IkonRoket() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
      <path d="M14 4c3.5-.5 5.5 1.5 6 6-1.5 3.5-4 6-7.5 7.5L8 13c1.5-3.500 3-6.500 6-9z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="14.500" cy="9.500" r="1.500" fill="currentColor" />
      <path d="M8 13l-3 1 2 3m3.500 .5l-1 3-3-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
