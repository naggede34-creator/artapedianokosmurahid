import { NextResponse } from "next/server";
import { otpOrdersCol } from "@/lib/db";

export const dynamic = "force-dynamic";

function maskToken(token) {
  if (!token || token.length < 6) return "***";
  return token.slice(0, 3) + "•".repeat(4) + token.slice(-3);
}

export async function GET() {
  try {
    const orders = await otpOrdersCol();
    const recent = await orders
      .find({ status: "done" })
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(20)
      .project({ token: 1, serviceName: 1, countryName: 1, price: 1, createdAt: 1 })
      .toArray();

    const items = recent.map((o) => ({
      user: maskToken(o.token),
      service: o.serviceName || "Layanan",
      country: o.countryName || "",
      price: o.price || 0,
      time: o.createdAt
    }));

    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
