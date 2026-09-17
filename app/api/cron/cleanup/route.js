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
import { getServices } from "@/lib/rumahotp";
import { usersCol } from "@/lib/db";
import { runCleanup } from "@/lib/cleanup";
import { getSimuruBalance, simuruConfigured } from "@/lib/simuru";
import { sendMonitorLog, cronReportLog } from "@/lib/monitor";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // belum diset = endpoint dibuka publik, cocok buat setup awal saja
  const auth = req.headers.get("authorization") || "";
  if (auth === `Bearer ${secret}`) return true;
  const { searchParams } = new URL(req.url);
  if (searchParams.get("secret") === secret) return true;
  return false;
}

async function checkRumahOtp() {
  const start = Date.now();
  try {
    if (!process.env.RUMAHOTP_APIKEY) return { name: "RumahOTP API", ok: false, error: "API key belum diset" };
    await getServices(process.env.RUMAHOTP_APIKEY);
    return { name: "RumahOTP API", ok: true, ms: Date.now() - start };
  } catch (err) {
    return { name: "RumahOTP API", ok: false, ms: Date.now() - start, error: err?.message || "gagal terhubung" };
  }
}

async function checkSimuru() {
  const start = Date.now();
  if (!simuruConfigured()) return { name: "Simuru API", ok: false, error: "SIMURU_APIKEY belum diset" };
  try {
    const balance = await getSimuruBalance();
    return {
      name: `Simuru API (saldo Rp${balance.toLocaleString("id-ID")})`,
      ok: true,
      ms: Date.now() - start,
      ...(balance < 20000 ? { error: "saldo menipis" } : {})
    };
  } catch (err) {
    return { name: "Simuru API", ok: false, ms: Date.now() - start, error: err?.message || "gagal terhubung" };
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
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const health = await Promise.all([checkMongo(), checkRumahOtp(), checkSimuru()]);
  const cleanup = await runCleanup();

  // Laporan hanya dikirim kalau ada yang perlu diketahui, supaya thread monitoring
  // tidak dibanjiri pesan identik setiap 5 menit.
  const noteworthy =
    health.some((h) => !h.ok || h.error) ||
    cleanup.errors.length > 0 ||
    cleanup.otpRefunded + cleanup.depositsCredited + cleanup.smmSettled + cleanup.depositsDeleted + cleanup.broadcastsDeleted > 0 ||
    new URL(req.url).searchParams.get("report") === "1";
  if (noteworthy) sendMonitorLog(cronReportLog({ health, cleanup }));

  return NextResponse.json({ ok: true, health, cleanup });
}
