// Dipanggil tiap 5 menit oleh Vercel Cron (lihat vercel.json) ATAU oleh cron
// eksternal (cron-job.org / UptimeRobot dkk) kalau project di Vercel Hobby yang
// cron bawaannya dibatasi minimal 1x/hari — lihat catatan di README.
//
// Cara panggil manual/eksternal:
//   GET https://domain-kamu.vercel.app/api/cron/cleanup?secret=ISI_CRON_SECRET
//
// Vercel Cron bawaan otomatis mengirim header Authorization: Bearer <CRON_SECRET>,
// jadi request dari Vercel sendiri tidak perlu query ?secret= — endpoint ini
// menerima dua-duanya.
import { NextResponse } from "next/server";
import { cronSah } from "@/lib/cronAuth";
import { getServices } from "@/lib/rumahotp";
import { usersCol, depositsCol } from "@/lib/db";
import { runCleanup } from "@/lib/cleanup";
import { sapuHoldMacet } from "@/lib/saldoHold";
import { undiJatuhTempoDanUmumkan } from "@/lib/giveawayUndi";
import { sendMonitorLog, cronReportLog } from "@/lib/monitor";
import { cfg } from "@/lib/config";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function isAuthorized(req) {
  return cronSah(req);
}

async function checkRumahOtp() {
  const start = Date.now();
  try {
    if (!(await cfg("RUMAHOTP_APIKEY"))) return { name: "RumahOTP API", ok: false, error: "API key belum diset" };
    await getServices((await cfg("RUMAHOTP_APIKEY")));
    return { name: "RumahOTP API", ok: true, ms: Date.now() - start };
  } catch (err) {
    return { name: "RumahOTP API", ok: false, ms: Date.now() - start, error: err?.message || "gagal terhubung" };
  }
}

async function checkPakasir() {
  const start = Date.now();
  try {
    if (!(await cfg("PAKASIR_MERCHANT_ID"))) return { name: "Pakasir QRIS", ok: false, error: "PAKASIR_MERCHANT_ID belum diset" };
    const res = await fetch(`https://api.pakasir.com/merchant/check/${(await cfg("PAKASIR_MERCHANT_ID"))}`, {
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { name: "Pakasir QRIS", ok: true, ms: Date.now() - start };
  } catch (err) {
    return { name: "Pakasir QRIS", ok: false, ms: Date.now() - start, error: err?.message || "gagal terhubung" };
  }
}

async function checkPendingDeposits() {
  const start = Date.now();
  try {
    const deps = await depositsCol();
    const count = await deps.countDocuments({ status: "pending" });
    return {
      name: `Deposit pending (${count} antrian)`,
      ok: true,
      ms: Date.now() - start,
      ...(count > 50 ? { error: "antrian menumpuk" } : {})
    };
  } catch (err) {
    return { name: "Deposit queue", ok: false, ms: Date.now() - start, error: err?.message || "gagal cek" };
  }
}

async function checkMongo() {
  const start = Date.now();
  try {
    const users = await usersCol();
    await users.estimatedDocumentCount();
    return { name: "MongoDB", ok: true, ms: Date.now() - start };
  } catch (err) {
    return { name: "MongoDB", ok: false, ms: Date.now() - start, error: err?.message || "gagal terhubung" };
  }
}

export async function GET(req) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const health = await Promise.all([checkMongo(), checkRumahOtp(), checkPakasir(), checkPendingDeposits()]);
  const cleanup = await runCleanup();

  // Saldo yang tertahan tapi pesanannya tidak pernah jadi.
  //
  // Ini satu-satunya yang bisa menangani fungsi yang MATI di tengah jalan:
  // saat itu terjadi, kode pengembalian di dalam permintaannya tidak pernah
  // dijalankan, jadi tidak ada tempat lain yang bisa menutup kasus itu.
  // Giveaway yang waktunya habis diundi sendiri. Tanpa ini, event yang
  // ditutup tengah malam menunggu sampai ada admin yang membuka dasbor —
  // dan pesertanya menunggu tanpa tahu sampai kapan.
  const gw = await undiJatuhTempoDanUmumkan();
  if (gw.length) console.warn(`[cron/cleanup] ${gw.length} giveaway diundi otomatis`);

  const hold = await sapuHoldMacet({ batas: 200 });
  if (hold.dikembalikan > 0) {
    console.warn(
      `[cron/cleanup] ${hold.dikembalikan} hold macet dikembalikan, total Rp${hold.total.toLocaleString("id-ID")}`
    );
  }

  // Laporan hanya dikirim kalau ada yang perlu diketahui, supaya thread monitoring
  // tidak dibanjiri pesan identik setiap 5 menit.
  const noteworthy =
    health.some((h) => !h.ok || h.error) ||
    cleanup.errors.length > 0 ||
    cleanup.otpRefunded + cleanup.depositsCredited + cleanup.depositsDeleted + cleanup.broadcastsDeleted > 0 ||
    hold.dikembalikan > 0 ||
    gw.length > 0 ||
    new URL(req.url).searchParams.get("report") === "1";
  if (noteworthy) sendMonitorLog(cronReportLog({ health, cleanup }));

  return NextResponse.json({ ok: true, health, cleanup, hold, giveaway: gw.length });
}
