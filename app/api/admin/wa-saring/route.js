import { NextResponse } from "next/server";
import { adminSah } from "@/lib/adminAuth";
import { cfg, simpanCfg } from "@/lib/config";
import { daftarSaringan } from "@/lib/wa/saring";
import { KATA_BAWAAN, uraiDaftar } from "@/lib/wa/saringKata";

export const dynamic = "force-dynamic";
const H = { "Cache-Control": "no-store" };

export async function GET(req) {
  if (!(await adminSah(req))) return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: H });
  try {
    const kata = uraiDaftar(String((await cfg("WA_KATA_TERLARANG")) ?? KATA_BAWAAN.join(",")));
    return NextResponse.json({ aktif: String((await cfg("WA_FILTER_AKTIF")) ?? "1") !== "0", kata, bawaan: KATA_BAWAAN, ...(await daftarSaringan({ limit: 40 })) }, { headers: H });
  } catch (err) { console.error("[admin/wa-saring]", err?.message || err); return NextResponse.json({ error: "Gagal memuat." }, { status: 500 }); }
}

// POST { aktif?: boolean, kata?: string | string[] }
export async function POST(req) {
  if (!(await adminSah(req))) return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: H });
  const b = await req.json().catch(() => ({}));
  try {
    if (b.aktif !== undefined) { const r = await simpanCfg("WA_FILTER_AKTIF", b.aktif ? "1" : "0"); if (r && r.ok === false) return NextResponse.json({ error: r.alasan }, { status: 400 }); }
    if (b.kata !== undefined) {
      const daftar = uraiDaftar(b.kata);
      if (!daftar.length) return NextResponse.json({ error: "Daftar kata tidak boleh kosong (matikan saklar bila ingin menonaktifkan saringan)." }, { status: 400 });
      if (daftar.length > 300) return NextResponse.json({ error: "Maksimal 300 kata." }, { status: 400 });
      const r = await simpanCfg("WA_KATA_TERLARANG", daftar.join(","));
      if (r && r.ok === false) return NextResponse.json({ error: r.alasan }, { status: 400 });
    }
    return NextResponse.json({ ok: true }, { headers: H });
  } catch (err) { console.error("[admin/wa-saring]", err?.message || err); return NextResponse.json({ error: "Gagal menyimpan." }, { status: 500 }); }
}
