import { NextResponse } from "next/server";
import { usersCol, adminBalanceLogsCol } from "@/lib/db";
import { adminSah } from "@/lib/adminAuth";
import { sendTelegramNotif, adminBalanceAdjustNotif } from "@/lib/telegram";
import { logBalance } from "@/lib/ledger";

export async function POST(req) {
  if (!await adminSah(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const { token, amount, action, note, wallet } = await req.json();
    // wallet: "game" → ubah SALDO GAME; selain itu saldo nokos (bawaan).
    const medan = wallet === "game" ? "saldoGame" : "balance";
    const nominal = Math.floor(Math.abs(Number(amount || 0)));
    const cleanNote = String(note || "").slice(0, 120);
    if (!token || !nominal || !["add", "sub"].includes(action)) {
      return NextResponse.json({ error: "Parameter tidak valid." }, { status: 400 });
    }

    const users = await usersCol();
    const delta = action === "add" ? nominal : -nominal;

    const updated = await users.findOneAndUpdate(
      action === "sub" ? { token, [medan]: { $gte: nominal } } : { token },
      { $inc: { [medan]: delta } },
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
      note: cleanNote,
      balanceAfter: updated[medan],
      ...(medan === "saldoGame" ? { wallet: "game" } : {}),
      createdAt: new Date()
    });

    await logBalance({
      token,
      type: action === "add" ? "admin_add" : "admin_sub",
      amount: delta,
      balanceAfter: updated[medan],
      ...(medan === "saldoGame" ? { wallet: "game" } : {}),
      title: cleanNote ? `Admin: ${cleanNote}` : undefined
    });

    sendTelegramNotif(
      adminBalanceAdjustNotif({ token, amount: nominal, action, newBalance: updated[medan], note: medan === "saldoGame" ? `[SALDO GAME] ${cleanNote}` : cleanNote })
    );

    return NextResponse.json({ ok: true, balance: updated[medan], wallet: medan === "saldoGame" ? "game" : "nokos" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal mengubah saldo." }, { status: 500 });
  }
}
