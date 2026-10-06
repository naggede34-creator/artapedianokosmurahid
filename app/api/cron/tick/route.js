// Denyut ringan untuk cron eksternal (cron-job.org / UptimeRobot, tiap 1 menit).
//
// Vercel Hobby hanya mengizinkan cron 1x/hari, padahal ada pekerjaan yang
// bergantung pada pengecekan rutin: kode OTP yang masuk saat halaman tertutup
// (untuk push/bot), jaminan OTP yang harus mengganti nomor tepat waktu, dan
// pengecekan stok untuk "kabari saya kalau stok ada".
//
//   GET https://domain-kamu.vercel.app/api/cron/tick?secret=ISI_CRON_SECRET
//
// Ringan sengaja: hanya pesanan yang masih hidup (≤ 35 menit) yang disentuh.
import { NextResponse } from "next/server";
import { cronSah } from "@/lib/cronAuth";
import { otpOrdersCol } from "@/lib/db";
import { reconcileOtpOrder } from "@/lib/orderReconcile";
import { periksaStokWatch } from "@/lib/stokWatch";
import { sapuGame } from "@/lib/game/inti";
import { sapuDepositTertunda } from "@/lib/depositService";
import { pengingatDeposit } from "@/lib/depositPengingat";
import { sapuBanSementara } from "@/lib/penggunaAdmin";
import { sapuWdInstan } from "@/lib/wdInstan";
import { sapuSetorGmail } from "@/lib/setorGmail";
import { pindaiBerkala } from "@/lib/keamanan";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UMUR_MAKS_MS = 35 * 60 * 1000;
const MAKS_PER_DENYUT = 40;

async function isAuthorized(req) {
  return cronSah(req);
}

export async function GET(req) {
  if (!(await isAuthorized(req))) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const hasil = { pesanan: 0, otpMasuk: 0, refund: 0, diganti: 0, galat: [] };
  try {
    const orders = await otpOrdersCol();
    const hidup = await orders
      .find({ status: "pending", refunded: { $ne: true }, createdAt: { $gte: new Date(Date.now() - UMUR_MAKS_MS) } })
      .sort({ createdAt: 1 })
      .limit(MAKS_PER_DENYUT)
      .toArray();
    for (const order of hidup) {
      try {
        const r = await reconcileOtpOrder(order);
        hasil.pesanan++;
        if (r.otpCode && !order.otpCode) hasil.otpMasuk++;
        if (r.refunded) hasil.refund++;
        if (r.gantiKe) hasil.diganti++;
      } catch (err) {
        hasil.galat.push(`${order.orderId}: ${err?.message || err}`);
      }
    }
  } catch (err) {
    hasil.galat.push(`query: ${err?.message || err}`);
  }

  // "Kabari saya kalau stok ada": gagalnya tidak boleh mengganggu pekerjaan di atas.
  try {
    hasil.stok = await periksaStokWatch();
  } catch (err) {
    hasil.galat.push(`stok: ${err?.message || err}`);
  }
  // Deposit QRIS yang sudah dibayar tapi webhook-nya tidak sampai (terutama dari bot): tanya provider & kreditkan.
  try {
    hasil.deposit = await sapuDepositTertunda({ maks: 30, anggaranMs: 30000 });
  } catch (err) {
    hasil.galat.push(`deposit: ${err?.message || err}`);
  }
  // Ban sementara yang sudah lewat waktunya dibuka otomatis.
  try {
    hasil.banSementara = await sapuBanSementara({});
  } catch (err) {
    hasil.galat.push(`ban-sementara: ${err?.message || err}`);
  }
  // Pengingat QRIS yang hampir kedaluwarsa (push web + bot).
  try {
    hasil.pengingat = await pengingatDeposit({ jeda: 0 });
  } catch (err) {
    hasil.galat.push(`pengingat: ${err?.message || err}`);
  }
  // Penarikan instant AustinPay yang macet / belum pasti: cocokkan ke riwayat penyedia, kembalikan saldo bila gagal.
  try {
    hasil.wd = await sapuWdInstan({ maks: 20, jeda: 0 });
  } catch (err) {
    hasil.galat.push(`wd: ${err?.message || err}`);
  }
  // Stor Gmail: baca hasil setoran dari penyedia, kreditkan upah yang diterima, pulihkan kiriman yang tak pasti.
  try {
    hasil.setorGmail = await sapuSetorGmail({ maks: 20, jeda: 0 });
  } catch (err) {
    hasil.galat.push(`setor-gmail: ${err?.message || err}`);
  }
  // Pemindaian keamanan otomatis (jalan sendiri tiap ±10 menit; di luar jadwal ini dilewati).
  try {
    hasil.keamanan = await pindaiBerkala();
  } catch (err) {
    hasil.galat.push(`keamanan: ${err?.message || err}`);
  }
  // Duel permainan: waktu habis, tantangan basi, pembayaran tertunda.
  try {
    hasil.game = await sapuGame();
  } catch (err) {
    hasil.galat.push(`game: ${err?.message || err}`);
  }
  return NextResponse.json({ ok: true, ...hasil });
}
