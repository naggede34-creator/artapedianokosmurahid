// Pita bukti sosial: "baru saja beli / menang" — tanpa nama lengkap, tanpa token, tanpa nominal.
import { NextResponse } from "next/server";
import { samarkan } from "@/lib/samarkan";
import { otpOrdersCol, gameMatchCol, usersCol } from "@/lib/db";

export const dynamic = "force-dynamic";

let cache = { t: 0, v: null };

export async function GET() {
  if (cache.v && Date.now() - cache.t < 20_000) return NextResponse.json(cache.v, { headers: { "Cache-Control": "public, max-age=15" } });
  try {
    const since = new Date(Date.now() - 3 * 24 * 3600_000);
    const [orders, duels] = await Promise.all([
      (await otpOrdersCol()).find({ status: "done", createdAt: { $gte: since } }).sort({ updatedAt: -1, createdAt: -1 }).limit(14).project({ token: 1, serviceName: 1, countryName: 1, createdAt: 1, updatedAt: 1 }).toArray(),
      (await gameMatchCol()).find({ jenis: "tarung", status: "selesai", "hasil.pemenang": { $ne: null }, selesaiAt: { $gte: since } }).sort({ selesaiAt: -1 }).limit(8).toArray()
    ]);
    const tokens = [...new Set(orders.map((o) => o.token).filter(Boolean))];
    const users = tokens.length ? await (await usersCol()).find({ token: { $in: tokens } }).project({ token: 1, name: 1 }).toArray() : [];
    const namaDari = Object.fromEntries(users.map((u) => [u.token, u.name]));
    const item = [];
    for (const o of orders) item.push({ tipe: "beli", user: samarkan(namaDari[o.token], o.token), teks: `baru saja beli nomor ${o.serviceName || "OTP"}${o.countryName ? ` (${o.countryName})` : ""}`, at: new Date(o.updatedAt || o.createdAt).getTime() });
    for (const g of duels) {
      const m = (g.pemain || []).find((p) => p.pid === g.hasil?.pemenang);
      if (m) item.push({ tipe: "menang", user: samarkan(m.nama, m.pid), teks: "baru saja menang di Arena Pendekar 🥋", at: new Date(g.selesaiAt).getTime() });
    }
    item.sort((a, b) => b.at - a.at);
    cache = { t: Date.now(), v: { items: item.slice(0, 16) } };
  } catch {
    cache = { t: Date.now(), v: { items: [] } };
  }
  return NextResponse.json(cache.v, { headers: { "Cache-Control": "public, max-age=15" } });
}
