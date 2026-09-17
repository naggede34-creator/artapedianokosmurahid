"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const LAST_SEEN_ID_KEY = "artapedia_info_last_id";

export default function InfoBell() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const boxRef = useRef(null);

  useEffect(() => {
    fetch("/api/announcements/public")
      .then((r) => r.json())
      .then((d) => {
        const list = Array.isArray(d.items) ? d.items.slice(0, 5) : [];
        setItems(list);
        const newest = list[0];
        const lastSeenId = localStorage.getItem(LAST_SEEN_ID_KEY);
        if (newest?.id && lastSeenId !== String(newest.id)) {
          setUnread(list.length);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    function onClickOutside(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function toggle() {
    setOpen((v) => !v);
    if (!open) {
      setUnread(0);
      if (items[0]?.id) localStorage.setItem(LAST_SEEN_ID_KEY, String(items[0].id));
    }
  }

  return (
    <div ref={boxRef} className="relative">
      <button
        onClick={toggle}
        aria-label="Info terbaru"
        className="press relative flex h-9 w-9 items-center justify-center rounded-lg text-ink transition-colors hover:bg-surface2"
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 3.5c-3 0-5 2.2-5 5.3v3.2c0 .7-.25 1.4-.7 1.95L5 15.6c-.7.85-.1 2.15 1 2.15h12c1.1 0 1.7-1.3 1-2.15l-1.3-1.65a3 3 0 0 1-.7-1.95V8.8c0-3.1-2-5.3-5-5.3Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <path d="M9.5 19.5a2.5 2.5 0 0 0 5 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-2 w-2 rounded-full bg-rose">
            <span className="signal-pulse absolute inline-flex h-full w-full rounded-full bg-rose" />
          </span>
        )}
      </button>

      {open && (
        <div className="expand-down absolute right-0 top-11 z-[65] w-[300px] overflow-hidden rounded-2xl border border-line bg-surface shadow-lift">
          <div className="flex items-center justify-between border-b border-line bg-surface2 px-4 py-2.5">
            <p className="text-xs font-semibold text-muted">Info Terbaru</p>
            <Link href="/informasi" onClick={() => setOpen(false)} className="text-[11px] font-medium text-amber-bright">
              Lihat semua
            </Link>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-muted">Belum ada info terbaru.</p>
            ) : (
              items.map((a) => (
                <Link
                  key={a.id}
                  href="/informasi"
                  onClick={() => setOpen(false)}
                  className="flex items-start gap-2.5 border-b border-line px-4 py-3 last:border-0 hover:bg-surface2"
                >
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-amber-soft text-sm">
                    {a.icon}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-ink">{a.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted">{a.body}</p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
