"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useUser } from "@/app/providers";
import SimCard from "@/components/SimCard";
import AccountInfoModal from "@/components/AccountInfoModal";
import { Icon, rupiah, EmptyState } from "@/components/ui";

function greeting() {
  const h = Number(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta", hour: "numeric", hour12: false }));
  if (h < 11) return "Selamat pagi";
  if (h < 15) return "Selamat siang";
  if (h < 18) return "Selamat sore";
  return "Selamat malam";
}

function Bars({ data, keyName, className }) {
  const max = Math.max(1, ...data.map((d) => d[keyName]));
  return (
    <div className="flex h-28 items-end gap-[3px]" role="img" aria-label={`Grafik ${keyName} 30 hari`}>
      {data.map((d) => (
        <span
          key={d.date}
          title={`${d.date}: ${keyName === "total" ? d[keyName] : rupiah(d[keyName])}`}
          className={`flex-1 rounded-t-[3px] ${d[keyName] > 0 ? className : "bg-surface2"}`}
          style={{ height: `${Math.max(4, (d[keyName] / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

const shortcuts = [
  { href: "/otp", label: "Beli nokos", icon: Icon.phone },
  { href: "/suntik", label: "Suntik sosmed", icon: Icon.rocket },
  { href: "/deposit", label: "Isi saldo", icon: Icon.qris },
  { href: "/transfer", label: "Transfer", icon: Icon.transfer },
  { href: "/mutasi", label: "Mutasi", icon: Icon.ledger },
  { href: "/referral", label: "Undang teman", icon: Icon.gift }
];

export default function DashboardPage() {
  const { token, name, balance, joinedAt, ready } = useUser();
  const [stats, setStats] = useState(null);
  const [loyalty, setLoyalty] = useState(null);
  const [board, setBoard] = useState(null);
  const [modal, setModal] = useState(false);

  useEffect(() => {
    if (!token) return;
    const t = encodeURIComponent(token);
    fetch(`/api/user/stats?token=${t}`)
      .then((r) => r.json())
      .then((d) => setStats(d.error ? { daily: [] } : d))
      .catch(() => setStats({ daily: [] }));
    fetch(`/api/loyalty/info?token=${t}`)
      .then((r) => r.json())
      .then((d) => setLoyalty(d.error ? null : d))
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    fetch("/api/leaderboard/orders")
      .then((r) => r.json())
      .then((d) => setBoard(d.items || []))
      .catch(() => setBoard([]));
  }, []);

  const hasOrders = useMemo(() => stats?.daily?.some((d) => d.total > 0), [stats]);
  const spend = useMemo(
    () => (stats?.daily || []).reduce((a, d) => ({ masuk: a.masuk + d.masuk, keluar: a.keluar + d.keluar }), { masuk: 0, keluar: 0 }),
    [stats]
  );
  const progress = loyalty?.next ? Math.min(100, Math.round((loyalty.totalSpent / loyalty.next.target) * 100)) : 100;

  return (
    <div className="mx-auto max-w-content px-4 py-6 sm:px-5 sm:py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{greeting()},</p>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
            {ready ? name || "Pelanggan Artapedia" : "…"}
          </h1>
        </div>
        <button onClick={() => setModal(true)} className="btn-ghost px-4 py-2.5">
          {name ? "Info akun" : "Atur nama & kode akun"}
        </button>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[440px_1fr]">
        <SimCard />

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-3">
          {shortcuts.map((s) => {
            const I = s.icon;
            return (
              <Link key={s.href} href={s.href} className="card hover-lift flex flex-col items-center justify-center gap-2 px-2 py-4 text-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-soft text-amber-bright">
                  <I />
                </span>
                <span className="text-xs font-semibold text-ink">{s.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Total transaksi", stats?.totalTransaksi],
          ["OTP berhasil", stats?.otpBerhasil],
          ["Suntik selesai", stats?.smmSelesai],
          ["Deposit sukses", stats?.depositSukses]
        ].map(([label, v]) => (
          <div key={label} className="card p-4">
            <p className="text-2xl font-extrabold tabular-nums text-ink">{stats ? v ?? 0 : "…"}</p>
            <p className="mt-0.5 text-xs text-muted">{label}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="card p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-bold text-ink">Pesanan 30 hari</h2>
            <span className="text-xs text-muted">nokos + suntik</span>
          </div>
          {!stats ? (
            <div className="skeleton mt-4 h-28 rounded-xl" />
          ) : hasOrders ? (
            <div className="mt-4">
              <Bars data={stats.daily} keyName="total" className="bg-amber" />
            </div>
          ) : (
            <EmptyState icon="📈" title="Belum ada pesanan bulan ini" />
          )}
        </div>

        <div className="card p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-bold text-ink">Arus saldo 30 hari</h2>
            <span className="text-xs">
              <span className="font-semibold text-success">+{rupiah(spend.masuk)}</span>
              <span className="text-muted"> / </span>
              <span className="font-semibold text-rose">−{rupiah(spend.keluar)}</span>
            </span>
          </div>
          {!stats ? (
            <div className="skeleton mt-4 h-28 rounded-xl" />
          ) : spend.masuk + spend.keluar > 0 ? (
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <Bars data={stats.daily} keyName="masuk" className="bg-success" />
                <p className="mt-1.5 text-center text-[11px] text-muted">Masuk</p>
              </div>
              <div>
                <Bars data={stats.daily} keyName="keluar" className="bg-rose" />
                <p className="mt-1.5 text-center text-[11px] text-muted">Keluar</p>
              </div>
            </div>
          ) : (
            <EmptyState icon="💼" title="Belum ada pergerakan saldo" />
          )}
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <Link href="/loyalitas" className="card hover-lift block p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-ink">Level & poin</h2>
            <span className="text-2xl" aria-hidden="true">
              {loyalty?.badge?.icon || "🥉"}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted">
            Level <span className="font-bold text-ink">{loyalty?.badge?.name || "Bronze"}</span> ·{" "}
            <span className="font-bold tabular-nums text-ink">{Number(loyalty?.points || 0).toLocaleString("id-ID")}</span> poin
          </p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface2">
            <div className="h-full rounded-full bg-amber" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted">
            {loyalty?.next
              ? `Belanja ${rupiah(loyalty.next.remaining)} lagi untuk naik ke ${loyalty.next.name}.`
              : "Kamu sudah di level tertinggi."}
          </p>
        </Link>

        <div className="card p-5">
          <h2 className="text-base font-bold text-ink">10 pembeli teraktif</h2>
          <ol className="mt-3 divide-y divide-line">
            {board === null ? (
              Array.from({ length: 3 }).map((_, i) => <li key={i} className="skeleton my-2 h-9 rounded-lg" />)
            ) : board.length === 0 ? (
              <li className="py-4 text-sm text-muted">Belum ada data.</li>
            ) : (
              board.map((u) => (
                <li key={u.rank} className="flex items-center gap-3 py-2">
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-extrabold ${
                      u.rank === 1 ? "bg-amber text-white" : u.rank <= 3 ? "bg-teal-bright text-white" : "bg-surface2 text-muted"
                    }`}
                  >
                    {u.rank}
                  </span>
                  <span className="flex-1 font-mono text-sm text-ink">{u.token}</span>
                  <span className="text-xs font-semibold tabular-nums text-muted">{u.successCount} sukses</span>
                </li>
              ))
            )}
          </ol>
        </div>
      </div>

      <AccountInfoModal open={modal} onClose={() => setModal(false)} token={token} balance={balance} joinedAt={joinedAt} />
    </div>
  );
}
