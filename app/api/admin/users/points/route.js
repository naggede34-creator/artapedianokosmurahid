// Penambahan & pengurangan poin oleh admin.
//
// Mengikuti pola app/api/admin/users/balance: satu operasi atomik dengan
// syarat, catatan ke log admin, lalu notifikasi. Bedanya cuma field yang
// diubah dan tidak ada mutasi saldo.
import { NextResponse } from "next/server";
import { usersCol, adminBalanceLogsCol } from "@/lib/db";
import { isAdminRequest } from "@/lib/adminAuth";
import { mergeLegacyPoints } from "@/lib/loyalty";
import { sendTelegramNotif, adminPointsAdjustNotif } from "@/lib/telegram";

export async function POST(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const { token, amount, action, note } = await req.json().catch(() => ({}));
    const nominal = Math.floor(Math.abs(Number(amount || 0)));
    const cleanNote = String(note || "").slice(0, 120);
    if (!token || !nominal || !["add", "sub"].includes(action)) {
      return NextResponse.json({ error: "Parameter tidak valid." }, { status: 400 });
    }

    const users = await usersCol();

    // Poin yang tersangkut di field lama digabung dulu, supaya pengurangan
    // dihitung dari poin yang sebenarnya dipunya user — bukan dari sebagian.
    await mergeLegacyPoints(token);

    const delta = action === "add" ? nominal : -nominal;

    // Syarat "poin cukup" disatukan dengan pengurangannya. Kalau diperiksa
    // lebih dulu di langkah terpisah, poin user bisa berubah di antara kedua
    // langkah itu dan hasilnya jadi minus.
    const updated = await users.findOneAndUpdate(
      action === "sub" ? { token, points: { $gte: nominal } } : { token },
      { $inc: { points: delta } },
      { returnDocument: "after" }
    );

    if (!updated) {
      const ada = await users.findOne({ token }, { projection: { points: 1 } });
      return NextResponse.json(
        {
          error: !ada
            ? "Akun tidak ditemukan."
            : `Poin user cuma ${ada.points || 0}, tidak cukup untuk dikurangi ${nominal}.`
        },
        { status: 400 }
      );
    }

    const logs = await adminBalanceLogsCol();
    await logs.insertOne({
      token,
      kind: "points",
      amount: nominal,
      action,
      note: cleanNote,
      pointsAfter: updated.points || 0,
      createdAt: new Date()
    });

    sendTelegramNotif(
      adminPointsAdjustNotif({ token, amount: nominal, action, newPoints: updated.points || 0, note: cleanNote })
    );

    return NextResponse.json({ ok: true, points: updated.points || 0 });
  } catch (err) {
    console.error("[admin/users/points]", err);
    return NextResponse.json({ error: "Gagal mengubah poin." }, { status: 500 });
  }
}
