import { NextResponse } from "next/server";
import { depositsCol, usersCol } from "@/lib/db";
import { checkTransaction } from "@/lib/pakasir";
import { checkDeposit } from "@/lib/rumahotp";
import { sendTelegramNotif, depositSuccessNotif } from "@/lib/telegram";
import { awardDepositCashback } from "@/lib/loyalty";

export const dynamic = "force-dynamic";

function pickField(obj, names) {
  for (const n of names) {
    if (obj?.[n] !== undefined && obj[n] !== null && obj[n] !== "") return obj[n];
  }
  return null;
}

// Riwayat topup RumahOTP sendiri (yang keliatan di screenshot dashboard mereka) pakai
// istilah "success"/"cancel", beda dari istilah Pakasir ("completed"). Disamakan di
// sini jadi satu kosakata internal biar logika kredit saldo di bawah tidak perlu
// tahu bedanya provider mana yang dipakai.
function normalizeRumahOtpStatus(raw) {
  const s = String(raw || "").toLowerCase();
  if (["success", "completed", "paid", "done"].includes(s)) return "completed";
  if (["cancel", "canceled", "cancelled", "expired", "expire", "failed"].includes(s)) return "canceled";
  return "pending";
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get("order_id");
    const token = searchParams.get("token");
    if (!orderId || !token) return NextResponse.json({ error: "Parameter kurang." }, { status: 400 });

    const deposits = await depositsCol();
    const deposit = await deposits.findOne({ orderId, token });
    if (!deposit) return NextResponse.json({ error: "Transaksi tidak ditemukan." }, { status: 404 });

    if (deposit.status !== "completed") {
      try {
        if (deposit.provider === "rumahotp") {
          // Endpoint get_status RumahOTP butuh "deposit_id" = ID transaksi yang
          // MEREKA generate & balikin waktu create (disimpan sbg providerRef),
          // bukan order_id kita. Kalau field ini kosong (data lama sebelum fix
          // ini), fallback ke orderId walau kemungkinan besar tidak akan cocok.
          const result = await checkDeposit(process.env.RUMAHOTP_APIKEY, deposit.providerRef || orderId);
          const data = result.data || result;
          console.log("[deposit/status] rumahotp raw:", JSON.stringify(data));
          const rawStatus = pickField(data, ["status"]);
          const newStatus = rawStatus ? normalizeRumahOtpStatus(rawStatus) : null;
          if (newStatus && newStatus !== deposit.status) {
            await deposits.updateOne({ orderId }, { $set: { status: newStatus } });
            deposit.status = newStatus;
          }
        } else {
          const result = await checkTransaction(process.env.PAKASIR_PROJECT, process.env.PAKASIR_APIKEY, orderId, deposit.amount);
          const tx = result.transaction || result;
          if (tx.status && tx.status !== deposit.status) {
            await deposits.updateOne({ orderId }, { $set: { status: tx.status } });
            deposit.status = tx.status;
          }
        }
      } catch (e) {
        // biarkan status lama kalau pengecekan gagal, tidak fatal
      }
    }

    if (deposit.status === "completed" && !deposit.credited) {
      const users = await usersCol();
      // KLAIM ATOMIK: hanya request yang berhasil mengubah credited false->true
      // yang boleh nambah saldo. Ini mencegah double-credit kalau ada request
      // barengan (mis. polling dobel dari browser + webhook Pakasir nembak di
      // waktu yang hampir sama) — sebelumnya cek & update terpisah sehingga bisa
      // sama-sama lolos dan saldo ke-kredit berkali-kali dari satu pembayaran.
      const claimed = await deposits.findOneAndUpdate(
        { orderId, credited: false },
        { $set: { credited: true } },
        { returnDocument: "after" }
      );

      if (claimed) {
        const updatedUser = await users.findOneAndUpdate(
          { token },
          { $inc: { balance: deposit.amount } },
          { returnDocument: "after" }
        );
        deposit.credited = true;

        const cashback = await awardDepositCashback(token, deposit.amount);

        const finalUser = cashback > 0 ? await users.findOne({ token }) : updatedUser;
        sendTelegramNotif(
          depositSuccessNotif({
            orderId,
            amount: deposit.amount,
            token,
            balance: finalUser?.balance ?? 0,
            cashback
          })
        );
      } else {
        // Kalah klaim (request lain barengan sudah lebih dulu berhasil) — tidak
        // usah ngapa-ngapain lagi, biar tidak dobel kredit/notif.
        deposit.credited = true;
      }
    }

    const user = await (await usersCol()).findOne({ token });

    return NextResponse.json({
      status: deposit.status,
      credited: deposit.credited,
      balance: user?.balance ?? 0
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Terjadi kesalahan server." }, { status: 500 });
  }
}
