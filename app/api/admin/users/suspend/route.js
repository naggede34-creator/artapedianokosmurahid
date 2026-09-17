import { NextResponse } from "next/server";
import { usersCol } from "@/lib/db";
import { isAdminRequest } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function POST(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const { token, suspended } = await req.json();
  if (!token) return NextResponse.json({ error: "Token diperlukan." }, { status: 400 });

  const users = await usersCol();
  await users.updateOne({ token }, { $set: { suspended: !!suspended } });
  return NextResponse.json({ ok: true, suspended: !!suspended });
}
