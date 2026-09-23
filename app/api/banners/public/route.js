import { NextResponse } from "next/server";
import { bannersCol } from "@/lib/db";
import { defaultBannersFor } from "@/lib/defaultBanners";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const placement = searchParams.get("placement") || "homepage";

  let items = [];
  try {
    const col = await bannersCol();
    items = await col.find({ active: true, placement }).sort({ sortOrder: 1, createdAt: -1 }).toArray();
  } catch (err) {
    // Database sedang bermasalah. Banner bawaan berupa berkas statis yang tidak
    // butuh database sama sekali, jadi halamannya tetap terisi alih-alih
    // menampilkan lubang kosong.
    console.error("[banners/public]", err?.message || err);
    return NextResponse.json({ items: defaultBannersFor(placement), bawaan: true });
  }

  // Banner bawaan hanya muncul kalau admin belum punya satu pun banner aktif
  // untuk tempat ini. Begitu dia membuat punyanya sendiri, yang bawaan mundur
  // dengan sendirinya — tidak ada tombol yang harus ditekan, dan tidak ada
  // keadaan di mana keduanya bercampur.
  if (items.length === 0) {
    return NextResponse.json({ items: defaultBannersFor(placement), bawaan: true });
  }

  return NextResponse.json({
    items: items.map((b) => ({
      id: b._id.toString(),
      title: b.title,
      label: b.label || "",
      imageUrl: b.imageUrl,
      linkUrl: b.linkUrl,
      placement: b.placement,
    })),
  });
}
