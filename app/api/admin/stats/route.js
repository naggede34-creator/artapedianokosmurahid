import { NextResponse } from "next/server";
import { otpOrdersCol, depositsCol } from "@/lib/db";
import { isAdminRequest } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

function dayKey(d) {
  return new Date(d).toISOString().slice(0, 10);
}

export async function GET(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const days = 7;
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - (days - 1));

    const orders = await otpOrdersCol();
    const deposits = await depositsCol();

    const [recentOrders, recentDeposits, topServices, topCountries] = await Promise.all([
      orders.find({ createdAt: { $gte: since } }).project({ createdAt: 1, price: 1, status: 1 }).toArray(),
      deposits.find({ createdAt: { $gte: since } }).project({ createdAt: 1, amount: 1, status: 1 }).toArray(),
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
        .toArray()
    ]);

    // Susun grid 7 hari terakhir supaya hari tanpa transaksi tetap muncul dengan nilai 0.
    const daily = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(since);
      d.setDate(since.getDate() + i);
      daily.push({ date: dayKey(d), orderCount: 0, orderRevenue: 0, depositCount: 0, depositAmount: 0 });
    }
    const byDay = Object.fromEntries(daily.map((d) => [d.date, d]));

    for (const o of recentOrders) {
      const key = dayKey(o.createdAt);
      if (!byDay[key]) continue;
      byDay[key].orderCount += 1;
      if (!["canceled"].includes(o.status)) byDay[key].orderRevenue += Number(o.price || 0);
    }
    for (const d of recentDeposits) {
      const key = dayKey(d.createdAt);
      if (!byDay[key]) continue;
      byDay[key].depositCount += 1;
      if (d.status === "completed") byDay[key].depositAmount += Number(d.amount || 0);
    }

    const totals = daily.reduce(
      (acc, d) => ({
        orderCount: acc.orderCount + d.orderCount,
        orderRevenue: acc.orderRevenue + d.orderRevenue,
        depositCount: acc.depositCount + d.depositCount,
        depositAmount: acc.depositAmount + d.depositAmount
      }),
      { orderCount: 0, orderRevenue: 0, depositCount: 0, depositAmount: 0 }
    );

    return NextResponse.json({
      days: daily,
      totals,
      topServices: topServices.map((s) => ({ name: s._id || "-", count: s.count })),
      topCountries: topCountries.map((c) => ({ name: c._id || "-", count: c.count }))
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal mengambil statistik." }, { status: 500 });
  }
}
