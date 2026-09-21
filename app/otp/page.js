"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useUser } from "@/app/providers";
import OtpOrderPanel from "@/components/OtpOrderPanel";
import BuySheet from "@/components/BuySheet";
import MysteryBoxModal from "@/components/MysteryBoxModal";
import LuckyHourBanner from "@/components/LuckyHourBanner";
import FlashSaleTimer from "@/components/FlashSaleTimer";
import { PageHeader, Icon } from "@/components/ui";

// WhatsApp selalu tampil paling atas, sisanya tetap mengikuti urutan asli dari RumahOTP (Server Murah).
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
    <Suspense fallback={<div className="mx-auto max-w-content px-4 py-6 sm:px-5 sm:py-10 text-sm text-muted">Memuat...</div>}>
      <OtpPageInner />
    </Suspense>
  );
}

const ACTIVE_ORDER_KEY = "artapedia_active_otp_order";
const RECENT_SERVICES_KEY = "artapedia_recent_otp_services";
const FAVORITE_SERVICES_KEY = "artapedia_favorite_otp_services";

function OtpPageInner() {
  const { token, balance, refreshBalance } = useUser();
  const searchParams = useSearchParams();

  const [services, setServices] = useState([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [order, setOrder] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [refreshSignal, setRefreshSignal] = useState(0);
  const [favorites, setFavorites] = useState([]);
  const [recentServices, setRecentServices] = useState([]);
  const [mysteryOrderId, setMysteryOrderId] = useState(null);
  const [mysteryOpen, setMysteryOpen] = useState(false);

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

  // Load favorites and recent services from localStorage
  useEffect(() => {
    try {
      const fav = localStorage.getItem(FAVORITE_SERVICES_KEY);
      if (fav) setFavorites(JSON.parse(fav));
      const rec = localStorage.getItem(RECENT_SERVICES_KEY);
      if (rec) setRecentServices(JSON.parse(rec));
    } catch {}
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

  function toggleFavorite(svc) {
    setFavorites((prev) => {
      const exists = prev.some((f) => f.name === svc.name);
      const next = exists ? prev.filter((f) => f.name !== svc.name) : [svc, ...prev].slice(0, 8);
      try { localStorage.setItem(FAVORITE_SERVICES_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }


  function handleOrderCreated(newOrder) {
    setOrder(newOrder);
    setSheetOpen(false);
    refreshBalance();
    if (newOrder?.orderId) {
      setMysteryOrderId(newOrder.orderId);
      setMysteryOpen(true);
    }
    try {
      localStorage.setItem(ACTIVE_ORDER_KEY, JSON.stringify({ token, order: newOrder }));
      // Track recently used service
      if (newOrder.serviceName) {
        const svc = { name: newOrder.serviceName, country: newOrder.countryName || "" };
        setRecentServices((prev) => {
          const next = [svc, ...prev.filter((s) => s.name !== svc.name)].slice(0, 6);
          try { localStorage.setItem(RECENT_SERVICES_KEY, JSON.stringify(next)); } catch {}
          return next;
        });
      }
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
    <div className="mx-auto max-w-content px-4 py-6 sm:px-5 sm:py-10">
      <div className="mb-4 space-y-2">
        <FlashSaleTimer />
        <LuckyHourBanner />
      </div>
      <PageHeader
        icon={<Icon.phone />}
        title="Beli nokos"
        desc="Pilih server (Nokos Murah atau OTP Fast), aplikasi, lalu negara. Nomor langsung tampil, kode OTP muncul sendiri begitu masuk. Tidak ada kode dalam waktu tertentu? Saldo dikembalikan otomatis."
        action={
          <button onClick={() => setSheetOpen(true)} className="btn-primary px-5">
            + Pesan nomor
          </button>
        }
      />

      {/* Pesanan Pending */}
      <div className="fade-up delay-2 mt-7">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-ink">Pesanan aktif</h2>
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
            <div className="card flex flex-col items-center gap-3 px-6 py-10 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface2 text-amber-bright">
                <Icon.phone width={26} height={26} />
              </span>
              <div>
                <p className="text-sm font-bold text-ink">Belum ada pesanan aktif</p>
                <p className="mt-1 text-xs text-muted">Nomor yang kamu beli akan muncul di sini beserta kode OTP-nya.</p>
              </div>
              <button onClick={() => setSheetOpen(true)} className="btn-dark mt-1 px-5">
                Pesan nomor sekarang
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Favorit & Layanan Terbaru */}
      {(favorites.length > 0 || recentServices.length > 0) && (
        <div className="mt-8">
          {favorites.length > 0 && (
            <div className="mb-4">
              <h2 className="text-sm font-bold text-ink mb-2">⭐ Layanan Favorit</h2>
              <div className="flex flex-wrap gap-2">
                {favorites.map((svc) => (
                  <div key={svc.name} className="flex items-center gap-1 rounded-xl border border-amber/30 bg-amber-soft px-3 py-1.5">
                    <button
                      onClick={() => { setSheetOpen(true); }}
                      className="text-xs font-semibold text-amber-bright hover:underline"
                    >
                      {svc.name}
                      {svc.country ? <span className="font-normal text-muted"> · {svc.country}</span> : null}
                    </button>
                    <button
                      onClick={() => toggleFavorite(svc)}
                      className="ml-1 text-amber-bright hover:text-rose text-xs"
                      title="Hapus dari favorit"
                    >
                      ★
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {recentServices.length > 0 && (
            <div>
              <h2 className="text-sm font-bold text-ink mb-2">🕐 Pernah Dipesan</h2>
              <div className="flex flex-wrap gap-2">
                {recentServices.map((svc) => (
                  <div key={svc.name} className="flex items-center gap-1 rounded-xl border border-line bg-surface2 px-3 py-1.5">
                    <button
                      onClick={() => setSheetOpen(true)}
                      className="text-xs font-semibold text-ink hover:text-amber-bright"
                    >
                      {svc.name}
                      {svc.country ? <span className="font-normal text-muted"> · {svc.country}</span> : null}
                    </button>
                    <button
                      onClick={() => toggleFavorite(svc)}
                      className={`ml-1 text-xs ${favorites.some((f) => f.name === svc.name) ? "text-amber-bright" : "text-muted hover:text-amber-bright"}`}
                      title={favorites.some((f) => f.name === svc.name) ? "Hapus dari favorit" : "Tambah ke favorit"}
                    >
                      {favorites.some((f) => f.name === svc.name) ? "★" : "☆"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Aturan singkat */}
      <div className="card-flat mt-8 grid gap-4 p-5 sm:grid-cols-3">
        {[
          ["Batal setelah 3 menit", "Kalau kode belum masuk, pesanan bisa dibatalkan dan saldo langsung kembali."],
          ["Refund otomatis", "Nomor yang kedaluwarsa tanpa kode dikembalikan penuh ke saldo."],
          ["Pilih server dengan rate tinggi", "Urutkan “Paling sukses” agar peluang kode masuk lebih besar."]
        ].map(([t, d]) => (
          <div key={t}>
            <p className="text-sm font-bold text-ink">{t}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">{d}</p>
          </div>
        ))}
      </div>

      <BuySheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        services={services}
        servicesLoading={servicesLoading}
        token={token}
        balance={balance}
        onOrderCreated={handleOrderCreated}
        initialQuery={searchParams.get("q") || ""}
      />
      <MysteryBoxModal
        open={mysteryOpen}
        onClose={() => { setMysteryOpen(false); setMysteryOrderId(null); }}
        token={token}
        orderId={mysteryOrderId}
      />
    </div>
  );
}
