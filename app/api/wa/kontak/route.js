import { auth, tolakAuth, j } from "@/lib/wa/api";
import { cariKontak } from "@/lib/wa/room";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const me = await auth(req);
  if (!me) return tolakAuth();
  const u = new URL(req.url).searchParams;
  return j(await cariKontak(me, { q: u.get("q") || "", hal: Math.max(0, Number(u.get("hal")) || 0) }));
}
