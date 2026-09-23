// Penghapusan pesan Room Chat.
//
// Tiga bentuk, dan bedanya penting:
//   scope = "me"    → disembunyikan HANYA dari yang meminta. Pesannya masih
//                     ada, dan orang lain tetap melihatnya. Siapa pun boleh.
//   scope = "all"   → dihapus untuk semua orang. Hanya pemilik pesannya.
//   scope = "admin" → dihapus untuk semua orang oleh admin, pesan siapa pun.
//
// Yang TIDAK dilakukan di sini: menghapus dokumennya dari database. Pesan
// ditandai deleted, bukan dibuang, supaya kalau ada yang dihapus keliru atau
// ada sengketa, isinya masih bisa ditelusuri admin.
import { NextResponse } from "next/server";
import { chatMessagesCol, chatGroupSettingsCol } from "@/lib/db";
import { isAdminRequest } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const { msgId, token, scope } = await req.json().catch(() => ({}));
    if (!msgId) return NextResponse.json({ error: "msgId diperlukan." }, { status: 400 });

    const col = await chatMessagesCol();
    const msg = await col.findOne({ msgId });
    if (!msg) return NextResponse.json({ error: "Pesan tidak ditemukan." }, { status: 404 });

    const admin = isAdminRequest(req);

    // ── Sembunyikan untuk diri sendiri ─────────────────────────────────
    if (scope === "me") {
      if (!token) return NextResponse.json({ error: "Kode akun diperlukan." }, { status: 400 });
      // $addToSet, bukan $push: menekan dua kali tidak boleh menumpuk token
      // yang sama berulang-ulang di dalam dokumen pesannya.
      await col.updateOne({ msgId }, { $addToSet: { hiddenFor: token } });
      return NextResponse.json({ ok: true, scope: "me" });
    }

    // ── Hapus untuk semua ──────────────────────────────────────────────
    const pemilik = Boolean(token) && msg.token === token;
    if (!admin && !pemilik) {
      return NextResponse.json({ error: "Cuma pengirimnya atau admin yang bisa menghapus untuk semua." }, { status: 403 });
    }

    await col.updateOne(
      { msgId },
      {
        $set: {
          deleted: true,
          deletedAt: new Date(),
          deletedBy: admin && !pemilik ? "admin" : "user",
          // Isinya dikosongkan dari tampilan, tapi disimpan apa adanya di
          // field terpisah — penghapusan keliru masih bisa ditelusuri.
          deletedSnapshot: {
            message: msg.message || "",
            type: msg.type || "text",
            token: msg.token || null,
            displayName: msg.displayName || null
          }
        }
      }
    );

    // Pesan yang dipin lalu dihapus akan meninggalkan bilah pin yang menunjuk
    // ke sesuatu yang sudah tidak ada. Pinnya ikut dilepas.
    if (msg.pinned) {
      const settings = await chatGroupSettingsCol();
      await settings.updateOne({ _id: "config" }, { $set: { pinnedMsgId: null } }, { upsert: true });
    }

    return NextResponse.json({ ok: true, scope: "all" });
  } catch (err) {
    console.error("[chat/delete]", err);
    return NextResponse.json({ error: "Gagal menghapus pesan." }, { status: 500 });
  }
}
