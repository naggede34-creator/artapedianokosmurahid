// Callback dari Pakasir saat tagihan gateway dibayar.
//
// TIDAK dipercaya begitu saja. Badan callback cuma dipakai untuk tahu tagihan
// MANA yang perlu diperiksa; status bayarnya ditanyakan ulang langsung ke
// Pakasir lewat periksaTagihan(). Endpoint ini terbuka di internet, dan siapa
// pun yang menebak nomor tagihan bisa mengirim {"status":"completed"} ke sini.
// Kalau statusnya dipercaya dari badan permintaan, itu saldo gratis untuk
// penebak.
//
// Aman dipanggil berkali-kali: pengirim webhook memang mengulang sampai dapat
// 200, dan yang menjaganya adalah klaim atomik + indeks unik di dalam.
import { NextResponse } from "next/server";
import { periksaTagihan } from "@/lib/gateway";
import { gatewayInvoicesCol } from "@/lib/db";
import { kabariMerchant } from "@/lib/gatewayNotify";

export const dynamic = "force-dynamic";

function ambilId(body) {
  for (const k of ["order_id", "orderId", "invoice_id", "invoiceId", "reference", "ref"]) {
    const v = body?.[k];
    if (typeof v === "string" && v.startsWith("INV-")) return v;
  }
  return null;
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const invoiceId = ambilId(body);
  // 200 walau tidak dikenali: membalas error membuat pengirim webhook mengulang
  // selamanya untuk sesuatu yang memang bukan milik kita.
  if (!invoiceId) return NextResponse.json({ success: true, ignored: true });

  const col = await gatewayInvoicesCol();
  const sebelum = await col.findOne({ invoiceId });
  if (!sebelum) return NextResponse.json({ success: true, ignored: true });

  const r = await periksaTagihan(invoiceId);
  if (r.ok && r.berubah && r.invoice.status === "paid") {
    kabariMerchant(sebelum.token, r.invoice).catch(() => {});
  }
  return NextResponse.json({ success: true });
}

// Sebagian penyedia memanggil callback dengan GET saat menguji URL-nya.
export async function GET() {
  return NextResponse.json({ success: true, service: "artapedia-qris-gateway" });
}
