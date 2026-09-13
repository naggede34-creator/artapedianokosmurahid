import { NextResponse } from "next/server";
import { usersCol, adminBalanceLogsCol } from "@/lib/db";
import { isAdminRequest } from "@/lib/adminAuth";
import { sendTelegramNotif, adminBalanceAdjustNotif } from "@/lib/telegram";

export async function POST(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const { token, amount, action, note } = await req.json();
    const nominal = Math.abs(Number(amount || 0));
    if (!token || !nominal || !["add", "sub"].includes(action)) {
      return NextResponse.json({ error: "Parameter tidak valid." }, { status: 400 });
    }

    const users = await usersCol();
    const delta = action === "add" ? nominal : -nominal;

    const updated = await users.findOneAndUpdate(
      action === "sub" ? { token, balance: { $gte: nominal } } : { token },
      { $inc: { balance: delta } },
      { returnDocument: "after" }
    );

    if (!updated) {
      return NextResponse.json(
        { error: action === "sub" ? "Saldo user tidak cukup untuk dikurangi." : "Akun tidak ditemukan." },
        { status: 400 }
      );
    }

    const logs = await adminBalanceLogsCol();
    await logs.insertOne({
      token,
      amount: nominal,
      action,
      note: note || "",
      balanceAfter: updated.balance,
      createdAt: new Date()
    });

    sendTelegramNotif(
      adminBalanceAdjustNotif({ token, amount: nominal, action, newBalance: updated.balance, note })
    );

    return NextResponse.json({ ok: true, balance: updated.balance });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal mengubah saldo." }, { status: 500 });
  }
}
