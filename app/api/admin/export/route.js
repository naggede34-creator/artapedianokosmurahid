// GET /api/admin/export?type=deposits|transactions|users&from=YYYY-MM-DD&to=YYYY-MM-DD
import { NextResponse } from "next/server";
import { usersCol, depositsCol, otpOrdersCol } from "@/lib/db";
import { isAdminRequest } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

function escCsv(v) {
  const s = String(v ?? "").replace(/"/g, '""');
  return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s}"` : s;
}

function toWIB(date) {
  if (!date) return "";
  return new Date(date).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
}

export async function GET(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "transactions";
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const dateFilter = {};
  if (from) dateFilter.$gte = new Date(from);
  if (to) {
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);
    dateFilter.$lte = toDate;
  }

  try {
    let csv = "";
    let filename = "";

    if (type === "users") {
      const users = await usersCol();
      const filter = from || to ? { createdAt: dateFilter } : {};
      const rows = await users.find(filter).sort({ createdAt: -1 }).limit(5000).toArray();
      const headers = ["Token", "Nama", "Saldo", "Total Deposit", "Poin", "Tier", "Referral", "Ditangguhkan", "Daftar (WIB)"];
      csv = headers.join(",") + "\n" + rows.map((u) => [
        u.token, u.name || "", u.balance || 0, u.depositTotal || 0,
        u.points || 0, u.lastKnownTier || "Bronze", u.referralCount || 0,
        u.suspended ? "Ya" : "Tidak", toWIB(u.createdAt)
      ].map(escCsv).join(",")).join("\n");
      filename = `artapedia-users-${Date.now()}.csv`;

    } else if (type === "deposits") {
      const deposits = await depositsCol();
      const filter = from || to ? { createdAt: dateFilter } : {};
      const rows = await deposits.find(filter).sort({ createdAt: -1 }).limit(5000).toArray();
      const headers = ["ID Deposit", "Token", "Provider", "Jumlah (Rp)", "Status", "Dibuat (WIB)", "Dibayar (WIB)"];
      csv = headers.join(",") + "\n" + rows.map((d) => [
        d.depositId || d._id?.toString(), d.token, d.provider,
        d.amount || 0, d.status, toWIB(d.createdAt), toWIB(d.paidAt)
      ].map(escCsv).join(",")).join("\n");
      filename = `artapedia-deposits-${Date.now()}.csv`;

    } else {
      // transactions (OTP orders)
      const orders = await otpOrdersCol();
      const filter = from || to ? { createdAt: dateFilter } : {};
      const rows = await orders.find(filter).sort({ createdAt: -1 }).limit(5000).toArray();
      const headers = ["Order ID", "Token", "Layanan", "Negara", "Nomor", "Harga Jual (Rp)", "Harga Base (Rp)", "Status", "OTP Code", "Dibuat (WIB)"];
      csv = headers.join(",") + "\n" + rows.map((o) => [
        o.orderId, o.token, o.serviceName, o.countryName, o.phoneNumber,
        o.price || 0, o.basePrice || 0, o.status, o.otpCode || "", toWIB(o.createdAt)
      ].map(escCsv).join(",")).join("\n");
      filename = `artapedia-transaksi-${Date.now()}.csv`;
    }

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (err) {
    console.error("[admin/export]", err);
    return NextResponse.json({ error: "Gagal ekspor data." }, { status: 500 });
  }
}
