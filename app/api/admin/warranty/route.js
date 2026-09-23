import { NextResponse } from "next/server";
import { warrantyClaimsCol, usersCol, balanceLogsCol } from "@/lib/db";
import { isAdminRequest } from "@/lib/adminAuth";
import { ObjectId } from "mongodb";
import { warrantyResolvedNotif, warrantyPublicNotif } from "@/lib/telegram";
import { umumkan } from "@/lib/notifyHub";

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
  const now = new Date();
  const status = action === "approve" ? "approved" : "rejected";

  // Status diklaim lebih dulu DI DALAM filter, bukan dibaca lalu ditulis.
  // Kalau statusnya dibaca dulu, dua klik "Setujui" yang berdekatan sama-sama
  // membaca "pending" dan sama-sama lolos — dan uang refundnya masuk dua kali.
  const claim = await claims.findOneAndUpdate(
    { _id: new ObjectId(id), status: "pending" },
    { $set: { status, adminNote: adminNote || "", resolvedAt: now } }
  );
  if (!claim) {
    const ada = await claims.findOne({ _id: new ObjectId(id) });
    if (!ada) return NextResponse.json({ error: "Klaim tidak ditemukan." }, { status: 404 });
    return NextResponse.json({ error: "Klaim ini sudah diproses sebelumnya." }, { status: 400 });
  }

  let saldoBaru = null;
  if (action === "approve") {
    const users = await usersCol();
    // $inc, bukan $set dengan saldo yang dibaca sebelumnya: dengan $set, satu
    // transaksi lain yang selesai di sela-selanya akan tertimpa dan hilang.
    const updated = await users.findOneAndUpdate(
      { token: claim.token },
      { $inc: { balance: claim.purchasePrice } },
      { returnDocument: "after" }
    );
    if (!updated) {
      // Usernya hilang — kembalikan klaimnya ke pending supaya tidak tercatat
      // sebagai disetujui padahal tidak ada saldo yang masuk.
      await claims.updateOne({ _id: new ObjectId(id) }, { $set: { status: "pending", resolvedAt: null } });
      return NextResponse.json({ error: "User tidak ditemukan." }, { status: 404 });
    }
    saldoBaru = updated.balance;

    const logs = await balanceLogsCol();
    await logs.insertOne({
      token: claim.token,
      type: "warranty_refund",
      amount: claim.purchasePrice,
      balanceAfter: saldoBaru,
      note: `Refund garansi nokos #${claim.orderId}`,
      title: `Garansi ${claim.serviceName || ""}`.trim(),
      ref: String(claim.orderId || id),
      createdAt: now
    });
  }

  umumkan({
    jenis: action === "approve" ? "garansi" : null,
    admin: warrantyResolvedNotif({
      approved: action === "approve",
      orderId: claim.orderId,
      serviceName: claim.serviceName,
      countryName: claim.countryName,
      amount: claim.purchasePrice,
      token: claim.token,
      adminNote,
      balance: saldoBaru
    }),
    // Penolakan tidak diumumkan: alasannya menyangkut kasus satu orang, dan
    // tidak ada gunanya dibaca orang lain.
    publik:
      action === "approve"
        ? warrantyPublicNotif({
            serviceName: claim.serviceName,
            amount: claim.purchasePrice,
            token: claim.token
          })
        : null
  });

  return NextResponse.json({ ok: true, balance: saldoBaru });
}
