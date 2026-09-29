import { auth, tolakAuth, j, galat, bacaBody, batasi, terlaluCepat } from "@/lib/wa/api";
import { publik, profilPid, ubahProfil, blokir } from "@/lib/wa/inti";

export const dynamic = "force-dynamic";

// GET ?pid= profil orang lain (tanpa token/foto mentah); tanpa pid = profilku.
export async function GET(req) {
  const me = await auth(req);
  if (!me) return tolakAuth();
  const pid = new URL(req.url).searchParams.get("pid");
  if (!pid || pid === me.pid) return j({ profil: publik(me), saya: true, sembunyiTerakhir: !!me.sembunyiTerakhir });
  const p = await profilPid(pid);
  if (!p) return galat("Pengguna tidak ditemukan.", 404);
  return j({ profil: publik(p), saya: false, diblokir: (me.blokir || []).includes(pid) });
}

export async function POST(req) {
  const body = await bacaBody(req);
  const me = await auth(req, body);
  if (!me) return tolakAuth();
  if (!batasi(me, "profil", 20, 60_000)) return terlaluCepat();

  if (body.blokir && typeof body.blokir === "object") {
    const r = await blokir(me, String(body.blokir.pid || ""), !!body.blokir.nyalakan);
    return r.ok ? j({ ok: true }) : galat(r.alasan);
  }
  const r = await ubahProfil(me, {
    nama: body.nama, bio: body.bio, foto: body.foto, hapusFoto: !!body.hapusFoto, sembunyiTerakhir: body.sembunyiTerakhir
  });
  return r.ok ? j({ ok: true }) : galat(r.alasan);
}
