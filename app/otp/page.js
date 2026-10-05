"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useUser } from "@/app/providers";
import OtpOrderPanel from "@/components/OtpOrderPanel";
import BuySheet from "@/components/BuySheet";
import MysteryBoxModal from "@/components/MysteryBoxModal";
import LuckyHourBanner from "@/components/LuckyHourBanner";
import FlashSaleTimer from "@/components/FlashSaleTimer";
import BannerRail from "@/components/BannerRail";
import { Icon } from "@/components/ui";

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
  // Kata kunci dari chip saran di panel OTP; menimpa ?q= selama lembar terbuka.
  const [cariSaran, setCariSaran] = useState("");
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

  const fmt = (n) => `Rp${Number(n || 0).toLocaleString("id-ID")}`;
  const bukaCari = (nama) => { setCariSaran(nama || ""); setSheetOpen(true); };

  return (
    <div className="mx-auto max-w-content px-4 py-6 sm:px-5 sm:py-10">
      <div className="mb-4 space-y-2">
        <FlashSaleTimer />
        <LuckyHourBanner />
      </div>

      {/* ───────── Hero ───────── */}
      <section className="relative overflow-hidden rounded-[28px] border border-line/10 bg-surface p-5 shadow-soft sm:p-7">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgb(var(--c-blue) / 0.30), transparent 65%)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-28 -left-16 h-60 w-60 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgb(var(--c-orange) / 0.16), transparent 65%)" }}
        />

        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-md">
            <h1 className="font-display text-display-sm font-bold tracking-tight text-ink sm:text-display-md">Beli nomor, kode OTP masuk sendiri</h1>
            {/* Nama server sengaja tidak disebut: admin bisa mengganti nama dan
                menyalakan/mematikan server kapan saja. Nama yang benar selalu
                tampil di kartu pilihan server. */}
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Pilih server, aplikasi, lalu negara. Nomornya langsung tampil dan kodenya muncul begitu masuk.
              Kalau kode tidak datang, saldo kembali otomatis.
            </p>
          </div>

          <div className="flex shrink-0 flex-col gap-3 sm:items-end">
            <div className="flex items-center gap-3 rounded-2xl border border-line/10 bg-surface2 px-4 py-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue/15 text-blue-bright">
                <Icon.phone width={18} height={18} />
              </span>
              <span>
                <span className="block text-[11px] text-muted">Saldo kamu</span>
                <span className="block text-base font-extrabold tabular-nums text-ink">{fmt(balance)}</span>
              </span>
            </div>
            <button
              onClick={() => bukaCari("")}
              className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-blue px-6 py-3.5 text-sm font-extrabold text-white shadow-lift transition-all hover:-translate-y-0.5 hover:bg-blue-bright active:scale-[0.98]"
            >
              Pesan nomor
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="transition-transform group-hover:translate-x-0.5">
                <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* Aturan pembelian: tiga hal yang paling sering ditanyakan */}
        <ul className="relative mt-6 grid gap-2.5 border-t border-line/10 pt-5 sm:grid-cols-3">
          {[
            ["Batal setelah 3 menit", "Kode belum masuk? Pesanan bisa dibatalkan dan saldo langsung kembali."],
            ["Refund otomatis", "Nomor yang kedaluwarsa tanpa kode dikembalikan penuh ke saldo."],
            ["Pilih rate tinggi", "Urutkan “Paling sukses” supaya peluang kode masuk lebih besar."]
          ].map(([t, d]) => (
            <li key={t} className="flex gap-2.5">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </span>
              <span>
                <span className="block text-[13px] font-bold text-ink">{t}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted">{d}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Banner admin di halaman yang paling ramai dikunjungi. */}
      <BannerRail placement="order" className="mt-5" />

      {/* ───────── Pesanan aktif ───────── */}
      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-extrabold text-ink">
            Pesanan aktif
            {order && <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-success" /></span>}
          </h2>
          {order && (
            <button
              onClick={() => setRefreshSignal((n) => n + 1)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-line/10 bg-surface2 text-muted transition-colors hover:text-blue-bright active:scale-95"
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
              onBuyAgain={(nama) => bukaCari(typeof nama === "string" ? nama : "")}
              onChanged={() => {
                refreshBalance();
                clearActiveOrder();
              }}
            />
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-line/20 px-6 py-10 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue/10 text-blue-bright">
                <Icon.phone width={26} height={26} />
              </span>
              <div>
                <p className="text-sm font-bold text-ink">Belum ada pesanan aktif</p>
                <p className="mt-1 text-xs text-muted">Nomor yang kamu beli muncul di sini beserta kode OTP-nya.</p>
              </div>
              <button onClick={() => bukaCari("")} className="mt-1 rounded-xl border border-line/15 bg-surface px-5 py-2.5 text-sm font-bold text-ink transition-colors hover:border-blue/50 hover:text-blue-bright">
                Pesan nomor sekarang
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ───────── Favorit & pernah dipesan ───────── */}
      {(favorites.length > 0 || recentServices.length > 0) && (
        <section className="mt-8 space-y-5">
          {favorites.length > 0 && (
            <div>
              <h2 className="mb-2.5 text-sm font-extrabold text-ink">Favorit</h2>
              <div className="flex flex-wrap gap-2">
                {favorites.map((svc) => (
                  <div key={svc.name} className="flex items-center overflow-hidden rounded-full border border-amber/30 bg-amber-soft">
                    <button onClick={() => bukaCari(svc.name)} className="py-1.5 pl-3.5 pr-2 text-xs font-bold text-amber-bright hover:underline">
                      {svc.name}
                      {svc.country ? <span className="font-medium text-muted"> · {svc.country}</span> : null}
                    </button>
                    <button onClick={() => toggleFavorite(svc)} className="py-1.5 pl-1 pr-3 text-xs text-amber-bright hover:text-rose" title="Hapus dari favorit" aria-label={`Hapus ${svc.name} dari favorit`}>
                      ★
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {recentServices.length > 0 && (
            <div>
              <h2 className="mb-2.5 text-sm font-extrabold text-ink">Pernah dipesan</h2>
              <div className="flex flex-wrap gap-2">
                {recentServices.map((svc) => {
                  const fav = favorites.some((f) => f.name === svc.name);
                  return (
                    <div key={svc.name} className="flex items-center overflow-hidden rounded-full border border-line/10 bg-surface2">
                      <button onClick={() => bukaCari(svc.name)} className="py-1.5 pl-3.5 pr-2 text-xs font-bold text-ink hover:text-blue-bright">
                        {svc.name}
                        {svc.country ? <span className="font-medium text-muted"> · {svc.country}</span> : null}
                      </button>
                      <button
                        onClick={() => toggleFavorite(svc)}
                        className={`py-1.5 pl-1 pr-3 text-xs ${fav ? "text-amber-bright" : "text-muted hover:text-amber-bright"}`}
                        title={fav ? "Hapus dari favorit" : "Tambah ke favorit"}
                        aria-label={fav ? `Hapus ${svc.name} dari favorit` : `Tambah ${svc.name} ke favorit`}
                      >
                        {fav ? "★" : "☆"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}

      <BuySheet
        open={sheetOpen}
        onClose={() => { setSheetOpen(false); setCariSaran(""); }}
        services={services}
        servicesLoading={servicesLoading}
        token={token}
        balance={balance}
        onOrderCreated={handleOrderCreated}
        initialQuery={cariSaran || searchParams.get("q") || ""}
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
