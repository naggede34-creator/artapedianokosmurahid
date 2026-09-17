// Buku besar saldo: SETIAP perubahan saldo user dicatat di koleksi balance_logs
// supaya halaman Mutasi Saldo lengkap (deposit, cashback, bonus referral, voucher,
// tukar poin, transfer masuk/keluar, beli OTP, refund, suntik sosmed, koreksi admin).
// Pencatatan bersifat best-effort: kalau gagal, transaksi utama tetap jalan.
import { balanceLogsCol } from "@/lib/db";

export const LEDGER_TYPES = {
  deposit: "Deposit saldo",
  cashback: "Cashback deposit",
  referral: "Bonus undang teman",
  voucher: "Klaim voucher",
  points: "Tukar poin",
  transfer_in: "Transfer masuk",
  transfer_out: "Transfer keluar",
  otp: "Beli nomor OTP",
  otp_refund: "Refund nomor OTP",
  smm: "Suntik sosmed",
  smm_refund: "Refund suntik sosmed",
  admin_add: "Penambahan oleh admin",
  admin_sub: "Pengurangan oleh admin"
};

export async function logBalance({ token, type, amount, balanceAfter, title, ref }) {
  try {
    const n = Math.round(Number(amount) || 0);
    if (!token || !n) return;
    const col = await balanceLogsCol();
    await col.insertOne({
      token,
      type,
      amount: n, // positif = masuk, negatif = keluar
      balanceAfter: balanceAfter ?? null,
      title: title || LEDGER_TYPES[type] || type,
      ref: ref ? String(ref) : null,
      createdAt: new Date()
    });
  } catch (err) {
    console.error("[ledger] gagal mencatat mutasi:", err?.message || err);
  }
}
