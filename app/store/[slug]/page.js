"use client";

import { useEffect, useState, use } from "react";
import { useUser } from "@/app/providers";

function fmt(n) { return "Rp " + Number(n || 0).toLocaleString("id-ID"); }
function fmtDate(d) { return d ? new Date(d).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" }) : "-"; }

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
    <div style={{ position: "fixed", inset: 0, background: "#00000099", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#1e1e35", borderRadius: 18, width: "100%", maxWidth: 420, maxHeight: "80vh", display: "flex", flexDirection: "column", border: "1px solid #6366f144" }}>
        {/* Header */}
        <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid #334155" }}>
          <div style={{ fontWeight: 700, fontSize: 17, color: "#e2e8f0" }}>🌐 Pilih Server — {svc.service_name}</div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>Harga sudah termasuk markup toko</div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
          {loading && <div style={{ color: "#64748b", textAlign: "center", padding: 24 }}>Memuat server...</div>}
          {!loading && !countries.length && <div style={{ color: "#64748b", textAlign: "center", padding: 24 }}>Tidak ada server tersedia.</div>}
          {countries.map(c => {
            const pl = c.pricelist?.[0];
            if (!pl) return null;
            const base = Number(pl.price || 0);
            const price = Math.ceil(base * (1 + storeMarkup / 100));
            const isSel = selected?.number_id === c.number_id;
            return (
              <div
                key={c.number_id}
                onClick={() => setSelected(c)}
                style={{
                  background: isSel ? "#6366f122" : "#0f0f1a", borderRadius: 10, padding: "12px 14px", marginBottom: 8, cursor: "pointer",
                  border: `1px solid ${isSel ? "#6366f188" : "#1e293b"}`, display: "flex", justifyContent: "space-between", alignItems: "center",
                }}
              >
                <div>
                  <div style={{ color: "#e2e8f0", fontSize: 14, fontWeight: isSel ? 700 : 400 }}>{c.name}</div>
                  {pl.operator && <div style={{ fontSize: 11, color: "#64748b" }}>{pl.operator}</div>}
                </div>
                <div style={{ color: "#a5b4fc", fontWeight: 700, fontSize: 15 }}>{fmt(price)}</div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 20px", borderTop: "1px solid #334155" }}>
          {err && <div style={{ color: "#fca5a5", fontSize: 13, marginBottom: 10 }}>{err}</div>}
          {selected && (
            <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 10 }}>
              Kamu memilih: <strong style={{ color: "#a5b4fc" }}>{selected.name}</strong> — {fmt(Math.ceil((selected.pricelist?.[0]?.price || 0) * (1 + storeMarkup / 100)))}
            </div>
          )}
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onClose} style={{ flex: 1, background: "#334155", color: "#94a3b8", border: "none", borderRadius: 10, padding: 10, cursor: "pointer", fontSize: 14 }}>Batal</button>
            <button onClick={handleBuy} disabled={!selected || buying} style={{ flex: 2, background: !selected || buying ? "#4338ca88" : "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", border: "none", borderRadius: 10, padding: 10, fontWeight: 700, cursor: !selected || buying ? "not-allowed" : "pointer", fontSize: 14 }}>
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
    <div style={{ position: "fixed", inset: 0, background: "#00000099", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#1e1e35", borderRadius: 18, padding: 28, width: "100%", maxWidth: 380, textAlign: "center", border: "1px solid #22c55e44" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
        <div style={{ fontWeight: 700, fontSize: 18, color: "#86efac", marginBottom: 8 }}>Pesanan Berhasil!</div>
        <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 12 }}>Nomor virtual siap menerima OTP.</div>
        {order?.phoneNumber && (
          <div style={{ background: "#0f0f1a", borderRadius: 10, padding: "12px 16px", margin: "12px 0", fontSize: 20, fontWeight: 800, letterSpacing: 3, color: "#a5b4fc" }}>{order.phoneNumber}</div>
        )}
        {order?.orderId && <div style={{ fontSize: 11, color: "#475569", marginBottom: 16 }}>Order #{order.orderId}</div>}
        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>Cek status OTP di Artapedia dengan kode akun kamu.</div>
        <button onClick={onClose} style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 28px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>Tutup</button>
      </div>
    </div>
  );
}

export default function StorePage({ params }) {
  const resolvedParams = use(params);
  const slug = resolvedParams.slug;
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
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f0f1a" }}>
      <div style={{ color: "#a5b4fc", fontSize: 16 }}>Memuat toko...</div>
    </div>
  );

  if (notFound) return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#0f0f1a", color: "#94a3b8", textAlign: "center", padding: 24 }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>🏪</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: "#e2e8f0" }}>Toko Tidak Ditemukan</div>
      <div style={{ fontSize: 14, marginTop: 8 }}>Toko dengan alamat ini tidak tersedia atau sudah dinonaktifkan.</div>
      <a href="/" style={{ marginTop: 20, background: "#6366f1", color: "#fff", textDecoration: "none", borderRadius: 10, padding: "10px 24px", fontSize: 14 }}>Ke Artapedia</a>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 100%)", color: "#e2e8f0", fontFamily: "system-ui, sans-serif" }}>
      {/* Store Header */}
      <div style={{ background: "linear-gradient(90deg, #6366f1, #8b5cf6)", padding: "20px 24px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", alignItems: "center", gap: 16 }}>
          {store?.logo
            ? <img src={store.logo} alt="logo" style={{ width: 56, height: 56, borderRadius: 12, objectFit: "cover", border: "2px solid #ffffff44" }} />
            : <div style={{ width: 56, height: 56, borderRadius: 12, background: "#ffffff22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>🏪</div>
          }
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}>{store?.webName}</div>
            {store?.description && <div style={{ fontSize: 13, color: "#c7d2fe", marginTop: 3 }}>{store.description}</div>}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px" }}>
        {!token && (
          <div style={{ background: "#f59e0b22", border: "1px solid #f59e0b44", borderRadius: 12, padding: "12px 16px", marginBottom: 20, fontSize: 13, color: "#fbbf24" }}>
            💡 Login ke Artapedia untuk bisa membeli layanan di toko ini.
            <a href="/" style={{ color: "#a5b4fc", marginLeft: 8, textDecoration: "underline" }}>Login sekarang →</a>
          </div>
        )}

        {/* Search */}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Cari layanan OTP..."
          style={{ width: "100%", background: "#1e1e35", border: "1px solid #6366f133", borderRadius: 12, padding: "12px 16px", color: "#e2e8f0", fontSize: 15, boxSizing: "border-box", outline: "none", marginBottom: 20 }}
        />

        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 12 }}>{filtered.length} layanan tersedia</div>

        {/* Services list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map(svc => {
            const base = Number(svc.price || 0);
            const price = Math.ceil(base * (1 + markup / 100));
            return (
              <div
                key={svc.service_id}
                onClick={() => setSelectedSvc(svc)}
                style={{
                  background: "#1e1e35", borderRadius: 12, padding: "14px 16px", cursor: "pointer",
                  border: "1px solid #6366f122", transition: "all .15s",
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                }}
                onMouseEnter={e => { e.currentTarget.style.border = "1px solid #6366f188"; e.currentTarget.style.background = "#25253f"; }}
                onMouseLeave={e => { e.currentTarget.style.border = "1px solid #6366f122"; e.currentTarget.style.background = "#1e1e35"; }}
              >
                <div>
                  <div style={{ fontWeight: 600, color: "#e2e8f0", fontSize: 14 }}>{svc.service_name}</div>
                  {svc.country && <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{svc.country}</div>}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ color: "#a5b4fc", fontWeight: 700, fontSize: 15 }}>mulai {base > 0 ? fmt(price) : "Lihat harga"}</div>
                  <div style={{ fontSize: 10, color: "#475569" }}>per OTP</div>
                </div>
              </div>
            );
          })}
          {!filtered.length && (
            <div style={{ textAlign: "center", color: "#475569", padding: "40px 0", fontSize: 14 }}>Tidak ada layanan ditemukan.</div>
          )}
        </div>

        <div style={{ textAlign: "center", marginTop: 40, fontSize: 12, color: "#334155" }}>
          Powered by <a href="/" style={{ color: "#6366f1", textDecoration: "none" }}>Artapedia</a>
        </div>
      </div>

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
