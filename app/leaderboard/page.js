"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/app/providers";

const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

function rupiah(v) { return `Rp${Number(v).toLocaleString("id-ID")}`; }

export default function LeaderboardPage() {
  const { token } = useUser();
  const [tab, setTab] = useState("weekly");

  // Referral leaderboard
  const [referralItems, setReferralItems] = useState([]);
  const [referralMonth, setReferralMonth] = useState(null);
  const [referralLoading, setReferralLoading] = useState(true);

  // Weekly buyer leaderboard
  const [weeklyItems, setWeeklyItems] = useState([]);
  const [weeklyLoading, setWeeklyLoading] = useState(true);
  const [userRank, setUserRank] = useState(null);
  const [userCount, setUserCount] = useState(0);
  const [userPrize, setUserPrize] = useState(0);
  const [prizes, setPrizes] = useState([]);
  const [lastWeek, setLastWeek] = useState(null);
  const [weekStart, setWeekStart] = useState(null);

  useEffect(() => {
    fetch("/api/referral/leaderboard")
      .then((r) => r.json())
      .then((data) => {
        setReferralItems(data.items || []);
        setReferralMonth(data.month ? new Date(data.month) : null);
      })
      .finally(() => setReferralLoading(false));

    const q = token ? `?token=${encodeURIComponent(token)}` : "";
    fetch(`/api/leaderboard-weekly${q}`)
      .then((r) => r.json())
      .then((data) => {
        setWeeklyItems(data.items || []);
        setUserRank(data.userRank || null);
        setUserCount(data.userCount || 0);
        setUserPrize(data.userPrize || 0);
        setPrizes(Array.isArray(data.prizes) ? data.prizes : []);
        setLastWeek(data.lastWeek || null);
        setWeekStart(data.weekStart ? new Date(data.weekStart) : null);
      })
      .finally(() => setWeeklyLoading(false));
  }, [token]);

  const medal = (rank) => (rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null);

  return (
    <div className="mx-auto max-w-content px-4 py-6 sm:px-5 sm:py-10">
      <p className="fade-up text-sm font-semibold text-teal-bright">Papan Peringkat</p>
      <h1 className="fade-up delay-1 mt-2 text-[26px] font-extrabold tracking-tight text-ink sm:text-[32px]">
        Leaderboard
      </h1>
      <p className="fade-up delay-2 mt-3 max-w-xl text-sm leading-relaxed text-muted">
        Bersaing untuk posisi teratas dan raih hadiah eksklusif setiap minggu!
      </p>

      {/* Tabs */}
      <div className="mt-6 flex gap-2 border-b border-line">
        {[
          { key: "weekly", label: "🏆 Pembeli Terbanyak" },
          { key: "referral", label: "👥 Pengundang Teman" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`pb-3 px-4 text-sm font-bold transition-colors border-b-2 -mb-px ${tab === t.key ? "border-amber text-amber-bright" : "border-transparent text-muted hover:text-ink"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Weekly Buyer Leaderboard */}
      {tab === "weekly" && (
        <div className="mt-6">
          {weekStart && (
            <p className="text-xs text-muted mb-4">
              Periode: <span className="font-semibold text-ink">{weekStart.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })} – {new Date(weekStart.getTime() + 6 * 86400000).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}</span>
            </p>
          )}

          {/* Posisi sendiri. Tidak ada tombol klaim: hadiahnya cair otomatis
              tiap Senin. Hadiah yang harus diklaim sendiri berakhir hangus
              untuk orang yang tidak kebetulan membuka halaman ini. */}
          {userRank && (
            <div className="panel-3d glow-3d mb-4 flex items-center gap-4 p-4">
              <span className="text-3xl">{medal(userRank) || `#${userRank}`}</span>
              <div className="flex-1">
                <p className="text-sm font-bold text-ink">
                  Posisimu minggu ini: <span className="text-amber-bright">#{userRank}</span>
                </p>
                <p className="text-xs text-muted">
                  {userCount}x transaksi
                  {userPrize > 0
                    ? ` · hadiah ${rupiah(userPrize)} cair otomatis Senin pagi`
                    : " · belum masuk zona hadiah, ayo naik lagi!"}
                </p>
              </div>
            </div>
          )}

          <div className="mb-4 rounded-xl border border-teal/30 bg-teal/5 px-4 py-2.5 text-xs leading-relaxed text-ink">
            💸 Hadiah <b>masuk saldo otomatis</b> tiap Senin pagi — tidak perlu diklaim. Pemenangnya diumumkan di
            channel Telegram.
          </div>

          {/* Hadiah per peringkat, ikut pengaturan admin. */}
          {prizes.length > 0 && (
            <div className={`mb-4 grid gap-2 ${prizes.length >= 3 ? "grid-cols-3" : "grid-cols-2"}`}>
              {prizes.map((p) => (
                <div key={p.rank} className="card-3d p-3 text-center">
                  <div className="mb-1 text-2xl">{medal(p.rank) || "🎖"}</div>
                  <p className="text-xs font-bold text-ink">#{p.rank}</p>
                  <p className="text-xs font-semibold text-amber-bright">{rupiah(p.amount)}</p>
                </div>
              ))}
            </div>
          )}

          {/* Pemenang minggu lalu. Tanpa ini papannya terasa kosong tiap Senin
              pagi dan tidak ada bukti hadiahnya benar-benar dibagikan. */}
          {lastWeek?.winners?.length > 0 && (
            <div className="mb-4 rounded-2xl border border-line bg-surface p-4">
              <p className="text-xs font-black uppercase tracking-wider text-muted">Pemenang minggu lalu</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {lastWeek.winners.map((w) => (
                  <span key={w.rank} className="chip bg-amber-soft text-amber-bright">
                    {medal(w.rank) || `#${w.rank}`} {w.count}x · {rupiah(w.amount)}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-line shadow-soft">
            {weeklyLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-10 rounded-lg" />)}
              </div>
            ) : weeklyItems.length === 0 ? (
              <p className="p-6 text-sm text-muted">Belum ada transaksi minggu ini.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-surface text-xs uppercase text-muted">
                  <tr>
                    <th className="px-4 py-3">Peringkat</th>
                    <th className="px-4 py-3">Akun</th>
                    <th className="px-4 py-3">Transaksi</th>
                    <th className="px-4 py-3">Hadiah</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {weeklyItems.map((it) => (
                    <tr key={it.rank} className={`transition-colors hover:bg-surface2/60 ${it.rank <= 3 ? "bg-amber-soft/30" : ""}`}>
                      <td className="px-4 py-3 font-extrabold text-ink">{medal(it.rank) || `#${it.rank}`}</td>
                      <td className="px-4 py-3 font-mono text-xs text-ink">{it.maskedToken}</td>
                      <td className="px-4 py-3 text-ink">{it.count}x</td>
                      <td className="px-4 py-3 font-semibold text-amber-bright">{it.prize > 0 ? rupiah(it.prize) : "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Referral Leaderboard */}
      {tab === "referral" && (
        <div className="mt-6">
          <p className="text-sm text-muted mb-4">
            Peringkat bulan{referralMonth ? ` ${MONTH_NAMES[referralMonth.getMonth()]} ${referralMonth.getFullYear()}` : " ini"}.
            Posisi 1–3 dapat bonus dari admin.
          </p>
          <div className="overflow-hidden rounded-2xl border border-line shadow-soft">
            {referralLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-10 rounded-lg" />)}
              </div>
            ) : referralItems.length === 0 ? (
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
                  {referralItems.map((it) => (
                    <tr key={it.rank} className={`transition-colors hover:bg-surface2/60 ${it.rank <= 3 ? "bg-amber-soft/40" : ""}`}>
                      <td className="px-4 py-3 font-extrabold text-ink">{medal(it.rank) || `#${it.rank}`}</td>
                      <td className="px-4 py-3 font-mono text-xs text-ink">{it.token}</td>
                      <td className="px-4 py-3 text-ink">{it.referralCount} orang</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
