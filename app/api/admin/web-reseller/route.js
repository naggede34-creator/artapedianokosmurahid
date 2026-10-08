import { NextResponse } from "next/server";
import { adminSah } from "@/lib/adminAuth";
import { resellerWebCol } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { rwOpsiTautan, urlWeb, lupakanWeb, statistikWeb } from "@/lib/webReseller";
import { usersCol } from "@/lib/db";

export const dynamic = "force-dynamic";
const H = { "Cache-Control": "no-store" };

export async function GET(req) {
  if (!(await adminSah(req))) return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: H });
  const sp = new URL(req.url).searchParams;
  // Detail satu web: statistik lengkap + jumlah & contoh pengguna (token disamarkan).
  const detail = (sp.get("slug") || "").toLowerCase();
  if (detail) {
    const w = /^[a-z0-9-]{3,24}$/.test(detail) ? await (await resellerWebCol()).findOne({ slug: detail }) : null;
    if (!w) return NextResponse.json({ error: "Web tidak ditemukan." }, { status: 404, headers: H });
    const users = await usersCol();
    const [jumlah, terbaru] = [await users.countDocuments({ rwSlug: w.slug }), await users.find({ rwSlug: w.slug }, { projection: { _id: 0, token: 1, name: 1, balance: 1, createdAt: 1 } }).sort({ createdAt: -1 }).limit(20).toArray()];
    return NextResponse.json({
      slug: w.slug, nama: w.nama, markupPersen: w.markupPersen, aktif: w.aktif !== false, dibekukan: !!w.dibekukan, dibuat: w.createdAt,
      pemilik: String(w.pemilik).slice(0, 8) + "…", statistik: await statistikWeb(w), jumlahPengguna: jumlah,
      penggunaTerbaru: terbaru.map((u) => ({ token: String(u.token).slice(0, 7) + "…", nama: u.name || "", saldo: Number(u.balance) || 0, dibuat: u.createdAt }))
    }, { headers: H });
  }
  const q = (sp.get("q") || "").trim().toLowerCase().slice(0, 40);
  const opsi = await rwOpsiTautan(await getSettings());
  const filter = q ? { $or: [{ slug: { $regex: q.replace(/[^a-z0-9-]/g, "") } }, { nama: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } }] } : {};
  const baris = await (await resellerWebCol()).find(filter).sort({ createdAt: -1 }).limit(200).toArray();
  const ucol = await usersCol();
  const jumlahPengguna = {};
  for (const w of baris) jumlahPengguna[w.slug] = await ucol.countDocuments({ rwSlug: w.slug });
  const items = baris.map((w) => ({
    slug: w.slug, nama: w.nama, markupPersen: w.markupPersen, aktif: w.aktif !== false, dibekukan: !!w.dibekukan,
    pemilik: String(w.pemilik).slice(0, 8) + "…", tautan: urlWeb(w.slug, opsi),
    pengguna: jumlahPengguna[w.slug] || 0,
    kunjungan: w.kunjungan || 0, pesananTotal: Math.max(0, w.pesananTotal || 0), pesananSelesai: Math.max(0, w.pesananSelesai || 0),
    omzet: Math.max(0, w.omzet || 0), komisiTotal: Math.max(0, w.komisiTotal || 0), komisiTertunda: Math.max(0, w.komisiTertunda || 0), createdAt: w.createdAt
  }));
  const ringkasan = items.reduce((a, w) => ({ web: a.web + 1, pesanan: a.pesanan + w.pesananSelesai, omzet: a.omzet + w.omzet, komisi: a.komisi + w.komisiTotal, pengguna: a.pengguna + w.pengguna }), { web: 0, pesanan: 0, omzet: 0, komisi: 0, pengguna: 0 });
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
