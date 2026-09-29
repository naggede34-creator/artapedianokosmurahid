import { auth, tolakAuth, j, galat, bacaBody, batasi, terlaluCepat } from "@/lib/wa/api";
import { kirim, ambil, tandaiBaca, ketik, reaksi, hapus, ubah, bintang, sematkan, pilihPoll, teruskan, kosongkan } from "@/lib/wa/pesan";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req) {
  const me = await auth(req);
  if (!me) return tolakAuth();
  const u = new URL(req.url).searchParams;
  const r = await ambil(me, u.get("room") || "", {
    after: u.get("after"), sebelum: u.get("sebelum"), limit: u.get("limit"), q: u.get("q") || "", bintang: u.get("bintang") === "1"
  });
  return r ? j(r) : galat("Obrolan tidak ditemukan.", 404);
}

export async function POST(req) {
  const body = await bacaBody(req);
  const me = await auth(req, body);
  if (!me) return tolakAuth();
  const aksi = String(body.aksi || "kirim");
  const roomId = String(body.room || "");

  if (aksi === "kirim") {
    if (!batasi(me, "kirim", 40, 60_000)) return terlaluCepat();
    const r = await kirim(me, roomId, body, { req });
    return r.ok ? j({ ok: true, pesan: r.pesan }) : galat(r.alasan, r.status || 400, r.tutup ? { tutup: true } : {});
  }
  if (!batasi(me, "aksi", 120, 60_000)) return terlaluCepat();
  const ok = (r, ekstra = {}) => (r.ok ? j({ ok: true, ...ekstra, ...(r.pesan ? { pesan: r.pesan } : {}), ...(r.terkirim !== undefined ? { terkirim: r.terkirim } : {}) }) : galat(r.alasan || "Gagal."));
  switch (aksi) {
    case "baca": return ok(await tandaiBaca(me, roomId));
    case "ketik": return ok(await ketik(me, roomId));
    case "reaksi": return ok(await reaksi(me, roomId, String(body.msgId || ""), String(body.emoji || "")));
    case "hapus": return ok(await hapus(me, roomId, String(body.msgId || ""), body.scope === "semua" ? "semua" : "saya", { req }));
    case "ubah": return ok(await ubah(me, roomId, String(body.msgId || ""), body.teks));
    case "bintang": return ok(await bintang(me, roomId, String(body.msgId || ""), !!body.nyalakan));
    case "sematkan": return ok(await sematkan(me, roomId, String(body.msgId || ""), !!body.nyalakan, { req }));
    case "vote": return ok(await pilihPoll(me, roomId, String(body.msgId || ""), String(body.opsiId || "")));
    case "teruskan": return ok(await teruskan(me, roomId, String(body.msgId || ""), body.ke));
    case "kosongkan": return ok(await kosongkan(me, roomId));
    default: return galat("Aksi tidak dikenal.");
  }
}
