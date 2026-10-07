import { auth, tolakAuth, j, galat, bacaBody, batasi, terlaluCepat } from "@/lib/wa/api";
import { mulai, keadaan, jawab, tolak, akhiri, kirimIce, riwayat, serverIce } from "@/lib/wa/call";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const me = await auth(req);
  if (!me) return tolakAuth();
  const u = new URL(req.url).searchParams;
  if (u.get("ice")) return j({ iceServers: await serverIce() });
  if (u.get("riwayat")) return j({ riwayat: await riwayat(me) });
  const k = await keadaan(me, u.get("call") || "", u.get("idx") || 0);
  return k ? j(k) : galat("Panggilan tidak ditemukan.", 404);
}

export async function POST(req) {
  const body = await bacaBody(req);
  const me = await auth(req, body);
  if (!me) return tolakAuth();
  const aksi = String(body.aksi || "");
  if (aksi === "mulai") {
    if (!batasi(me, "call", 12, 60_000)) return terlaluCepat();
    const r = await mulai(me, { ke: String(body.ke || ""), jenis: body.jenis, offer: body.offer });
    return r.ok ? j({ ok: true, callId: r.callId, status: r.status }) : galat(r.alasan);
  }
  if (!batasi(me, "call-sinyal", 600, 60_000)) return terlaluCepat();
  const id = String(body.callId || "");
  if (aksi === "jawab") { const r = await jawab(me, id, body.answer); return r.ok ? j({ ok: true }) : galat(r.alasan, 409); }
  if (aksi === "tolak") return j(await tolak(me, id));
  if (aksi === "akhiri") return j(await akhiri(me, id));
  if (aksi === "ice") return j(await kirimIce(me, id, body.kandidat));
  return galat("Aksi tidak dikenal.");
}
