// Giveaway untuk admin: buat, undi, batalkan.
import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { daftarEvent, buatEvent, undiPemenang, batalkanEvent } from "@/lib/giveaway";
import { umumkan } from "@/lib/notifyHub";
import { giveawayBaruNotif, giveawayMenangNotif } from "@/lib/giveawayNotif";
import { notifyBotUser } from "@/lib/shopBot";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    return NextResponse.json({ items: await daftarEvent({ batas: 100 }) });
  } catch (err) {
    console.error("[admin/giveaway GET]", err?.message || err);
    return NextResponse.json({ error: "Gagal memuat." }, { status: 500 });
  }
}

export async function POST(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
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
      const r = await undiPemenang(body?.giveawayId);
      if (!r.berubah) return NextResponse.json({ ok: true, pesan: r.alasan || "Sudah pernah diundi." });

      const teks = giveawayMenangNotif({ event: r.event, pemenang: r.pemenang });
      umumkan({ jenis: "giveaway_menang", admin: teks, publik: teks });

      // Tiap pemenang dikabari di chat botnya sendiri. Pengumuman di channel
      // saja tidak cukup: tidak semua orang membacanya, dan hadiah yang masuk
      // tanpa keterangan terbaca seperti saldo yang muncul entah dari mana.
      for (const p of r.pemenang.filter((x) => !x.gagal)) {
        notifyBotUser(
          p.token,
          `🎉 <b>SELAMAT, KAMU MENANG!</b>\n\n` +
            `Giveaway: <b>${r.event.judul}</b>\n` +
            `Hadiah: <b>${r.event.jenisHadiah === "poin" ? `${r.event.nilaiHadiah} poin` : `Rp${r.event.nilaiHadiah.toLocaleString("id-ID")}`}</b>\n\n` +
            `Sudah masuk ke akunmu. Cek sekarang!`
        );
      }

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
