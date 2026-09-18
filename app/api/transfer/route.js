import { NextResponse } from "next/server";
import { usersCol } from "@/lib/db";
import { logBalance } from "@/lib/ledger";
import { sendTelegramNotif, transferNotif } from "@/lib/telegram";

export const dynamic = "force-dynamic";

const MIN_TRANSFER = 1000;

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const fromToken = String(body.token || "").trim();
    const toToken = String(body.targetToken || "").trim().toUpperCase();
    const amount = Math.floor(Number(body.amount || 0));

    if (!fromToken) return NextResponse.json({ error: "Kode akun kosong." }, { status: 400 });
    if (!toToken) return NextResponse.json({ error: "Kode akun tujuan wajib diisi." }, { status: 400 });
    if (fromToken === toToken) return NextResponse.json({ error: "Tidak bisa transfer ke akun sendiri." }, { status: 400 });
    if (!Number.isFinite(amount) || amount < MIN_TRANSFER) {
      return NextResponse.json({ error: `Nominal transfer minimal Rp${MIN_TRANSFER.toLocaleString("id-ID")}.` }, { status: 400 });
    }

    const users = await usersCol();
    const target = await users.findOne({ token: toToken });
    if (!target) return NextResponse.json({ error: "Kode akun tujuan tidak ditemukan." }, { status: 404 });

    // Potong saldo pengirim hanya kalau cukup (atomik, tidak bisa minus).
    const debited = await users.findOneAndUpdate(
      { token: fromToken, balance: { $gte: amount } },
      { $inc: { balance: -amount } },
      { returnDocument: "after" }
    );
    if (!debited) {
      return NextResponse.json({ error: "Saldo tidak cukup atau akun tidak ditemukan." }, { status: 400 });
    }

    const credited = await users.findOneAndUpdate(
      { token: toToken },
      { $inc: { balance: amount } },
      { returnDocument: "after" }
    );
    if (!credited) {
      // Akun tujuan hilang di tengah proses: kembalikan saldo pengirim.
      await users.updateOne({ token: fromToken }, { $inc: { balance: amount } });
      return NextResponse.json({ error: "Transfer gagal, saldo dikembalikan." }, { status: 500 });
    }

    const ref = `TF${Date.now()}`;
    await logBalance({
      token: fromToken,
      type: "transfer_out",
      amount: -amount,
      balanceAfter: debited.balance,
      title: `Transfer ke ${toToken.slice(0, 7)}…`,
      ref
    });
    await logBalance({
      token: toToken,
      type: "transfer_in",
      amount,
      balanceAfter: credited.balance,
      title: `Transfer dari ${fromToken.slice(0, 7)}…`,
      ref
    });

    sendTelegramNotif(transferNotif({ fromToken, toToken, amount, fromBalance: debited.balance }));

    return NextResponse.json({ balance: debited.balance, transferredTo: toToken, amount, ref });
  } catch (err) {
    console.error("[transfer]", err);
    return NextResponse.json({ error: "Gagal memproses transfer." }, { status: 500 });
  }
}
