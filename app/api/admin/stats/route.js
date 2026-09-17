import { NextResponse } from "next/server";
import { otpOrdersCol, depositsCol, smmOrdersCol } from "@/lib/db";
import { isAdminRequest } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

function dayKey(d) {
  return new Date(new Date(d).getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

export async function GET(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const days = 7;
    const todayKey = dayKey(new Date());
    const base = new Date(`${todayKey}T00:00:00Z`);
    const since = new Date(base.getTime() - (days - 1) * 24 * 3600 * 1000 - 7 * 3600 * 1000);

    const orders = await otpOrdersCol();
    const deposits = await depositsCol();
    const smm = await smmOrdersCol();

    const [recentOrders, recentDeposits, recentSmm, topServices, topCountries, topPlatforms] = await Promise.all([
      orders.find({ createdAt: { $gte: since } }).project({ createdAt: 1, price: 1, status: 1, refunded: 1 }).toArray(),
      deposits.find({ createdAt: { $gte: since } }).project({ createdAt: 1, amount: 1, status: 1, provider: 1 }).toArray(),
      smm.find({ createdAt: { $gte: since } }).project({ createdAt: 1, charge: 1, status: 1, refundedAmount: 1 }).toArray(),
      orders
        .aggregate([
          { $match: { createdAt: { $gte: since } } },
          { $group: { _id: "$serviceName", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 5 }
        ])
        .toArray(),
      orders
        .aggregate([
          { $match: { createdAt: { $gte: since } } },
          { $group: { _id: "$countryName", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 5 }
        ])
        .toArray(),
      smm
        .aggregate([
          { $match: { createdAt: { $gte: since } } },
          { $group: { _id: { $concat: ["$platform", " ", "$kind"] }, count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 5 }
        ])
        .toArray()
    ]);

    const daily = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(base.getTime() - i * 24 * 3600 * 1000);
      daily.push({
        date: d.toISOString().slice(0, 10),
        orderCount: 0,
        orderRevenue: 0,
        smmCount: 0,
        smmRevenue: 0,
        depositCount: 0,
        depositAmount: 0
      });
    }
    const byDay = Object.fromEntries(daily.map((d) => [d.date, d]));
    const depositByProvider = {};

    for (const o of recentOrders) {
      const row = byDay[dayKey(o.createdAt)];
      if (!row) continue;
      row.orderCount += 1;
      if (!o.refunded && o.status !== "canceled") row.orderRevenue += Number(o.price || 0);
    }
    for (const s of recentSmm) {
      const row = byDay[dayKey(s.createdAt)];
      if (!row) continue;
      row.smmCount += 1;
      if (s.status !== "failed") row.smmRevenue += Math.max(0, Number(s.charge || 0) - Number(s.refundedAmount || 0));
    }
    for (const d of recentDeposits) {
      const row = byDay[dayKey(d.createdAt)];
      if (!row) continue;
      row.depositCount += 1;
      if (d.status === "completed") {
        row.depositAmount += Number(d.amount || 0);
        const key = d.provider || "pakasir";
        depositByProvider[key] = depositByProvider[key] || { count: 0, amount: 0 };
        depositByProvider[key].count += 1;
        depositByProvider[key].amount += Number(d.amount || 0);
      }
    }

    const totals = daily.reduce(
      (acc, d) => ({
        orderCount: acc.orderCount + d.orderCount,
        orderRevenue: acc.orderRevenue + d.orderRevenue,
        smmCount: acc.smmCount + d.smmCount,
        smmRevenue: acc.smmRevenue + d.smmRevenue,
        depositCount: acc.depositCount + d.depositCount,
        depositAmount: acc.depositAmount + d.depositAmount
      }),
      { orderCount: 0, orderRevenue: 0, smmCount: 0, smmRevenue: 0, depositCount: 0, depositAmount: 0 }
    );

    return NextResponse.json({
      days: daily,
      totals,
      depositByProvider,
      topServices: topServices.map((s) => ({ name: s._id || "-", count: s.count })),
      topCountries: topCountries.map((c) => ({ name: c._id || "-", count: c.count })),
      topPlatforms: topPlatforms.map((c) => ({ name: c._id || "-", count: c.count }))
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal mengambil statistik." }, { status: 500 });
  }
}
