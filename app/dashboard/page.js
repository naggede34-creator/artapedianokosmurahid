"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useUser } from "@/app/providers";
import AccountInfoModal from "@/components/AccountInfoModal";

function greeting() {
  const h = new Date().getHours();
  if (h < 10) return "Selamat Pagi";
  if (h < 15) return "Selamat Siang";
  if (h < 18) return "Selamat Sore";
  return "Selamat Malam";
}

function StatCard({ icon, value, label, accent }) {
  return (
    <div className="hover-lift card-shadow flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
      <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${accent}`}>{icon}</span>
      <div>
        <p className="font-display text-xl font-semibold text-ink">{value}</p>
        <p className="text-xs text-muted">{label}</p>
      </div>
    </div>
  );
}

function MiniBars({ data, keyName, colorClass }) {
  const max = Math.max(1, ...data.map((d) => d[keyName]));
  return (
    <div className="flex h-24 items-end gap-[3px]">
      {data.map((d, i) => (
        <span
          key={i}
          title={`${d.date}: ${d[keyName]}`}
          className={`flex-1 rounded-sm ${d[keyName] > 0 ? colorClass : "bg-surface3"}`}
          style={{ height: `${Math.max(4, (d[keyName] / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { token, name, balance, joinedAt, ready } = useUser();
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [board, setBoard] = useState([]);
  const [boardLoading, setBoardLoading] = useState(true);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [loyalty, setLoyalty] = useState(null);

  useEffect(() => {
    if (!token) return;
    setStatsLoading(true);
    fetch(`/api/user/stats?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => setStats(d.error ? null : d))
      .catch(() => setStats(null))
      .finally(() => setStatsLoading(false));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/loyalty/info?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => setLoyalty(d.error ? null : d))
      .catch(() => setLoyalty(null));
  }, [token]);

  useEffect(() => {
    fetch("/api/leaderboard/orders")
      .then((r) => r.json())
      .then((d) => setBoard(d.items || []))
      .catch(() => setBoard([]))
      .finally(() => setBoardLoading(false));
  }, []);

  const hasOrderActivity = useMemo(() => stats?.daily?.some((d) => d.total > 0), [stats]);
  const hasSpendActivity = useMemo(() => stats?.daily?.some((d) => d.masuk > 0 || d.keluar > 0), [stats]);

  return (
    <div className="mx-auto max-w-content px-5 py-8">
      {/* Greeting */}
      <div className="fade-up card-shadow flex items-center justify-between rounded-2xl border border-line bg-gradient-to-br from-surface to-surface2 p-5">
        <div>
          <p className="text-sm text-muted">{greeting()},</p>
          <p className="font-display text-lg font-semibold text-ink">
            {ready && token ? (name ? name : `${token.slice(0, 10)}…`) : "Memuat akun..."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/loyalitas"
            className="press flex items-center gap-1.5 rounded-full border border-line bg-surface2 px-3 py-1.5 text-xs font-medium text-ink hover:border-amber/40"
          >
            <span>{loyalty?.badge?.icon || "🥉"}</span>
            <span>{loyalty?.badge?.name || "Bronze"}</span>
          </Link>
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-soft text-xl">
            {new Date().getHours() < 18 ? "☀️" : "🌙"}
          </span>
        </div>
      </div>

      {/* Saldo */}
      <div className="glow-ring fade-up delay-1 mt-4 rounded-2xl">
        <div className="rounded-2xl bg-gradient-to-br from-amber-bright via-amber to-teal p-5 text-white shadow-glow">
          <p className="text-xs uppercase tracking-wide text-white/80">Total Saldo Aktif</p>
          <p className="mt-1 font-display text-3xl font-semibold">
            {ready ? `Rp${balance.toLocaleString("id-ID")}` : "Rp0"}
          </p>
        </div>
      </div>

      {/* Stat grid */}
      <div className="fade-up delay-2 mt-4 grid grid-cols-3 gap-3">
        <StatCard
          accent="bg-amber-soft text-amber-bright"
          value={statsLoading ? "…" : stats?.totalTransaksi ?? 0}
          label="Total Transaksi"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M4 12a8 8 0 1 0 2.34-5.66" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M4 4v4h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
        />
        <StatCard
          accent="bg-teal-soft text-teal-bright"
          value={statsLoading ? "…" : stats?.otpBerhasil ?? 0}
          label="OTP Berhasil"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="m5 13 4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
        />
        <StatCard
          accent="bg-success-soft text-success"
          value={statsLoading ? "…" : stats?.depositSukses ?? 0}
          label="Deposit Sukses"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 4v16M12 4l-4 4M12 4l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
        />
      </div>

      {/* Quick actions */}
      <div className="fade-up delay-3 mt-4 grid grid-cols-2 gap-3">
        <Link
          href="/otp"
          className="hover-lift card-shadow flex flex-col items-center gap-2 rounded-2xl border border-line bg-surface py-5 text-sm font-medium text-ink"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-soft text-amber-bright">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="9" cy="20" r="1.4" fill="currentColor" />
              <circle cx="18" cy="20" r="1.4" fill="currentColor" />
              <path d="M2.5 3h2.2l1.9 11.1a2 2 0 0 0 2 1.65h8.4a2 2 0 0 0 2-1.6L20.8 7H6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          Pesan OTP
        </Link>
        <Link
          href="/deposit"
          className="hover-lift card-shadow flex flex-col items-center gap-2 rounded-2xl border border-line bg-surface py-5 text-sm font-medium text-ink"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-soft text-teal-bright">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <rect x="3.5" y="6" width="17" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
              <path d="M3.5 10h17" stroke="currentColor" strokeWidth="1.8" />
              <circle cx="16.5" cy="14" r="1.1" fill="currentColor" />
            </svg>
          </span>
          Isi Saldo
        </Link>
      </div>

      {/* Info Akun - kotak besar */}
      <button
        onClick={() => setAccountModalOpen(true)}
        className="hover-lift card-shadow fade-up delay-3 mt-3 flex w-full flex-col items-center gap-2.5 rounded-2xl border border-line bg-surface py-7 text-sm font-medium text-ink"
      >
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-soft text-2xl text-amber-bright">
          ℹ️
        </span>
        <span className="text-base font-semibold">Info Akun</span>
        <span className="text-xs font-normal text-muted">Nama, kode akun & saldo kamu</span>
      </button>

      {/* Orders chart */}
      <div className="fade-up delay-4 card-shadow mt-4 rounded-2xl border border-line bg-surface p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-ink">📈 Orders</p>
          <p className="text-xs text-muted">30 hari terakhir</p>
        </div>
        {statsLoading ? (
          <div className="skeleton mt-4 h-24 rounded-lg" />
        ) : hasOrderActivity ? (
          <div className="mt-4">
            <div className="mb-2 flex items-center gap-3 text-[11px] text-muted">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-surface3" /> Total</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-success" /> Completed</span>
            </div>
            <MiniBars data={stats.daily} keyName="total" colorClass="bg-amber" />
          </div>
        ) : (
          <div className="mt-6 flex flex-col items-center justify-center gap-2 py-6 text-center">
            <span className="text-2xl">📭</span>
            <p className="text-sm text-muted">Belum ada data pesanan dalam 30 hari terakhir.</p>
          </div>
        )}
      </div>

      {/* Spending chart */}
      <div className="fade-up delay-5 card-shadow mt-4 rounded-2xl border border-line bg-surface p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-ink">💼 Spending</p>
          <div className="flex items-center gap-3 text-[11px] text-muted">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber" /> Masuk</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose" /> Keluar</span>
          </div>
        </div>
        <p className="mt-0.5 text-[11px] uppercase tracking-wide text-muted">Last 30 days</p>
        {statsLoading ? (
          <div className="skeleton mt-4 h-24 rounded-lg" />
        ) : hasSpendActivity ? (
          <div className="mt-4 grid grid-cols-2 gap-4">
            <MiniBars data={stats.daily} keyName="masuk" colorClass="bg-amber" />
            <MiniBars data={stats.daily} keyName="keluar" colorClass="bg-rose" />
          </div>
        ) : (
          <div className="mt-6 flex flex-col items-center justify-center gap-2 py-6 text-center">
            <span className="text-2xl">📊</span>
            <p className="text-sm text-muted">Belum ada data pemasukan/pengeluaran dalam 30 hari terakhir.</p>
          </div>
        )}
      </div>

      {/* Leaderboard */}
      <div className="fade-up delay-6 card-shadow mt-4 rounded-2xl border border-line bg-surface p-5">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-soft text-base">🏆</span>
          <p className="text-sm font-semibold text-ink">Peringkat 10 User</p>
        </div>
        <div className="mt-3 flex flex-col gap-2">
          {boardLoading ? (
            Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-12 rounded-xl" />)
          ) : board.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted">Belum ada pesanan sukses yang tercatat.</p>
          ) : (
            board.map((u) => (
              <div
                key={u.rank}
                className="flex items-center justify-between rounded-xl border border-line bg-surface2/60 px-3 py-2.5"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold ${
                      u.rank === 1
                        ? "bg-amber text-white"
                        : u.rank <= 3
                        ? "bg-teal text-white"
                        : "bg-surface3 text-ink"
                    }`}
                  >
                    {u.rank}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-ink">{u.token}</p>
                    <p className="text-[11px] text-muted">{u.successCount} Pesanan Sukses</p>
                  </div>
                </div>
                <span className="rounded-md bg-amber-soft px-2 py-1 text-[11px] font-medium text-amber-bright">
                  #{u.rank}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <AccountInfoModal
        open={accountModalOpen}
        onClose={() => setAccountModalOpen(false)}
        token={token}
        balance={balance}
        joinedAt={joinedAt}
      />
    </div>
  );
}
