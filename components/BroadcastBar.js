"use client";

import { useEffect, useState } from "react";

const DISMISSED_KEY = "artapedia_dismissed_broadcasts";

function getDismissed() {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) || "[]");
  } catch {
    return [];
  }
}

function addDismissed(id) {
  try {
    const list = getDismissed();
    if (!list.includes(id)) list.push(id);
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(list.slice(-50)));
  } catch {}
}

export default function BroadcastBar() {
  const [items, setItems] = useState([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/broadcasts/public");
        const data = await res.json();
        if (cancelled) return;
        const dismissed = getDismissed();
        const visible = (Array.isArray(data.items) ? data.items : []).filter((b) => !dismissed.includes(b.id));
        setItems(visible);
      } catch {
        // Diam saja — broadcast bukan fitur kritikal, jangan sampai mengganggu web kalau gagal fetch.
      }
    }

    load();
    const interval = setInterval(load, 60000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (index >= items.length) setIndex(0);
  }, [items, index]);

  if (items.length === 0) return null;
  const current = items[Math.min(index, items.length - 1)];

  function dismiss() {
    addDismissed(current.id);
    setItems((prev) => prev.filter((b) => b.id !== current.id));
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[70] flex justify-center px-4">
      <div className="glow-ring pointer-events-auto animate-scale-in w-full max-w-xl rounded-2xl">
        <div className="glass flex items-start gap-3 rounded-2xl border border-line px-4 py-3 shadow-lift">
          <span className="float-slow flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber to-amber-bright text-base text-white shadow-3d">
            📣
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-bright">Broadcast Admin</p>
            <p className="mt-0.5 whitespace-pre-line break-words text-sm leading-relaxed text-ink">
              {current.message}
            </p>
            {items.length > 1 && (
              <div className="mt-2 flex items-center gap-1.5">
                {items.map((b, i) => (
                  <span
                    key={b.id}
                    className={`h-1.5 w-1.5 rounded-full transition-colors ${
                      i === index ? "bg-amber-bright" : "bg-surface3"
                    }`}
                  />
                ))}
                <button
                  onClick={() => setIndex((i) => (i + 1) % items.length)}
                  className="press ml-1.5 text-[11px] font-medium text-teal-bright"
                >
                  Berikutnya →
                </button>
              </div>
            )}
          </div>
          <button
            onClick={dismiss}
            aria-label="Tutup broadcast"
            className="press flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface2 hover:text-ink"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
