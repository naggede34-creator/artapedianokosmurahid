import { auth, tolakAuth, j, galat, batasi, terlaluCepat } from "@/lib/wa/api";
import { ringkasanArena, selesaikanPeriode } from "@/lib/game/musimArena";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// GET → papan Season Arena (musim berjalan + pekan berjalan), posisiku, hadiah, juara periode lalu.
// Sekaligus memicu penutupan periode yang sudah lewat (idempoten) supaya hadiah tidak menunggu cron.
export async function GET(req) {
  const me = await auth(req);
  if (!me) return tolakAuth();
  if (!batasi(me, "arena-papan", 40, 60_000)) return terlaluCepat();
  try {
    selesaikanPeriode().catch(() => {});
    return j(await ringkasanArena(me));
  } catch (err) {
    console.error("[arena GET]", err?.message || err);
    return galat("Gagal memuat papan arena.", 500);
  }
}
