// Ringkasan dasbor QRIS Gateway milik satu kode akun.
import { NextResponse } from "next/server";
import { ringkasan } from "@/lib/gateway";
import {
  INVOICE_MIN, INVOICE_MAX, BIAYA_QRIS, WD_MIN, BIAYA_WD, KONVERSI_MIN, EWALLET
} from "@/lib/gatewayConfig";
import { usersCol } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Kode akun kosong." }, { status: 400 });
  try {
    const data = await ringkasan(token);
    if (!data) return NextResponse.json({ error: "Akun tidak ditemukan." }, { status: 404 });
    const users = await usersCol();
    const u = await users.findOne({ token }, { projection: { balance: 1 } });
    return NextResponse.json({
      ...data,
      saldoArta: u?.balance ?? 0,
      batas: {
        invoiceMin: INVOICE_MIN, invoiceMax: INVOICE_MAX, biayaQris: BIAYA_QRIS,
        wdMin: WD_MIN, biayaWd: BIAYA_WD, konversiMin: KONVERSI_MIN,
        ewallet: Object.entries(EWALLET).map(([k, v]) => ({ kode: k, nama: v.nama, contoh: v.contoh }))
      }
    });
  } catch (err) {
    console.error("[gateway] ringkasan:", err?.message || err);
    return NextResponse.json({ error: "Gagal memuat dasbor gateway." }, { status: 500 });
  }
}
