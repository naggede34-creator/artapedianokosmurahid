import { NextResponse } from "next/server";
import { usersCol, otpOrdersCol } from "@/lib/db";
import { logBalance } from "@/lib/ledger";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const WINBACK_BONUS = 500;
const WINBACK_FIELD = "winbackClaimedAt";
const MIN_INACTIVE_DAYS = 1;
const MAX_INACTIVE_DAYS = 30;

export async function POST(req) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!rateLimit(`${ip}:winback`, 3, 60_000)) {
      return NextResponse.json({ error: "Terlalu banyak percobaan." }, { status: 429 });
    }

    const { token } = await req.json().catch(() => ({}));
    if (!token) return NextResponse.json({ error: "Token tidak valid." }, { status: 400 });

    const users = await usersCol();
    const user = await users.findOne({ token });
    if (!user) return NextResponse.json({ error: "Akun tidak ditemukan." }, { status: 404 });

    if (user[WINBACK_FIELD]) {
      return NextResponse.json({ error: "Bonus sudah pernah diklaim sebelumnya." }, { status: 409 });
    }

    // Cek transaksi terakhir
    const orders = await otpOrdersCol();
    const lastOrder = await orders.findOne({ token }, { sort: { createdAt: -1 }, projection: { createdAt: 1 } });

    const now = Date.now();
    if (lastOrder) {
      const daysDiff = (now - new Date(lastOrder.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      if (daysDiff < MIN_INACTIVE_DAYS) {
        return NextResponse.json({ error: "Kamu masih aktif bertransaksi, bonus ini hanya untuk yang sudah lama tidak belanja." }, { status: 400 });
      }
      if (daysDiff > MAX_INACTIVE_DAYS) {
        return NextResponse.json({ error: "Terlalu lama tidak aktif. Silakan hubungi CS untuk bantuan." }, { status: 400 });
      }
    }

    // Kreditkan bonus
    const result = await users.findOneAndUpdate(
      { token, [WINBACK_FIELD]: { $exists: false } },
      {
        $inc: { balance: WINBACK_BONUS },
        $set: { [WINBACK_FIELD]: new Date() }
      },
      { returnDocument: "after" }
    );

    if (!result) {
      return NextResponse.json({ error: "Bonus sudah pernah diklaim." }, { status: 409 });
    }

    await logBalance({
      token,
      type: "admin_add",
      amount: WINBACK_BONUS,
      balanceAfter: result.balance,
      title: "Bonus Win-back - Kami Kangen Kamu!",
      ref: "winback"
    });

    return NextResponse.json({ ok: true, amount: WINBACK_BONUS, balance: result.balance });
  } catch (err) {
    console.error("[winback]", err?.message || err);
    return NextResponse.json({ error: "Terjadi kesalahan server." }, { status: 500 });
  }
}
