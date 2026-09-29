import { auth, tolakAuth, j, bacaBody, batasi } from "@/lib/wa/api";
import { balasAI } from "@/lib/wa/ai";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Dipicu klien sesudah pesan terkirim di Grup Umum. Tak pernah menggagalkan chat.
export async function POST(req) {
  const body = await bacaBody(req);
  const me = await auth(req, body);
  if (!me) return tolakAuth();
  if (!batasi(me, "ai", 12, 60_000)) return j({ ok: true, replied: false });
  try {
    return j({ ok: true, ...(await balasAI({ namaPengirim: me.nama, teks: String(body.teks || "").slice(0, 500), jenis: body.jenis === "teks" ? "teks" : "lain" })) });
  } catch (err) {
    console.error("[wa/ai]", err?.message || err);
    return j({ ok: true, replied: false });
  }
}
