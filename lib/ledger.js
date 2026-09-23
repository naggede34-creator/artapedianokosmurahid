// Buku besar saldo: SETIAP perubahan saldo user dicatat di koleksi balance_logs
// supaya halaman Mutasi Saldo lengkap (deposit, cashback, bonus referral, voucher,
// tukar poin, transfer masuk/keluar, beli OTP, refund, koreksi admin).
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
    // Kode 11000 = indeks unik menolak. Untuk mutasi bertipe "deposit" itu
    // berarti ada yang mencoba mengkreditkan transaksi yang SUDAH pernah
    // dikreditkan — jaring pengaman database bekerja. Dicatat sebagai
    // kejadian serius, bukan sebagai kegagalan pencatatan biasa.
    if (err?.code === 11000) {
      console.error(
        `[ledger] KREDIT GANDA DITOLAK — token ${String(token).slice(0, 7)}…, tipe ${type}, ref ${ref}. ` +
          "Saldo TIDAK ditambahkan dua kali oleh jalur ini."
      );
      return;
    }
    console.error("[ledger] gagal mencatat mutasi:", err?.message || err);
  }
}


/**
 * Pencatatan mutasi yang TIDAK best-effort: hasilnya dipakai untuk memutuskan
 * apakah boleh melanjutkan.
 *
 * Dipakai di jalur uang masuk yang tidak boleh terjadi dua kali. Caranya:
 * catat DULU, baru tambah saldo. Indeks unik di balance_logs menolak catatan
 * kedua untuk transaksi yang sama, jadi percobaan kredit kedua berhenti
 * SEBELUM menyentuh saldo — bukan ketahuan sesudahnya.
 *
 * Mengembalikan { ok: true, id } kalau ini yang pertama, atau
 * { ok: false, duplikat: true } kalau transaksi itu sudah pernah dicatat.
 */
export async function logBalanceOnce({ token, type, amount, title, ref }) {
  const n = Math.round(Number(amount) || 0);
  if (!token || !n || !ref) return { ok: false, alasan: "data kurang" };
  try {
    const col = await balanceLogsCol();
    const hasil = await col.insertOne({
      token,
      type,
      amount: n,
      balanceAfter: null, // diisi setelah saldo benar-benar bertambah
      title: title || LEDGER_TYPES[type] || type,
      ref: String(ref),
      createdAt: new Date()
    });
    return { ok: true, id: hasil.insertedId };
  } catch (err) {
    if (err?.code === 11000) {
      console.error(
        `[ledger] KREDIT GANDA DICEGAH — tipe ${type}, ref ${ref}, token ${String(token).slice(0, 7)}…. ` +
          "Saldo tidak ditambahkan."
      );
      return { ok: false, duplikat: true };
    }
    // Database bermasalah: JANGAN teruskan. Menambah saldo tanpa catatan yang
    // berhasil berarti kehilangan satu-satunya bukti bahwa ia pernah ditambah.
    console.error("[ledger] gagal mencatat mutasi wajib:", err?.message || err);
    return { ok: false, alasan: err?.message || "gagal mencatat" };
  }
}

// Melengkapi catatan dengan saldo akhir, sesudah saldonya benar-benar berubah.
export async function setLedgerBalanceAfter(id, balanceAfter) {
  if (!id) return;
  try {
    const col = await balanceLogsCol();
    await col.updateOne({ _id: id }, { $set: { balanceAfter: balanceAfter ?? null } });
  } catch (err) {
    console.error("[ledger] gagal melengkapi saldo akhir:", err?.message || err);
  }
}
