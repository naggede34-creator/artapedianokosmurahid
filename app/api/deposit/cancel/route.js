import { NextResponse } from "next/server";
import { depositsCol, usersCol } from "@/lib/db";
import { cancelTransactionV2, cancelTransactionV1 } from "@/lib/pakasir";
import { cancelDeposit } from "@/lib/rumahotp";
import { fetchProviderStatus, creditDeposit } from "@/lib/depositService";
import { sendTelegramNotif, depositCanceledNotif } from "@/lib/telegram";

export async function POST(req) {
  try {
    const { token, orderId } = await req.json().catch(() => ({}));
    if (!token || !orderId) return NextResponse.json({ error: "Parameter kurang." }, { status: 400 });

    const deposits = await depositsCol();
    const deposit = await deposits.findOne({ orderId, token });
    if (!deposit) return NextResponse.json({ error: "Transaksi tidak ditemukan." }, { status: 404 });
    if (deposit.status === "completed") {
      return NextResponse.json({ error: "Transaksi ini sudah berhasil, tidak bisa dibatalkan." }, { status: 400 });
    }
    if (deposit.status !== "pending") {
      return NextResponse.json({ ok: true, status: deposit.status, message: "Transaksi ini sudah tidak aktif." });
    }

    // Cek dulu ke provider: kalau ternyata sudah dibayar, jangan dibatalkan — kreditkan.
    const remote = await fetchProviderStatus(deposit);
    if (remote === "completed") {
      await creditDeposit(deposit);
      return NextResponse.json(
        { error: "Pembayaran sudah diterima, saldo sudah masuk. Transaksi tidak dibatalkan.", status: "completed" },
        { status: 409 }
      );
    }

    const claimed = await deposits.findOneAndUpdate(
      { orderId, token, status: "pending" },
      { $set: { status: "canceled", canceledAt: new Date() } }
    );
    if (!claimed) return NextResponse.json({ ok: true, message: "Transaksi ini sudah tidak aktif." });

    // OTPMANIA tidak menyediakan endpoint batal — QRIS-nya kedaluwarsa sendiri.
    // Kalau user tetap membayar setelah membatalkan, cron tetap mengkreditkan saldonya.
    if (deposit.provider === "pakasir") {
      // v2 membatalkan lewat txn_id; deposit lama tanpa txn_id tetap lewat v1.
      const p = deposit.pakasirTxnId
        ? cancelTransactionV2(process.env.PAKASIR_PROJECT, process.env.PAKASIR_APIKEY, deposit.pakasirTxnId)
        : cancelTransactionV1(process.env.PAKASIR_PROJECT, process.env.PAKASIR_APIKEY, orderId, deposit.amount);
      p.catch((e) => console.error("[deposit/cancel] pakasir:", e?.message || e));
    } else if (deposit.provider === "rumahotp") {
      cancelDeposit(process.env.RUMAHOTP_APIKEY, deposit.providerRef || orderId).catch(() => {});
    }

    const u = await (await usersCol()).findOne({ token }, { projection: { name: 1 } });
    sendTelegramNotif(
      depositCanceledNotif({ orderId, provider: deposit.provider, amount: deposit.amount, token, name: u?.name, reason: "canceled" })
    );

    return NextResponse.json({ ok: true, status: "canceled" });
  } catch (err) {
    console.error("[deposit/cancel]", err?.response?.data || err?.message || err);
    return NextResponse.json({ error: "Gagal membatalkan transaksi." }, { status: 500 });
  }
}
