"use client";

import Link from "next/link";

export default function InviteButton() {
  return (
    <Link
      href="/referral"
      aria-label="Undang teman"
      title="Undang teman, dapat bonus saldo"
      className="press flex h-9 w-9 items-center justify-center rounded-lg text-ink transition-colors hover:bg-surface2"
    >
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
        <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.7" />
        <path d="M3.5 19c0-3.2 2.5-5.5 5.5-5.5s5.5 2.3 5.5 5.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M17 8h4M19 6v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    </Link>
  );
}
