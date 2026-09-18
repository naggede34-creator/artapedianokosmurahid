import { NextResponse } from "next/server";
import { usersCol } from "@/lib/db";
import { generateUserToken } from "@/lib/token";
import { sendTelegramNotif, newUserNotif } from "@/lib/telegram";
import { sendMonitorLog, userLoginLog } from "@/lib/monitor";

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const users = await usersCol();

    if (body.token) {
      const existing = await users.findOne({ token: body.token });
      if (existing) {
        sendMonitorLog(userLoginLog({ token: existing.token, isNew: false }));
        return NextResponse.json({
          token: existing.token,
          balance: existing.balance,
          depositBalance: existing.depositBalance ?? null,
          name: existing.name || null,
          createdAt: existing.createdAt || null,
          tourDone: existing.tourDone === true
        });
      }
      return NextResponse.json({ error: "Kode akun tidak ditemukan." }, { status: 404 });
    }

    let token;
    for (let i = 0; i < 5; i++) {
      const candidate = generateUserToken();
      const found = await users.findOne({ token: candidate });
      if (!found) {
        token = candidate;
        break;
      }
    }
    if (!token) throw new Error("Gagal membuat kode akun, coba lagi.");

    // Kalau user baru datang dari link undangan teman (?ref=TOKEN), catat siapa yang mengundang.
    // Bonusnya baru dicairkan ke pengundang saat user ini deposit pertama kali (lihat deposit/webhook).
    let referredBy = null;
    const refCandidate = typeof body.ref === "string" ? body.ref.trim() : "";
    if (refCandidate && refCandidate !== token) {
      const referrer = await users.findOne({ token: refCandidate });
      if (referrer) referredBy = referrer.token;
    }

    const createdAt = new Date();
    await users.insertOne({
      token,
      balance: 0,
      referredBy,
      referralCount: 0,
      referralEarnings: 0,
      referralBonusGiven: false,
      points: 0,
      totalSpent: 0,
      cashbackTotal: 0,
      createdAt
    });

    sendTelegramNotif(newUserNotif({ token, referredBy }));
    sendMonitorLog(userLoginLog({ token, isNew: true }));

    return NextResponse.json({ token, balance: 0, createdAt, tourDone: false });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Terjadi kesalahan server." }, { status: 500 });
  }
}
