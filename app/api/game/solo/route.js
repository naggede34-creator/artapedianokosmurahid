import { auth, tolakAuth, j, galat, bacaBody, batasi, terlaluCepat } from "@/lib/wa/api";
import { infoSolo, mainSolo, isiUlangKoin, NAMA_GAME } from "@/lib/game/solo";
import { jagaGame } from "@/lib/anticurang";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// GET  → konfigurasi, saldo/koin, tabel pengali, riwayat
// POST { aksi: "plinko" | "slot" | "isi-ulang", mode: "demo" | "saldo", bet, baris?, risiko? }
export async function GET(req) {
  const me = await auth(req);
  if (!me) return tolakAuth();
  try {
    return j(await infoSolo(me));
  } catch (err) {
    console.error("[solo GET]", err?.message || err);
    return galat("Gagal memuat game solo.", 500);
  }
}

export async function POST(req) {
  const body = await bacaBody(req);
  const me = await auth(req, body);
  if (!me) return tolakAuth();
  const aksi = String(body.aksi || "");
  try {
    const blok = await jagaGame(me, req);
    if (blok) return galat(blok.alasan, blok.status);
    if (aksi === "isi-ulang") {
      if (!batasi(me, "solo-isi", 6, 60_000)) return terlaluCepat();
      const r = await isiUlangKoin(me);
      return r.ok ? j({ ok: true, koin: r.koin }) : galat(r.alasan);
    }
    if (Object.prototype.hasOwnProperty.call(NAMA_GAME, aksi)) {
      if (!batasi(me, "solo-main", 90, 60_000)) return terlaluCepat();
      const { aksi: _a, token: _t, ...sisa } = body; void _a; void _t;
      const r = await mainSolo(me, { ...sisa, game: aksi });
      if (!r.ok) return galat(r.alasan, 400, r.batas ? { batas: true } : {});
      const { ok: _ok, ...data } = r; void _ok;
      return j({ ok: true, ...data });
    }
    return galat("Aksi tidak dikenal.");
  } catch (err) {
    console.error("[solo POST]", err?.message || err);
    return galat("Terjadi kesalahan. Coba lagi.", 500);
  }
}
