// Angka-angka QRIS Gateway, di satu tempat.
//
// Dipisah dari lib/gateway.js supaya halaman (komponen klien) bisa menampilkan
// batas dan biayanya tanpa ikut menarik koneksi database ke dalam bundel
// peramban — dan supaya tidak ada dua salinan angka yang bisa berbeda antara
// yang ditampilkan dan yang benar-benar dihitung.

/** Nominal tagihan QRIS yang boleh dibuat merchant. */
export const INVOICE_MIN = 2_000;
export const INVOICE_MAX = 10_000_000;

/**
 * Biaya per tagihan yang BERHASIL dibayar, dipotong dari yang diterima
 * merchant. Tagihan yang tidak dibayar tidak dikenai apa pun.
 */
export const BIAYA_QRIS = 250;

/**
 * Penarikan ke e-wallet, otomatis lewat AustinPay.
 *
 * WD_MIN dan WD_MAX adalah nominal yang DITERIMA di e-wallet. Biayanya
 * ditambahkan di atasnya dan ikut dipotong dari saldo gateway: penarikan Rp10.000
 * memotong saldo Rp11.000. Biaya tidak boleh diambil dari nominal yang dikirim,
 * karena AustinPay menolak kiriman di bawah Rp10.000.
 */
export const WD_MIN = 10_000;
export const WD_MAX = 5_000_000;
export const BIAYA_WD = 1_000;

/** Konversi ke saldo Arta Pedia untuk beli nokos — tanpa biaya. */
export const KONVERSI_MIN = 1_000;

/**
 * E-wallet tujuan penarikan.
 *
 * Nomornya divalidasi sesuai bentuk masing-masing: e-wallet Indonesia memakai
 * nomor ponsel, dan nomor yang salah ketik berarti uang terkirim ke orang lain
 * yang tidak bisa ditarik kembali.
 */
export const EWALLET = {
  dana: { nama: "DANA", pola: /^08\d{8,12}$/, contoh: "08123456789" },
  ovo: { nama: "OVO", pola: /^08\d{8,12}$/, contoh: "08123456789" },
  gopay: { nama: "GoPay", pola: /^08\d{8,12}$/, contoh: "08123456789" },
  shopeepay: { nama: "ShopeePay", pola: /^08\d{8,12}$/, contoh: "08123456789" },
  linkaja: { nama: "LinkAja", pola: /^08\d{8,12}$/, contoh: "08123456789" }
};

export function ewalletValid(kode, nomor) {
  const e = EWALLET[kode];
  if (!e) return false;
  return e.pola.test(String(nomor || "").trim());
}

/** Yang benar-benar diterima merchant dari satu tagihan yang dibayar. */
export function bersihDariTagihan(nominal) {
  return Math.max(0, Math.round(Number(nominal) || 0) - BIAYA_QRIS);
}

/** Yang dipotong dari saldo gateway untuk satu penarikan: nominal diterima + biaya. */
export function totalPenarikan(nominal) {
  return Math.max(0, Math.round(Number(nominal) || 0)) + BIAYA_WD;
}
