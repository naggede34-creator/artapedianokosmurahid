import { auth, tolakAuth, j, galat, bacaBody, batasi, terlaluCepat } from "@/lib/wa/api";
import { infoRoom, bukaPrivate, buatGrup, ubahGrup, tambahAnggota, keluarkanAnggota, aturAdmin, keluarGrup, gabungDenganKode, resetKodeUndang, aturPref } from "@/lib/wa/room";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const me = await auth(req);
  if (!me) return tolakAuth();
  const u = new URL(req.url).searchParams;
  const kode = u.get("kode");
  if (kode) {
    // Pratinjau tautan undangan (nama & jumlah anggota) sebelum bergabung.
    const { waRoomCol } = await import("@/lib/db");
    const r = await (await waRoomCol()).findOne({ kodeUndang: String(kode) });
    if (!r) return galat("Tautan undangan tidak berlaku.", 404);
    return j({ nama: r.nama, anggota: (r.anggota || []).length, deskripsi: r.deskripsi || "", sudah: (r.anggota || []).includes(me.pid) });
  }
  const info = await infoRoom(me, u.get("room") || "");
  return info ? j(info) : galat("Obrolan tidak ditemukan.", 404);
}

const hasil = (r, ekstra = {}) => (r.ok ? j({ ok: true, ...ekstra, ...r }) : galat(r.alasan || "Gagal.", r.status || 400));

export async function POST(req) {
  const body = await bacaBody(req);
  const me = await auth(req, body);
  if (!me) return tolakAuth();
  const aksi = String(body.aksi || "");
  if (!batasi(me, "room", 40, 60_000)) return terlaluCepat();

  switch (aksi) {
    case "private": return hasil(await bukaPrivate(me, String(body.pid || "")));
    case "buat-grup":
      if (!batasi(me, "buat-grup", 10, 3600_000)) return terlaluCepat();
      return hasil(await buatGrup(me, { nama: body.nama, anggota: body.anggota, foto: body.foto, deskripsi: body.deskripsi }));
    case "ubah-grup":
      return hasil(await ubahGrup(me, String(body.roomId || ""), { nama: body.nama, deskripsi: body.deskripsi, foto: body.foto, hapusFoto: !!body.hapusFoto, hanyaAdminKirim: body.hanyaAdminKirim }));
    case "tambah": return hasil(await tambahAnggota(me, String(body.roomId || ""), body.pids));
    case "keluarkan": return hasil(await keluarkanAnggota(me, String(body.roomId || ""), String(body.pid || "")));
    case "admin": return hasil(await aturAdmin(me, String(body.roomId || ""), String(body.pid || ""), !!body.jadikan));
    case "keluar": return hasil(await keluarGrup(me, String(body.roomId || "")));
    case "gabung": return hasil(await gabungDenganKode(me, String(body.kode || "")));
    case "reset-kode": return hasil(await resetKodeUndang(me, String(body.roomId || "")));
    case "pref": return hasil(await aturPref(me, String(body.roomId || ""), { pinned: body.pinned, muted: body.muted, archived: body.archived }));
    default: return galat("Aksi tidak dikenal.");
  }
}
