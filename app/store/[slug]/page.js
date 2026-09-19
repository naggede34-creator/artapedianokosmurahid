"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/app/providers";

function fmt(n) { return "Rp " + Number(n || 0).toLocaleString("id-ID"); }

function CountryModal({ svc, storeMarkup, storeSlug, buyerToken, onClose, onSuccess }) {
  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [buying, setBuying] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch(`/api/otp/countries?service_id=${svc.service_id}`)
      .then(r => r.json())
      .then(d => {
        const list = Array.isArray(d.items || d) ? (d.items || d) : [];
        setCountries(list);
      })
      .catch(() => setCountries([]))
      .finally(() => setLoading(false));
  }, [svc.service_id]);

  async function handleBuy() {
    if (!selected) { setErr("Pilih server/negara dulu."); return; }
    if (!buyerToken) { setErr("Login dulu untuk beli."); return; }
    setBuying(true); setErr("");
    const pl = selected.pricelist?.[0];
    try {
      const res = await fetch("/api/reseller/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: buyerToken,
          storeSlug,
          serviceId: svc.service_id,
          numberId: selected.number_id,
          providerId: pl?.provider_id,
          operatorId: pl?.operator_id || null,
          operatorName: pl?.operator || null,
          serviceName: svc.service_name,
          countryName: selected.name,
        }),
      });
      const d = await res.json();
      if (d.ok) onSuccess(d);
      else setErr(d.error || "Gagal beli.");
    } catch { setErr("Gagal beli."); }
    setBuying(false);
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4" style={{ background: "rgba(0,0,0,0.6)" }}>
      <div className="glass flex w-full flex-col rounded-t-2xl sm:max-w-md sm:rounded-2xl border border-line" style={{ maxHeight: "80vh" }}>
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <p className="font-display text-base font-semibold text-ink">🌐 Pilih Server</p>
            <p className="text-xs text-muted">{svc.service_name}</p>
          </div>
          <button onClick={onClose} className="press flex h-8 w-8 items-center justify-center rounded-xl border border-line text-muted">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {loading && <p className="py-8 text-center text-sm text-muted">Memuat server...</p>}
          {!loading && !countries.length && <p className="py-8 text-center text-sm text-muted">Tidak ada server tersedia.</p>}
          <div className="flex flex-col gap-2">
            {countries.map(c => {
              const pl = c.pricelist?.[0];
              if (!pl) return null;
              const base = Number(pl.price || 0);
              const price = Math.ceil(base * (1 + storeMarkup / 100));
              const isSel = selected?.number_id === c.number_id;
              return (
                <button
                  key={c.number_id}
                  onClick={() => setSelected(c)}
                  className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${isSel ? "border-amber bg-amber-soft" : "border-line bg-surface hover:bg-surface2"}`}
                >
                  <div>
                    <p className={`text-sm font-semibold ${isSel ? "text-amber-bright" : "text-ink"}`}>{c.name}</p>
                    {pl.operator && <p className="text-xs text-muted">{pl.operator}</p>}
                  </div>
                  <p className={`text-sm font-bold tabular-nums ${isSel ? "text-amber-bright" : "text-ink"}`}>{fmt(price)}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-t border-line px-5 py-4">
          {err && <p className="mb-3 rounded-lg bg-rose/10 px-3 py-2 text-xs text-rose">{err}</p>}
          {selected && (
            <p className="mb-3 text-xs text-muted">
              Dipilih: <span className="font-semibold text-ink">{selected.name}</span> — <span className="font-semibold text-amber-bright">{fmt(Math.ceil((selected.pricelist?.[0]?.price || 0) * (1 + storeMarkup / 100)))}</span>
            </p>
          )}
          <div className="flex gap-3">
            <button onClick={onClose} className="press flex-1 rounded-xl border border-line bg-surface py-2.5 text-sm font-semibold text-muted">Batal</button>
            <button onClick={handleBuy} disabled={!selected || buying} className="press flex-[2] rounded-xl bg-amber py-2.5 text-sm font-bold text-white disabled:opacity-50">
              {buying ? "Memproses..." : "✅ Beli Sekarang"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SuccessModal({ order, onClose }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }}>
      <div className="glass w-full max-w-sm rounded-2xl border border-line p-6 text-center">
        <div className="mb-3 text-5xl">✅</div>
        <h3 className="font-display text-lg font-bold text-teal-bright">Pesanan Berhasil!</h3>
        <p className="mt-1 text-sm text-muted">Nomor virtual siap menerima OTP.</p>
        {order?.phoneNumber && (
          <div className="my-4 rounded-xl border border-line bg-surface px-4 py-3">
            <p className="font-mono text-xl font-extrabold tracking-widest text-amber-bright">{order.phoneNumber}</p>
          </div>
        )}
        {order?.orderId && <p className="mb-4 text-xs text-muted">Order #{order.orderId}</p>}
        <p className="mb-4 text-xs text-muted">Cek status OTP di Artapedia dengan kode akun kamu.</p>
        <button onClick={onClose} className="press w-full rounded-xl bg-amber py-2.5 text-sm font-bold text-white">Tutup</button>
      </div>
    </div>
  );
}

export default function StorePage({ params }) {
  const { slug } = params;
  const { token } = useUser();

  const [store, setStore] = useState(null);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedSvc, setSelectedSvc] = useState(null);
  const [successOrder, setSuccessOrder] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [storeRes, svcRes] = await Promise.all([
          fetch(`/api/reseller/store?slug=${encodeURIComponent(slug)}`),
          fetch("/api/otp/services"),
        ]);
        const storeData = await storeRes.json();
        if (storeData.error) { setNotFound(true); setLoading(false); return; }
        const svcData = await svcRes.json();
        setStore(storeData);
        setServices(Array.isArray(svcData.items) ? svcData.items : []);
      } catch { setNotFound(true); }
      setLoading(false);
    }
    load();
  }, [slug]);

  const markup = store?.markup || 0;
  const filtered = services.filter(s =>
    !search || s.service_name?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <p className="text-muted">Memuat toko...</p>
    </div>
  );

  if (notFound) return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 text-5xl">🏪</div>
      <h2 className="font-display text-xl font-bold text-ink">Toko Tidak Ditemukan</h2>
      <p className="mt-2 text-sm text-muted">Toko dengan alamat ini tidak tersedia atau sudah dinonaktifkan.</p>
      <a href="/" className="press mt-6 rounded-xl bg-amber px-6 py-2.5 text-sm font-bold text-white">Ke Artapedia</a>
    </div>
  );

  return (
    <div className="mx-auto max-w-2xl px-4 pb-16 pt-6">
      {/* Store header card */}
      <div className="card-3d mb-6 overflow-hidden rounded-2xl border border-line">
        <div className="bg-gradient-to-r from-amber to-amber-bright p-5">
          <div className="flex items-center gap-4">
            {store?.logo
              ? <img src={store.logo} alt="logo" className="h-14 w-14 rounded-xl border-2 border-white/30 object-cover" />
              : <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/20 text-3xl">🏪</div>
            }
            <div>
              <h1 className="font-display text-xl font-extrabold text-white">{store?.webName}</h1>
              {store?.description && <p className="mt-0.5 text-sm text-white/80">{store.description}</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Login banner */}
      {!token && (
        <div className="mb-5 rounded-xl border border-amber/30 bg-amber-soft px-4 py-3">
          <p className="text-sm text-amber-bright">
            💡 Login ke Artapedia untuk bisa membeli layanan di toko ini.{" "}
            <a href="/" className="font-semibold underline">Login sekarang →</a>
          </p>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-5">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">🔍</span>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cari layanan OTP..."
          className="w-full rounded-xl border border-line bg-surface py-3 pl-10 pr-4 text-sm text-ink outline-none focus:border-amber"
        />
      </div>

      <p className="mb-3 text-xs text-muted">{filtered.length} layanan tersedia</p>

      {/* Services list */}
      <div className="flex flex-col gap-2">
        {filtered.map(svc => {
          const base = Number(svc.price || 0);
          const price = Math.ceil(base * (1 + markup / 100));
          return (
            <button
              key={svc.service_id}
              onClick={() => setSelectedSvc(svc)}
              className="press card flex w-full items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3.5 text-left hover:bg-surface2"
            >
              <div>
                <p className="text-sm font-semibold text-ink">{svc.service_name}</p>
                {svc.country && <p className="text-xs text-muted">{svc.country}</p>}
              </div>
              <div className="text-right">
                <p className="text-sm font-bold tabular-nums text-amber-bright">mulai {base > 0 ? fmt(price) : "Lihat harga"}</p>
                <p className="text-xs text-muted">per OTP</p>
              </div>
            </button>
          );
        })}
        {!filtered.length && (
          <p className="py-10 text-center text-sm text-muted">Tidak ada layanan ditemukan.</p>
        )}
      </div>

      <p className="mt-10 text-center text-xs text-muted">
        Powered by{" "}
        <a href="/" className="text-amber-bright hover:underline">Artapedia</a>
      </p>

      {selectedSvc && (
        <CountryModal
          svc={selectedSvc}
          storeMarkup={markup}
          storeSlug={slug}
          buyerToken={token}
          onClose={() => setSelectedSvc(null)}
          onSuccess={(d) => { setSelectedSvc(null); setSuccessOrder(d); }}
        />
      )}
      {successOrder && <SuccessModal order={successOrder} onClose={() => setSuccessOrder(null)} />}
    </div>
  );
}
