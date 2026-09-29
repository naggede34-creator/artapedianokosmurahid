// Status & kontrol backup otomatis dari dasbor admin.
//
// Tombol "Kirim sekarang" memanggil rute cron-nya dengan CRON_SECRET dari
// server — secretnya TIDAK pernah dikirim ke peramban. Kalau dikirim, siapa
// pun yang membuka DevTools di dasbor admin bisa memicu seluruh cron situs ini
// dari luar, termasuk yang menyentuh saldo.
import { NextResponse } from "next/server";
import { adminSah } from "@/lib/adminAuth";
import { getSettings, updateSettings } from "@/lib/settings";
import { tokenPengirim, tujuanBackup } from "@/lib/kirimBerkas";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req) {
  if (!await adminSah(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const settings = await getSettings();
    const { token, asal } = await tokenPengirim(settings);
    const { sah, ditolak } = await tujuanBackup();
    return NextResponse.json({
      aktif: settings.autoBackup !== false,
      jarakHari: settings.autoBackupHari === 2 ? 2 : 1,
      terakhir: settings.autoBackupTerakhir || "",
      botSiap: !!token,
      lewatBot: asal,
      // Id chatnya ikut ditampilkan supaya admin bisa memastikan backup
      // memang menuju chatnya sendiri, bukan chat orang lain. Ini bukan
      // rahasia — id chat sendiri terlihat di bot mana pun.
      tujuan: sah,
      ditolak,
      cronSecretAda: !!process.env.CRON_SECRET
    });
  } catch (err) {
    console.error("[admin/backup GET]", err?.message || err);
    return NextResponse.json({ error: "Gagal memuat status backup." }, { status: 500 });
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

  try {
    if (body?.aksi === "simpan") {
      await updateSettings({
        autoBackup: body.aktif === true,
        autoBackupHari: Number(body.jarakHari) === 2 ? 2 : 1
      });
      return NextResponse.json({ ok: true, pesan: "Pengaturan backup disimpan." });
    }

    if (body?.aksi === "kirim") {
      const base =
        (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`) ||
        (process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`) ||
        new URL(req.url).origin;

      const url = new URL("/api/cron/backup", base);
      // paksa=1 melewati penjaga jarak 1-2 hari: ini permintaan manual admin,
      // bukan jadwal.
      url.searchParams.set("paksa", "1");

      const r = await fetch(url, {
        headers: process.env.CRON_SECRET ? { authorization: `Bearer ${process.env.CRON_SECRET}` } : {},
        signal: AbortSignal.timeout(280000)
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) return NextResponse.json({ error: d?.error || `Gagal (HTTP ${r.status})`, detail: d }, { status: 400 });
      return NextResponse.json({
        ok: true,
        pesan: d?.ok
          ? `Terkirim ke ${d.tujuan} chat lewat ${d.lewatBot}. Cek Telegram kamu.`
          : d?.dilewati || "Tidak ada yang terkirim.",
        detail: d
      });
    }

    return NextResponse.json({ error: "Aksi tidak dikenali." }, { status: 400 });
  } catch (err) {
    console.error("[admin/backup POST]", err?.message || err);
    return NextResponse.json({ error: String(err?.message || err).slice(0, 200) }, { status: 500 });
  }
}
