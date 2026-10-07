import { auth, tolakAuth, j } from "@/lib/wa/api";
import { publik, perluNama } from "@/lib/wa/inti";
import { daftarRoom } from "@/lib/wa/room";
import { jumlahStatusBaru } from "@/lib/wa/status";
import { adminSahWa } from "@/lib/wa/admin";
import { panggilanMasuk, bersihkanDering } from "@/lib/wa/call";

export const dynamic = "force-dynamic";

// Polling ringan layar utama: daftar obrolan, panggilan masuk, penanda status.
export async function GET(req) {
  const me = await auth(req);
  if (!me) return tolakAuth();
  try {
    await bersihkanDering();
    const [rooms, masuk, statusBaru] = await Promise.all([daftarRoom(me), panggilanMasuk(me), jumlahStatusBaru(me)]);
    const admin = await adminSahWa(req);
    return j({ admin, perluNama: perluNama(me), saya: { ...publik(me), blokir: me.blokir || [], sembunyiTerakhir: !!me.sembunyiTerakhir }, rooms, panggilanMasuk: masuk, statusBaru });
  } catch (err) {
    console.error("[wa/sinkron]", err?.message || err);
    return j({ error: "Gagal memuat obrolan." }, 500);
  }
}
