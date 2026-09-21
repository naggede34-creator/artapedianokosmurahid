import { NextResponse } from "next/server";
import { rumahOtpConfigured } from "@/lib/rumahotp";
import { virtusimConfigured, virtusimCountry } from "@/lib/virtusim";

export const dynamic = "force-dynamic";

// Server mana saja yang aktif (API key-nya sudah diisi di environment).
export async function GET() {
  return NextResponse.json({
    available: {
      rumahotp: rumahOtpConfigured(),
      virtusim: virtusimConfigured()
    },
    virtusimCountry: virtusimCountry()
  });
}
