import { NextResponse } from "next/server";
import { usersCol } from "@/lib/db";
import { logBalance } from "@/lib/ledger";
import { sendTelegramNotif, transferNotif } from "@/lib/telegram";
import { rateLimit } from "@/lib/rateLimit";
import { getSettings, transferConfig, transferFeeFor } from "@/lib/settings";

export const dynamic = "force-dynamic";

const rupiah = (n) => `Rp${Number(n || 0).toLocaleString("id-ID")}`;

// GET dipakai halaman transfer untuk menampilkan status fitur + biaya admin,
// supaya angka di layar user persis sama dengan yang dihitung server.
export async function GET() {
  try {
    const settings = await getSettings();
    return NextResponse.json(transferConfig(settings));
  } catch (err) {
    console.error("[transfer:config]", err);
    return NextResponse.json({ error: "Gagal memuat konfigurasi transfer." }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!rateLimit(`${ip}:transfer`, 5, 60_000)) {
      return NextResponse.json({ error: "Terlalu banyak percobaan. Coba lagi dalam 1 menit." }, { status: 429 });
    }

    const settings = await getSettings();
    const cfg = transferConfig(settings);
    if (!cfg.enabled) {
      return NextResponse.json(
        { error: "Fitur transfer saldo antar pengguna sedang dinonaktifkan oleh admin." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const fromToken = String(body.token || "").trim();
    const toToken = String(body.targetToken || "").trim().toUpperCase();
    const amount = Math.floor(Number(body.amount || 0));

    if (!fromToken) return NextResponse.json({ error: "Kode akun kosong." }, { status: 400 });
    if (!toToken) return NextResponse.json({ error: "Kode akun tujuan wajib diisi." }, { status: 400 });
    if (fromToken === toToken) return NextResponse.json({ error: "Tidak bisa transfer ke akun sendiri." }, { status: 400 });
    if (!Number.isFinite(amount) || amount < cfg.minAmount) {
      return NextResponse.json({ error: `Nominal transfer minimal ${rupiah(cfg.minAmount)}.` }, { status: 400 });
    }
    if (cfg.maxAmount > 0 && amount > cfg.maxAmount) {
      return NextResponse.json({ error: `Nominal transfer maksimal ${rupiah(cfg.maxAmount)}.` }, { status: 400 });
    }

    // Biaya admin ditanggung PENGIRIM. Penerima tetap menerima nominal penuh.
    const fee = transferFeeFor(settings, amount);
    const total = amount + fee;

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

    if (fromUser.balance < total) {
      return NextResponse.json({
        error: fee > 0
          ? `Saldo tidak cukup. Transfer ${rupiah(amount)} + biaya admin ${rupiah(fee)} = ${rupiah(total)}.`
          : "Saldo tidak cukup."
      }, { status: 400 });
    }
    if (transferable < total) {
      return NextResponse.json({
        error: `Transfer hanya bisa menggunakan saldo dari deposit. Saldo deposit kamu ${rupiah(transferable)} — tidak cukup untuk transfer ${rupiah(amount)}${fee > 0 ? ` + biaya admin ${rupiah(fee)}` : ""} (total ${rupiah(total)}). Saldo dari voucher, spin wheel, atau poin tidak bisa ditransfer.`
      }, { status: 400 });
    }

    // Potong saldo pengirim hanya kalau cukup (atomik, tidak bisa minus).
    const debitCond = { token: fromToken, balance: { $gte: total } };
    const debitInc = { balance: -total };
    if (hasDepositField) {
      debitCond.depositBalance = { $gte: total };
      debitInc.depositBalance = -total;
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
      // Akun tujuan hilang di tengah proses: kembalikan saldo pengirim (termasuk biaya admin).
      const restoreInc = { balance: total };
      if (hasDepositField) restoreInc.depositBalance = total;
      await users.updateOne({ token: fromToken }, { $inc: restoreInc });
      return NextResponse.json({ error: "Transfer gagal, saldo dikembalikan." }, { status: 500 });
    }

    const ref = `TF${Date.now()}`;
    await logBalance({
      token: fromToken,
      type: "transfer_out",
      amount: -amount,
      balanceAfter: debited.balance + fee,
      title: `Transfer ke ${toToken.slice(0, 7)}…`,
      ref
    });
    if (fee > 0) {
      // Dicatat terpisah supaya pendapatan biaya admin bisa direkap dari ledger.
      await logBalance({
        token: fromToken,
        type: "transfer_fee",
        amount: -fee,
        balanceAfter: debited.balance,
        title: `Biaya admin transfer (${cfg.feePercent}%${cfg.feeFlat > 0 ? ` + ${rupiah(cfg.feeFlat)}` : ""})`,
        ref
      });
    }
    await logBalance({
      token: toToken,
      type: "transfer_in",
      amount,
      balanceAfter: credited.balance,
      title: `Transfer dari ${fromToken.slice(0, 7)}…`,
      ref
    });

    const transferText = transferNotif({ fromToken, toToken, amount, fee, fromBalance: debited.balance });
    sendTelegramNotif(transferText);

    return NextResponse.json({ balance: debited.balance, transferredTo: toToken, amount, fee, total, ref });
  } catch (err) {
    console.error("[transfer]", err);
    return NextResponse.json({ error: "Gagal memproses transfer." }, { status: 500 });
  }
}
