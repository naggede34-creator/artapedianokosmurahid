import { NextResponse } from "next/server";
import { otpOrdersCol, depositsCol, smmOrdersCol } from "@/lib/db";

export const dynamic = "force-dynamic";

// Kunci hari pakai zona WIB supaya transaksi jam 00:00-07:00 WIB tidak jatuh ke hari sebelumnya.
function dayKey(d) {
  return new Date(new Date(d).getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

export async function GET(req) {
  try {
    const token = new URL(req.url).searchParams.get("token");
    if (!token) return NextResponse.json({ error: "Kode akun kosong." }, { status: 400 });

    const days = 30;
    const todayKey = dayKey(new Date());
    const since = new Date(Date.now() - days * 24 * 3600 * 1000);

    const [allOrders, allDeposits, allSmm] = await Promise.all([
      (await otpOrdersCol()).find({ token }).project({ createdAt: 1, price: 1, status: 1, refunded: 1 }).toArray(),
      (await depositsCol()).find({ token }).project({ createdAt: 1, amount: 1, status: 1 }).toArray(),
      (await smmOrdersCol()).find({ token }).project({ createdAt: 1, charge: 1, status: 1, refundedAmount: 1 }).toArray()
    ]);

    const otpBerhasil = allOrders.filter((o) => o.status === "done").length;
    const depositSukses = allDeposits.filter((d) => d.status === "completed").length;
    const smmSelesai = allSmm.filter((s) => s.status === "completed" || s.status === "partial").length;

    const daily = [];
    const base = new Date(`${todayKey}T00:00:00Z`);
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(base.getTime() - i * 24 * 3600 * 1000);
      daily.push({ date: d.toISOString().slice(0, 10), total: 0, completed: 0, masuk: 0, keluar: 0 });
    }
    const byDay = Object.fromEntries(daily.map((d) => [d.date, d]));

    for (const o of allOrders) {
      if (new Date(o.createdAt) < since) continue;
      const row = byDay[dayKey(o.createdAt)];
      if (!row) continue;
      row.total += 1;
      if (o.status === "done") {
        row.completed += 1;
        row.keluar += Number(o.price || 0);
      }
    }
    for (const s of allSmm) {
      if (new Date(s.createdAt) < since) continue;
      const row = byDay[dayKey(s.createdAt)];
      if (!row) continue;
      row.total += 1;
      if (s.status === "completed" || s.status === "partial") row.completed += 1;
      if (!["failed", "canceled", "refunded"].includes(s.status)) {
        row.keluar += Math.max(0, Number(s.charge || 0) - Number(s.refundedAmount || 0));
      }
    }
    for (const d of allDeposits) {
      if (d.status !== "completed" || new Date(d.createdAt) < since) continue;
      const row = byDay[dayKey(d.createdAt)];
      if (row) row.masuk += Number(d.amount || 0);
    }

    return NextResponse.json({
      totalTransaksi: allOrders.length + allSmm.length,
      otpBerhasil,
      smmSelesai,
      depositSukses,
      daily
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal mengambil statistik akun." }, { status: 500 });
  }
}
