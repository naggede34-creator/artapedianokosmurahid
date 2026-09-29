// Giveaway untuk admin: buat, undi, batalkan.
import { NextResponse } from "next/server";
import { adminSah } from "@/lib/adminAuth";
import { daftarEvent, buatEvent, batalkanEvent } from "@/lib/giveaway";
import { undiDanUmumkan, undiJatuhTempoDanUmumkan } from "@/lib/giveawayUndi";
import { umumkan } from "@/lib/notifyHub";
import { giveawayBaruNotif } from "@/lib/giveawayNotif";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req) {
  if (!await adminSah(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    // Event yang waktunya habis diundi dulu, supaya dasbor tidak menampilkan
    // "menunggu undian" untuk sesuatu yang seharusnya sudah selesai.
    await undiJatuhTempoDanUmumkan();
    return NextResponse.json({ items: await daftarEvent({ batas: 100 }) });
  } catch (err) {
    console.error("[admin/giveaway GET]", err?.message || err);
    return NextResponse.json({ error: "Gagal memuat." }, { status: 500 });
  }
}

export async function POST(req) {
  if (!await adminSah(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body tidak sah." }, { status: 400 });
  }

  const aksi = String(body?.aksi || "buat");
  try {
    if (aksi === "buat") {
      const r = await buatEvent(body);
      if (!r.ok) return NextResponse.json({ error: r.salah[0], salah: r.salah }, { status: 400 });
      umumkan({ jenis: "giveaway_baru", admin: giveawayBaruNotif(r.event), publik: giveawayBaruNotif(r.event) });
      return NextResponse.json({ ok: true, event: r.event, pesan: "Giveaway dibuat dan diumumkan." });
    }

    if (aksi === "undi") {
      const r = await undiDanUmumkan(body?.giveawayId);
      if (!r.berubah) return NextResponse.json({ ok: true, pesan: r.alasan || "Sudah pernah diundi." });

      return NextResponse.json({
        ok: true,
        pemenang: r.pemenang,
        pesan: r.pemenang.length
          ? `${r.pemenang.filter((x) => !x.gagal).length} pemenang, hadiah sudah masuk.`
          : "Tidak ada peserta."
      });
    }

    if (aksi === "batal") {
      const r = await batalkanEvent(body?.giveawayId);
      if (!r.ok) return NextResponse.json({ error: r.alasan }, { status: 400 });
      return NextResponse.json({ ok: true, pesan: "Giveaway dibatalkan." });
    }

    return NextResponse.json({ error: "Aksi tidak dikenali." }, { status: 400 });
  } catch (err) {
    console.error("[admin/giveaway POST]", err?.message || err);
    return NextResponse.json({ error: "Gagal memproses." }, { status: 500 });
  }
}
