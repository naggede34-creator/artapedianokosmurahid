import { NextResponse } from "next/server";
import { announcementsCol } from "@/lib/db";
import { ANNOUNCEMENTS } from "@/lib/announcements";

export const dynamic = "force-dynamic";

function fmtDate(d) {
  return new Date(d).toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }) + " WIB";
}

export async function GET() {
  try {
    const col = await announcementsCol();
    const list = await col
      .find({ active: { $ne: false } })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    if (list.length === 0) {
      // Belum ada pengumuman dari admin di database — tampilkan data bawaan
      // supaya halaman Informasi tidak kosong.
      return NextResponse.json({ items: ANNOUNCEMENTS });
    }

    return NextResponse.json({
      items: list.map((a) => ({
        id: a._id.toString(),
        category: a.category,
        title: a.title,
        date: fmtDate(a.createdAt),
        icon: a.icon || "ℹ️",
        body: a.body,
        views: a.views || 0,
        likes: a.likes || 0,
        fire: a.fire || 0
      }))
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ items: ANNOUNCEMENTS });
  }
}
