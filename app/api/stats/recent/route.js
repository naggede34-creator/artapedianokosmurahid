import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { otpOrdersCol } from "@/lib/db";

export const dynamic = "force-dynamic";

// Tidak lagi membocorkan potongan token (kunci akun): cukup kode hash yang tak bisa dibalik.
function maskToken(token) {
  if (!token) return "***";
  return "AP" + createHash("sha256").update(String(token)).digest("hex").slice(0, 3).toUpperCase() + "•••";
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
