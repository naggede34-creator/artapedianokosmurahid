import { auth, tolakAuth, j, galat, bacaBody, batasi, terlaluCepat } from "@/lib/wa/api";
import { ringkasanKlan, buatKlan, gabungKlan, keluarKlan, keluarkanDariKlan } from "@/lib/klan";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// GET  → klanku (anggota, misi minggu ini), papan klan mingguan & sepanjang masa, klan yang bisa dimasuki
// POST → { aksi: buat | gabung | keluar | keluarkan }
export async function GET(req) {
  const me = await auth(req);
  if (!me) return tolakAuth();
  if (!batasi(me, "klan-baca", 60, 60_000)) return terlaluCepat();
  try { return j(await ringkasanKlan(me)); } catch (err) { console.error("[klan GET]", err?.message || err); return galat("Gagal memuat klan.", 500); }
}

export async function POST(req) {
  const body = await bacaBody(req);
  const me = await auth(req, body);
  if (!me) return tolakAuth();
  if (!batasi(me, "klan-aksi", 15, 60_000)) return terlaluCepat();
  try {
    const aksi = String(body.aksi || "");
    let r;
    if (aksi === "buat") r = await buatKlan(me, { nama: body.nama, tag: body.tag, deskripsi: body.deskripsi });
    else if (aksi === "gabung") r = await gabungKlan(me, body.klanId);
    else if (aksi === "keluar") r = await keluarKlan(me);
    else if (aksi === "keluarkan") r = await keluarkanDariKlan(me, String(body.pid || ""));
    else return galat("Aksi tidak dikenal.");
    return r.ok ? j(r) : galat(r.alasan || "Gagal.");
  } catch (err) {
    console.error("[klan POST]", err?.message || err);
    return galat("Terjadi kesalahan server.", 500);
  }
}
