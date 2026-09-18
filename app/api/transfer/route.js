import { NextResponse } from "next/server";
import { usersCol } from "@/lib/db";
import { logBalance } from "@/lib/ledger";
import { sendTelegramNotif, sendTelegramPhoto, transferNotif } from "@/lib/telegram";
import { generateReceiptPng, transferParams } from "@/lib/receiptImage";

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

    // Cek apakah pengirim punya saldo deposit yang cukup.
    // depositBalance: hanya bertambah dari deposit tunai — saldo dari voucher, spin wheel,
    // poin, cashback, dll. TIDAK bisa ditransfer. Akun lama (tanpa field depositBalance)
    // dianggap seluruh saldo berasal dari deposit (backwards-compatible).
    const fromUser = await users.findOne({ token: fromToken }, { projection: { balance: 1, depositBalance: 1, name: 1 } });
    if (!fromUser) return NextResponse.json({ error: "Kode akun tidak ditemukan." }, { status: 404 });

    const hasDepositField = fromUser.depositBalance !== undefined && fromUser.depositBalance !== null;
    const transferable = hasDepositField ? fromUser.depositBalance : fromUser.balance;

    if (fromUser.balance < amount) {
      return NextResponse.json({ error: "Saldo tidak cukup." }, { status: 400 });
    }
    if (transferable < amount) {
      return NextResponse.json({
        error: `Transfer hanya bisa menggunakan saldo dari deposit. Saldo deposit kamu Rp${transferable.toLocaleString("id-ID")} — tidak cukup untuk transfer Rp${amount.toLocaleString("id-ID")}. Saldo dari voucher, spin wheel, atau poin tidak bisa ditransfer.`
      }, { status: 400 });
    }

    // Potong saldo pengirim hanya kalau cukup (atomik, tidak bisa minus).
    const debitCond = { token: fromToken, balance: { $gte: amount } };
    const debitInc = { balance: -amount };
    if (hasDepositField) {
      debitCond.depositBalance = { $gte: amount };
      debitInc.depositBalance = -amount;
    }
    const debited = await users.findOneAndUpdate(
      debitCond,
      { $inc: debitInc },
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
      const restoreInc = { balance: amount };
      if (hasDepositField) restoreInc.depositBalance = amount;
      await users.updateOne({ token: fromToken }, { $inc: restoreInc });
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

    const transferText = transferNotif({ fromToken, toToken, amount, fromBalance: debited.balance });
    sendTelegramNotif(transferText);
    generateReceiptPng(transferParams({
      ref,
      fromToken,
      fromName: debited?.name,
      toToken,
      toName: credited?.name,
      amount,
      fromBalance: debited.balance
    })).then((png) => sendTelegramPhoto(png, transferText.slice(0, 800))).catch((err) => console.error("[receipt/transfer]", err?.message || err));

    return NextResponse.json({ balance: debited.balance, transferredTo: toToken, amount, ref });
  } catch (err) {
    console.error("[transfer]", err);
    return NextResponse.json({ error: "Gagal memproses transfer." }, { status: 500 });
  }
}
