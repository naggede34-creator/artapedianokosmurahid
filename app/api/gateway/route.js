// Ringkasan dasbor QRIS Gateway milik satu kode akun.
import { NextResponse } from "next/server";
import { ringkasan } from "@/lib/gateway";
import {
  INVOICE_MIN, INVOICE_MAX, BIAYA_QRIS, WD_MIN, WD_MAX, BIAYA_WD, KONVERSI_MIN
} from "@/lib/gatewayConfig";
import { infoWdGateway } from "@/lib/gatewayWd";
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
    const wd = await infoWdGateway();
    return NextResponse.json({
      ...data,
      saldoArta: u?.balance ?? 0,
      batas: {
        invoiceMin: INVOICE_MIN, invoiceMax: INVOICE_MAX, biayaQris: BIAYA_QRIS,
        wdMin: wd.min, wdMax: wd.maks, biayaWd: BIAYA_WD, konversiMin: KONVERSI_MIN,
        wdOtomatis: wd.otomatis,
        ewallet: wd.dompet.map((nama) => ({ kode: nama, nama, contoh: "08123456789" }))
      }
    });
  } catch (err) {
    console.error("[gateway] ringkasan:", err?.message || err);
    return NextResponse.json({ error: "Gagal memuat dasbor gateway." }, { status: 500 });
  }
}
