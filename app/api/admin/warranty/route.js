import { NextResponse } from "next/server";
import { warrantyClaimsCol, usersCol, balanceLogsCol } from "@/lib/db";
import { isAdminRequest } from "@/lib/adminAuth";
import { ObjectId } from "mongodb";

export const dynamic = "force-dynamic";

export async function GET(req) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const claims = await warrantyClaimsCol();
  const list = await claims.find({}).sort({ createdAt: -1 }).toArray();

  return NextResponse.json({
    items: list.map((c) => ({
      id: c._id.toString(),
      token: c.token,
      orderId: c.orderId,
      serviceName: c.serviceName,
      countryName: c.countryName,
      phoneNumber: c.phoneNumber,
      description: c.description,
      screenshotData: c.screenshotData || null,
      purchasePrice: c.purchasePrice,
      status: c.status,
      adminNote: c.adminNote || "",
      createdAt: c.createdAt,
      resolvedAt: c.resolvedAt
    }))
  });
}

export async function POST(req) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id, action, adminNote } = await req.json();
  if (!id || !["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "Data tidak valid." }, { status: 400 });
  }

  const claims = await warrantyClaimsCol();
  const claim = await claims.findOne({ _id: new ObjectId(id) });
  if (!claim) return NextResponse.json({ error: "Klaim tidak ditemukan." }, { status: 404 });
  if (claim.status !== "pending") {
    return NextResponse.json({ error: "Klaim ini sudah diproses sebelumnya." }, { status: 400 });
  }

  const now = new Date();

  if (action === "approve") {
    const users = await usersCol();
    const user = await users.findOne({ token: claim.token });
    if (!user) return NextResponse.json({ error: "User tidak ditemukan." }, { status: 404 });

    const newBalance = (user.balance || 0) + claim.purchasePrice;
    await users.updateOne({ token: claim.token }, { $set: { balance: newBalance } });

    const logs = await balanceLogsCol();
    await logs.insertOne({
      token: claim.token,
      type: "warranty_refund",
      amount: claim.purchasePrice,
      note: `Refund garansi nokos #${claim.orderId}`,
      createdAt: now
    });
  }

  await claims.updateOne(
    { _id: new ObjectId(id) },
    { $set: { status: action === "approve" ? "approved" : "rejected", adminNote: adminNote || "", resolvedAt: now } }
  );

  return NextResponse.json({ ok: true });
}
