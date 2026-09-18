// GET /api/admin/activity?token=&type=all|otp|deposit|balance&from=&to=&page=1
import { NextResponse } from "next/server";
import { otpOrdersCol, depositsCol, balanceLogsCol } from "@/lib/db";
import { isAdminRequest } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

function toWIB(date) {
  if (!date) return "";
  return new Date(date).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
}

export async function GET(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token")?.trim() || "";
  const type = searchParams.get("type") || "all";
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));

  const dateFilter = {};
  if (from) dateFilter.$gte = new Date(from);
  if (to) {
    const d = new Date(to);
    d.setHours(23, 59, 59, 999);
    dateFilter.$lte = d;
  }

  const tokenFilter = token ? { token: { $regex: token, $options: "i" } } : {};
  const dateKey = Object.keys(dateFilter).length ? { createdAt: dateFilter } : {};

  try {
    const [otpRows, depositRows, balanceRows] = await Promise.all([
      (type === "all" || type === "otp")
        ? (async () => {
            const col = await otpOrdersCol();
            return col
              .find({ ...tokenFilter, ...dateKey })
              .sort({ createdAt: -1 })
              .limit(500)
              .project({ orderId: 1, token: 1, serviceName: 1, countryName: 1, phoneNumber: 1, price: 1, status: 1, otpCode: 1, refunded: 1, createdAt: 1 })
              .toArray();
          })()
        : [],
      (type === "all" || type === "deposit")
        ? (async () => {
            const col = await depositsCol();
            return col
              .find({ ...tokenFilter, ...dateKey })
              .sort({ createdAt: -1 })
              .limit(500)
              .project({ depositId: 1, token: 1, provider: 1, amount: 1, status: 1, credited: 1, paidAt: 1, createdAt: 1 })
              .toArray();
          })()
        : [],
      (type === "all" || type === "balance")
        ? (async () => {
            const col = await balanceLogsCol();
            return col
              .find({ ...tokenFilter, ...dateKey })
              .sort({ createdAt: -1 })
              .limit(500)
              .project({ token: 1, type: 1, amount: 1, balanceAfter: 1, title: 1, ref: 1, createdAt: 1 })
              .toArray();
          })()
        : [],
    ]);

    const items = [
      ...otpRows.map((o) => ({
        kind: "otp",
        icon: "📱",
        token: o.token,
        title: `${o.serviceName || "-"} — ${o.countryName || "-"}`,
        detail: o.phoneNumber || "",
        amount: -(o.price || 0),
        status: o.refunded ? "refund" : o.status,
        ref: o.orderId,
        createdAt: o.createdAt,
        createdWIB: toWIB(o.createdAt),
      })),
      ...depositRows.map((d) => ({
        kind: "deposit",
        icon: "💳",
        token: d.token,
        title: `Deposit via ${d.provider || "QRIS"}`,
        detail: d.status === "completed" ? "Berhasil" : d.status,
        amount: d.status === "completed" ? (d.amount || 0) : 0,
        status: d.status,
        ref: d.depositId || String(d._id),
        createdAt: d.createdAt,
        createdWIB: toWIB(d.createdAt),
      })),
      ...balanceRows.map((b) => ({
        kind: "balance",
        icon: b.amount > 0 ? "➕" : "➖",
        token: b.token,
        title: b.title || b.type,
        detail: b.ref || "",
        amount: b.amount,
        balanceAfter: b.balanceAfter,
        status: "logged",
        ref: b.ref,
        createdAt: b.createdAt,
        createdWIB: toWIB(b.createdAt),
      })),
    ];

    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const total = items.length;
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const safePage = Math.min(page, pages);
    const slice = items.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

    return NextResponse.json({ items: slice, total, page: safePage, pages });
  } catch (err) {
    console.error("[admin/activity]", err);
    return NextResponse.json({ error: "Gagal mengambil log aktivitas." }, { status: 500 });
  }
}
