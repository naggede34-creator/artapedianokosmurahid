import { NextResponse } from "next/server";
import { resellersCol } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("slug");
    if (!slug) return NextResponse.json({ error: "Slug diperlukan." }, { status: 400 });

    const col = await resellersCol();
    const r = await col.findOne({ slug, active: true });
    if (!r) return NextResponse.json({ error: "Toko tidak ditemukan." }, { status: 404 });

    return NextResponse.json({
      slug: r.slug,
      webName: r.webName,
      markup: r.markup,
      logo: r.logo || null,
      description: r.description || "",
    });
  } catch (err) {
    console.error("[reseller/store]", err);
    return NextResponse.json({ error: "Gagal ambil info toko." }, { status: 500 });
  }
}
