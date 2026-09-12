"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useUser } from "@/app/providers";
import OtpOrderPanel from "@/components/OtpOrderPanel";

const STEP_LABELS = ["Layanan", "Negara", "Operator", "Konfirmasi", "Nomor aktif"];

// WhatsApp selalu tampil paling atas, sisanya tetap mengikuti urutan asli dari RumahOTP.
function sortWithWaFirst(items) {
  const rank = (name = "") => {
    const n = name.toLowerCase();
    if (n === "whatsapp" || n.startsWith("whatsapp")) return 0;
    if (n.includes("whatsapp")) return 1;
    return 2;
  };
  return [...items]
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const ra = rank(a.item.service_name);
      const rb = rank(b.item.service_name);
      if (ra !== rb) return ra - rb;
      return a.index - b.index; // stabil, sisanya tidak diacak
    })
    .map((x) => x.item);
}

export default function OtpPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-content px-5 py-14 text-sm text-muted">Memuat...</div>}>
      <OtpPageInner />
    </Suspense>
  );
}

function OtpPageInner() {
  const { token, balance, refreshBalance } = useUser();
  const searchParams = useSearchParams();

  const [step, setStep] = useState(0);
  const [services, setServices] = useState([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get("q") || "");

  const [selectedService, setSelectedService] = useState(null);
  const [countries, setCountries] = useState([]);
  const [countriesLoading, setCountriesLoading] = useState(false);

  const [selectedCountry, setSelectedCountry] = useState(null);
  const [selectedProvider, setSelectedProvider] = useState(null);

  const [operators, setOperators] = useState([]);
  const [operatorsLoading, setOperatorsLoading] = useState(false);
  const [selectedOperator, setSelectedOperator] = useState(null);

  const [buying, setBuying] = useState(false);
  const [buyError, setBuyError] = useState("");
  const [order, setOrder] = useState(null);

  const ACTIVE_ORDER_KEY = "artapedia_active_otp_order";

  useEffect(() => {
    fetch("/api/otp/services")
      .then((r) => r.json())
      .then((d) => setServices(sortWithWaFirst(Array.isArray(d.items) ? d.items : [])))
      .catch(() => setServices([]))
      .finally(() => setServicesLoading(false));
  }, []);

  // Pulihkan order aktif kalau halaman ini di-refresh, biar OTP-nya nggak "hilang".
  useEffect(() => {
    if (!token) return;
    try {
      const raw = localStorage.getItem(ACTIVE_ORDER_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved?.token === token && saved?.order?.orderId) {
        setOrder(saved.order);
        setStep(4);
      }
    } catch (e) {
      /* abaikan data tersimpan yang korup */
    }
  }, [token]);

  const filteredServices = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return services;
    return services.filter((s) => (s.service_name || "").toLowerCase().includes(q));
  }, [services, search]);

  async function chooseService(svc) {
    setSelectedService(svc);
    setSelectedCountry(null);
    setSelectedProvider(null);
    setSelectedOperator(null);
    setCountries([]);
    setStep(1);
    setCountriesLoading(true);
    try {
      const res = await fetch(`/api/otp/countries?service_id=${encodeURIComponent(svc.service_code)}`);
      const data = await res.json();
      setCountries(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      setCountries([]);
    } finally {
      setCountriesLoading(false);
    }
  }

  async function chooseProvider(country, provider) {
    setSelectedCountry(country);
    setSelectedProvider(provider);
    setSelectedOperator(null);
    setOperators([]);
    setStep(2);
    setOperatorsLoading(true);
    try {
      const res = await fetch(
        `/api/otp/operators?country=${encodeURIComponent(country.name)}&provider_id=${encodeURIComponent(provider.provider_id)}`
      );
      const data = await res.json();
      const items = Array.isArray(data.items) ? data.items : [];
      setOperators(items);
      if (items.length <= 1) {
        setSelectedOperator(items[0] || null);
        setStep(3);
      }
    } catch (e) {
      setOperators([]);
      setStep(3);
    } finally {
      setOperatorsLoading(false);
    }
  }

  function chooseOperator(op) {
    setSelectedOperator(op);
    setStep(3);
  }

  async function confirmBuy() {
    setBuyError("");
    setBuying(true);
    try {
      const res = await fetch("/api/otp/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          numberId: selectedCountry.number_id,
          providerId: selectedProvider.provider_id,
          operatorId: selectedOperator?.id || null,
          basePrice: selectedProvider.price,
          serviceName: selectedService.service_name,
          countryName: selectedCountry.name
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal membeli nomor.");
      const newOrder = {
        orderId: data.orderId,
        phoneNumber: data.phoneNumber,
        price: data.price,
        createdAt: data.createdAt,
        serviceName: selectedService.service_name,
        countryName: selectedCountry.name,
        status: "pending",
        otpCode: null,
        otpMsg: null
      };
      setOrder(newOrder);
      setStep(4);
      refreshBalance();
      try {
        localStorage.setItem(ACTIVE_ORDER_KEY, JSON.stringify({ token, order: newOrder }));
      } catch (e) {
        /* localStorage penuh/diblokir, tidak fatal */
      }
    } catch (err) {
      setBuyError(err.message);
    } finally {
      setBuying(false);
    }
  }

  function clearActiveOrder() {
    try {
      localStorage.removeItem(ACTIVE_ORDER_KEY);
    } catch (e) {
      /* abaikan */
    }
  }

  function startOver() {
    clearActiveOrder();
    setStep(0);
    setSelectedService(null);
    setSelectedCountry(null);
    setSelectedProvider(null);
    setSelectedOperator(null);
    setOrder(null);
    setBuyError("");
  }

  return (
    <div className="mx-auto max-w-content px-5 py-14">
      <p className="fade-up text-sm font-semibold uppercase tracking-wide text-teal-bright">Beli Nomor OTP</p>
      <h1 className="fade-up delay-1 mt-2 font-display text-display-sm font-semibold text-ink sm:text-display-md">
        Semua layanan, satu alur pembelian
      </h1>
      <p className="fade-up delay-2 mt-3 max-w-xl text-sm leading-relaxed text-muted">
        Bukan cuma WhatsApp — pilih dari seluruh layanan yang tersedia, lalu negara dan operator dengan harga yang tampil di depan.
      </p>

      <div className="fade-up delay-3 mt-8 flex flex-wrap gap-2 text-xs">
        {STEP_LABELS.map((label, i) => (
          <div
            key={label}
            className={`rounded-full border px-3 py-1.5 transition-all duration-300 ${
              i === step
                ? "border-teal bg-teal-soft text-teal-bright shadow-soft"
                : i < step
                ? "border-line text-ink"
                : "border-line text-muted"
            }`}
          >
            {i + 1}. {label}
          </div>
        ))}
      </div>

      <div className="scale-in mt-8 rounded-2xl border border-line bg-surface p-6 shadow-soft">
        {step === 0 && (
          <div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari layanan, contoh: WhatsApp, Telegram, Google..."
              className="w-full rounded-lg border border-line bg-bg px-4 py-3 text-sm text-ink outline-none transition-colors focus:border-teal"
            />
            {servicesLoading ? (
              <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="skeleton h-[52px] rounded-xl border border-line" />
                ))}
              </div>
            ) : filteredServices.length === 0 ? (
              <p className="mt-6 text-sm text-muted">Layanan tidak ditemukan. Coba kata kunci lain.</p>
            ) : (
              <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {filteredServices.map((s) => (
                  <button
                    key={s.service_code}
                    onClick={() => chooseService(s)}
                    className="hover-lift flex items-center gap-3 rounded-xl border border-line bg-bg px-4 py-3 text-left text-sm text-ink transition-colors hover:border-teal"
                  >
                    {s.service_img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.service_img} alt="" className="h-7 w-7 rounded object-contain" />
                    ) : (
                      <span className="flex h-7 w-7 items-center justify-center rounded bg-surface2 text-xs text-muted">
                        {(s.service_name || "?")[0]}
                      </span>
                    )}
                    <span className="line-clamp-2">{s.service_name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 1 && (
          <div>
            <button onClick={() => setStep(0)} className="underline-grow text-xs text-muted hover:text-ink">
              ← Ganti layanan
            </button>
            <p className="mt-3 text-sm text-muted">
              Layanan: <span className="font-medium text-ink">{selectedService?.service_name}</span>
            </p>
            {countriesLoading ? (
              <div className="mt-5 space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="skeleton h-[84px] rounded-xl border border-line" />
                ))}
              </div>
            ) : countries.length === 0 ? (
              <p className="mt-6 text-sm text-muted">Belum ada stok untuk layanan ini. Coba layanan lain.</p>
            ) : (
              <div className="mt-5 space-y-3">
                {countries.map((c) => (
                  <div key={c.number_id} className="rounded-xl border border-line bg-bg p-4">
                    <div className="flex items-center gap-3">
                      {c.img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.img} alt="" className="h-6 w-6 rounded-full object-cover" />
                      ) : null}
                      <span className="text-sm font-medium text-ink">{c.name}</span>
                      <span className="text-xs text-muted">Stok {c.stock_total ?? "-"}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(c.pricelist || []).map((p) => (
                        <button
                          key={p.provider_id}
                          disabled={p.available === false || p.stock === 0}
                          onClick={() => chooseProvider(c, p)}
                          className="press rounded-lg border border-line px-3 py-2 text-xs text-ink transition-colors hover:border-teal hover:bg-teal-soft disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Rp{Number(p.sell_price ?? p.price).toLocaleString("id-ID")}
                          <span className="ml-1 text-muted">· stok {p.stock ?? "-"}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div>
            <button onClick={() => setStep(1)} className="underline-grow text-xs text-muted hover:text-ink">
              ← Ganti negara
            </button>
            {operatorsLoading ? (
              <div className="mt-5 grid gap-2 sm:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="skeleton h-[44px] rounded-lg border border-line" />
                ))}
              </div>
            ) : operators.length === 0 ? (
              <p className="mt-6 text-sm text-muted">Tidak ada pilihan operator spesifik, lanjut ke konfirmasi.</p>
            ) : (
              <div className="mt-5 grid gap-2 sm:grid-cols-3">
                {operators.map((op) => (
                  <button
                    key={op.id}
                    onClick={() => chooseOperator(op)}
                    className="hover-lift rounded-lg border border-line bg-bg px-4 py-3 text-sm text-ink transition-colors hover:border-teal"
                  >
                    {op.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 3 && selectedService && selectedCountry && selectedProvider && (
          <div>
            <button onClick={() => setStep(2)} className="underline-grow text-xs text-muted hover:text-ink">
              ← Kembali
            </button>
            <h3 className="mt-3 font-display text-lg font-medium text-ink">Konfirmasi pembelian</h3>
            <dl className="mt-4 space-y-2 text-sm">
              <Row label="Layanan" value={selectedService.service_name} />
              <Row label="Negara" value={selectedCountry.name} />
              <Row label="Operator" value={selectedOperator?.name || "Otomatis"} />
              <Row label="Harga" value={`Rp${Number(selectedProvider.sell_price ?? selectedProvider.price).toLocaleString("id-ID")}`} />
              <Row label="Saldo kamu" value={`Rp${balance.toLocaleString("id-ID")}`} />
            </dl>
            {buyError && <p className="mt-4 text-sm text-rose">{buyError}</p>}
            <button
              onClick={confirmBuy}
              disabled={buying}
              className="press mt-6 w-full rounded-lg bg-teal px-5 py-3 text-sm font-medium text-white shadow-soft transition-colors hover:bg-teal-bright disabled:opacity-60 sm:w-auto"
            >
              {buying ? "Memproses..." : "Beli nomor sekarang"}
            </button>
          </div>
        )}

        {step === 4 && order && (
          <div>
            <OtpOrderPanel
              order={order}
              token={token}
              onChanged={() => {
                refreshBalance();
                clearActiveOrder();
              }}
            />
            <div className="mt-4">
              <button onClick={startOver} className="press rounded-lg border border-line px-5 py-2.5 text-sm text-ink transition-colors hover:border-teal hover:text-teal-bright">
                Beli nomor lain
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between border-b border-line pb-2">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium text-ink">{value}</dd>
    </div>
  );
}
