// GET /api/admin/backup-reseller?jenis=web|bot[&id=slug|botId][&format=json|csv]
// Mengunduh backup pengguna web reseller atau bot reseller. Hanya admin; token BOT tidak pernah ikut.
import { NextResponse } from "next/server";
import { adminSah } from "@/lib/adminAuth";
import { bangunBackupWebReseller, bangunBackupBotReseller, csvPengguna } from "@/lib/backupReseller";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req) {
  if (!(await adminSah(req))) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const jenis = sp.get("jenis") === "bot" ? "bot" : sp.get("jenis") === "web" ? "web" : "";
  if (!jenis) return NextResponse.json({ error: "jenis harus web atau bot." }, { status: 400 });
  const id = (sp.get("id") || "").trim().slice(0, 40) || null;
  const csv = sp.get("format") === "csv";
  try {
    const backup = jenis === "web"
      ? await bangunBackupWebReseller({ slug: id && /^[a-z0-9-]{3,24}$/.test(id.toLowerCase()) ? id.toLowerCase() : null })
      : await bangunBackupBotReseller({ botId: id });
    const tgl = new Date().toISOString().slice(0, 10);
    const nama = `backup-${jenis}-reseller${id ? `-${id.replace(/[^a-zA-Z0-9_-]/g, "")}` : ""}-${tgl}`;
    const body = csv ? csvPengguna(backup) : JSON.stringify(backup, null, 2);
    return new NextResponse(body, {
      headers: {
        "Content-Type": csv ? "text/csv; charset=utf-8" : "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${nama}.${csv ? "csv" : "json"}"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (err) {
    console.error("[admin/backup-reseller]", err?.message || err);
    return NextResponse.json({ error: "Gagal membuat backup." }, { status: 500 });
  }
}
