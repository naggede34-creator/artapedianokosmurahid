"use client";

import { useEffect, useRef, useState } from "react";

function fmtTime(d) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "baru saja";
  if (m < 60) return `${m}m lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}j lalu`;
  return `${Math.floor(h / 24)}h lalu`;
}

export default function NotificationBell({ token }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const ref = useRef(null);

  function load() {
    if (!token) return;
    fetch(`/api/notifications?token=${token}`).then((r) => r.json()).then(setData);
  }

  useEffect(() => { load(); }, [token]);

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

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setOpen((v) => !v); if (!open) load(); }}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-surface text-muted hover:text-ink press"
        aria-label="Notifikasi"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M12 3.5c-3 0-5 2.2-5 5.3v3.2c0 .7-.25 1.4-.7 1.95L5 15.6c-.7.85-.1 2.15 1 2.15h12c1.1 0 1.7-1.3 1-2.15l-1.3-1.65a3 3 0 0 1-.7-1.95V8.8c0-3.1-2-5.3-5-5.3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M9.5 19.5a2.5 2.5 0 0 0 5 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 rounded-2xl border border-line bg-surface shadow-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-line">
            <p className="text-sm font-bold text-ink">Notifikasi</p>
            {unread > 0 && (
              <button onClick={markAll} className="text-xs text-amber-bright font-semibold press">
                Tandai semua dibaca
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {!data ? (
              <div className="p-4 space-y-2">
                {[1,2,3].map((i) => <div key={i} className="skeleton h-12 rounded-lg" />)}
              </div>
            ) : data.items.length === 0 ? (
              <div className="py-10 text-center">
                <div className="text-4xl mb-2">🔔</div>
                <p className="text-sm text-muted">Belum ada notifikasi</p>
              </div>
            ) : (
              data.items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => markOne(n.id)}
                  className={`w-full text-left px-4 py-3 border-b border-line last:border-0 hover:bg-surface2 transition-colors ${!n.read ? "bg-amber-soft/30" : ""}`}
                >
                  <div className="flex items-start gap-2.5">
                    <span className="text-lg shrink-0 mt-0.5">{n.icon || "📢"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-ink">{n.title}</p>
                      <p className="text-xs text-muted mt-0.5 line-clamp-2">{n.body}</p>
                      <p className="text-[10px] text-muted/60 mt-1">{fmtTime(n.createdAt)}</p>
                    </div>
                    {!n.read && <span className="h-2 w-2 rounded-full bg-amber shrink-0 mt-1" />}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
