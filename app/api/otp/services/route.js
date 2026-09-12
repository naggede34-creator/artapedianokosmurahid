import { NextResponse } from "next/server";
import { getServices } from "@/lib/rumahotp";

export async function GET() {
  try {
    const data = await getServices(process.env.RUMAHOTP_APIKEY);
    return NextResponse.json({ items: data.data || data.services || data || [] });
  } catch (err) {
    console.error(err?.response?.data || err);
    return NextResponse.json({ error: "Gagal mengambil daftar layanan." }, { status: 500 });
  }
}
