import { NextResponse } from "next/server";
import { usersCol, userNotificationsCol } from "@/lib/db";

export const dynamic = "force-dynamic";

const TIERS = [
  { name: "Bronze",  minPoints: 0,    color: "#CD7F32", emoji: "🥉" },
  { name: "Silver",  minPoints: 200,  color: "#C0C0C0", emoji: "🥈" },
  { name: "Gold",    minPoints: 500,  color: "#FFD700", emoji: "🥇" },
  { name: "Diamond", minPoints: 1500, color: "#B9F2FF", emoji: "💎" },
];

function getTier(points) {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (points >= TIERS[i].minPoints) return TIERS[i];
  }
  return TIERS[0];
}

// GET ?token= — check if user leveled up since last check
export async function GET(req) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) return NextResponse.json({ leveledUp: false });

  const users = await usersCol();
  const user = await users.findOne({ token });
  if (!user) return NextResponse.json({ leveledUp: false });

  const points = user.points || 0;
  const currentTier = getTier(points);
  const lastTierName = user.lastKnownTier || "Bronze";

  if (currentTier.name === lastTierName) {
    return NextResponse.json({ leveledUp: false });
  }

  // They leveled up — mark it
  await users.updateOne({ token }, { $set: { lastKnownTier: currentTier.name } });

  const notif = await userNotificationsCol();
  await notif.insertOne({
    token,
    type: "reward",
    title: `${currentTier.emoji} Naik Level ke ${currentTier.name}!`,
    body: `Selamat! Kamu telah mencapai level ${currentTier.name}. Nikmati keuntungan eksklusif anggota ${currentTier.name}.`,
    read: false,
    createdAt: new Date(),
  });

  return NextResponse.json({ leveledUp: true, tier: currentTier, prevTier: TIERS.find((t) => t.name === lastTierName) || TIERS[0] });
}

// POST ?token= — acknowledge level up (clear flag)
export async function POST(req) {
  const { token } = await req.json();
  if (!token) return NextResponse.json({ ok: false });
  const users = await usersCol();
  const user = await users.findOne({ token });
  if (!user) return NextResponse.json({ ok: false });
  const points = user.points || 0;
  const tier = getTier(points);
  await users.updateOne({ token }, { $set: { lastKnownTier: tier.name } });
  return NextResponse.json({ ok: true });
}
