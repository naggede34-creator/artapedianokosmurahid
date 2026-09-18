import { NextResponse } from "next/server";
import { usersCol, userNotificationsCol } from "@/lib/db";
import { isAdminRequest } from "@/lib/adminAuth";
import { sendTelegramNotif } from "@/lib/telegram";
import { sendMonitorLog } from "@/lib/monitor";

export const dynamic = "force-dynamic";

export async function POST(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const { token, suspend, reason } = await req.json().catch(() => ({}));
    if (!token) return NextResponse.json({ error: "Token wajib diisi." }, { status: 400 });

    const users = await usersCol();
    const user = await users.findOne({ token });
    if (!user) return NextResponse.json({ error: "User tidak ditemukan." }, { status: 404 });

    if (suspend) {
      await users.updateOne({ token }, {
        $set: {
          suspended: true,
          suspendedAt: new Date(),
          suspendReason: reason || "Ditangguhkan oleh admin"
        }
      });

      const notif = await userNotificationsCol();
      await notif.insertOne({
        token,
        type: "warning",
        title: "⚠️ Akun Ditangguhkan",
        body: reason || "Akun kamu telah ditangguhkan. Hubungi admin untuk info lebih lanjut.",
        read: false,
        createdAt: new Date()
      });

      sendTelegramNotif(
        `🚫 <b>USER DITANGGUHKAN (MANUAL)</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `🔑 Token : <code>${token.slice(0, 6)}••••${token.slice(-4)}</code>\n` +
        `👤 Nama  : ${user.name || "-"}\n` +
        `📋 Alasan: ${reason || "Tidak disebutkan"}\n` +
        `🕒 Waktu : ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB`
      );
    } else {
      await users.updateOne({ token }, {
        $unset: { suspended: "", suspendedAt: "", suspendReason: "", securityFlags: "" }
      });

      sendMonitorLog(
        `✅ <b>USER DIBUKA PEMBLOKIRAN</b>\n` +
        `🔑 Token : <code>${token.slice(0, 6)}••••${token.slice(-4)}</code>\n` +
        `👤 Nama  : ${user.name || "-"}`
      );
    }

    return NextResponse.json({ ok: true, suspended: !!suspend });
  } catch (err) {
    console.error("[admin/users/suspend]", err);
    return NextResponse.json({ error: "Gagal mengubah status suspend." }, { status: 500 });
  }
}
