"use client";

import { useEffect, useState } from "react";

function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "baru saja";
  if (min < 60) return `${min} menit lalu`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} jam lalu`;
  return `${Math.floor(hr / 24)} hari lalu`;
}

export default function TransactionTicker() {
  const [items, setItems] = useState([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/activity/ticker");
        const data = await res.json();
        if (cancelled) return;
        setItems(Array.isArray(data.items) ? data.items : []);
      } catch {
        // Diam saja — bukan fitur kritikal.
      }
    }

    load();
    const refreshInterval = setInterval(load, 60000);
    return () => {
      cancelled = true;
      clearInterval(refreshInterval);
    };
  }, []);

  useEffect(() => {
    if (items.length < 2) return;
    const rotateInterval = setInterval(() => {
      setIndex((i) => (i + 1) % items.length);
    }, 3800);
    return () => clearInterval(rotateInterval);
  }, [items.length]);

  useEffect(() => {
    if (index >= items.length) setIndex(0);
  }, [items, index]);

  if (items.length === 0) return null;
  const current = items[Math.min(index, items.length - 1)];

  return (
    <div className="mt-5 flex items-center gap-2.5 overflow-hidden rounded-full border border-line bg-surface px-4 py-2.5" aria-live="polite">
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
      </span>
      <p key={`${current.token}-${current.createdAt}`} className="animate-fade-in min-w-0 flex-1 truncate text-xs text-ink sm:text-sm">
        <code className="font-mono font-semibold text-amber-bright">{current.token}</code>{" "}
        {current.kind === "smm" ? "memesan suntik" : "berhasil dapat kode"}{" "}
        <span className="font-semibold">{current.serviceName}</span>
        {current.countryName ? ` · ${current.countryName}` : ""} <span className="text-muted">· {timeAgo(current.createdAt)}</span>
      </p>
    </div>
  );
}
