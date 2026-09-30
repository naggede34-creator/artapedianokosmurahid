import { auth, tolakAuth, j, galat, bacaBody, batasi, terlaluCepat } from "@/lib/wa/api";
import { perluNama } from "@/lib/wa/inti";
import { catatAktivitas } from "@/lib/game/aktivitas";
import { daftarGame, ambilGame, buatDuel, gabungDuel, tolakDuel, batalDuel, mainAksi, menyerah } from "@/lib/game/inti";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// GET            → lobi, duel milikku, riwayat, konfigurasi
// GET ?id=<id>   → satu duel (papan menurut sudut pandangku); sekaligus memeriksa batas waktu
export async function GET(req) {
  const me = await auth(req);
  if (!me) return tolakAuth();
  const id = new URL(req.url).searchParams.get("id");
  try {
    if (id) {
      const r = await ambilGame(me, id);
      return r.ok ? j(r.game) : galat(r.alasan, 404);
    }
    return j(await daftarGame(me));
  } catch (err) {
    console.error("[game GET]", err?.message || err);
    return galat("Gagal memuat permainan.", 500);
  }
}

export async function POST(req) {
  const body = await bacaBody(req);
  const me = await auth(req, body);
  if (!me) return tolakAuth();
  const aksi = String(body.aksi || "");
  try {
    if (aksi === "buat") {
      if (!batasi(me, "game-buat", 10, 60_000)) return terlaluCepat();
      const r = await buatDuel(me, { jenis: String(body.jenis || ""), taruhan: body.taruhan, undangPid: body.undang ? String(body.undang) : null });
      return r.ok ? j({ ok: true, gameId: r.gameId }) : galat(r.alasan);
    }
    if (aksi === "masuk") {
      // Pengguna membuka dasbor game: admin dikabari (sekali per 30 menit per pengguna). Tanpa nama → tidak dicatat.
      if (!batasi(me, "game-masuk", 20, 60_000)) return terlaluCepat();
      if (perluNama(me)) return j({ ok: true, perluNama: true });
      await catatAktivitas(me, "masuk");
      return j({ ok: true });
    }
    if (!batasi(me, "game-aksi", 240, 60_000)) return terlaluCepat();
    const id = String(body.id || "");
    if (aksi === "gabung") {
      if (!batasi(me, "game-gabung", 20, 60_000)) return terlaluCepat();
      const r = await gabungDuel(me, id);
      return r.ok ? j({ ok: true, gameId: r.gameId }) : galat(r.alasan);
    }
    if (aksi === "tolak") { const r = await tolakDuel(me, id); return r.ok ? j({ ok: true }) : galat(r.alasan || "Gagal."); }
    if (aksi === "batal") { const r = await batalDuel(me, id); return r.ok ? j({ ok: true }) : galat(r.alasan || "Gagal membatalkan."); }
    if (aksi === "main") {
      const r = await mainAksi(me, id, body.langkah);
      return r.ok ? j({ ok: true, game: r.game }) : galat(r.alasan, 400, r.tutup ? { tutup: true } : {});
    }
    if (aksi === "menyerah") { const r = await menyerah(me, id); return r.ok ? j({ ok: true, game: r.game }) : galat(r.alasan); }
    return galat("Aksi tidak dikenal.");
  } catch (err) {
    console.error("[game POST]", err?.message || err);
    return galat("Terjadi kesalahan server.", 500);
  }
}
