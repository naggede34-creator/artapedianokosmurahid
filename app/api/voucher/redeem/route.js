import { NextResponse } from "next/server";
import { vouchersCol, usersCol } from "@/lib/db";
import { sendTelegramNotif, voucherRedeemedNotif } from "@/lib/telegram";
import { logBalance } from "@/lib/ledger";
import { rateLimit } from "@/lib/rateLimit";

export async function POST(req) {
  try {
    const { token, code: rawCode } = await req.json();
    const code = (rawCode || "").trim().toUpperCase();
    if (!token || !code) return NextResponse.json({ error: "Kode voucher wajib diisi." }, { status: 400 });

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!rateLimit(`${token}:voucher`, 5, 60_000) || !rateLimit(`${ip}:voucher`, 10, 60_000)) {
      return NextResponse.json({ error: "Terlalu banyak percobaan. Coba lagi dalam 1 menit." }, { status: 429 });
    }

    const users = await usersCol();
    const user = await users.findOne({ token });
    if (!user) return NextResponse.json({ error: "Kode akun tidak ditemukan." }, { status: 404 });

    const vouchers = await vouchersCol();
    const voucher = await vouchers.findOne({ code });
    if (!voucher) return NextResponse.json({ error: "Kode voucher tidak ditemukan." }, { status: 404 });
    if (voucher.active === false) return NextResponse.json({ error: "Voucher ini sudah tidak aktif." }, { status: 400 });
    if ((voucher.redeemedBy || []).includes(token)) {
      return NextResponse.json({ error: "Kamu sudah pernah memakai voucher ini." }, { status: 400 });
    }
    if ((voucher.usedCount || 0) >= voucher.maxUses) {
      return NextResponse.json({ error: "Kuota voucher ini sudah habis." }, { status: 400 });
    }

    // Klaim atomik: pastikan kuota belum habis & user belum pernah pakai, dicek ulang di query
    // supaya dua klaim bersamaan tidak sama-sama lolos (race condition).
    const claimed = await vouchers.findOneAndUpdate(
      { code, active: { $ne: false }, redeemedBy: { $ne: token }, $expr: { $lt: ["$usedCount", "$maxUses"] } },
      { $inc: { usedCount: 1 }, $push: { redeemedBy: token } },
      { returnDocument: "after" }
    );
    if (!claimed) {
      return NextResponse.json({ error: "Voucher ini sudah tidak bisa diklaim (kuota habis atau sudah dipakai)." }, { status: 400 });
    }

    const updatedUser = await users.findOneAndUpdate(
      { token },
      { $inc: { balance: voucher.amount } },
      { returnDocument: "after" }
    );

    await logBalance({
      token,
      type: "voucher",
      amount: voucher.amount,
      balanceAfter: updatedUser?.balance,
      title: `Voucher ${code}`,
      ref: code
    });

    sendTelegramNotif(
      voucherRedeemedNotif({
        code,
        amount: voucher.amount,
        token,
        remainingUses: Math.max(0, claimed.maxUses - claimed.usedCount)
      })
    );

    return NextResponse.json({ ok: true, amount: voucher.amount, balance: updatedUser?.balance });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal mengklaim voucher." }, { status: 500 });
  }
}
