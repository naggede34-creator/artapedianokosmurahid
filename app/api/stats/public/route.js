import { NextResponse } from "next/server";
import { usersCol, otpOrdersCol } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 300; // cache 5 menit

export async function GET() {
  try {
    const [users, orders] = await Promise.all([usersCol(), otpOrdersCol()]);
    const [userCount, orderCount] = await Promise.all([
      users.countDocuments({}),
      orders.countDocuments({ status: "done" })
    ]);
    return NextResponse.json({
      users: userCount,
      orders: orderCount,
      services: 500,
      countries: 150
    });
  } catch {
    return NextResponse.json({ users: 50000, orders: 500000, services: 500, countries: 150 });
  }
}
