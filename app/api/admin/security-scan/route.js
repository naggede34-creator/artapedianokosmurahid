// POST /api/admin/security-scan  — triggered from admin dashboard
// Deteksi spam order, deposit massal, saldo anomali, penyalahgunaan garansi, dll.
import { NextResponse } from "next/server";
import { usersCol, otpOrdersCol, depositsCol, userNotificationsCol, warrantyClaimsCol } from "@/lib/db";
import { isAdminRequest } from "@/lib/adminAuth";
import { sendTelegramNotif } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

const WINDOW_1H   = 60 * 60 * 1000;
const WINDOW_30M  = 30 * 60 * 1000;
const WINDOW_10M  = 10 * 60 * 1000;
const WINDOW_24H  = 24 * 60 * 60 * 1000;
const WINDOW_7D   = 7  * 24 * 60 * 60 * 1000;

function maskToken(token = "") {
  if (!token || token.length <= 8) return token || "-";
  return `${token.slice(0, 4)}••••${token.slice(-4)}`;
}

export async function POST(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const now = new Date();
  const users       = await usersCol();
  const orders      = await otpOrdersCol();
  const deposits    = await depositsCol();
  const notifs      = await userNotificationsCol();
  const warranties  = await warrantyClaimsCol();

  const flags = [];
  const autoSuspended = [];

  // ─── 1. OTP Spam: >15 order dalam 1 jam ────────────────────────────────────
  const cut1h  = new Date(now - WINDOW_1H);
  const otpAgg = await orders.aggregate([
    { $match: { createdAt: { $gte: cut1h }, status: { $in: ["pending", "completed", "failed"] } } },
    { $group: { _id: "$token", count: { $sum: 1 } } },
    { $match: { count: { $gte: 15 } } }
  ]).toArray();
  for (const { _id: token, count } of otpAgg) {
    const user = await users.findOne({ token });
    if (!user || user.suspended) continue;
    flags.push({ token, reason: `OTP spam: ${count}× dalam 1 jam`, severity: "high", category: "spam" });
  }

  // ─── 2. Deposit Spam: >10 deposit dalam 30 menit ───────────────────────────
  const cut30m  = new Date(now - WINDOW_30M);
  const depAgg  = await deposits.aggregate([
    { $match: { createdAt: { $gte: cut30m } } },
    { $group: { _id: "$token", count: { $sum: 1 } } },
    { $match: { count: { $gte: 10 } } }
  ]).toArray();
  for (const { _id: token, count } of depAgg) {
    const user = await users.findOne({ token });
    if (!user || user.suspended) continue;
    flags.push({ token, reason: `Deposit spam: ${count}× dalam 30 menit`, severity: "medium", category: "spam" });
  }

  // ─── 3. Saldo Negatif Anomali ───────────────────────────────────────────────
  const negUsers = await users.find({ balance: { $lt: -1000 }, suspended: { $ne: true } }).limit(20).toArray();
  for (const u of negUsers) {
    flags.push({ token: u.token, reason: `Saldo negatif: Rp${Math.abs(u.balance || 0).toLocaleString("id-ID")}`, severity: "critical", category: "balance" });
  }

  // ─── 4. Penyalahgunaan Garansi: >3 klaim dalam 7 hari ─────────────────────
  const cut7d    = new Date(now - WINDOW_7D);
  const warAgg   = await warranties.aggregate([
    { $match: { createdAt: { $gte: cut7d } } },
    { $group: { _id: "$token", count: { $sum: 1 }, approved: { $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] } } } },
    { $match: { count: { $gte: 4 } } }
  ]).toArray();
  for (const { _id: token, count, approved } of warAgg) {
    const user = await users.findOne({ token });
    if (!user || user.suspended) continue;
    flags.push({ token, reason: `Abuse garansi: ${count}× klaim / 7 hari (disetujui: ${approved})`, severity: "high", category: "warranty" });
  }

  // ─── 5. Nomor HP Diorder Berulang: >8 order nomor sama dalam 24 jam ────────
  const cut24h    = new Date(now - WINDOW_24H);
  const phoneAgg  = await orders.aggregate([
    { $match: { createdAt: { $gte: cut24h }, phoneNumber: { $exists: true, $ne: "" } } },
    { $group: { _id: { token: "$token", phone: "$phoneNumber" }, count: { $sum: 1 } } },
    { $match: { count: { $gte: 8 } } }
  ]).toArray();
  for (const { _id: { token, phone }, count } of phoneAgg) {
    const user = await users.findOne({ token });
    if (!user || user.suspended) continue;
    if (flags.some((f) => f.token === token && f.category === "phone")) continue;
    flags.push({ token, reason: `Nomor berulang: ${phone?.slice(-6)} diorder ${count}× dalam 24 jam`, severity: "medium", category: "phone" });
  }

  // ─── 6. Lonjakan Saldo Anomali: gain >Rp 500k dalam 1 jam tanpa deposit ───
  const cut10m    = new Date(now - WINDOW_10M);
  const recentDep = await deposits.distinct("token", { createdAt: { $gte: cut1h }, status: "paid" });
  const recentDepSet = new Set(recentDep);
  const highBalUsers = await users.find({
    balance: { $gte: 500000 },
    suspended: { $ne: true },
    updatedAt: { $gte: cut1h }
  }).limit(50).toArray();
  for (const u of highBalUsers) {
    if (recentDepSet.has(u.token)) continue;
    if (flags.some((f) => f.token === u.token)) continue;
    const prevBal = u.prevBalance ?? 0;
    if ((u.balance - prevBal) > 500000) {
      flags.push({ token: u.token, reason: `Lonjakan saldo anomali: +Rp${(u.balance - prevBal).toLocaleString("id-ID")} tanpa deposit`, severity: "high", category: "balance" });
    }
  }

  // ─── 7. Auto-Suspend untuk severity high/critical ──────────────────────────
  for (const flag of flags) {
    if (flag.severity === "high" || flag.severity === "critical") {
      await users.updateOne({ token: flag.token }, {
        $set: {
          suspended: true,
          suspendedAt: now,
          suspendReason: `Auto-security: ${flag.reason}`,
          "securityFlags.lastFlag": flag.reason,
          "securityFlags.flaggedAt": now,
          "securityFlags.category": flag.category,
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
      await users.updateOne({ token: flag.token }, {
        $set: { "securityFlags.lastFlag": flag.reason, "securityFlags.flaggedAt": now, "securityFlags.category": flag.category }
      });
    }
  }

  // ─── Telegram report ───────────────────────────────────────────────────────
  if (flags.length > 0) {
    const lines = flags.map((f) => {
      const icon = f.severity === "critical" ? "🚨" : f.severity === "high" ? "🔴" : "🟡";
      const act  = autoSuspended.some((s) => s.token === f.token) ? " → <b>AUTO-SUSPEND</b>" : "";
      return `${icon} <code>${maskToken(f.token)}</code>\n   ↳ ${f.reason}${act}`;
    }).join("\n");
    await sendTelegramNotif(
      `🛡️ <b>SECURITY SCAN MANUAL</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `${lines}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🚨 Critical: ${flags.filter((f) => f.severity === "critical").length}  🔴 High: ${flags.filter((f) => f.severity === "high").length}  🟡 Medium: ${flags.filter((f) => f.severity === "medium").length}\n` +
      `🚫 Auto-suspend: ${autoSuspended.length} akun\n` +
      `🕒 ${now.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB`
    );
  }

  return NextResponse.json({
    ok: true,
    scannedAt: now.toISOString(),
    flagged: flags.length,
    autoSuspended: autoSuspended.length,
    summary: {
      critical: flags.filter((f) => f.severity === "critical").length,
      high:     flags.filter((f) => f.severity === "high").length,
      medium:   flags.filter((f) => f.severity === "medium").length,
    },
    flags: flags.map((f) => ({ token: maskToken(f.token), reason: f.reason, severity: f.severity, category: f.category }))
  });
}
