"use client";

import { useEffect, useMemo, useState } from "react";
import { useUser } from "@/app/providers";
import { PageHeader, Icon, EmptyState, Segmented, rupiah, fmtWIB } from "@/components/ui";

const GROUPS = {
  masuk: (r) => r.amount > 0,
  keluar: (r) => r.amount < 0
};

const TYPE_ICON = {
  deposit: "💳",
  cashback: "🎁",
  referral: "🤝",
  voucher: "🎟️",
  points: "⭐",
  transfer_in: "📥",
  transfer_out: "📤",
  otp: "📱",
  otp_refund: "↩️",
  smm: "🚀",
  smm_refund: "↩️",
  admin_add: "🛡️",
  admin_sub: "🛡️"
};

function dayLabel(d) {
  return new Date(d).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export default function MutasiPage() {
  const { token, ready, balance } = useUser();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("semua");

  useEffect(() => {
    if (!ready || !token) return;
    setLoading(true);
    fetch(`/api/mutasi?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => setRows(Array.isArray(d.items) ? d.items : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [ready, token]);

  const filtered = useMemo(() => (GROUPS[filter] ? rows.filter(GROUPS[filter]) : rows), [rows, filter]);
  const totals = useMemo(
    () => ({
      masuk: rows.filter((r) => r.amount > 0).reduce((s, r) => s + r.amount, 0),
      keluar: rows.filter((r) => r.amount < 0).reduce((s, r) => s - r.amount, 0)
    }),
    [rows]
  );

  const grouped = useMemo(() => {
    const out = [];
    for (const r of filtered) {
      const label = dayLabel(r.createdAt);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(r);
      else out.push({ label, items: [r] });
    }
    return out;
  }, [filtered]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-5 sm:py-10">
      <PageHeader icon={<Icon.ledger />} title="Mutasi saldo" desc="Setiap rupiah yang masuk dan keluar dari saldo kamu, lengkap dengan saldo akhirnya." />

      <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
        <div className="card p-4">
          <p className="text-xs text-muted">Saldo sekarang</p>
          <p className="mt-1 text-base font-extrabold tabular-nums text-ink sm:text-lg">{rupiah(balance)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-muted">Total masuk</p>
          <p className="mt-1 text-base font-extrabold tabular-nums text-success sm:text-lg">+{rupiah(totals.masuk)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-muted">Total keluar</p>
          <p className="mt-1 text-base font-extrabold tabular-nums text-rose sm:text-lg">−{rupiah(totals.keluar)}</p>
        </div>
      </div>

      <Segmented
        className="mt-5"
        value={filter}
        onChange={setFilter}
        options={[
          { value: "semua", label: "Semua" },
          { value: "masuk", label: "Masuk" },
          { value: "keluar", label: "Keluar" }
        ]}
      />

      <div className="mt-4">
        {loading ? (
          <div className="card space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton h-12 rounded-xl" />
            ))}
          </div>
        ) : grouped.length === 0 ? (
          <div className="card">
            <EmptyState title="Belum ada mutasi" desc="Deposit, pembelian, refund, dan transfer akan tercatat di sini." />
          </div>
        ) : (
          <div className="space-y-5">
            {grouped.map((g) => (
              <div key={g.label}>
                <p className="mb-2 px-1 text-xs font-semibold text-muted">{g.label}</p>
                <div className="card divide-y divide-line overflow-hidden">
                  {g.items.map((r) => (
                    <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base ${r.amount > 0 ? "bg-success-soft" : "bg-rose-soft"}`}>
                        {TYPE_ICON[r.type] || (r.amount > 0 ? "↓" : "↑")}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink">{r.title}</p>
                        <p className="truncate text-[11px] text-muted">
                          {fmtWIB(r.createdAt).split(", ").pop()}
                          {r.ref ? ` · ${r.ref}` : ""}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className={`text-sm font-bold tabular-nums ${r.amount > 0 ? "text-success" : "text-rose"}`}>
                          {r.amount > 0 ? "+" : "−"}
                          {rupiah(Math.abs(r.amount))}
                        </p>
                        {r.balanceAfter !== null && r.balanceAfter !== undefined && (
                          <p className="text-[11px] tabular-nums text-muted">saldo {rupiah(r.balanceAfter)}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
