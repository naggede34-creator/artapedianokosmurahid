"use client";

import { useEffect, useRef, useState } from "react";
import { useLembarTerbuka } from "@/lib/lembarTerbuka";
import { rupiah } from "@/components/ui";

// Klaim garansi nomor bermasalah. Dipisah dari dasbor supaya halaman Riwayat dan Dasbor memakai satu salinan.
export default function WarrantyModal({ open, onClose, token }) {
  useLembarTerbuka(open);
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [description, setDescription] = useState("");
  const [screenshotData, setScreenshotData] = useState(null);
  const [screenshotPreview, setScreenshotPreview] = useState(null);
  const [purchasePrice, setPurchasePrice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState({ text: "", ok: false });
  const [claims, setClaims] = useState([]);
  const [tab, setTab] = useState("form"); // "form" | "history"
  const screenshotInputRef = useRef(null);

  function handleScreenshot(file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setMsg({ text: "Ukuran foto terlalu besar (maks 5 MB).", ok: false }); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const MAX = 800;
        const ratio = Math.min(MAX / img.width, MAX / img.height, 1);
        const canvas = document.createElement("canvas");
        canvas.width  = Math.round(img.width  * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
        setScreenshotData(dataUrl);
        setScreenshotPreview(dataUrl);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => {
    if (!open || !token) return;
    setOrdersLoading(true);
    setSelectedOrder(null);
    setDescription("");
    setScreenshotData(null);
    setScreenshotPreview(null);
    setPurchasePrice("");
    setMsg({ text: "", ok: false });
    setTab("form");

    const t = encodeURIComponent(token);
    Promise.all([
      fetch(`/api/otp/history?token=${t}`).then((r) => r.json()),
      fetch(`/api/warranty/claim?token=${t}`).then((r) => r.json())
    ])
      .then(([hist, claimsData]) => {
        setOrders(Array.isArray(hist.items) ? hist.items : []);
        setClaims(Array.isArray(claimsData.items) ? claimsData.items : []);
      })
      .catch(() => setOrders([]))
      .finally(() => setOrdersLoading(false));
  }, [open, token]);

  if (!open) return null;

  const claimedIds = new Set(claims.map((c) => c.orderId));

  async function submit(e) {
    e.preventDefault();
    if (!selectedOrder) { setMsg({ text: "Pilih nokos terlebih dahulu.", ok: false }); return; }
    if (!description.trim()) { setMsg({ text: "Isi deskripsi masalah.", ok: false }); return; }
    if (!purchasePrice || Number(purchasePrice) <= 0) { setMsg({ text: "Isi harga beli yang valid.", ok: false }); return; }

    setSubmitting(true);
    setMsg({ text: "", ok: false });
    try {
      const res = await fetch("/api/warranty/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          orderId: selectedOrder.orderId,
          description: description.trim(),
          screenshotData: screenshotData || null,
          purchasePrice: Number(purchasePrice)
        })
      });
      const data = await res.json();
      if (!res.ok) { setMsg({ text: data.error || "Gagal mengirim klaim.", ok: false }); return; }
      setMsg({ text: "Klaim garansi berhasil dikirim! Admin akan memproses dalam 1×24 jam.", ok: true });
      setClaims((prev) => [
        { orderId: selectedOrder.orderId, status: "pending", createdAt: new Date() },
        ...prev
      ]);
      setSelectedOrder(null);
      setDescription("");
      setScreenshotData(null);
      setScreenshotPreview(null);
      setPurchasePrice("");
      setTimeout(() => setTab("history"), 1200);
    } finally {
      setSubmitting(false);
    }
  }

  const STATUS_CONFIG = {
    approved: { label: "Disetujui", dot: "bg-teal-bright", cls: "bg-teal-soft text-teal-bright border-teal/30" },
    rejected: { label: "Ditolak", dot: "bg-rose", cls: "bg-rose-soft text-rose border-rose/30" },
    pending: { label: "Menunggu", dot: "bg-amber animate-pulse", cls: "bg-amber-soft text-amber-bright border-amber/30" }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center px-0 sm:px-5">
      <button aria-label="Tutup" onClick={onClose} className="animate-fade-in absolute inset-0" style={{ background: "rgb(var(--c-ink) / 0.5)" }} />
      <div className="animate-scale-in relative w-full max-w-lg overflow-hidden rounded-t-3xl sm:rounded-3xl border border-line bg-bg shadow-lift flex flex-col max-h-[92dvh]">

        {/* Header gradient */}
        <div className="shrink-0 bg-gradient-to-br from-rose to-rose/80 px-5 py-5 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20 text-xl">🛡️</span>
              <div>
                <p className="text-base font-extrabold tracking-tight">Klaim Garansi</p>
                <p className="text-xs opacity-75 mt-0.5">Nomor bermasalah? Ajukan refund saldo</p>
              </div>
            </div>
            <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/15 hover:bg-white/25 transition-colors" aria-label="Tutup">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
            </button>
          </div>
          {/* Tab pills */}
          <div className="mt-4 flex gap-2">
            {[["form", "📝 Ajukan"], ["history", `📋 Riwayat${claims.length ? ` (${claims.length})` : ""}`]].map(([v, l]) => (
              <button key={v} onClick={() => setTab(v)} className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${tab === v ? "bg-white text-rose" : "bg-white/15 text-white/80 hover:bg-white/25"}`}>{l}</button>
            ))}
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-5">
          {tab === "history" ? (
            <div className="space-y-3">
              {claims.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-4xl mb-2">📭</p>
                  <p className="text-sm font-semibold text-ink">Belum ada klaim</p>
                  <p className="text-xs text-muted mt-1">Klaim yang kamu ajukan akan muncul di sini.</p>
                </div>
              ) : claims.map((c) => {
                const cfg = STATUS_CONFIG[c.status] || STATUS_CONFIG.pending;
                return (
                  <div key={c.orderId} className={`rounded-2xl border p-4 ${cfg.cls}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full shrink-0 ${cfg.dot}`} />
                        <span className="text-xs font-black">{cfg.label}</span>
                      </div>
                      <span className="font-mono text-[10px] opacity-70">#{c.orderId?.slice(-10)}</span>
                    </div>
                    {c.adminNote && <p className="mt-2 text-xs opacity-80 bg-white/30 rounded-xl px-3 py-2">💬 {c.adminNote}</p>}
                    <p className="text-[10px] opacity-60 mt-2">{c.createdAt ? new Date(c.createdAt).toLocaleDateString("id-ID", { day:"2-digit", month:"short", year:"numeric" }) : ""}</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-5">
              {/* Info */}
              <div className="flex gap-3 rounded-2xl bg-amber-soft border border-amber/30 p-3.5">
                <span className="text-lg shrink-0">⚠️</span>
                <p className="text-xs text-amber-bright leading-relaxed">Garansi <strong>1x per nokos</strong>. Diproses admin dalam <strong>1×24 jam</strong>. Jika disetujui, saldo dikembalikan otomatis.</p>
              </div>

              {/* Step 1 - Pilih nokos */}
              <div>
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose text-white text-[10px] font-black">1</span>
                  <p className="text-xs font-black text-ink">Pilih nokos yang bermasalah</p>
                </div>
                {ordersLoading ? (
                  <div className="skeleton h-20 rounded-2xl" />
                ) : orders.length === 0 ? (
                  <p className="text-sm text-muted py-3 text-center">Belum ada riwayat nokos.</p>
                ) : (
                  <div className="max-h-44 overflow-y-auto space-y-1.5 rounded-2xl border border-line bg-surface p-2">
                    {orders.map((o) => {
                      const alreadyClaimed = claimedIds.has(o.orderId);
                      const isSelected = selectedOrder?.orderId === o.orderId;
                      return (
                        <button key={o.orderId} type="button" disabled={alreadyClaimed}
                          onClick={() => { setSelectedOrder(o); setPurchasePrice(String(o.price || "")); }}
                          className={`w-full text-left rounded-xl px-3 py-2.5 text-xs transition-all ${
                            alreadyClaimed ? "opacity-40 cursor-not-allowed bg-surface2" :
                            isSelected ? "bg-rose-soft border-2 border-rose/50 text-rose" :
                            "border border-transparent hover:border-rose/20 hover:bg-rose-soft/30 text-ink"
                          }`}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold truncate">{o.serviceName} — {o.countryName}</span>
                            <span className="shrink-0 font-mono text-[10px] text-muted">#{o.orderId?.slice(-8)}</span>
                          </div>
                          <div className="mt-0.5 flex items-center gap-2 text-muted">
                            <span>{o.phoneNumber || "—"}</span>·<span className="font-semibold">{rupiah(o.price)}</span>
                            {alreadyClaimed && <span className="text-rose ml-auto font-bold">✓ Diklaim</span>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Step 2 - Harga beli */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose text-white text-[10px] font-black">2</span>
                  <label className="text-xs font-black text-ink">Harga beli nokos (Rp)</label>
                </div>
                <div className="flex items-center rounded-2xl border border-line bg-surface focus-within:border-rose overflow-hidden">
                  <span className="pl-4 text-sm font-bold text-muted">Rp</span>
                  <input type="number" min="1" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)}
                    placeholder="Contoh: 3000" required
                    className="flex-1 bg-transparent px-3 py-3 text-sm text-ink outline-none tabular-nums" />
                </div>
              </div>

              {/* Step 3 - Deskripsi */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose text-white text-[10px] font-black">3</span>
                  <label className="text-xs font-black text-ink">Detail masalah</label>
                </div>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                  placeholder="Jelaskan masalahnya secara detail. Contoh: Nomor tidak menerima SMS OTP sama sekali setelah ditunggu 15 menit. Layanan: WhatsApp."
                  rows={4} maxLength={1000} required
                  className="w-full rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink outline-none focus:border-rose resize-none leading-relaxed" />
                <p className="text-[10px] text-muted mt-1 text-right">{description.length}/1000</p>
              </div>

              {/* Step 4 - Upload foto bukti */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-surface2 text-muted text-[10px] font-black border border-line">4</span>
                  <label className="text-xs font-black text-ink">Foto bukti <span className="text-muted font-normal">(opsional, maks 5 MB)</span></label>
                </div>
                <input ref={screenshotInputRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => handleScreenshot(e.target.files?.[0])} />
                {screenshotPreview ? (
                  <div className="relative rounded-2xl overflow-hidden border border-rose/30">
                    <img src={screenshotPreview} alt="Preview" className="w-full max-h-40 object-cover" />
                    <button type="button" onClick={() => { setScreenshotData(null); setScreenshotPreview(null); if (screenshotInputRef.current) screenshotInputRef.current.value = ""; }}
                      className="absolute top-2 right-2 rounded-full bg-black/60 text-white w-7 h-7 flex items-center justify-center text-xs font-bold hover:bg-black/80">✕</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => screenshotInputRef.current?.click()}
                    className="w-full rounded-2xl border-2 border-dashed border-rose/30 py-4 text-xs text-muted hover:border-rose/60 hover:text-rose transition-colors flex flex-col items-center gap-1">
                    <span className="text-2xl">📸</span>
                    <span>Tap untuk upload foto bukti</span>
                    <span className="text-[10px] opacity-60">Screenshot pesan gagal / inbox kosong</span>
                  </button>
                )}
              </div>

              {/* Selected summary */}
              {selectedOrder && (
                <div className="rounded-2xl bg-rose-soft border border-rose/20 p-4">
                  <p className="text-xs font-black text-rose mb-2">📋 Ringkasan Klaim</p>
                  <div className="space-y-1.5 text-xs text-rose/80">
                    <div className="flex justify-between"><span>Layanan</span><span className="font-bold">{selectedOrder.serviceName}</span></div>
                    <div className="flex justify-between"><span>Nomor</span><span className="font-mono font-bold">{selectedOrder.phoneNumber || "—"}</span></div>
                    <div className="flex justify-between"><span>Refund jika disetujui</span><span className="font-extrabold text-rose">{rupiah(Number(purchasePrice) || selectedOrder.price)}</span></div>
                  </div>
                </div>
              )}

              {msg.text && (
                <div className={`rounded-2xl border p-3.5 text-xs font-semibold flex items-start gap-2 ${msg.ok ? "bg-teal-soft border-teal/30 text-teal-bright" : "bg-rose-soft border-rose/30 text-rose"}`}>
                  <span>{msg.ok ? "✅" : "❌"}</span>
                  <span>{msg.text}</span>
                </div>
              )}

              <button type="submit" disabled={submitting || !selectedOrder}
                className="w-full rounded-2xl bg-rose py-3.5 text-sm font-extrabold text-white transition-all active:scale-95 disabled:opacity-50"
                style={{ boxShadow: "0 6px 0 0 rgba(180,0,0,0.3)" }}>
                {submitting ? "⏳ Mengirim klaim..." : "🛡️ Kirim Klaim Garansi"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
