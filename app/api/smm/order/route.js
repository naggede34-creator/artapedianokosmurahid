import { NextResponse } from "next/server";
import { placeSmmOrder, SmmUserError } from "@/lib/smmService";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const result = await placeSmmOrder({
      token: String(body.token || ""),
      serviceId: body.serviceId,
      target: body.target,
      quantity: body.quantity,
      comments: body.comments
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof SmmUserError) {
      return NextResponse.json({ error: err.message }, { status: err.status || 400 });
    }
    console.error("[smm/order]", err?.message || err);
    return NextResponse.json({ error: "Gagal membuat pesanan. Coba lagi atau hubungi admin." }, { status: 500 });
  }
}
