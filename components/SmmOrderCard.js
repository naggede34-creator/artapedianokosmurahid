"use client";

import { useEffect, useRef, useState } from "react";
import { platformIcon } from "@/components/PlatformIcon";
import { Badge, statusTone, CopyButton, rupiah, fmtWIB } from "@/components/ui";
import { SMM_STATUS_LABEL } from "@/lib/paymentProviders";

function fmtNum(n) {
  return Number(n || 0).toLocaleString("id-ID");
}

export default function SmmOrderCard({ order: initial, token, onSettled }) {
  const [order, setOrder] = useState(initial);
  const [refilling, setRefilling] = useState(false);
  const [msg, setMsg] = useState("");
  const timer = useRef(null);

  useEffect(() => setOrder(initial), [initial]);

  useEffect(() => {
    if (order.settled || order.status === "failed" || !token) return undefined;
    async function tick() {
      try {
        const res = await fetch(`/api/smm/status?token=${encodeURIComponent(token)}&id=${encodeURIComponent(order.id)}`);
        const data = await res.json();
        if (res.ok && data.item) {
          setOrder(data.item);
          if (data.item.settled) {
            clearInterval(timer.current);
            onSettled?.(data.item);
          }
        }
      } catch {
        /* coba lagi nanti */
      }
    }
    tick();
    timer.current = setInterval(tick, 15000);
    return () => clearInterval(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id, order.settled, token]);

  async function refill() {
    setRefilling(true);
    setMsg("");
    try {
      const res = await fetch("/api/smm/refill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, id: order.id })
      });
      const data = await res.json();
      setMsg(res.ok ? data.message || "Refill diajukan." : data.error || "Refill gagal.");
    } finally {
      setRefilling(false);
    }
  }

  const delivered =
    order.remains !== null && order.remains !== undefined ? Math.max(0, order.quantity - Number(order.remains)) : order.status === "completed" ? order.quantity : 0;
  const pct = order.quantity ? Math.min(100, Math.round((delivered / order.quantity) * 100)) : 0;
  const running = !order.settled && order.status !== "failed";

  return (
    <div className="card p-4">
      <div className="flex items-start gap-3">
        {platformIcon(order.platform, 36)}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-bold leading-snug text-ink">{order.serviceTitle}</p>
            <Badge tone={statusTone(order.status)} pulse={running}>
              {SMM_STATUS_LABEL[order.status] || order.status}
            </Badge>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted" title={order.target}>
            {order.target}
          </p>
        </div>
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold tabular-nums text-ink">
            {fmtNum(delivered)} / {fmtNum(order.quantity)}
          </span>
          <span className="text-muted">{pct}%</span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface2">
          <div
            className={`h-full rounded-full transition-[width] duration-700 ${order.status === "failed" || order.status === "canceled" ? "bg-rose" : "bg-amber"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <span className="text-muted">Biaya</span>
        <span className="text-right font-semibold tabular-nums text-ink">{rupiah(order.charge)}</span>
        {order.refundedAmount > 0 && (
          <>
            <span className="text-muted">Dikembalikan</span>
            <span className="text-right font-semibold tabular-nums text-success">+{rupiah(order.refundedAmount)}</span>
          </>
        )}
        {order.startCount !== null && order.startCount !== undefined && (
          <>
            <span className="text-muted">Jumlah awal</span>
            <span className="text-right tabular-nums text-ink">{fmtNum(order.startCount)}</span>
          </>
        )}
        <span className="text-muted">Dipesan</span>
        <span className="text-right text-ink">{fmtWIB(order.createdAt)}</span>
        <span className="text-muted">ID</span>
        <span className="flex items-center justify-end font-mono text-ink">
          {order.id}
          <CopyButton value={order.id} label="" className="px-1" />
        </span>
      </div>

      {order.failReason && <p className="mt-2 text-xs text-rose">{order.failReason}</p>}

      {order.status === "completed" && order.refill && (
        <div className="mt-3 border-t border-line pt-3">
          <button onClick={refill} disabled={refilling} className="btn-ghost w-full py-2 text-xs">
            {refilling ? "Mengajukan…" : "Ajukan refill (kalau turun > 30%)"}
          </button>
          {msg && <p className="mt-1.5 text-xs text-muted">{msg}</p>}
        </div>
      )}
    </div>
  );
}
