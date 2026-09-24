"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/app/providers";

function fmtRp(n) { return `Rp${Number(n || 0).toLocaleString("id-ID")}`; }

function DeliveryBadge({ type }) {
  const map = { text: ["📝", "Teks"], file: ["📎", "File"], image: ["🖼️", "Gambar"] };
  const [icon, label] = map[type] || ["📦", type];
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-surface2 px-2 py-0.5 text-[10px] font-semibold text-muted">
      {icon} {label}
    </span>
  );
}

function DeliveryContent({ type, content }) {
  if (!content) return null;
  if (type === "image") {
    return (
      <div className="mt-3">
        <p className="text-xs font-bold text-teal-bright mb-1.5">🎁 Konten kamu:</p>
        <img src={content} alt="Produk" className="w-full rounded-xl border border-line object-cover max-h-64" onError={(e) => { e.target.style.display = "none"; }} />
      </div>
    );
  }
  if (type === "file") {
    return (
      <div className="mt-3">
        <p className="text-xs font-bold text-teal-bright mb-1.5">🎁 Konten kamu:</p>
        <a
          href={content}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl bg-teal-soft border border-teal/30 px-4 py-2.5 text-sm font-bold text-teal-bright hover:bg-teal/20 transition-colors"
        >
          📎 Unduh File
        </a>
      </div>
    );
  }
  // text
  return (
    <div className="mt-3">
      <p className="text-xs font-bold text-teal-bright mb-1.5">🎁 Konten kamu:</p>
      <div className="rounded-xl border border-teal/30 bg-teal-soft p-3 font-mono text-xs text-ink break-all whitespace-pre-wrap select-all">
        {content}
      </div>
    </div>
  );
}

function ProductCard({ product, onBuy }) {
  const unlimited = product.stock === -1;
  const outOfStock = !unlimited && product.stock <= 0;

  return (
    <div className={`group relative rounded-3xl border-2 bg-surface p-5 transition-all hover:-translate-y-1 hover:shadow-xl ${outOfStock ? "border-line opacity-60" : "border-line hover:border-amber"}`}
      style={{ boxShadow: "4px 4px 0px 0px rgba(0,0,0,0.08)" }}>
      {/* Gambar / emoji */}
      {product.imageUrl ? (
        <img src={product.imageUrl} alt={product.name} className="w-full h-36 object-cover rounded-2xl mb-3 border border-line" />
      ) : (
        <div className="w-full h-32 rounded-2xl mb-3 bg-gradient-to-br from-amber-soft to-surface2 flex items-center justify-center text-5xl border border-line">
          📦
        </div>
      )}

      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="text-sm font-black text-ink leading-tight">{product.name}</p>
        <DeliveryBadge type={product.deliveryType} />
      </div>

      {product.description && (
        <p className="text-xs text-muted line-clamp-3 mb-3 leading-relaxed whitespace-pre-line">{product.description}</p>
      )}

      <div className="flex items-center justify-between gap-2 mt-auto pt-2 border-t border-line">
        <div>
          <p className="text-lg font-black text-ink tabular-nums">{fmtRp(product.price)}</p>
          <p className="text-[10px] text-muted">
            {unlimited ? "Stok tidak terbatas" : outOfStock ? "Stok habis" : `Stok: ${product.stock}`}
          </p>
        </div>
        <button
          onClick={() => onBuy(product)}
          disabled={outOfStock}
          className="rounded-2xl bg-amber px-4 py-2.5 text-sm font-black text-white shadow-md transition-all active:scale-95 hover:bg-amber-bright disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ boxShadow: "0 4px 0 0 rgba(180,100,0,0.4)" }}
        >
          {outOfStock ? "Habis" : "Beli"}
        </button>
      </div>
    </div>
  );
}

function BuyModal({ product, balance, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");
  const { token } = useUser();

  async function doBuy() {
    setLoading(true); setErr("");
    try {
      const res = await fetch("/api/products/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, productId: product.id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal membeli.");
      setResult(data);
      onSuccess(data.balance);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-3xl bg-bg border-2 border-line overflow-hidden max-h-[88dvh] flex flex-col"
        style={{ boxShadow: "6px 6px 0 0 rgba(0,0,0,0.15)" }}>
        {/* Header */}
        <div className="bg-gradient-to-r from-amber to-amber-bright p-5 text-white">
          <p className="text-xs font-bold opacity-80 mb-0.5">Konfirmasi Pembelian</p>
          <p className="text-lg font-black leading-tight">{product.name}</p>
        </div>

        <div className="p-5 overflow-y-auto">
          {!result ? (
            <>
              <div className="space-y-2.5 mb-5">
                <div className="flex justify-between items-center py-2.5 border-b border-line">
                  <span className="text-sm text-muted">Harga</span>
                  <span className="text-sm font-black text-ink">{fmtRp(product.price)}</span>
                </div>
                <div className="flex justify-between items-center py-2.5 border-b border-line">
                  <span className="text-sm text-muted">Saldo kamu</span>
                  <span className={`text-sm font-black ${balance < product.price ? "text-rose" : "text-teal-bright"}`}>{fmtRp(balance)}</span>
                </div>
                <div className="flex justify-between items-center py-2.5">
                  <span className="text-sm text-muted">Sisa setelah beli</span>
                  <span className="text-sm font-black text-ink">{fmtRp(Math.max(0, balance - product.price))}</span>
                </div>
              </div>
              {err && <p className="text-xs text-rose font-medium mb-3 p-2.5 rounded-xl bg-rose-soft/30">{err}</p>}
              <div className="flex gap-2.5">
                <button onClick={onClose} className="flex-1 py-3 rounded-2xl border-2 border-line text-sm font-bold text-ink hover:bg-surface2 transition-colors">
                  Batal
                </button>
                <button
                  onClick={doBuy}
                  disabled={loading || balance < product.price}
                  className="flex-1 py-3 rounded-2xl bg-amber text-sm font-black text-white transition-all active:scale-95 hover:bg-amber-bright disabled:opacity-50"
                  style={{ boxShadow: "0 4px 0 0 rgba(180,100,0,0.4)" }}
                >
                  {loading ? "Memproses..." : "Beli Sekarang"}
                </button>
              </div>
              {balance < product.price && (
                <p className="text-center text-xs text-rose mt-2.5 font-medium">Saldo tidak cukup. Silakan isi saldo terlebih dahulu.</p>
              )}
            </>
          ) : (
            <div className="text-center">
              <div className="text-5xl mb-3">🎉</div>
              <p className="text-base font-black text-ink mb-1">Pembelian Berhasil!</p>
              <p className="text-xs text-muted mb-4">Saldo kamu sekarang: <span className="font-bold text-ink">{fmtRp(result.balance)}</span></p>
              <DeliveryContent type={result.deliveryType} content={result.deliveryContent} />
              <button onClick={onClose} className="mt-5 w-full py-3 rounded-2xl bg-gradient-to-r from-teal to-teal-bright text-sm font-black text-white">
                Tutup
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ProdukPage() {
  const { token, balance, setBalance, ready } = useUser();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("Semua");
  const [buying, setBuying] = useState(null);
  const [myOrders, setMyOrders] = useState([]);
  const [view, setView] = useState("store"); // "store" | "my-orders"

  useEffect(() => {
    fetch("/api/products")
      .then((r) => r.json())
      .then((d) => setProducts(Array.isArray(d.items) ? d.items : []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!token || view !== "my-orders") return;
    fetch(`/api/products/orders?token=${token}`)
      .then((r) => r.json())
      .then((d) => setMyOrders(Array.isArray(d.items) ? d.items : []));
  }, [token, view]);

  const categories = ["Semua", ...Array.from(new Set(products.map((p) => p.category || "Umum")))];
  const filtered = filter === "Semua" ? products : products.filter((p) => (p.category || "Umum") === filter);

  return (
    <main className="mx-auto max-w-content px-4 pb-28 pt-6 sm:px-5 sm:pt-10">
      {/* ── Header ── */}
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 rounded-full bg-amber-soft border-2 border-amber/40 px-3 py-1 mb-2">
          <span className="text-amber-bright text-xs font-black">🛍️ TOKO DIGITAL</span>
        </div>
        <h1 className="font-display text-3xl font-black text-ink mb-1" style={{ textShadow: "2px 2px 0 rgba(0,0,0,0.08)" }}>
          Produk Lain
        </h1>
        <p className="text-sm text-muted">Produk digital berkualitas — foto, file, akun, dan lainnya.</p>
      </div>

      {/* ── View toggle ── */}
      <div className="flex gap-2 mb-5">
        {[["store", "🛍️ Toko"], ["my-orders", "📋 Pembelianku"]].map(([v, l]) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`flex-1 py-2.5 rounded-2xl text-sm font-black border-2 transition-all ${
              view === v
                ? "bg-ink text-white border-ink shadow-md"
                : "bg-surface text-ink border-line hover:border-amber"
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {view === "store" && (
        <>
          {/* Category filter */}
          {categories.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2 mb-5 scrollbar-hide">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setFilter(cat)}
                  className={`shrink-0 rounded-full border-2 px-4 py-1.5 text-xs font-black transition-all ${
                    filter === cat
                      ? "border-amber bg-amber text-white"
                      : "border-line bg-surface text-muted hover:border-amber/60"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[1,2,3,4].map((i) => <div key={i} className="h-52 animate-pulse rounded-3xl bg-surface2" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-6xl mb-3">📦</div>
              <p className="font-black text-ink mb-1">Belum ada produk</p>
              <p className="text-sm text-muted">Admin belum menambahkan produk.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {filtered.map((p) => (
                <ProductCard key={p.id} product={p} onBuy={setBuying} />
              ))}
            </div>
          )}
        </>
      )}

      {view === "my-orders" && (
        <div className="space-y-3">
          {myOrders.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-6xl mb-3">🛒</div>
              <p className="font-black text-ink mb-1">Belum ada pembelian</p>
              <p className="text-sm text-muted">Kamu belum membeli produk apapun.</p>
            </div>
          ) : myOrders.map((o) => (
            <div key={o.id} className="rounded-3xl border-2 border-line bg-surface p-4"
              style={{ boxShadow: "3px 3px 0 0 rgba(0,0,0,0.06)" }}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="text-sm font-black text-ink">{o.productName}</p>
                <span className="text-sm font-black text-rose shrink-0">−{fmtRp(o.price)}</span>
              </div>
              <DeliveryContent type={o.deliveryType} content={o.deliveryContent} />
              <p className="text-[10px] text-muted mt-2">{new Date(o.purchasedAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
            </div>
          ))}
        </div>
      )}

      {buying && (
        <BuyModal
          product={buying}
          balance={balance || 0}
          onClose={() => setBuying(null)}
          onSuccess={(newBal) => { setBalance(newBal); setTimeout(() => setBuying(null), 3000); }}
        />
      )}
    </main>
  );
}
