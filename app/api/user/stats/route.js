import { NextResponse } from "next/server";
import { otpOrdersCol, depositsCol } from "@/lib/db";

export const dynamic = "force-dynamic";

function dayKey(d) {
  return new Date(d).toISOString().slice(0, 10);
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");
    if (!token) return NextResponse.json({ error: "Kode akun kosong." }, { status: 400 });

    const days = 30;
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - (days - 1));

    const orders = await otpOrdersCol();
    const deposits = await depositsCol();

    const [allOrders, allDeposits] = await Promise.all([
      orders.find({ token }).project({ createdAt: 1, price: 1, status: 1 }).toArray(),
      deposits.find({ token }).project({ createdAt: 1, amount: 1, status: 1 }).toArray()
    ]);

    const totalTransaksi = allOrders.length;
    const otpBerhasil = allOrders.filter((o) => o.status === "done").length;
    const depositSukses = allDeposits.filter((d) => d.status === "completed").length;

    const daily = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(since);
      d.setDate(since.getDate() + i);
      daily.push({ date: dayKey(d), total: 0, completed: 0, masuk: 0, keluar: 0 });
    }
    const byDay = Object.fromEntries(daily.map((d) => [d.date, d]));

    for (const o of allOrders) {
      const key = dayKey(o.createdAt);
      if (!byDay[key]) continue;
      byDay[key].total += 1;
      if (o.status === "done") byDay[key].completed += 1;
      if (o.status === "done") byDay[key].keluar += Number(o.price || 0);
    }
    for (const d of allDeposits) {
      const key = dayKey(d.createdAt);
      if (!byDay[key]) continue;
      if (d.status === "completed") byDay[key].masuk += Number(d.amount || 0);
    }

    return NextResponse.json({
      totalTransaksi,
      otpBerhasil,
      depositSukses,
      daily
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal mengambil statistik akun." }, { status: 500 });
  }
}
