// SALDO NOKOS YANG BOLEH DITARIK = hanya yang berasal dari DEPOSIT (`users.depositBalance`).
// Saldo yang masuk dari sumber lain (voucher, hadiah, misi, spin, poin toko, cashback, referral, transfer masuk, hasil tukar
// poin game, tambahan admin, …) hanya menambah `balance`, tidak menambah `depositBalance` → tidak bisa ditarik.
//
// Aturan pemakaian: saat saldo dipakai (beli nomor, beli produk, ubah ke poin game, …), saldo BONUS terpakai lebih dulu,
// baru bagian deposit. Jadi `depositBalance` berkurang hanya bila bonus tidak cukup menutup pembayaran — dan harus selalu
// ≤ `balance`. Tanpa pemotongan ini, deposit yang sudah dibelanjakan lalu "terisi lagi" oleh bonus akan terbaca sebagai deposit
// (pencucian bonus jadi saldo tarik).
//
// Refund pesanan mengembalikan bagian deposit yang tadinya terpakai (disimpan di pesanan/hold sebagai `depositBagian`),
// bukan seluruhnya — supaya refund dari pesanan yang dibayar bonus tetap bonus.
import { usersCol } from "@/lib/db";

const n = (v) => Math.max(0, Number(v) || 0);

/** Bagian deposit yang terpakai ketika `jumlah` dibayar dari saldo; bonus dipakai lebih dulu. */
export function bagianDepositDipakai(balanceSebelum, depositSebelum, jumlah) {
  const bal = n(balanceSebelum);
  const dep = Math.min(n(depositSebelum), bal);
  const bonus = bal - dep;
  return Math.max(0, Math.min(dep, n(jumlah) - bonus));
}

/**
 * Akun lama belum punya `depositBalance`: diisi sekali dari min(saldo, total deposit sepanjang masa).
 * Aman dipanggil berulang (hanya mengisi bila field belum ada).
 */
export async function pastikanDepositBalance(token) {
  const kol = await usersCol();
  const u = await kol.findOne({ token }, { projection: { balance: 1, depositBalance: 1, depositTotal: 1 } });
  if (!u) return null;
  if (u.depositBalance !== undefined && u.depositBalance !== null) return u.depositBalance;
  const awal = Math.min(n(u.balance), n(u.depositTotal));
  await kol.updateOne({ token, $or: [{ depositBalance: { $exists: false } }, { depositBalance: null }] }, { $set: { depositBalance: awal } });
  return awal;
}

/**
 * Dipanggil SETELAH saldo dipotong `jumlah`. `sesudah` = dokumen pengguna hasil pemotongan (findOneAndUpdate returnDocument "after").
 * Mengurangi depositBalance sebesar bagian deposit yang terpakai dan mengembalikan bagian itu (simpan di pesanan untuk refund).
 */
export async function catatPotongan(token, sesudah, jumlah) {
  try {
    const kol = await usersCol();
    const bal0 = n(sesudah?.balance) + n(jumlah);
    const dep = sesudah?.depositBalance;
    if (dep === undefined || dep === null) {
      // Akun lama: deposit sebelum potongan dianggap min(saldo, total deposit); field diisi dengan sisa setelah potongan.
      const depSebelum = Math.min(bal0, n(sesudah?.depositTotal));
      const dipakaiLama = bagianDepositDipakai(bal0, depSebelum, jumlah);
      await kol.updateOne({ token, $or: [{ depositBalance: { $exists: false } }, { depositBalance: null }] }, { $set: { depositBalance: Math.min(n(sesudah?.balance), depSebelum - dipakaiLama) } });
      return dipakaiLama;
    }
    const dipakai = bagianDepositDipakai(bal0, dep, jumlah);
    const baru = await kol.updateOne({ token, depositBalance: { $gte: dipakai } }, { $inc: { depositBalance: -dipakai } });
    if (!baru.matchedCount) await kol.updateOne({ token, depositBalance: { $exists: true } }, { $min: { depositBalance: n(sesudah?.balance) } });
    return dipakai;
  } catch (err) {
    console.error("[saldoDeposit] catatPotongan:", err?.message || err);
    return 0;
  }
}

/** Isi $inc untuk refund: saldo penuh, bagian deposit sesuai catatan pesanan (pesanan lama tanpa catatan = seluruhnya). */
export function incRefund(totalRefund, depositBagian) {
  const total = n(totalRefund);
  const dep = depositBagian === undefined || depositBagian === null ? total : Math.min(total, n(depositBagian));
  return { balance: total, ...(dep > 0 ? { depositBalance: dep } : {}) };
}

/** Jaga invarian depositBalance ≤ balance setelah saldo dikurangi tanpa jalur khusus (mis. koreksi admin). */
export async function rapatkanDeposit(token, balanceSesudah) {
  try {
    await (await usersCol()).updateOne({ token, depositBalance: { $exists: true } }, { $min: { depositBalance: n(balanceSesudah) } });
  } catch (err) { console.error("[saldoDeposit] rapatkan:", err?.message || err); }
}

/** Kredit refund atomik: saldo penuh + bagian deposit. Mengembalikan dokumen pengguna sesudah kredit (atau null). */
export async function kreditRefund(token, totalRefund, depositBagian) {
  await pastikanDepositBalance(token);
  return (await usersCol()).findOneAndUpdate({ token }, { $inc: incRefund(totalRefund, depositBagian) }, { returnDocument: "after" });
}
