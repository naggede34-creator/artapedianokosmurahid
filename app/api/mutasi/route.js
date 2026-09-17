import { NextResponse } from "next/server";
import { balanceLogsCol, depositsCol, otpOrdersCol } from "@/lib/db";

export const dynamic = "force-dynamic";

// Mutasi saldo diambil dari buku besar (balance_logs). Untuk transaksi lama yang
// terjadi sebelum buku besar ada, data deposit & OTP lama ikut ditampilkan supaya
// riwayat user tidak terlihat kosong.
export async function GET(req) {
  try {
    const token = new URL(req.url).searchParams.get("token");
    if (!token) return NextResponse.json({ error: "Kode akun kosong." }, { status: 400 });

    const logs = await balanceLogsCol();
    const ledger = await logs.find({ token }).sort({ createdAt: -1 }).limit(200).toArray();
    const items = ledger.map((l) => ({
      id: l._id.toString(),
      type: l.type,
      title: l.title,
      amount: l.amount,
      balanceAfter: l.balanceAfter ?? null,
      ref: l.ref || null,
      createdAt: l.createdAt
    }));

    const oldest = ledger.length ? ledger[ledger.length - 1].createdAt : new Date();
    const legacyFilter = { token, createdAt: { $lt: oldest } };
    const [deps, otps] = await Promise.all([
      (await depositsCol())
        .find({ ...legacyFilter, status: "completed" }, { projection: { orderId: 1, amount: 1, createdAt: 1, provider: 1 } })
        .sort({ createdAt: -1 })
        .limit(100)
        .toArray(),
      (await otpOrdersCol())
        .find(legacyFilter, { projection: { orderId: 1, price: 1, createdAt: 1, serviceName: 1, countryName: 1, refunded: 1 } })
        .sort({ createdAt: -1 })
        .limit(100)
        .toArray()
    ]);

    for (const d of deps) {
      items.push({
        id: `legacy-dep-${d.orderId}`,
        type: "deposit",
        title: "Deposit saldo",
        amount: Number(d.amount) || 0,
        balanceAfter: null,
        ref: d.orderId,
        createdAt: d.createdAt
      });
    }
    for (const o of otps) {
      if (o.refunded) continue; // dibeli lalu direfund = netral
      items.push({
        id: `legacy-otp-${o.orderId}`,
        type: "otp",
        title: `OTP ${o.serviceName || ""} · ${o.countryName || ""}`.trim(),
        amount: -(Number(o.price) || 0),
        balanceAfter: null,
        ref: o.orderId,
        createdAt: o.createdAt
      });
    }

    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return NextResponse.json({ items: items.slice(0, 250) });
  } catch (err) {
    console.error("[mutasi]", err);
    return NextResponse.json({ error: "Gagal memuat mutasi saldo." }, { status: 500 });
  }
}
