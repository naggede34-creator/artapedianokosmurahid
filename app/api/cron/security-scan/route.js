// Dipanggil tiap 10 menit oleh cron eksternal atau Vercel Cron.
// Mendeteksi pola mencurigakan dan auto-suspend user bermasalah.
// GET /api/cron/security-scan?secret=CRON_SECRET
import { NextResponse } from "next/server";
import { usersCol, otpOrdersCol, depositsCol, userNotificationsCol } from "@/lib/db";
import { sendTelegramNotif } from "@/lib/telegram";
import { sendMonitorLog } from "@/lib/monitor";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function isAuthorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = req.headers.get("authorization") || "";
  if (auth === `Bearer ${secret}`) return true;
  const { searchParams } = new URL(req.url);
  if (searchParams.get("secret") === secret) return true;
  return false;
}

function maskToken(token = "") {
  if (!token || token.length <= 8) return token || "-";
  return `${token.slice(0, 4)}••••${token.slice(-4)}`;
}

const WINDOW_1H = 60 * 60 * 1000;
const WINDOW_10M = 10 * 60 * 1000;
const WINDOW_30M = 30 * 60 * 1000;

export async function GET(req) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const now = new Date();
  const users = await usersCol();
  const orders = await otpOrdersCol();
  const deposits = await depositsCol();
  const notifs = await userNotificationsCol();

  const flags = [];
  const autoSuspended = [];

  try {
    // 1. OTP spam: >15 order dalam 1 jam dari 1 token (bukan operator sah)
    const recentOtpCutoff = new Date(now.getTime() - WINDOW_1H);
    const otpAgg = await orders.aggregate([
      { $match: { createdAt: { $gte: recentOtpCutoff }, status: { $in: ["pending", "completed"] } } },
      { $group: { _id: "$token", count: { $sum: 1 } } },
      { $match: { count: { $gte: 15 } } }
    ]).toArray();

    for (const { _id: token, count } of otpAgg) {
      const user = await users.findOne({ token });
      if (!user || user.suspended) continue;
      flags.push({ token, reason: `OTP spam: ${count}x dalam 1 jam`, severity: "high" });
    }

    // 2. Deposit spam: >10 deposit dibuat dalam 30 menit dari 1 token
    const recentDepCutoff = new Date(now.getTime() - WINDOW_30M);
    const depAgg = await deposits.aggregate([
      { $match: { createdAt: { $gte: recentDepCutoff } } },
      { $group: { _id: "$token", count: { $sum: 1 } } },
      { $match: { count: { $gte: 10 } } }
    ]).toArray();

    for (const { _id: token, count } of depAgg) {
      const user = await users.findOne({ token });
      if (!user || user.suspended) continue;
      flags.push({ token, reason: `Deposit spam: ${count}x dalam 30 menit`, severity: "medium" });
    }

    // 3. Saldo negatif atau tidak masuk akal (< -1000 yang tidak seharusnya terjadi)
    const negativeBalanceUsers = await users.find({
      balance: { $lt: -1000 },
      suspended: { $ne: true }
    }).limit(20).toArray();

    for (const u of negativeBalanceUsers) {
      flags.push({ token: u.token, reason: `Saldo negatif: Rp${u.balance?.toLocaleString("id-ID")}`, severity: "critical" });
    }

    // 4. Auto-suspend severity high/critical
    for (const flag of flags) {
      const severity = flag.severity;
      if (severity === "high" || severity === "critical") {
        await users.updateOne({ token: flag.token }, {
          $set: {
            suspended: true,
            suspendedAt: now,
            suspendReason: `Auto-security: ${flag.reason}`,
            "securityFlags.lastFlag": flag.reason,
            "securityFlags.flaggedAt": now
          }
        });

        await notifs.insertOne({
          token: flag.token,
          type: "warning",
          title: "⚠️ Akun Ditangguhkan Otomatis",
          body: "Akun kamu telah ditangguhkan karena aktivitas mencurigakan. Hubungi admin untuk pemulihan.",
          read: false,
          createdAt: now
        });

        autoSuspended.push(flag);
      } else {
        // severity medium: catat saja di user, jangan suspend
        await users.updateOne({ token: flag.token }, {
          $set: {
            "securityFlags.lastFlag": flag.reason,
            "securityFlags.flaggedAt": now
          }
        });
      }
    }

    // Kirim laporan ke Telegram kalau ada yang mencurigakan
    if (flags.length > 0) {
      const lines = flags.map((f) => {
        const icon = f.severity === "critical" ? "🚨" : f.severity === "high" ? "🔴" : "🟡";
        const action = autoSuspended.some((s) => s.token === f.token) ? " → <b>AUTO-SUSPEND</b>" : "";
        return `${icon} <code>${maskToken(f.token)}</code> — ${f.reason}${action}`;
      }).join("\n");

      await sendTelegramNotif(
        `🛡️ <b>LAPORAN SECURITY SCAN</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `${lines}\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `🚫 Auto-suspend: ${autoSuspended.length} akun\n` +
        `🕒 ${now.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB`
      );
    } else {
      sendMonitorLog(
        `🛡️ Security scan: bersih (${now.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB)`
      );
    }

    return NextResponse.json({
      ok: true,
      flagged: flags.length,
      autoSuspended: autoSuspended.length,
      flags: flags.map((f) => ({ token: maskToken(f.token), reason: f.reason, severity: f.severity }))
    });
  } catch (err) {
    console.error("[security-scan]", err);
    return NextResponse.json({ error: "Security scan gagal.", detail: err?.message }, { status: 500 });
  }
}
