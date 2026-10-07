import { auth, tolakAuth, j, galat, bacaBody, batasi, terlaluCepat } from "@/lib/wa/api";
import { buatStatus, daftarStatus, lihatStatus, penontonStatus, hapusStatus, LATAR_STATUS } from "@/lib/wa/status";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req) {
  const me = await auth(req);
  if (!me) return tolakAuth();
  const u = new URL(req.url).searchParams;
  if (u.get("penonton")) {
    const p = await penontonStatus(me, u.get("penonton"));
    return p ? j({ penonton: p }) : galat("Status tidak ditemukan.", 404);
  }
  return j({ daftar: await daftarStatus(me), latar: LATAR_STATUS });
}

export async function POST(req) {
  const body = await bacaBody(req);
  const me = await auth(req, body);
  if (!me) return tolakAuth();
  const aksi = String(body.aksi || "");
  if (aksi === "buat") {
    if (!batasi(me, "status", 15, 3600_000)) return terlaluCepat();
    const r = await buatStatus(me, { jenis: body.jenis, teks: body.teks, latar: body.latar, gambar: body.gambar });
    return r.ok ? j({ ok: true, statusId: r.statusId }) : galat(r.alasan);
  }
  if (aksi === "lihat") {
    if (!batasi(me, "lihat", 300, 60_000)) return terlaluCepat();
    const r = await lihatStatus(me, String(body.statusId || ""));
    return r.ok ? j({ ok: true }) : galat(r.alasan, 404);
  }
  if (aksi === "hapus") {
    const r = await hapusStatus(me, String(body.statusId || ""));
    return r.ok ? j({ ok: true }) : galat("Status tidak ditemukan.", 404);
  }
  return galat("Aksi tidak dikenal.");
}
