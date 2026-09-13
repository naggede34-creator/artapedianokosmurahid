import { NextResponse } from "next/server";
import { usersCol } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const fromToken = String(body.token || "").trim();
    const toToken = String(body.targetToken || "").trim();
    const amount = Number(body.amount || 0);

    if (!fromToken) return NextResponse.json({ error: "Kode akun kosong." }, { status: 400 });
    if (!toToken) return NextResponse.json({ error: "Kode akun tujuan wajib diisi." }, { status: 400 });
    if (fromToken === toToken) return NextResponse.json({ error: "Tidak bisa transfer ke akun sendiri." }, { status: 400 });
    if (!Number.isFinite(amount) || amount < 1000) {
      return NextResponse.json({ error: "Nominal transfer minimal Rp1.000." }, { status: 400 });
    }

    const users = await usersCol();

    const target = await users.findOne({ token: toToken });
    if (!target) return NextResponse.json({ error: "Kode akun tujuan tidak ditemukan." }, { status: 404 });

    // Kurangi saldo pengirim hanya kalau saldonya cukup (filter balance >= amount),
    // supaya tidak race-condition jadi minus.
    const debited = await users.findOneAndUpdate(
      { token: fromToken, balance: { $gte: amount } },
      { $inc: { balance: -amount } },
      { returnDocument: "after" }
    );
    const debitedDoc = debited?.value || debited;
    if (!debitedDoc) {
      return NextResponse.json({ error: "Saldo tidak cukup atau akun tidak ditemukan." }, { status: 400 });
    }

    await users.updateOne({ token: toToken }, { $inc: { balance: amount } });

    return NextResponse.json({ balance: debitedDoc.balance, transferredTo: toToken, amount });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal memproses transfer." }, { status: 500 });
  }
}
