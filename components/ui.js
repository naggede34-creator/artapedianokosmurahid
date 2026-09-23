"use client";

import { useState } from "react";

export function rupiah(n) {
  return `Rp${Math.round(Number(n) || 0).toLocaleString("id-ID")}`;
}

export function fmtWIB(d, { withSeconds = false, dateOnly = false } = {}) {
  if (!d) return "-";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "-";
  const opts = { timeZone: "Asia/Jakarta", day: "2-digit", month: "short", year: "numeric" };
  if (!dateOnly) {
    opts.hour = "2-digit";
    opts.minute = "2-digit";
    if (withSeconds) opts.second = "2-digit";
  }
  return date.toLocaleString("id-ID", opts) + (dateOnly ? "" : " WIB");
}

export function timeAgo(d) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "baru saja";
  if (m < 60) return `${m} menit lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  const days = Math.floor(h / 24);
  return days < 30 ? `${days} hari lalu` : fmtWIB(d, { dateOnly: true });
}

export function PageHeader({ title, desc, action, icon }) {
  return (
    <div className="manga-head fade-up flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-xl">
        <div className="flex items-center gap-3">
          {icon && (
            <span className="comic-badge flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-soft text-amber-bright">
              {icon}
            </span>
          )}
          <h1 className="comic-head anim-underline text-[26px] leading-tight text-ink sm:text-[32px]">{title}</h1>
        </div>
        {desc && <p className="mt-2 text-sm leading-relaxed text-muted">{desc}</p>}
      </div>
      {action}
    </div>
  );
}

const TONES = {
  blue: "bg-amber-soft text-amber-bright",
  green: "bg-success-soft text-success",
  red: "bg-rose-soft text-rose",
  amber: "bg-warn-soft text-warn",
  gray: "bg-surface2 text-muted",
  navy: "bg-teal-soft text-teal"
};

export function Badge({ tone = "gray", children, pulse = false, className = "" }) {
  return (
    <span className={`chip ${TONES[tone] || TONES.gray} ${className}`}>
      {pulse && <span className="signal-pulse h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function statusTone(status) {
  const s = String(status || "").toLowerCase();
  if (["completed", "done", "received", "success"].includes(s)) return "green";
  if (["pending", "processing", "in_progress", "submitting"].includes(s)) return "blue";
  if (["partial"].includes(s)) return "amber";
  if (["canceled", "expired", "failed", "error", "refunded"].includes(s)) return "red";
  return "gray";
}

export function EmptyState({ icon = "📭", title, desc, action }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface2 text-2xl">{icon}</span>
      <p className="mt-1 text-sm font-semibold text-ink">{title}</p>
      {desc && <p className="max-w-xs text-xs leading-relaxed text-muted">{desc}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function Segmented({ value, onChange, options, className = "" }) {
  return (
    <div className={`no-scrollbar inline-flex max-w-full gap-1 overflow-x-auto rounded-xl bg-surface2 p-1 ${className}`}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`tab whitespace-nowrap ${value === o.value ? "tab-active" : ""}`}
        >
          {o.label}
          {o.count !== undefined && (
            <span className={`ml-1.5 rounded-md px-1.5 py-0.5 text-[10px] ${value === o.value ? "bg-amber-soft text-amber-bright" : "bg-surface3 text-muted"}`}>
              {o.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export function CopyButton({ value, label = "Salin", className = "" }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        if (!value) return;
        navigator.clipboard?.writeText(String(value));
        setDone(true);
        setTimeout(() => setDone(false), 1400);
      }}
      className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-amber-bright transition-colors hover:bg-amber-soft ${className}`}
    >
      {done ? (
        <>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <path d="m5 13 4 4L19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Tersalin
        </>
      ) : (
        <>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <rect x="8" y="8" width="12" height="12" rx="2.5" stroke="currentColor" strokeWidth="2" />
            <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" stroke="currentColor" strokeWidth="2" />
          </svg>
          {label}
        </>
      )}
    </button>
  );
}

export function Spinner({ className = "h-4 w-4" }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Alert({ tone = "red", children, className = "" }) {
  const map = {
    red: "border-rose/25 bg-rose-soft text-rose",
    green: "border-success/25 bg-success-soft text-success",
    blue: "border-amber/25 bg-amber-soft text-amber-bright",
    amber: "border-warn/25 bg-warn-soft text-warn"
  };
  return (
    <div role={tone === "red" ? "alert" : "status"} className={`rounded-xl border px-3.5 py-2.5 text-[13px] leading-relaxed ${map[tone]} ${className}`}>
      {children}
    </div>
  );
}

export function Row({ label, children, strong = false }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 text-sm">
      <span className="shrink-0 text-muted">{label}</span>
      <span className={`min-w-0 text-right ${strong ? "font-bold text-ink" : "font-medium text-ink"}`}>{children}</span>
    </div>
  );
}

export const Icon = {
  phone: (p) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" {...p}>
      <rect x="6" y="2.5" width="12" height="19" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M10 18.5h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  rocket: (p) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" {...p}>
      <path d="M14.5 4.5c2.5-1 5-.9 5-.9s.1 2.5-.9 5c-1 2.6-3.4 5.2-6.1 6.9l-3-3c1.7-2.7 4.3-5.1 5-8Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9.5 10.5 6 10l-2.5 2.5 4 1M13.5 14.5l.5 3.5-2.5 2.5-1-4M6.5 17.5 4 20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="15.5" cy="8.5" r="1.4" fill="currentColor" />
    </svg>
  ),
  qris: (p) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" {...p}>
      <rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
      <rect x="14" y="3.5" width="6.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
      <rect x="3.5" y="14" width="6.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M14 14h2.5v2.5H14zM18 18h2.5v2.5H18zM18 14h2.5M14 20.5h2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  history: (p) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" {...p}>
      <path d="M4 12a8 8 0 1 0 2.34-5.66" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M4 4v4h4M12 8v4l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  home: (p) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" {...p}>
      <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  ),
  transfer: (p) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" {...p}>
      <path d="M4 8h13l-3-3M20 16H7l3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  ledger: (p) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" {...p}>
      <rect x="4" y="3.5" width="16" height="17" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 8h8M8 12h8M8 16h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  arrowLeft: (p) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" {...p}>
      <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  chevron: (p) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" {...p}>
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  search: (p) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" {...p}>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="m20 20-4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  refresh: (p) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" {...p}>
      <path d="M20 11a8 8 0 0 0-14.6-4.5M4 4v4h4M4 13a8 8 0 0 0 14.6 4.5M20 20v-4h-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  check: (p) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" {...p}>
      <path d="m5 13 4 4L19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  x: (p) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" {...p}>
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  gift: (p) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" {...p}>
      <rect x="3.5" y="9" width="17" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.5 12.5h17M12 9v11M12 9C9 9 8 7.5 8 6.3A2.3 2.3 0 0 1 12 4.8 2.3 2.3 0 0 1 16 6.3C16 7.5 15 9 12 9Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  ),
  star: (p) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" {...p}>
      <path d="m12 3.5 2.6 5.3 5.8.85-4.2 4.1 1 5.75L12 16.7l-5.2 2.8 1-5.75-4.2-4.1 5.8-.85Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  ),
  help: (p) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" {...p}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9.6 9.3a2.4 2.4 0 1 1 3.6 2.1c-.8.5-1.2.9-1.2 1.9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="17" r="1" fill="currentColor" />
    </svg>
  ),
  shop: (p) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" {...p}>
      <path d="M4 5h16l-1.5 8H5.5L4 5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M8 13v2a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="8" cy="20" r="1.2" fill="currentColor" />
      <circle cx="16" cy="20" r="1.2" fill="currentColor" />
    </svg>
  ),
  coin: (p) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" {...p}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 7v10M9.5 9.5C9.5 8.4 10.6 8 12 8s2.5.4 2.5 1.5-1 1.5-2.5 1.5-2.5.4-2.5 1.5S10.6 14 12 14s2.5.4 2.5 1.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  key: (p) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" {...p}>
      <circle cx="8" cy="8" r="4.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="m11 11 8 8m-3-3 2-2m-4 4 1.5-1.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
};
