// Gerbang transaksi bersama: dua penjaga yang dipasang di semua jalur uang.
//   1) MODE BACA-SAJA DARURAT (admin, MODE_BACA_SAJA=1): semua transaksi uang berhenti — deposit, beli, tarik, transfer, game bertaruhan.
//      Membaca (riwayat, saldo, chat) tetap jalan; webhook penyedia & kredit deposit yang sudah dibayar TIDAK diblokir (uang masuk tak boleh hilang).
//   2) KUNCI AKUN (pemilik akun): memblokir transaksi KELUAR (beli, tarik, transfer, game, tukar poin) tapi bukan deposit.
//      Membuka kunci tidak instan: pemilik mengajukan buka, baru berlaku setelah masa tunggu (KUNCI_AKUN_TUNDA_MENIT, bawaan 60) —
//      supaya orang yang memegang kode akun hasil curian tidak bisa langsung membukanya. Pemilik bisa membatalkan pengajuan.
import { cfg, cfgAngka } from "@/lib/config";
import { usersCol } from "@/lib/db";

export const PESAN_BACA_SAJA = "Toko sedang dalam mode darurat (hanya-baca): transaksi dihentikan sementara. Saldo kamu aman. Coba lagi nanti.";

export async function bacaSajaAktif() {
  return String((await cfg("MODE_BACA_SAJA")) ?? "0") === "1";
}

/** Kunci masih berlaku? (terkunci dan belum lewat masa tunggu buka). */
export function kunciAktif(u, kini = Date.now()) {
  if (!u?.kunciAkun) return false;
  const buka = u.kunciBukaAt ? new Date(u.kunciBukaAt).getTime() : 0;
  return !(buka && buka <= kini);
}

/**
 * Periksa sebelum transaksi. `jenis`: "masuk" (deposit — hanya baca-saja yang menghalangi) atau "keluar" (kunci akun juga berlaku).
 * Mengembalikan null bila boleh, atau { status, error }. `user` boleh diberikan bila sudah dibaca pemanggil.
 */
export async function periksaTransaksi(token, { jenis = "keluar", user = null } = {}) {
  if (await bacaSajaAktif()) return { status: 503, error: PESAN_BACA_SAJA };
  if (jenis !== "keluar") return null;
  const u = user || (token ? await (await usersCol()).findOne({ token: String(token) }, { projection: { kunciAkun: 1, kunciBukaAt: 1 } }) : null);
  if (kunciAktif(u)) return { status: 403, error: "Akunmu sedang DIKUNCI (atas permintaanmu). Buka kunci dulu di Profil → Keamanan akun." };
  return null;
}

export async function tundaBukaKunciMenit() {
  return Math.max(0, Math.min(1440, Math.round(await cfgAngka("KUNCI_AKUN_TUNDA_MENIT", 60))));
}
