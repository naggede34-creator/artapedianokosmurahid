// Ekspor & impor DATA LENGKAP (khusus owner — jalur ini tidak ada di izin peran lain).
//
// GET  /api/admin/data-lengkap                      → ringkasan saldo + daftar kelompok & jumlah dokumen
// GET  /api/admin/data-lengkap?unduh=1&kelompok=a,b[&kredensial=1]
//                                                  → unduh berkas JSON (dialirkan)
// POST /api/admin/data-lengkap  { aksi: "kosongkan", koleksi }
//                               { aksi: "isi", koleksi, mode, dokumen: [...] }
//   Impor dipecah per batch oleh dasbor supaya tidak kena batas ukuran body / waktu fungsi serverless.
import { NextResponse } from "next/server";
import { adminSah } from "@/lib/adminAuth";
import {
  KELOMPOK,
  alirkanBackup,
  hitungKoleksi,
  ringkasanData,
  kosongkanKoleksi,
  isiBatch,
  SEMUA_KOLEKSI,
  MODE_IMPOR
} from "@/lib/dataLengkap";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req) {
  if (!(await adminSah(req))) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const sp = new URL(req.url).searchParams;

  if (sp.get("unduh") === "1") {
    const diminta = (sp.get("kelompok") || "").split(",").map((s) => s.trim()).filter((s) => KELOMPOK[s]);
    const kelompok = diminta.length ? diminta : Object.keys(KELOMPOK).filter((k) => !KELOMPOK[k].besar);
    const kredensial = sp.get("kredensial") === "1";
    const tgl = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);
    const nama = `artapedia-data-lengkap-${tgl}${kredensial ? "-kredensial" : ""}.json`;
    return new NextResponse(alirkanBackup({ kelompok, sertakanKredensial: kredensial }), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${nama}"`,
        "Cache-Control": "no-store"
      }
    });
  }

  try {
    const [ringkasan, kelompok] = await Promise.all([ringkasanData(), hitungKoleksi()]);
    return NextResponse.json({ ok: true, ringkasan, kelompok });
  } catch (err) {
    console.error("[admin/data-lengkap GET]", err?.message || err);
    return NextResponse.json({ error: "Gagal memuat ringkasan data." }, { status: 500 });
  }
}

export async function POST(req) {
  if (!(await adminSah(req))) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body tidak sah." }, { status: 400 });
  }

  const koleksi = String(body?.koleksi || "");
  if (!SEMUA_KOLEKSI.has(koleksi)) {
    return NextResponse.json({ error: "Koleksi tidak dikenali atau tidak boleh diimpor." }, { status: 400 });
  }

  try {
    if (body.aksi === "kosongkan") {
      const r = await kosongkanKoleksi(koleksi);
      console.warn(`[admin/data-lengkap] koleksi ${koleksi} dikosongkan (${r.dihapus} dokumen) untuk restore.`);
      return NextResponse.json({ ok: true, ...r });
    }
    if (body.aksi === "isi") {
      if (!MODE_IMPOR.includes(body.mode)) return NextResponse.json({ error: "Mode tidak valid." }, { status: 400 });
      const r = await isiBatch({ koleksi, dokumen: body.dokumen, mode: body.mode, legacy: body.legacy === true });
      return NextResponse.json({ ok: true, ...r });
    }
    return NextResponse.json({ error: "Aksi tidak dikenali." }, { status: 400 });
  } catch (err) {
    console.error("[admin/data-lengkap POST]", err?.message || err);
    return NextResponse.json({ error: String(err?.message || "Gagal memproses data.").slice(0, 200) }, { status: 400 });
  }
}
