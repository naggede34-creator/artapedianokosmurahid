"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useUser } from "@/app/providers";
import SimCard from "@/components/SimCard";
import AccountInfoModal from "@/components/AccountInfoModal";
import SpinWheelGame from "@/components/SpinWheelGame";
import OTPPriceWidget from "@/components/OTPPriceWidget";
import MissionsPanel from "@/components/MissionsPanel";
import WeeklyChallenge from "@/components/WeeklyChallenge";
import FlashSaleTimer from "@/components/FlashSaleTimer";
import LuckyHourBanner from "@/components/LuckyHourBanner";
import LevelUpModal from "@/components/LevelUpModal";
import OnboardingTour, { useShouldShowTour } from "@/components/OnboardingTour";
import NamePromptModal from "@/components/NamePromptModal";
import WinbackBanner from "@/components/WinbackBanner";
import AnimeHero from "@/components/AnimeHero";
import MangaWaifu from "@/components/MangaWaifu";
import { Icon, rupiah, EmptyState } from "@/components/ui";

function greeting() {
  const h = Number(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta", hour: "numeric", hour12: false }));
  if (h < 11) return "Selamat pagi";
  if (h < 15) return "Selamat siang";
  if (h < 18) return "Selamat sore";
  return "Selamat malam";
}

function Bars({ data, keyName, className }) {
  const max = Math.max(1, ...data.map((d) => d[keyName]));
  return (
    <div className="flex h-28 items-end gap-[3px]" role="img" aria-label={`Grafik ${keyName} 30 hari`}>
      {data.map((d) => (
        <span
          key={d.date}
          title={`${d.date}: ${keyName === "total" ? d[keyName] : rupiah(d[keyName])}`}
          className={`flex-1 rounded-t-[3px] ${d[keyName] > 0 ? className : "bg-surface2"}`}
          style={{ height: `${Math.max(4, (d[keyName] / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

const shortcuts = [
  { href: "/otp", label: "Beli nokos", icon: Icon.phone },
  { href: "/deposit", label: "Isi saldo", icon: Icon.qris },
  { href: "/transfer", label: "Transfer", icon: Icon.transfer },
  { href: "/mutasi", label: "Mutasi", icon: Icon.ledger },
  { href: "/misi", label: "Misi & Poin", icon: Icon.star },
  { href: "/referral", label: "Undang teman", icon: Icon.gift },
  { href: "/produk", label: "Toko Produk", icon: Icon.shop, badge: "Baru" },
  { href: "/saldo-gratis", label: "Saldo Gratis", icon: Icon.coin, badge: "Baru" }
];

function WarrantyModal({ open, onClose, token }) {
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [description, setDescription] = useState("");
  const [contactInfo, setContactInfo] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState({ text: "", ok: false });
  const [claims, setClaims] = useState([]);
  const [tab, setTab] = useState("form"); // "form" | "history"

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
    setContactInfo("");
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
      const fullDesc = contactInfo.trim()
        ? `${description.trim()}\n\nKontak/info tambahan: ${contactInfo.trim()}`
        : description.trim();

      const res = await fetch("/api/warranty/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          orderId: selectedOrder.orderId,
          description: fullDesc,
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
      setContactInfo("");
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
      <div className="animate-scale-in relative w-full max-w-lg overflow-hidden rounded-t-3xl sm:rounded-3xl border border-line bg-bg shadow-lift flex flex-col max-h-[92vh]">

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

              {/* Step 4 - Info kontak tambahan (opsional) */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-surface2 text-muted text-[10px] font-black border border-line">4</span>
                  <label className="text-xs font-black text-ink">Info tambahan <span className="text-muted font-normal">(opsional)</span></label>
                </div>
                <input value={contactInfo} onChange={(e) => setContactInfo(e.target.value)}
                  placeholder="Contoh: Telegram @username, atau bukti pendukung lainnya (link/teks)"
                  className="w-full rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink outline-none focus:border-rose" />
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

export default function DashboardPage() {
  const { token, name, balance, joinedAt, ready } = useUser();
  const [showTour, hideTour] = useShouldShowTour();
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [stats, setStats] = useState(null);
  const [loyalty, setLoyalty] = useState(null);
  const [board, setBoard] = useState(null);
  const [modal, setModal] = useState(false);
  const [warrantyModal, setWarrantyModal] = useState(false);
  const [checkin, setCheckin] = useState(null);
  const [checkinLoading, setCheckinLoading] = useState(true);
  const [checkinBusy, setCheckinBusy] = useState(false);
  const [balanceTarget, setBalanceTarget] = useState(0);
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetInput, setTargetInput] = useState("");
  const [achievements, setAchievements] = useState(null);
  const [recentOrders, setRecentOrders] = useState(null);
  const [dashboardBanners, setDashboardBanners] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [ticketsLoaded, setTicketsLoaded] = useState(false);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketForm, setTicketForm] = useState({ subject: "", message: "" });
  const [ticketSubmitting, setTicketSubmitting] = useState(false);
  const [ticketMsg, setTicketMsg] = useState("");
  const [expandedTicket, setExpandedTicket] = useState(null);
  const [ticketReply, setTicketReply] = useState("");
  const [ticketReplyLoading, setTicketReplyLoading] = useState(false);
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [apiKeyInfo, setApiKeyInfo] = useState(null);
  const [apiKeyGenerating, setApiKeyGenerating] = useState(false);
  const [newApiKey, setNewApiKey] = useState(null);
  const [apiKeyConfirm, setApiKeyConfirm] = useState(false);

  useEffect(() => {
    if (!token) return;
    const t = encodeURIComponent(token);
    fetch(`/api/user/stats?token=${t}`)
      .then((r) => r.json())
      .then((d) => setStats(d.error ? { daily: [] } : d))
      .catch(() => setStats({ daily: [] }));
    fetch(`/api/loyalty/info?token=${t}`)
      .then((r) => r.json())
      .then((d) => setLoyalty(d.error ? null : d))
      .catch(() => {});
    fetch(`/api/checkin?token=${t}`)
      .then((r) => r.json())
      .then((d) => setCheckin(d.error ? null : d))
      .catch(() => {})
      .finally(() => setCheckinLoading(false));
    fetch(`/api/achievements?token=${t}`)
      .then((r) => r.json())
      .then((d) => setAchievements(d.error ? null : d))
      .catch(() => {});
    fetch(`/api/otp/history?token=${t}&limit=5`)
      .then((r) => r.json())
      .then((d) => setRecentOrders(Array.isArray(d.items) ? d.items.slice(0, 5) : []))
      .catch(() => setRecentOrders([]));
    fetch(`/api/banners/public?placement=dashboard`)
      .then((r) => r.json())
      .then((d) => setDashboardBanners(Array.isArray(d.items) ? d.items : []))
      .catch(() => {});
    fetch(`/api/apikey?token=${t}`)
      .then((r) => r.json())
      .then((d) => setApiKeyInfo(d))
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("artapedia_balance_target");
      if (saved) setBalanceTarget(Number(saved));
    } catch {}
  }, []);

  // Prompt pengisian nama jika belum ada & tour sudah selesai/tidak tampil
  useEffect(() => {
    if (!ready || showTour) return;
    if (name) return;
    try {
      const dismissed = localStorage.getItem("artapedia_name_dismissed");
      if (dismissed && Date.now() - Number(dismissed) < 3 * 24 * 60 * 60 * 1000) return;
    } catch {}
    const t = setTimeout(() => setShowNamePrompt(true), 1500);
    return () => clearTimeout(t);
  }, [ready, name, showTour]);

  async function doCheckin() {
    if (!token || checkinBusy) return;
    setCheckinBusy(true);
    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token })
      });
      const data = await res.json();
      setCheckin(data);
    } catch {
    } finally {
      setCheckinBusy(false);
    }
  }

  function saveTarget() {
    const val = Number(targetInput);
    if (!val || val <= 0) return;
    setBalanceTarget(val);
    try { localStorage.setItem("artapedia_balance_target", String(val)); } catch {}
    setEditingTarget(false);
  }

  async function loadTickets() {
    if (!token || ticketsLoading) return;
    setTicketsLoading(true);
    try {
      const r = await fetch(`/api/support/tickets?token=${encodeURIComponent(token)}`);
      const d = await r.json();
      setTickets(Array.isArray(d.items) ? d.items : []);
      setTicketsLoaded(true);
    } catch {
    } finally {
      setTicketsLoading(false);
    }
  }

  async function submitTicket(e) {
    e.preventDefault();
    if (!token || ticketSubmitting) return;
    setTicketSubmitting(true);
    setTicketMsg("");
    try {
      const r = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, subject: ticketForm.subject, message: ticketForm.message }),
      });
      const d = await r.json();
      if (d.ok) {
        setTicketMsg("Tiket berhasil dibuat! Admin akan merespons segera.");
        setTicketForm({ subject: "", message: "" });
        setShowTicketForm(false);
        loadTickets();
      } else {
        setTicketMsg(d.error || "Gagal membuat tiket.");
      }
    } catch {
      setTicketMsg("Terjadi kesalahan. Coba lagi.");
    } finally {
      setTicketSubmitting(false);
    }
  }

  async function replyTicket(ticketId) {
    if (!token || !ticketReply.trim() || ticketReplyLoading) return;
    setTicketReplyLoading(true);
    try {
      const r = await fetch("/api/support/tickets/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, ticketId, message: ticketReply }),
      });
      const d = await r.json();
      if (d.ok) {
        setTicketReply("");
        loadTickets();
      }
    } catch {
    } finally {
      setTicketReplyLoading(false);
    }
  }

  async function generateApiKey() {
    if (!token || apiKeyGenerating) return;
    setApiKeyGenerating(true);
    setNewApiKey(null);
    try {
      const r = await fetch("/api/apikey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const d = await r.json();
      if (d.ok) {
        setNewApiKey(d.apiKey);
        setApiKeyInfo({ hasKey: true, maskedKey: `${d.apiKey.slice(0, 4)}${"•".repeat(d.apiKey.length - 8)}${d.apiKey.slice(-4)}` });
      }
    } catch {
    } finally {
      setApiKeyGenerating(false);
      setApiKeyConfirm(false);
    }
  }

  useEffect(() => {
    fetch("/api/leaderboard/orders")
      .then((r) => r.json())
      .then((d) => setBoard(d.items || []))
      .catch(() => setBoard([]));
  }, []);

  const hasOrders = useMemo(() => stats?.daily?.some((d) => d.total > 0), [stats]);
  const spend = useMemo(
    () => (stats?.daily || []).reduce((a, d) => ({ masuk: a.masuk + d.masuk, keluar: a.keluar + d.keluar }), { masuk: 0, keluar: 0 }),
    [stats]
  );
  const progress = loyalty?.next ? Math.min(100, Math.round((loyalty.totalSpent / loyalty.next.target) * 100)) : 100;

  return (
    <div className="mx-auto max-w-content px-4 py-6 sm:px-5 sm:py-10">
      <LevelUpModal token={token} onClose={() => {}} />
      {showTour && <OnboardingTour onDone={hideTour} />}
      {showNamePrompt && !showTour && (
        <NamePromptModal onClose={() => setShowNamePrompt(false)} />
      )}

      {/* Anime Hero Banner */}
      <div className="mb-5">
        <AnimeHero />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{greeting()},</p>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
            {ready ? name || "Pelanggan Artapedia" : "…"}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setWarrantyModal(true)}
            className="flex items-center gap-1.5 rounded-xl border border-rose/40 bg-rose-soft px-4 py-2.5 text-sm font-semibold text-rose transition-colors hover:bg-rose/10"
          >
            🛡️ Claim Garansi
          </button>
          <button onClick={() => setModal(true)} className="btn-ghost px-4 py-2.5">
            {name ? "Info akun" : "Atur nama & kode akun"}
          </button>
        </div>
      </div>

      {/* Win-back banner */}
      {ready && token && (
        <div className="mt-4">
          <WinbackBanner />
        </div>
      )}

      {/* Low Balance Alert */}
      {ready && balance !== undefined && balance < 2000 && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-amber/30 bg-amber-soft px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber text-white text-base">⚠️</span>
            <div>
              <p className="text-sm font-bold text-amber-bright">Saldo hampir habis!</p>
              <p className="text-xs text-muted">Saldo kamu kurang dari Rp2.000 — isi sekarang agar bisa terus bertransaksi.</p>
            </div>
          </div>
          <Link href="/deposit" className="shrink-0 rounded-xl bg-amber px-4 py-2 text-xs font-bold text-white">
            Isi Saldo
          </Link>
        </div>
      )}

      {/* ── Manga Waifu AI chat — di atas SimCard/balance ── */}
      {ready && (
        <div className="mt-5">
          <MangaWaifu
            balance={balance}
            hasRecentOrder={Array.isArray(recentOrders) && recentOrders.some(
              (o) => Date.now() - new Date(o.createdAt).getTime() < 24 * 60 * 60 * 1000
            )}
          />
        </div>
      )}

      <div className="mt-3 grid gap-5 lg:grid-cols-[440px_1fr]">
        <SimCard />

        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8 lg:grid-cols-4">
          {shortcuts.map((s) => {
            const I = s.icon;
            return (
              <Link key={s.href} href={s.href} className="card card-3d hover-lift manga-lines relative flex flex-col items-center justify-center gap-2 px-2 py-4 text-center">
                {s.badge && (
                  <span className="absolute -top-1.5 -right-1 rounded-full bg-rose px-1.5 py-0.5 text-[9px] font-black text-white leading-none shadow-sm animate-pulse">
                    {s.badge}
                  </span>
                )}
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl transition-transform group-hover:scale-110 ${s.badge ? "bg-gradient-to-br from-amber to-amber-bright text-white shadow-md" : "bg-amber-soft text-amber-bright"}`}>
                  <I />
                </span>
                <span className="text-xs font-semibold text-ink">{s.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Total transaksi", stats?.totalTransaksi],
          ["OTP berhasil", stats?.otpBerhasil],
          ["Suntik selesai", stats?.smmSelesai],
          ["Deposit sukses", stats?.depositSukses]
        ].map(([label, v]) => (
          <div key={label} className="card p-4">
            <p className="text-2xl font-extrabold tabular-nums text-ink">{stats ? v ?? 0 : "…"}</p>
            <p className="mt-0.5 text-xs text-muted">{label}</p>
          </div>
        ))}
      </div>

      {/* Achievement Badges */}
      {achievements && achievements.items?.length > 0 && (
        <div className="mt-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-ink">🏅 Badge Kamu ({achievements.unlockedCount}/{achievements.total})</h2>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {achievements.items.map((a) => (
              <div
                key={a.id}
                title={a.desc}
                className={`flex shrink-0 flex-col items-center gap-1.5 rounded-2xl border p-3 text-center transition-all w-[84px] ${
                  a.unlocked
                    ? a.tier === "diamond"
                      ? "border-teal/40 bg-teal-soft"
                      : a.tier === "gold"
                      ? "border-amber/40 bg-amber-soft"
                      : a.tier === "silver"
                      ? "border-line bg-surface2"
                      : "border-line bg-surface"
                    : "border-dashed border-line bg-surface opacity-40 grayscale"
                }`}
              >
                <span className="text-2xl">{a.icon}</span>
                <p className="text-[10px] font-bold text-ink leading-tight">{a.name}</p>
                {a.unlocked && (
                  <span className="text-[9px] rounded-full bg-teal-soft px-1.5 py-0.5 font-semibold text-teal-bright">✓ Dapat</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Daily Check-in + Spin Wheel + Balance Target */}
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        {/* Check-in Card */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">🗓️</span>
            <h2 className="text-base font-bold text-ink">Check-in Harian</h2>
          </div>
          {checkinLoading ? (
            <div className="skeleton h-16 rounded-xl" />
          ) : checkin?.alreadyDone ? (
            <div className="text-center">
              <p className="text-3xl font-extrabold text-amber-bright">🔥 {checkin.streak}</p>
              <p className="text-xs text-muted mt-1">hari berturut-turut</p>
              <div className="mt-3 rounded-xl bg-amber-soft px-4 py-2">
                <p className="text-xs font-semibold text-amber-bright">Sudah check-in hari ini ✓</p>
                <p className="text-xs text-muted mt-0.5">Total {checkin.points} poin terkumpul</p>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-sm text-muted mb-1">Streak saat ini: <strong className="text-ink">{checkin?.streak || 0} hari</strong></p>
              <p className="text-xs text-muted mb-3">Check-in tiap hari = bonus poin berlipat!</p>
              <button
                onClick={doCheckin}
                disabled={checkinBusy}
                className="w-full rounded-xl bg-gradient-to-r from-amber to-amber-bright py-2.5 text-sm font-bold text-white shadow-3d disabled:opacity-50"
              >
                {checkinBusy ? "Memproses..." : "✅ Check-in Sekarang"}
              </button>
            </div>
          )}
          {checkin?.alreadyDone === false && checkin?.streak > 0 && (
            <p className="mt-2 text-center text-[11px] text-muted">Kembali besok untuk menjaga streak!</p>
          )}
        </div>

        {/* Spin Wheel */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">🎡</span>
            <h2 className="text-base font-bold text-ink">Putar Roda Keberuntungan</h2>
          </div>
          <SpinWheelGame />
        </div>

        {/* Balance Target */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">🎯</span>
            <h2 className="text-base font-bold text-ink">Target Saldo</h2>
          </div>
          {balanceTarget > 0 ? (
            <div>
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-xs text-muted">Saldo sekarang</span>
                <span className="text-xs font-semibold text-ink">{rupiah(balance || 0)}</span>
              </div>
              <div className="h-3 rounded-full bg-surface2 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-teal to-teal-bright transition-all"
                  style={{ width: `${Math.min(100, Math.round(((balance || 0) / balanceTarget) * 100))}%` }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[11px] text-muted">Rp0</span>
                <span className="text-[11px] font-semibold text-teal-bright">{rupiah(balanceTarget)}</span>
              </div>
              <p className="mt-2 text-xs text-center text-muted">
                {(balance || 0) >= balanceTarget
                  ? "🎉 Target tercapai!"
                  : `Kurang ${rupiah(balanceTarget - (balance || 0))} lagi`}
              </p>
              <button
                onClick={() => { setTargetInput(String(balanceTarget)); setEditingTarget(true); }}
                className="mt-3 w-full text-xs text-muted hover:text-ink"
              >
                Ubah target
              </button>
            </div>
          ) : editingTarget ? (
            <div>
              <p className="text-xs text-muted mb-2">Masukkan target saldo kamu:</p>
              <input
                type="number"
                min="1000"
                value={targetInput}
                onChange={(e) => setTargetInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveTarget()}
                placeholder="Contoh: 50000"
                autoFocus
                className="w-full rounded-xl border border-line bg-surface2 px-3 py-2 text-sm outline-none focus:border-teal"
              />
              <div className="flex gap-2 mt-2">
                <button onClick={saveTarget} className="flex-1 rounded-xl bg-teal-bright py-2 text-xs font-bold text-white">Simpan</button>
                <button onClick={() => setEditingTarget(false)} className="flex-1 rounded-xl border border-line py-2 text-xs text-muted">Batal</button>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-sm text-muted mb-3">Tetapkan target saldo untuk memantau progres tabunganmu.</p>
              <button
                onClick={() => { setTargetInput(""); setEditingTarget(true); }}
                className="rounded-xl border border-teal/30 bg-teal-soft px-5 py-2 text-sm font-semibold text-teal-bright hover:bg-teal/20"
              >
                + Set Target
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Recent Transactions */}
      {recentOrders !== null && (
        <div className="mt-5 card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-ink">🧾 Transaksi Terakhir</h2>
            <Link href="/riwayat" className="text-xs font-semibold text-amber-bright hover:underline">Lihat semua →</Link>
          </div>
          {recentOrders.length === 0 ? (
            <p className="text-sm text-muted py-3 text-center">Belum ada transaksi OTP.</p>
          ) : (
            <div className="space-y-2">
              {recentOrders.map((o) => (
                <div key={o.orderId} className="flex items-center gap-3 rounded-xl border border-line bg-surface2 px-3.5 py-2.5">
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                    o.status === "success" ? "bg-teal-soft text-teal-bright" : o.status === "cancelled" ? "bg-rose-soft text-rose" : "bg-amber-soft text-amber-bright"
                  }`}>
                    {o.status === "success" ? "✓" : o.status === "cancelled" ? "✗" : "⏳"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink truncate">{o.serviceName} — {o.countryName}</p>
                    <p className="text-xs text-muted">{o.phoneNumber || "—"} · #{o.orderId?.slice(-8)}</p>
                  </div>
                  <span className="shrink-0 text-sm font-bold tabular-nums text-teal-bright">{rupiah(o.price)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-5 space-y-3">
        <FlashSaleTimer />
        <LuckyHourBanner />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <MissionsPanel token={token} />
        <WeeklyChallenge token={token} />
      </div>

      <div className="mt-5">
        <OTPPriceWidget />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="card p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-bold text-ink">Pesanan 30 hari</h2>
            <span className="text-xs text-muted">nokos + suntik</span>
          </div>
          {!stats ? (
            <div className="skeleton mt-4 h-28 rounded-xl" />
          ) : hasOrders ? (
            <div className="mt-4">
              <Bars data={stats.daily} keyName="total" className="bg-amber" />
            </div>
          ) : (
            <EmptyState icon="📈" title="Belum ada pesanan bulan ini" />
          )}
        </div>

        <div className="card p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-bold text-ink">Arus saldo 30 hari</h2>
            <span className="text-xs">
              <span className="font-semibold text-success">+{rupiah(spend.masuk)}</span>
              <span className="text-muted"> / </span>
              <span className="font-semibold text-rose">−{rupiah(spend.keluar)}</span>
            </span>
          </div>
          {!stats ? (
            <div className="skeleton mt-4 h-28 rounded-xl" />
          ) : spend.masuk + spend.keluar > 0 ? (
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <Bars data={stats.daily} keyName="masuk" className="bg-success" />
                <p className="mt-1.5 text-center text-[11px] text-muted">Masuk</p>
              </div>
              <div>
                <Bars data={stats.daily} keyName="keluar" className="bg-rose" />
                <p className="mt-1.5 text-center text-[11px] text-muted">Keluar</p>
              </div>
            </div>
          ) : (
            <EmptyState icon="💼" title="Belum ada pergerakan saldo" />
          )}
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <Link href="/loyalitas" className="card hover-lift block p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-ink">Level & poin</h2>
            <span className="text-2xl" aria-hidden="true">
              {loyalty?.badge?.icon || "🥉"}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted">
            Level <span className="font-bold text-ink">{loyalty?.badge?.name || "Bronze"}</span> ·{" "}
            <span className="font-bold tabular-nums text-ink">{Number(loyalty?.points || 0).toLocaleString("id-ID")}</span> poin
          </p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface2">
            <div className="h-full rounded-full bg-amber" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted">
            {loyalty?.next
              ? `Belanja ${rupiah(loyalty.next.remaining)} lagi untuk naik ke ${loyalty.next.name}.`
              : "Kamu sudah di level tertinggi."}
          </p>
        </Link>

        <div className="card p-5">
          <h2 className="text-base font-bold text-ink">10 pembeli teraktif</h2>
          <ol className="mt-3 divide-y divide-line">
            {board === null ? (
              Array.from({ length: 3 }).map((_, i) => <li key={i} className="skeleton my-2 h-9 rounded-lg" />)
            ) : board.length === 0 ? (
              <li className="py-4 text-sm text-muted">Belum ada data.</li>
            ) : (
              board.map((u) => (
                <li key={u.rank} className="flex items-center gap-3 py-2">
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-extrabold ${
                      u.rank === 1 ? "bg-amber text-white" : u.rank <= 3 ? "bg-teal-bright text-white" : "bg-surface2 text-muted"
                    }`}
                  >
                    {u.rank}
                  </span>
                  <span className="flex-1 font-mono text-sm text-ink">{u.token}</span>
                  <span className="text-xs font-semibold tabular-nums text-muted">{u.successCount} sukses</span>
                </li>
              ))
            )}
          </ol>
        </div>
      </div>

      {/* Dashboard Banners */}
      {dashboardBanners.length > 0 && (
        <div className="mt-5 flex gap-3 overflow-x-auto pb-1 scrollbar-none">
          {dashboardBanners.map((b) => (
            b.linkUrl ? (
              <a key={b._id} href={b.linkUrl} target="_blank" rel="noopener noreferrer"
                className="shrink-0 rounded-2xl overflow-hidden border border-line hover:border-rose/40 transition-all">
                <img src={b.imageUrl} alt={b.title || "Banner"} className="h-20 w-auto max-w-xs object-cover" />
              </a>
            ) : (
              <div key={b._id} className="shrink-0 rounded-2xl overflow-hidden border border-line">
                <img src={b.imageUrl} alt={b.title || "Banner"} className="h-20 w-auto max-w-xs object-cover" />
              </div>
            )
          ))}
        </div>
      )}

      {/* API Key Section */}
      <div className="mt-5 card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-ink">🔑 API Key Developer</h2>
            <p className="text-xs text-muted mt-0.5">Akses programatik ke akun kamu</p>
          </div>
          <Link href="/api-docs" className="text-xs text-rose font-semibold hover:underline">Docs →</Link>
        </div>
        {apiKeyInfo === null ? (
          <div className="skeleton h-10 rounded-xl" />
        ) : apiKeyInfo.hasKey ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-xl bg-surface2 border border-line px-4 py-3">
              <span className="font-mono text-sm text-ink flex-1 tracking-wider">{apiKeyInfo.maskedKey}</span>
              <span className="text-xs text-success font-semibold">Aktif</span>
            </div>
            {newApiKey && (
              <div className="rounded-xl bg-teal-soft border border-teal/30 p-3">
                <p className="text-xs text-teal-bright font-bold mb-1.5">⚠️ Simpan API key ini sekarang — tidak akan ditampilkan lagi!</p>
                <p className="font-mono text-xs text-ink bg-surface rounded-lg px-3 py-2 border border-line break-all select-all">{newApiKey}</p>
              </div>
            )}
            {apiKeyConfirm ? (
              <div className="rounded-xl bg-amber-soft border border-amber/30 p-3">
                <p className="text-xs text-amber-bright font-semibold mb-2">API key lama akan tidak berlaku. Lanjutkan?</p>
                <div className="flex gap-2">
                  <button onClick={generateApiKey} disabled={apiKeyGenerating}
                    className="flex-1 rounded-lg bg-rose py-2 text-xs font-bold text-white disabled:opacity-50">
                    {apiKeyGenerating ? "⏳ Generating..." : "Ya, Generate Ulang"}
                  </button>
                  <button onClick={() => setApiKeyConfirm(false)}
                    className="flex-1 rounded-lg border border-line py-2 text-xs font-bold text-ink">
                    Batal
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setApiKeyConfirm(true)}
                className="w-full rounded-xl border border-line py-2.5 text-xs font-bold text-muted hover:text-ink hover:border-rose/40 transition-all">
                🔄 Generate Ulang API Key
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted">Kamu belum memiliki API key. Generate sekarang untuk mulai integrasi.</p>
            <button onClick={generateApiKey} disabled={apiKeyGenerating}
              className="w-full rounded-xl bg-rose py-3 text-sm font-bold text-white disabled:opacity-50 transition-all active:scale-95"
              style={{ boxShadow: "0 4px 0 0 rgba(180,0,0,0.25)" }}>
              {apiKeyGenerating ? "⏳ Generating..." : "🔑 Generate API Key"}
            </button>
          </div>
        )}
      </div>

      {/* Support Tickets */}
      <div className="mt-5 card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-ink">🎫 Tiket Support</h2>
            <p className="text-xs text-muted mt-0.5">Butuh bantuan? Hubungi tim kami</p>
          </div>
          <button onClick={() => { setShowTicketForm((v) => !v); if (!ticketsLoaded) loadTickets(); }}
            className="text-xs font-bold text-white bg-rose rounded-lg px-3 py-1.5 active:scale-95 transition-all">
            + Buat Tiket
          </button>
        </div>

        {showTicketForm && (
          <form onSubmit={submitTicket} className="mb-4 space-y-3 rounded-2xl bg-surface2 border border-line p-4">
            <h3 className="text-sm font-black text-ink">Buat Tiket Baru</h3>
            <input value={ticketForm.subject} onChange={(e) => setTicketForm((f) => ({ ...f, subject: e.target.value }))}
              placeholder="Subjek / judul masalah" required maxLength={200}
              className="w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-sm text-ink outline-none focus:border-rose" />
            <textarea value={ticketForm.message} onChange={(e) => setTicketForm((f) => ({ ...f, message: e.target.value }))}
              placeholder="Jelaskan masalah kamu secara detail..." rows={4} required maxLength={2000}
              className="w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-sm text-ink outline-none focus:border-rose resize-none" />
            {ticketMsg && (
              <p className={`text-xs font-semibold ${ticketMsg.includes("berhasil") ? "text-teal-bright" : "text-rose"}`}>{ticketMsg}</p>
            )}
            <div className="flex gap-2">
              <button type="submit" disabled={ticketSubmitting}
                className="flex-1 rounded-xl bg-rose py-2.5 text-sm font-bold text-white disabled:opacity-50 active:scale-95 transition-all">
                {ticketSubmitting ? "⏳ Mengirim..." : "Kirim Tiket"}
              </button>
              <button type="button" onClick={() => setShowTicketForm(false)}
                className="rounded-xl border border-line px-4 py-2.5 text-sm font-bold text-ink hover:bg-surface2 transition-all">
                Batal
              </button>
            </div>
          </form>
        )}

        {!ticketsLoaded ? (
          <button onClick={loadTickets} disabled={ticketsLoading}
            className="w-full rounded-xl border border-line py-3 text-sm text-muted hover:text-ink hover:border-rose/40 transition-all">
            {ticketsLoading ? "⏳ Memuat tiket..." : "📋 Lihat riwayat tiket saya"}
          </button>
        ) : tickets.length === 0 ? (
          <p className="text-sm text-muted text-center py-4">Belum ada tiket. Buat tiket jika ada pertanyaan atau masalah.</p>
        ) : (
          <div className="space-y-3">
            {tickets.map((t) => {
              const statusColor = t.status === "open" ? "text-amber-bright bg-amber-soft border-amber/30"
                : t.status === "answered" ? "text-teal-bright bg-teal-soft border-teal/30"
                : "text-muted bg-surface2 border-line";
              const isExpanded = expandedTicket === t.ticketId;
              return (
                <div key={t.ticketId} className="rounded-2xl border border-line overflow-hidden">
                  <button onClick={() => setExpandedTicket(isExpanded ? null : t.ticketId)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface2 transition-all">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusColor} shrink-0 uppercase`}>
                          {t.status === "open" ? "Terbuka" : t.status === "answered" ? "Dijawab" : "Ditutup"}
                        </span>
                        <span className="font-semibold text-sm text-ink truncate">{t.subject}</span>
                      </div>
                      <p className="text-[11px] text-muted mt-0.5">{t.messageCount} pesan · {new Date(t.updatedAt).toLocaleDateString("id-ID")}</p>
                    </div>
                    <span className="text-muted text-lg shrink-0">{isExpanded ? "▲" : "▼"}</span>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-line bg-surface2 p-4 space-y-3">
                      <div className="max-h-64 overflow-y-auto space-y-2">
                        {(t.messages || []).map((m, i) => (
                          <div key={i} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
                            <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs ${
                              m.from === "user"
                                ? "bg-rose text-white rounded-br-sm"
                                : "bg-surface border border-line text-ink rounded-bl-sm"
                            }`}>
                              <p className="leading-relaxed">{m.text}</p>
                              <p className={`text-[10px] mt-1 ${m.from === "user" ? "text-white/60" : "text-muted"}`}>
                                {m.from === "user" ? "Kamu" : "Admin"} · {new Date(m.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                      {t.status !== "closed" && (
                        <div className="flex gap-2">
                          <input value={ticketReply} onChange={(e) => setTicketReply(e.target.value)}
                            placeholder="Tulis balasan..." maxLength={2000}
                            className="flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-xs text-ink outline-none focus:border-rose"
                            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); replyTicket(t.ticketId); } }} />
                          <button onClick={() => replyTicket(t.ticketId)} disabled={ticketReplyLoading || !ticketReply.trim()}
                            className="rounded-xl bg-rose px-4 py-2 text-xs font-bold text-white disabled:opacity-50 active:scale-95 transition-all">
                            Kirim
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AccountInfoModal open={modal} onClose={() => setModal(false)} token={token} balance={balance} joinedAt={joinedAt} />
      <WarrantyModal open={warrantyModal} onClose={() => setWarrantyModal(false)} token={token} />
    </div>
  );
}
