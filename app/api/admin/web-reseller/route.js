import { NextResponse } from "next/server";
import { adminSah } from "@/lib/adminAuth";
import { resellerWebCol } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { rwOpsiTautan, urlWeb, lupakanWeb } from "@/lib/webReseller";

export const dynamic = "force-dynamic";
const H = { "Cache-Control": "no-store" };

export async function GET(req) {
  if (!(await adminSah(req))) return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: H });
  const q = (new URL(req.url).searchParams.get("q") || "").trim().toLowerCase().slice(0, 40);
  const opsi = await rwOpsiTautan(await getSettings());
  const filter = q ? { $or: [{ slug: { $regex: q.replace(/[^a-z0-9-]/g, "") } }, { nama: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } }] } : {};
  const baris = await (await resellerWebCol()).find(filter).sort({ createdAt: -1 }).limit(200).toArray();
  const items = baris.map((w) => ({
    slug: w.slug, nama: w.nama, markupPersen: w.markupPersen, aktif: w.aktif !== false, dibekukan: !!w.dibekukan,
    pemilik: String(w.pemilik).slice(0, 8) + "…", tautan: urlWeb(w.slug, opsi),
    kunjungan: w.kunjungan || 0, pesananTotal: Math.max(0, w.pesananTotal || 0), pesananSelesai: Math.max(0, w.pesananSelesai || 0),
    omzet: Math.max(0, w.omzet || 0), komisiTotal: Math.max(0, w.komisiTotal || 0), komisiTertunda: Math.max(0, w.komisiTertunda || 0), createdAt: w.createdAt
  }));
  const ringkasan = items.reduce((a, w) => ({ web: a.web + 1, pesanan: a.pesanan + w.pesananSelesai, omzet: a.omzet + w.omzet, komisi: a.komisi + w.komisiTotal }), { web: 0, pesanan: 0, omzet: 0, komisi: 0 });
  return NextResponse.json({ items, ringkasan }, { headers: H });
}

// POST { slug, dibekukan: bool }  — admin membekukan/membuka sebuah web (web beku tampil seperti web utama).
export async function POST(req) {
  if (!(await adminSah(req))) return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: H });
  const b = await req.json().catch(() => ({}));
  const slug = String(b.slug || "").toLowerCase();
  if (!/^[a-z0-9-]{3,24}$/.test(slug)) return NextResponse.json({ error: "Nama web tidak sah." }, { status: 400, headers: H });
  const r = await (await resellerWebCol()).updateOne({ slug }, { $set: { dibekukan: b.dibekukan === true, updatedAt: new Date() } });
  lupakanWeb(slug);
  if (!r.matchedCount) return NextResponse.json({ error: "Web tidak ditemukan." }, { status: 404, headers: H });
  return NextResponse.json({ ok: true }, { headers: H });
}
