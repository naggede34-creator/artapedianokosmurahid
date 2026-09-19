import { NextResponse } from "next/server";
import { resellersCol } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const { token, webName, markup, logo, description, active } = await req.json().catch(() => ({}));
    if (!token) return NextResponse.json({ error: "Token diperlukan." }, { status: 400 });

    const col = await resellersCol();
    const r = await col.findOne({ token });
    if (!r) return NextResponse.json({ error: "Kamu belum punya web reseller." }, { status: 404 });

    const upd = { updatedAt: new Date() };
    if (webName !== undefined) upd.webName = String(webName).trim().slice(0, 50) || r.webName;
    if (markup !== undefined) upd.markup = Math.max(0, Math.min(100, Number(markup) || 0));
    if (logo !== undefined) upd.logo = logo || null;
    if (description !== undefined) upd.description = String(description).trim().slice(0, 300);
    if (active !== undefined) upd.active = Boolean(active);

    await col.updateOne({ token }, { $set: upd });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[reseller/settings]", err);
    return NextResponse.json({ error: "Gagal update settings." }, { status: 500 });
  }
}
