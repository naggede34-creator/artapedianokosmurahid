import { NextResponse } from "next/server";
import { usersCol, otpOrdersCol, depositsCol, dailyActivitiesCol } from "@/lib/db";

export const dynamic = "force-dynamic";

const ACHIEVEMENTS = [
  { id: "first_order",    icon: "📱", name: "Nomor Pertama",   desc: "Beli nokos pertama kali",       tier: "bronze" },
  { id: "orders_10",      icon: "🔟", name: "Pelanggan Aktif", desc: "Selesaikan 10 pesanan nokos",   tier: "silver" },
  { id: "orders_50",      icon: "🏅", name: "Reguler",         desc: "Selesaikan 50 pesanan nokos",   tier: "gold"   },
  { id: "orders_100",     icon: "🏆", name: "Veteran",         desc: "Selesaikan 100 pesanan nokos",  tier: "diamond"},
  { id: "first_deposit",  icon: "💳", name: "Donatur Pertama", desc: "Lakukan deposit pertama",       tier: "bronze" },
  { id: "deposit_100k",   icon: "💰", name: "High Roller",     desc: "Total deposit Rp100.000+",      tier: "silver" },
  { id: "deposit_500k",   icon: "🐳", name: "Whale",           desc: "Total deposit Rp500.000+",      tier: "gold"   },
  { id: "streak_7",       icon: "🔥", name: "Streak 7 Hari",   desc: "Check-in 7 hari berturut-turut",tier: "silver" },
  { id: "spin_jackpot",   icon: "🎰", name: "Jackpot!",        desc: "Menangkan jackpot spin wheel",  tier: "gold"   },
  { id: "welcome",        icon: "👋", name: "Anggota Baru",    desc: "Bergabung dengan Artapedia",    tier: "bronze" },
  { id: "referral_1",     icon: "🤝", name: "Pengundang",      desc: "Mengundang 1 teman",            tier: "bronze" },
  { id: "referral_5",     icon: "🌟", name: "Influencer",      desc: "Mengundang 5 teman",            tier: "gold"   },
];

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Token kosong." }, { status: 400 });

  const users = await usersCol();
  const user = await users.findOne({ token });
  if (!user) return NextResponse.json({ error: "User tidak ditemukan." }, { status: 404 });

  const orders = await otpOrdersCol();
  const deps = await depositsCol();
  const acts = await dailyActivitiesCol();

  const [orderCount, totalDeposit, depositCount, maxStreak, jackpotSpin] = await Promise.all([
    orders.countDocuments({ token, status: "done" }),
    deps.aggregate([
      { $match: { token, status: "completed" } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]).toArray().then((r) => r[0]?.total || 0),
    deps.countDocuments({ token, status: "completed" }),
    acts.find({ token, type: "checkin" }).sort({ date: -1 }).limit(30).toArray().then((records) => {
      let streak = 0, max = 0;
      for (let i = 0; i < records.length; i++) {
        if (i === 0) { streak = 1; }
        else {
          const prev = new Date(records[i - 1].date);
          const curr = new Date(records[i].date);
          const diff = (prev - curr) / 86400000;
          if (diff === 1) streak++;
          else streak = 1;
        }
        if (streak > max) max = streak;
      }
      return max;
    }),
    acts.countDocuments({ token, type: "spin", "prize.label": { $regex: /jackpot/i } })
  ]);

  const referralCount = user.referralCount || 0;
  const unlocked = new Set();
  if (user.welcomeBonusGiven || orderCount > 0 || depositCount > 0) unlocked.add("welcome");
  if (orderCount >= 1) unlocked.add("first_order");
  if (orderCount >= 10) unlocked.add("orders_10");
  if (orderCount >= 50) unlocked.add("orders_50");
  if (orderCount >= 100) unlocked.add("orders_100");
  if (depositCount >= 1) unlocked.add("first_deposit");
  if (totalDeposit >= 100000) unlocked.add("deposit_100k");
  if (totalDeposit >= 500000) unlocked.add("deposit_500k");
  if (maxStreak >= 7) unlocked.add("streak_7");
  if (jackpotSpin > 0) unlocked.add("spin_jackpot");
  if (referralCount >= 1) unlocked.add("referral_1");
  if (referralCount >= 5) unlocked.add("referral_5");

  const result = ACHIEVEMENTS.map((a) => ({ ...a, unlocked: unlocked.has(a.id) }));
  return NextResponse.json({ items: result, unlockedCount: unlocked.size, total: ACHIEVEMENTS.length });
}
