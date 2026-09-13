"use client";

import { useEffect, useState } from "react";

const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

export default function LeaderboardPage() {
  const [items, setItems] = useState([]);
  const [month, setMonth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/referral/leaderboard")
      .then((r) => r.json())
      .then((data) => {
        setItems(data.items || []);
        setMonth(data.month ? new Date(data.month) : null);
      })
      .finally(() => setLoading(false));
  }, []);

  const medal = (rank) => (rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null);

  return (
    <div className="mx-auto max-w-content px-5 py-14">
      <p className="fade-up text-sm font-semibold uppercase tracking-wide text-teal-bright">Leaderboard</p>
      <h1 className="fade-up delay-1 mt-2 font-display text-display-sm font-semibold text-ink sm:text-display-md">
        Top pengundang teman{month ? ` — ${MONTH_NAMES[month.getMonth()]} ${month.getFullYear()}` : ""}
      </h1>
      <p className="fade-up delay-2 mt-3 max-w-xl text-sm leading-relaxed text-muted">
        Peringkat dihitung dari jumlah teman baru yang mendaftar lewat link referral kamu bulan ini.
        Posisi 1–3 dapat sorotan khusus — hubungi admin untuk info bonus tambahan.
      </p>

      <div className="scale-in mt-8 overflow-hidden rounded-2xl border border-line shadow-soft">
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton h-10 rounded-lg" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="p-6 text-sm text-muted">Belum ada yang berhasil mengundang teman bulan ini.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-surface text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Peringkat</th>
                <th className="px-4 py-3">Akun</th>
                <th className="px-4 py-3">Teman diundang</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {items.map((it) => (
                <tr key={it.rank} className={`transition-colors hover:bg-surface2/60 ${it.rank <= 3 ? "bg-amber-soft/40" : ""}`}>
                  <td className="px-4 py-3 font-display font-semibold text-ink">
                    {medal(it.rank) || `#${it.rank}`}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-ink">{it.token}</td>
                  <td className="px-4 py-3 text-ink">{it.referralCount} orang</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
