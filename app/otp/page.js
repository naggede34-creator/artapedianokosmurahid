"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useUser } from "@/app/providers";
import OtpOrderPanel from "@/components/OtpOrderPanel";
import BuySheet from "@/components/BuySheet";

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

const ACTIVE_ORDER_KEY = "artapedia_active_otp_order";

function OtpPageInner() {
  const { token, balance, refreshBalance } = useUser();
  const searchParams = useSearchParams();

  const [services, setServices] = useState([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [order, setOrder] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [refreshSignal, setRefreshSignal] = useState(0);

  useEffect(() => {
    fetch("/api/otp/services")
      .then((r) => r.json())
      .then((d) => setServices(sortWithWaFirst(Array.isArray(d.items) ? d.items : [])))
      .catch(() => setServices([]))
      .finally(() => setServicesLoading(false));
  }, []);

  // Kalau datang dari ?q=, langsung buka sheet buat cari layanan itu.
  useEffect(() => {
    if (searchParams.get("q")) setSheetOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      }
    } catch (e) {
      /* abaikan data tersimpan yang korup */
    }
  }, [token]);

  const popularIcons = useMemo(() => services.slice(0, 4), [services]);

  function handleOrderCreated(newOrder) {
    setOrder(newOrder);
    setSheetOpen(false);
    refreshBalance();
    try {
      localStorage.setItem(ACTIVE_ORDER_KEY, JSON.stringify({ token, order: newOrder }));
    } catch (e) {
      /* localStorage penuh/diblokir, tidak fatal */
    }
  }

  function clearActiveOrder() {
    try {
      localStorage.removeItem(ACTIVE_ORDER_KEY);
    } catch (e) {
      /* abaikan */
    }
  }

  return (
    <div className="mx-auto max-w-content px-5 py-10">
      <p className="fade-up text-sm font-semibold uppercase tracking-wide text-teal-bright">Beli Nomor OTP</p>
      <h1 className="fade-up delay-1 mt-2 font-display text-display-sm font-semibold text-ink sm:text-display-md">
        Nomor & kode OTP dalam satu tempat
      </h1>
      <p className="fade-up delay-2 mt-3 max-w-xl text-sm leading-relaxed text-muted">
        Pilih aplikasi, negara, lalu order — nomor dan kode OTP-nya langsung tampil di sini begitu masuk.
      </p>

      {/* Pesanan Pending */}
      <div className="fade-up delay-2 mt-7">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-ink">Pesanan Pending</h2>
          {order && (
            <button
              onClick={() => setRefreshSignal((n) => n + 1)}
              className="btn-3d flex h-8 w-8 items-center justify-center rounded-full border border-line text-muted transition-colors hover:text-amber-bright"
              aria-label="Segarkan status"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <path d="M4 4v5h5M20 20v-5h-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M4.6 15a8 8 0 1 0 1.5-8.4L4 9M19.4 9a8 8 0 0 1-1.5 8.4L20 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
        </div>

        <div className="mt-3">
          {order ? (
            <OtpOrderPanel
              order={order}
              token={token}
              refreshSignal={refreshSignal}
              onBuyAgain={() => setSheetOpen(true)}
              onChanged={() => {
                refreshBalance();
                clearActiveOrder();
              }}
            />
          ) : (
            <div className="glass flex flex-col items-center gap-3 rounded-2xl px-6 py-10 text-center shadow-soft">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface2 text-2xl">📦</span>
              <div>
                <p className="text-sm font-medium text-ink">Tidak ada pesanan</p>
                <p className="mt-1 text-xs text-muted">Pesanan aktif akan muncul disini</p>
              </div>
              <button
                onClick={() => setSheetOpen(true)}
                className="btn-3d mt-1 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-ink to-[#1D2A4A] px-5 py-2.5 text-sm font-medium text-white shadow-3d"
              >
                + Buat Pesanan
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Banner Beli Nomor Virtual */}
      <div className="glow-ring fade-up delay-3 mt-8 rounded-3xl">
        <button
          onClick={() => setSheetOpen(true)}
          className="relative flex w-full items-center justify-between gap-4 overflow-hidden rounded-3xl bg-gradient-to-br from-amber via-amber-bright to-teal-bright px-5 py-5 text-left shadow-card-3d sm:px-7"
        >
          <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/15 blur-2xl" />
          <div className="relative min-w-0">
            <p className="font-display text-base font-semibold text-white sm:text-lg">Beli Nomor Virtual</p>
            <p className="mt-1 max-w-xs text-xs leading-relaxed text-white/75">
              Baca dulu ketentuan sebelum membeli, biar sama-sama nyaman.
            </p>
            <div className="mt-3 flex items-center gap-1.5">
              {popularIcons.map((s) =>
                s.service_img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={s.service_code} src={s.service_img} alt="" className="h-7 w-7 rounded-full border-2 border-white/70 bg-white object-contain p-0.5" />
                ) : (
                  <span key={s.service_code} className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white/70 bg-white text-[10px] text-ink">
                    {(s.service_name || "?")[0]}
                  </span>
                )
              )}
              <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white/70 bg-ink/70 text-[10px] font-medium text-white">
                +{Math.max(services.length - popularIcons.length, 0)}
              </span>
            </div>
          </div>
          <span className="btn-3d relative shrink-0 rounded-full bg-white px-4 py-2 text-sm font-medium text-ink shadow-3d">
            Beli Nomor →
          </span>
        </button>
      </div>

      <BuySheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        services={services}
        servicesLoading={servicesLoading}
        token={token}
        balance={balance}
        onOrderCreated={handleOrderCreated}
      />
    </div>
  );
}
