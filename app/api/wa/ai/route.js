import { auth, tolakAuth, j, bacaBody, batasi } from "@/lib/wa/api";
import { balasAI } from "@/lib/wa/ai";
import { balasAsisten, adalahRoomAi, POLA_PANGGIL } from "@/lib/wa/asisten";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

// Dipicu klien sesudah pesan terkirim. Tiga kasus:
//  • roomId "ai-<pid>" → obrolan pribadi dengan WEARTA AI (selalu dijawab)
//  • pesan "@ai …" di obrolan mana pun → WEARTA AI menjawab di obrolan itu
//  • Grup Umum → anggota-anggota AI komunitas (perilaku lama)
// Tak pernah menggagalkan chat.
export async function POST(req) {
  const body = await bacaBody(req);
  const me = await auth(req, body);
  if (!me) return tolakAuth();
  const roomId = String(body.roomId || "");
  const teks = String(body.teks || "").slice(0, 600);
  try {
    if (roomId && (adalahRoomAi(roomId) || POLA_PANGGIL.test(teks))) {
      if (!batasi(me, "asisten", 10, 60_000)) return j({ ok: true, replied: false, batas: true });
      return j({ ok: true, ...(await balasAsisten(me, roomId, teks)) });
    }
    if (!batasi(me, "ai", 12, 60_000)) return j({ ok: true, replied: false });
    return j({ ok: true, ...(await balasAI({ namaPengirim: me.nama, teks, jenis: body.jenis === "teks" ? "teks" : "lain" })) });
  } catch (err) {
    console.error("[wa/ai]", err?.message || err);
    return j({ ok: true, replied: false });
  }
}
