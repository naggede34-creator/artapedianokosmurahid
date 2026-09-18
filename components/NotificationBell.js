"use client";

import { useEffect, useRef, useState } from "react";

/* ── accent per type ───────────────────────────────────────── */
const TYPE_META = {
  reward:    { glow: "#f59e0b", bar: "#f59e0b", icon: "⭐", label: "Hadiah"    },
  mission:   { glow: "#14b8a6", bar: "#14b8a6", icon: "🎯", label: "Misi"      },
  challenge: { glow: "#f59e0b", bar: "#f59e0b", icon: "🏆", label: "Tantangan" },
  mystery:   { glow: "#a855f7", bar: "#a855f7", icon: "🎁", label: "Kotak"     },
  system:    { glow: "#64748b", bar: "#334155", icon: "📢", label: "Info"      },
  deposit:   { glow: "#22c55e", bar: "#22c55e", icon: "💰", label: "Deposit"   },
  promo:     { glow: "#f43f5e", bar: "#f43f5e", icon: "🔥", label: "Promo"     },
  otp:       { glow: "#06b6d4", bar: "#06b6d4", icon: "🔑", label: "OTP"       },
  winback:   { glow: "#fb923c", bar: "#fb923c", icon: "🎉", label: "Bonus"     },
};

function getMeta(type) { return TYPE_META[type] || TYPE_META.system; }

function fmtTime(d) {
  const diff = Date.now() - new Date(d).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "baru saja";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} mnt lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  const days = Math.floor(h / 24);
  return days === 1 ? "kemarin" : `${days} hari lalu`;
}

function fmtRp(n) { return "Rp" + Number(n).toLocaleString("id-ID"); }

/* ── OTP notification: large code + copy btn ─────────────── */
function OtpDetail({ n }) {
  const [copied, setCopied] = useState(false);
  const code = n.otpCode || n.code || n.body;
  if (!code) return null;
  function copy() {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <div className="mt-2 flex items-center gap-2 p-2 rounded-xl"
      style={{ background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.25)" }}>
      <span className="flex-1 font-mono text-xl font-black tracking-[0.25em] text-cyan-300 code-reveal">
        {code}
      </span>
      <button onClick={(e) => { e.stopPropagation(); copy(); }}
        className="shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all"
        style={{ background: copied ? "rgba(6,182,212,0.3)" : "rgba(6,182,212,0.15)", color: "#67e8f9" }}>
        {copied ? "✓ Disalin" : "SALIN"}
      </button>
    </div>
  );
}

/* ── Deposit notification: balance breakdown ─────────────── */
function DepositDetail({ n }) {
  if (!n.amount && !n.balanceBefore) return null;
  return (
    <div className="mt-2 rounded-xl overflow-hidden text-[11px]"
      style={{ border: "1px solid rgba(34,197,94,0.2)" }}>
      {n.balanceBefore != null && (
        <div className="flex justify-between px-3 py-1.5"
          style={{ background: "rgba(34,197,94,0.05)" }}>
          <span style={{ color: "#6b7280" }}>Sebelum</span>
          <span style={{ color: "#9ca3af" }}>{fmtRp(n.balanceBefore)}</span>
        </div>
      )}
      {n.amount > 0 && (
        <div className="flex justify-between px-3 py-1.5"
          style={{ background: "rgba(34,197,94,0.1)" }}>
          <span style={{ color: "#6ee7b7" }}>+ Deposit</span>
          <span className="font-black" style={{ color: "#4ade80" }}>+{fmtRp(n.amount)}</span>
        </div>
      )}
      {n.balanceAfter != null && (
        <div className="flex justify-between px-3 py-1.5"
          style={{ background: "rgba(34,197,94,0.07)" }}>
          <span style={{ color: "#6ee7b7" }}>Saldo Baru</span>
          <span className="font-bold" style={{ color: "#86efac" }}>{fmtRp(n.balanceAfter)}</span>
        </div>
      )}
    </div>
  );
}

/* ── Promo notification: price list ─────────────────────── */
function PromoDetail({ n }) {
  const prices = n.prices || n.promoList;
  if (!prices || !prices.length) return null;
  return (
    <div className="mt-2 space-y-1">
      {prices.map((p, i) => (
        <div key={i} className="flex items-center justify-between px-2 py-1 rounded-lg text-[10px]"
          style={{ background: "rgba(244,63,94,0.06)", border: "1px solid rgba(244,63,94,0.12)" }}>
          <span style={{ color: "#9ca3af" }}>{p.name}</span>
          <div className="flex items-center gap-2">
            {p.oldPrice && (
              <span style={{ color: "#6b7280", textDecoration: "line-through" }}>{fmtRp(p.oldPrice)}</span>
            )}
            <span className="font-bold" style={{ color: "#fb7185" }}>{fmtRp(p.price)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Winback notification: glow bonus badge ──────────────── */
function WinbackDetail({ n }) {
  if (!n.amount) return null;
  return (
    <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-xl"
      style={{ background: "rgba(251,146,60,0.1)", border: "1px solid rgba(251,146,60,0.25)" }}>
      <span className="text-xl">🎁</span>
      <div>
        <p className="text-[10px] font-bold" style={{ color: "#fdba74" }}>Bonus Kembali</p>
        <p className="font-black text-sm" style={{ color: "#fb923c" }}>+{fmtRp(n.amount)}</p>
      </div>
    </div>
  );
}

/* ── Single notification card ────────────────────────────── */
function NotifCard({ n, onMark }) {
  const meta = getMeta(n.type);
  const isUnread = !n.read;

  return (
    <button onClick={() => onMark(n.id)}
      className="group w-full text-left transition-all duration-200"
      style={{
        background: isUnread ? "rgba(255,255,255,0.03)" : "transparent",
        borderBottom: "1px solid rgba(30,45,61,0.8)",
      }}>

      {/* Left accent bar + content */}
      <div className="flex gap-3 px-4 py-3.5 relative"
        style={{ borderLeft: `4px solid ${isUnread ? meta.bar : "transparent"}` }}>

        {/* Icon bubble */}
        <div className="shrink-0 relative mt-0.5">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg"
            style={{
              background: `${meta.glow}18`,
              border: `2px solid ${meta.glow}30`,
              boxShadow: isUnread ? `0 0 12px ${meta.glow}30` : "none",
            }}>
            {n.icon || meta.icon}
          </div>
          {isUnread && (
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2"
              style={{ background: meta.glow, borderColor: "#06080f", animation: "manga-pulse 2s ease-in-out infinite" }} />
          )}
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{ background: `${meta.glow}20`, color: meta.glow }}>
              {meta.label}
            </span>
            <span className="text-[10px] shrink-0" style={{ color: "#4b5563" }}>{fmtTime(n.createdAt)}</span>
          </div>

          <p className={`text-[13px] leading-snug ${isUnread ? "font-bold" : "font-medium"}`}
            style={{ color: isUnread ? "#e5e7eb" : "#9ca3af" }}>
            {n.title}
          </p>

          {/* Generic body (if no special detail) */}
          {n.body && n.type !== "otp" && (
            <p className="text-xs mt-0.5 leading-relaxed line-clamp-2" style={{ color: "#6b7280" }}>{n.body}</p>
          )}

          {/* Type-specific detail panels */}
          {n.type === "otp" && <OtpDetail n={n} />}
          {n.type === "deposit" && <DepositDetail n={n} />}
          {n.type === "promo" && <PromoDetail n={n} />}
          {n.type === "winback" && <WinbackDetail n={n} />}
          {(n.type === "reward" || n.type === "mission" || n.type === "challenge") && n.amount && (
            <div className="mt-1.5 inline-flex items-center gap-1 text-xs font-black px-2 py-0.5 rounded-full"
              style={{ background: `${meta.glow}15`, color: meta.glow }}>
              {n.amount > 0 ? "+" : ""}{n.unit === "poin" ? `${n.amount} poin` : fmtRp(n.amount)}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

/* ── Main component ──────────────────────────────────────── */
export default function NotificationBell({ token }) {
  const [open, setOpen]     = useState(false);
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("all");
  const ref     = useRef(null);
  const bellRef = useRef(null);

  function load() {
    if (!token) return;
    setLoading(true);
    fetch(`/api/notifications?token=${token}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [token]);

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  async function markAll() {
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "read_all", token }),
    });
    load();
  }

  async function markOne(id) {
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "read", id, token }),
    });
    load();
  }

  const unread   = data?.unread || 0;
  const items    = data?.items  || [];
  const filtered = filter === "all" ? items : items.filter((n) => n.type === filter);
  const types    = [...new Set(items.map((n) => n.type).filter(Boolean))];

  return (
    <div className="relative" ref={ref}>
      {/* ── Bell button ── */}
      <button ref={bellRef}
        onClick={() => { setOpen((v) => !v); if (!open) load(); }}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl transition-all press"
        style={{
          border: open ? "2px solid rgba(245,158,11,0.6)" : "2px solid rgba(30,45,61,0.8)",
          background: open ? "rgba(245,158,11,0.1)" : "rgba(8,14,24,0.8)",
          boxShadow: open ? "0 0 16px rgba(245,158,11,0.25)" : "none",
          color: open ? "#fbbf24" : "#64748b",
        }}
        aria-label="Notifikasi">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
          style={unread > 0 ? { animation: "wiggle 3s ease-in-out infinite" } : {}}>
          <path d="M12 3.5c-3 0-5 2.2-5 5.3v3.2c0 .7-.25 1.4-.7 1.95L5 15.6c-.7.85-.1 2.15 1 2.15h12c1.1 0 1.7-1.3 1-2.15l-1.3-1.65a3 3 0 0 1-.7-1.95V8.8c0-3.1-2-5.3-5-5.3Z"
            stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M9.5 19.5a2.5 2.5 0 0 0 5 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex min-w-[18px] h-[18px] px-1 items-center justify-center rounded-full text-[10px] font-extrabold text-white"
            style={{ background: "#f43f5e", boxShadow: "0 0 8px rgba(244,63,94,0.6)" }}>
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {/* ── Dropdown panel ── */}
      {open && (
        <div className="absolute right-0 top-12 z-50 w-[360px] overflow-hidden manga-enter"
          style={{
            maxHeight: "85vh",
            background: "#06080f",
            border: "2px solid #1e2d3d",
            borderRadius: "18px",
            boxShadow: "6px 6px 0 #000, 0 24px 60px rgba(0,0,0,0.8)",
          }}>

          {/* Halftone overlay */}
          <div className="pointer-events-none absolute inset-0 rounded-[18px] overflow-hidden" style={{ zIndex: 0 }}>
            <div style={{
              position: "absolute", inset: 0, opacity: 0.03,
              backgroundImage: "radial-gradient(circle, #ffffff 0.7px, transparent 0.7px)",
              backgroundSize: "8px 8px",
            }} />
          </div>

          <div className="relative" style={{ zIndex: 1 }}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3.5"
              style={{ borderBottom: "1px solid rgba(30,45,61,0.9)" }}>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-[0.2em]"
                  style={{ color: "#f59e0b", letterSpacing: "0.2em" }}>◆ NOTIFIKASI</span>
                {unread > 0 && (
                  <span className="flex h-5 min-w-[20px] px-1.5 items-center justify-center rounded-full text-[10px] font-black"
                    style={{ background: "rgba(244,63,94,0.2)", color: "#fb7185", border: "1px solid rgba(244,63,94,0.3)" }}>
                    {unread}
                  </span>
                )}
              </div>
              {unread > 0 && (
                <button onClick={markAll}
                  className="text-[11px] font-bold hover:underline press"
                  style={{ color: "#f59e0b" }}>
                  Tandai dibaca
                </button>
              )}
            </div>

            {/* Filter chips */}
            {types.length > 1 && (
              <div className="flex gap-1.5 px-3 py-2.5 overflow-x-auto scrollbar-hide"
                style={{ borderBottom: "1px solid rgba(30,45,61,0.9)" }}>
                <button onClick={() => setFilter("all")}
                  className="shrink-0 text-[11px] font-black px-3 py-1 rounded-full transition-all press"
                  style={filter === "all"
                    ? { background: "linear-gradient(135deg,#f59e0b,#d97706)", color: "#0a0a0a" }
                    : { background: "rgba(255,255,255,0.05)", color: "#6b7280", border: "1px solid rgba(255,255,255,0.08)" }}>
                  Semua
                </button>
                {types.map((t) => {
                  const m = getMeta(t);
                  return (
                    <button key={t} onClick={() => setFilter(t)}
                      className="shrink-0 text-[11px] font-black px-3 py-1 rounded-full transition-all press"
                      style={filter === t
                        ? { background: m.glow, color: "#0a0a0a" }
                        : { background: `${m.glow}12`, color: m.glow, border: `1px solid ${m.glow}30` }}>
                      {m.label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* List */}
            <div className="overflow-y-auto" style={{ maxHeight: "60vh" }}>
              {loading && !data ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex gap-3">
                      <div className="w-10 h-10 rounded-2xl shrink-0"
                        style={{ background: "rgba(255,255,255,0.04)", animation: "manga-shimmer 1.5s infinite" }} />
                      <div className="flex-1 space-y-2">
                        <div className="h-2.5 w-16 rounded-full"
                          style={{ background: "rgba(255,255,255,0.04)", animation: "manga-shimmer 1.5s infinite" }} />
                        <div className="h-2.5 w-full rounded-full"
                          style={{ background: "rgba(255,255,255,0.04)", animation: "manga-shimmer 1.5s infinite" }} />
                        <div className="h-2.5 w-3/4 rounded-full"
                          style={{ background: "rgba(255,255,255,0.04)", animation: "manga-shimmer 1.5s infinite" }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                  <div className="text-5xl mb-3 opacity-30">🔔</div>
                  <p className="text-sm font-bold" style={{ color: "#9ca3af" }}>
                    {filter === "all" ? "Belum ada notifikasi" : `Tidak ada "${getMeta(filter).label}"`}
                  </p>
                  <p className="text-xs mt-1" style={{ color: "#4b5563" }}>
                    Notifikasi hadir, mission, promo & update penting akan muncul di sini.
                  </p>
                </div>
              ) : (
                filtered.map((n) => <NotifCard key={n.id} n={n} onMark={markOne} />)
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="px-4 py-2.5 text-center"
                style={{ borderTop: "1px solid rgba(30,45,61,0.9)" }}>
                <p className="text-[11px]" style={{ color: "#374151" }}>
                  {items.length} notifikasi tersimpan
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes wiggle {
          0%, 85%, 100% { transform: rotate(0deg); }
          88% { transform: rotate(-12deg); }
          92% { transform: rotate(12deg); }
          96% { transform: rotate(-8deg); }
          98% { transform: rotate(8deg); }
        }
        @keyframes manga-pulse {
          0%, 100% { opacity: 1; transform: scale(1); box-shadow: 0 0 4px currentColor; }
          50% { opacity: 0.7; transform: scale(1.3); box-shadow: 0 0 8px currentColor; }
        }
        @keyframes manga-shimmer {
          0%   { opacity: 0.04; }
          50%  { opacity: 0.09; }
          100% { opacity: 0.04; }
        }
      `}</style>
    </div>
  );
}
