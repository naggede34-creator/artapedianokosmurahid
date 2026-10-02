import { NextResponse } from "next/server";
import { depositsCol } from "@/lib/db";

export const dynamic = "force-dynamic";

// Nominal deposit yang paling sering berhasil dipakai akun ini (maks 4), untuk chip "Biasa kamu" di halaman deposit.
// Diurutkan dari yang paling sering; sama banyak → yang terbaru dulu. Hanya deposit saldo nokos yang sudah lunas.
export async function GET(req) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) return NextResponse.json({ items: [] });
  try {
    const col = await depositsCol();
    const rows = await col
      .find({ token, status: "completed", wallet: { $ne: "game" } }, { projection: { amount: 1, createdAt: 1 } })
      .sort({ createdAt: -1 })
      .limit(60)
      .toArray();
    const peta = new Map();
    for (const r of rows) {
      const a = Math.floor(Number(r.amount));
      if (!(a >= 1000)) continue;
      const e = peta.get(a) || { amount: a, n: 0, terbaru: 0 };
      e.n++; e.terbaru = Math.max(e.terbaru, new Date(r.createdAt).getTime() || 0);
      peta.set(a, e);
    }
    const items = [...peta.values()].sort((x, y) => y.n - x.n || y.terbaru - x.terbaru).slice(0, 4).map(({ amount, n }) => ({ amount, n }));
    return NextResponse.json({ items }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ items: [] }); }
}
