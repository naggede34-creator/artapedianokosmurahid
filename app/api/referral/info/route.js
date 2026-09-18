import { NextResponse } from "next/server";
import { usersCol } from "@/lib/db";
import { getApiKeys } from "@/lib/apiKeys";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");
    if (!token) return NextResponse.json({ error: "Token wajib diisi." }, { status: 400 });

    const users = await usersCol();
    const user = await users.findOne({ token });
    if (!user) return NextResponse.json({ error: "Kode akun tidak ditemukan." }, { status: 404 });

    return NextResponse.json({
      token: user.token,
      referralCount: user.referralCount || 0,
      referralEarnings: user.referralEarnings || 0,
      bonusPercent: (await getApiKeys()).referralBonusPercent ?? 0
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Terjadi kesalahan server." }, { status: 500 });
  }
}
