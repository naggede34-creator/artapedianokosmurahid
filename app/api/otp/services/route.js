import { NextResponse } from "next/server";
import { getServices } from "@/lib/rumahotp";
import { getApiKeys } from "@/lib/apiKeys";

export async function GET() {
  try {
    const { rumahOtp } = await getApiKeys();
    if (!rumahOtp) return NextResponse.json({ error: "RumahOTP API key belum diisi. Isi di Dashboard Admin → Pengaturan." }, { status: 503 });
    const data = await getServices(rumahOtp);
    return NextResponse.json({ items: data.data || data.services || data || [] });
  } catch (err) {
    console.error(err?.response?.data || err);
    return NextResponse.json({ error: "Gagal mengambil daftar layanan." }, { status: 500 });
  }
}
