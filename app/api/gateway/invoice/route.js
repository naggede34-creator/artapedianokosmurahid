// Buat & cek tagihan dari dasbor gateway (bukan dari API merchant).
import { NextResponse } from "next/server";
import { buatTagihan, periksaTagihan } from "@/lib/gateway";
import { gatewayInvoicesCol } from "@/lib/db";
import { rateLimit } from "@/lib/rateLimit";
import { kabariAdmin, gwTagihanDibuatNotif, gwTagihanDibayarNotif, kabariMerchant } from "@/lib/gatewayNotify";

export const dynamic = "force-dynamic";

export async function POST(req) {
  const { token, amount, ref } = await req.json().catch(() => ({}));
  if (!token) return NextResponse.json({ error: "Kode akun kosong." }, { status: 400 });
  if (!rateLimit(`gwweb:${token}`, 20, 60_000)) {
    return NextResponse.json({ error: "Terlalu cepat. Tunggu sebentar." }, { status: 429 });
  }

  const r = await buatTagihan({ token, amount, merchantRef: ref || "", sumber: "web" });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status || 400 });

  kabariAdmin(gwTagihanDibuatNotif({
    invoiceId: r.invoice.invoiceId, token, amount: r.invoice.amount,
    sumber: "web", merchantRef: r.invoice.merchantRef
  })).catch(() => {});

  return NextResponse.json({ ok: true, invoice: r.invoice });
}

// Cek status satu tagihan. Kepemilikannya diperiksa: tanpa itu, siapa pun yang
// menebak nomor tagihan bisa memaksa kreditnya masuk ke akun orang lain.
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  const id = searchParams.get("id");
  if (!token || !id) return NextResponse.json({ error: "Parameter kurang." }, { status: 400 });

  const col = await gatewayInvoicesCol();
  const ada = await col.findOne({ invoiceId: id });
  if (!ada || ada.token !== token) {
    return NextResponse.json({ error: "Tagihan tidak ditemukan." }, { status: 404 });
  }

  const r = await periksaTagihan(id);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status || 400 });

  if (r.berubah && r.invoice.status === "paid") {
    kabariAdmin(gwTagihanDibayarNotif({
      invoiceId: r.invoice.invoiceId, token, amount: r.invoice.amount,
      biaya: r.invoice.biaya, diterima: r.invoice.diterima, merchantRef: r.invoice.merchantRef
    })).catch(() => {});
    kabariMerchant(token, r.invoice).catch(() => {});
  }

  return NextResponse.json({ ok: true, invoice: r.invoice, saldo: r.saldo });
}
