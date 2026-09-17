"use client";

import { useEffect, useRef, useState } from "react";

const TYPE_STYLE = {
  reward:    { border: "border-l-amber",    bg: "bg-amber-soft/40",   icon: "⭐", badge: "bg-amber/20 text-amber-bright",    label: "Hadiah"    },
  mission:   { border: "border-l-teal",     bg: "bg-teal-soft/40",    icon: "🎯", badge: "bg-teal/20 text-teal-bright",      label: "Misi"      },
  challenge: { border: "border-l-amber",    bg: "bg-amber-soft/40",   icon: "🏆", badge: "bg-amber/20 text-amber-bright",    label: "Tantangan" },
  mystery:   { border: "border-l-[#a855f7]",bg: "bg-purple-50/30",   icon: "🎁", badge: "bg-purple-100 text-purple-600",   label: "Kotak"     },
  system:    { border: "border-l-line",     bg: "",                   icon: "📢", badge: "bg-surface2 text-muted",           label: "Info"      },
  deposit:   { border: "border-l-success",  bg: "bg-success/5",       icon: "💰", badge: "bg-success/15 text-success",       label: "Deposit"   },
  promo:     { border: "border-l-rose",     bg: "bg-rose-soft/30",    icon: "🔥", badge: "bg-rose/15 text-rose",             label: "Promo"     },
};

function getStyle(type) {
  return TYPE_STYLE[type] || TYPE_STYLE.system;
}

function fmtTime(d) {
  const diff = Date.now() - new Date(d).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "baru saja";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} menit lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  const days = Math.floor(h / 24);
  if (days === 1) return "kemarin";
  return `${days} hari lalu`;
}

function NotifItem({ n, onMark }) {
  const style = getStyle(n.type);
  return (
    <button
      onClick={() => onMark(n.id)}
      className={`group w-full text-left border-b border-line last:border-0 transition-all hover:bg-surface2
        ${!n.read ? `${style.bg} border-l-4 ${style.border}` : "border-l-4 border-l-transparent"}`}
    >
      <div className="flex items-start gap-3 px-4 py-3.5">
        {/* Icon bubble */}
        <div className={`relative shrink-0 flex h-9 w-9 items-center justify-center rounded-xl text-lg
          ${!n.read ? "bg-surface shadow-sm" : "bg-surface2"}`}>
          {n.icon || style.icon}
          {!n.read && (
            <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-amber border-2 border-surface" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${style.badge}`}>
              {style.label}
            </span>
            <span className="text-[10px] text-muted/70 ml-auto shrink-0">{fmtTime(n.createdAt)}</span>
          </div>
          <p className={`text-xs leading-snug ${!n.read ? "font-semibold text-ink" : "font-medium text-ink/80"}`}>
            {n.title}
          </p>
          {n.body && (
            <p className="text-xs text-muted mt-0.5 line-clamp-2 leading-relaxed">{n.body}</p>
          )}
          {n.amount && (
            <div className={`mt-1.5 inline-flex items-center gap-1 text-xs font-bold rounded-lg px-2 py-0.5
              ${n.amount > 0 ? "bg-success/10 text-success" : "bg-rose/10 text-rose"}`}>
              {n.amount > 0 ? "+" : ""}
              {n.type === "mission" || n.type === "challenge" || n.type === "mystery"
                ? n.unit === "poin" ? `${n.amount} poin` : `Rp${Number(n.amount).toLocaleString("id-ID")}`
                : `Rp${Number(n.amount).toLocaleString("id-ID")}`}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

export default function NotificationBell({ token }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("all");
  const ref = useRef(null);
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

  const unread = data?.unread || 0;
  const items = data?.items || [];
  const filtered = filter === "all" ? items : items.filter((n) => n.type === filter);
  const types = [...new Set(items.map((n) => n.type).filter(Boolean))];

  return (
    <div className="relative" ref={ref}>
      {/* Bell Button */}
      <button
        ref={bellRef}
        onClick={() => { setOpen((v) => !v); if (!open) load(); }}
        className={`relative flex h-9 w-9 items-center justify-center rounded-xl border transition-all press
          ${open ? "border-amber/60 bg-amber-soft text-amber-bright" : "border-line bg-surface text-muted hover:text-ink"}`}
        aria-label="Notifikasi"
      >
        <svg
          width="18" height="18" viewBox="0 0 24 24" fill="none"
          className={unread > 0 ? "animate-[wiggle_2s_ease-in-out_infinite]" : ""}
          style={unread > 0 ? { animation: "wiggle 3s ease-in-out infinite" } : {}}
        >
          <path d="M12 3.5c-3 0-5 2.2-5 5.3v3.2c0 .7-.25 1.4-.7 1.95L5 15.6c-.7.85-.1 2.15 1 2.15h12c1.1 0 1.7-1.3 1-2.15l-1.3-1.65a3 3 0 0 1-.7-1.95V8.8c0-3.1-2-5.3-5-5.3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M9.5 19.5a2.5 2.5 0 0 0 5 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex min-w-[18px] h-[18px] px-1 items-center justify-center rounded-full bg-rose text-[10px] font-extrabold text-white shadow-sm">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div className="absolute right-0 top-12 z-50 w-[340px] rounded-2xl border border-line bg-surface shadow-2xl overflow-hidden"
          style={{ maxHeight: "85vh" }}>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-line bg-surface">
            <div className="flex items-center gap-2">
              <span className="text-base font-extrabold text-ink">Notifikasi</span>
              {unread > 0 && (
                <span className="flex h-5 min-w-[20px] px-1.5 items-center justify-center rounded-full bg-rose text-[10px] font-bold text-white">
                  {unread}
                </span>
              )}
            </div>
            {unread > 0 && (
              <button
                onClick={markAll}
                className="text-[11px] text-amber-bright font-semibold hover:underline press"
              >
                Tandai semua dibaca
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          {types.length > 1 && (
            <div className="flex gap-1 px-3 py-2 border-b border-line overflow-x-auto scrollbar-hide bg-surface2/50">
              <button
                onClick={() => setFilter("all")}
                className={`shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-all press
                  ${filter === "all" ? "bg-ink text-bg" : "text-muted hover:text-ink hover:bg-surface"}`}
              >
                Semua
              </button>
              {types.map((t) => {
                const s = getStyle(t);
                return (
                  <button
                    key={t}
                    onClick={() => setFilter(t)}
                    className={`shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-all press
                      ${filter === t ? `${s.badge}` : "text-muted hover:text-ink hover:bg-surface"}`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* List */}
          <div className="overflow-y-auto" style={{ maxHeight: "65vh" }}>
            {loading && !data ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-3">
                    <div className="skeleton h-9 w-9 rounded-xl shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="skeleton h-3 w-16 rounded" />
                      <div className="skeleton h-3 w-full rounded" />
                      <div className="skeleton h-3 w-3/4 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
                <div className="text-5xl mb-3 opacity-40">🔔</div>
                <p className="text-sm font-semibold text-ink">
                  {filter === "all" ? "Belum ada notifikasi" : `Tidak ada notifikasi "${getStyle(filter).label}"`}
                </p>
                <p className="text-xs text-muted mt-1">
                  Kamu akan dapat notifikasi saat ada hadiah, misi selesai, atau update penting.
                </p>
              </div>
            ) : (
              filtered.map((n) => <NotifItem key={n.id} n={n} onMark={markOne} />)
            )}
          </div>

          {/* Footer */}
          {items.length > 0 && (
            <div className="px-4 py-2.5 border-t border-line bg-surface2/50 text-center">
              <p className="text-[11px] text-muted">{items.length} notifikasi tersimpan</p>
            </div>
          )}
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
      `}</style>
    </div>
  );
}
