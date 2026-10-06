import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// WarungNokos tidak punya pemilihan operator: ordernya memakai operator "any".
// Rute dipertahankan agar klien lama tidak menerima 404.
export async function GET() {
  return NextResponse.json({ items: [] });
}
