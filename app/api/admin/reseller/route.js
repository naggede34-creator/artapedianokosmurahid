// Admin web: semua bot reseller buatan pengguna + antrean penarikan komisinya.
import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { botsCol, usersCol } from "@/lib/db";
import { samarkanToken, lepasWebhook } from "@/lib/bots";
import { daftarPenarikan, tolakPenarikan, selesaikanPenarikan } from "@/lib/resellerWd";
import { botsCol as _botsCol } from "@/lib/db";
import { kabariPemilikBot } from "@/lib/kirimReseller";
import { resellerWdSelesaiNotif, resellerWdTolakNotif } from "@/lib/resellerNotif";

export const dynamic = "force-dynamic";

export async function GET(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const status = new URL(req.url).searchParams.get("status") || "pending";

  try {
    const col = await botsCol();
    const rows = await col.find({ jenis: "reseller" }).sort({ createdAt: -1 }).limit(300).toArray();

    // Nama pemiliknya diambil SEKALI untuk semua baris, bukan satu kueri per
    // bot. Dengan tiga ratus bot, satu kueri per baris berarti tiga ratus
    // perjalanan ke database untuk satu kali buka halaman.
    const users = await usersCol();
    const tokens = [...new Set(rows.map((b) => b.pemilikToken).filter(Boolean))];
    const peta = new Map();
    if (tokens.length) {
      const us = await users.find({ token: { $in: tokens } }, { projection: { token: 1, name: 1 } }).toArray();
      for (const u of us) peta.set(u.token, u.name || "");
    }

    const wd = await daftarPenarikan({ status, batas: 200 });
    const pending = (await daftarPenarikan({ status: "pending", batas: 500 })).length;

    return NextResponse.json({
      pending,
      bots: rows.map((b) => ({
        botId: b.botId,
        username: b.username,
        nama: b.nama,
        aktif: b.aktif !== false,
        dibekukan: !!b.dibekukan,
        // Token tidak pernah dikirim utuh, bahkan ke admin: dasbor ini sering
        // dibuka sambil berbagi layar, dan token bot itu kunci penuh botnya.
        tokenSamar: samarkanToken(b.token),
        pemilikToken: b.pemilikToken || "",
        pemilikNama: peta.get(b.pemilikToken) || "",
        ownerTelegramId: b.ownerTelegramId || "",
        ownerUsername: b.ownerUsername || "",
        markupPersen: Number(b.markupPersen) || 0,
        komisi: Number(b.komisi) || 0,
        jumlahTerjual: Number(b.jumlahTerjual) || 0,
        jumlahPembeli: Number(b.jumlahPembeli) || 0,
        webhookOk: !!b.webhookOk,
        createdAt: b.createdAt || null
      })),
      penarikan: wd.map((w) => ({ ...w, pemilikNama: peta.get(w.pemilikToken) || "" }))
    });
  } catch (err) {
    console.error("[admin/reseller GET]", err?.message || err);
    return NextResponse.json({ error: "Gagal memuat." }, { status: 500 });
  }
}

/**
 * Mengabarkan pemilik bot lewat botnya sendiri.
 *
 * Kegagalannya tidak pernah menggagalkan aksinya: uangnya sudah dikirim atau
 * komisinya sudah dikembalikan, dan membatalkan itu karena notifikasi gagal
 * jauh lebih buruk daripada notifikasi yang tidak sampai.
 */
async function kabariReseller(wd, buatTeks) {
  try {
    const col = await _botsCol();
    const bot = await col.findOne({ botId: String(wd.botId) });
    if (!bot?.token || !bot?.ownerTelegramId) return;
    await kabariPemilikBot(bot, buatTeks(bot));
  } catch (err) {
    console.error("[admin/reseller] notif penarikan gagal:", err?.message || err);
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

  const aksi = String(body?.aksi || "");
  try {
    if (aksi === "wd-selesai") {
      const r = await selesaikanPenarikan(body.wdId);
      if (!r.ok) return NextResponse.json({ error: r.alasan }, { status: 400 });
      await kabariReseller(r.wd, (bot) =>
        resellerWdSelesaiNotif({
          botUsername: bot.username,
          botNama: bot.nama,
          ownerUsername: bot.ownerUsername,
          // Yang dikirim adalah nominal BERSIH. Mengabarkan nominal kotor
          // membuat resellernya mengira uangnya kurang saat mengecek
          // e-walletnya.
          diterima: r.wd.diterima ?? r.wd.amount,
          ewalletNama: r.wd.ewalletNama,
          nomor: r.wd.nomor
        })
      );
      return NextResponse.json({ ok: true, pesan: "Ditandai sudah dikirim, resellernya dikabari." });
    }
    if (aksi === "wd-tolak") {
      const r = await tolakPenarikan(body.wdId, body.alasan);
      if (!r.ok) return NextResponse.json({ error: r.alasan }, { status: 400 });
      await kabariReseller(r.wd, (bot) =>
        resellerWdTolakNotif({
          botUsername: bot.username,
          botNama: bot.nama,
          ownerUsername: bot.ownerUsername,
          amount: r.wd.amount,
          alasan: r.wd.alasan
        })
      );
      return NextResponse.json({ ok: true, pesan: "Ditolak, komisi dikembalikan penuh dan resellernya dikabari." });
    }

    const botId = String(body?.botId || "");
    if (!botId) return NextResponse.json({ error: "botId kosong." }, { status: 400 });
    const col = await botsCol();

    if (aksi === "beku" || aksi === "cairkan") {
      const beku = aksi === "beku";
      const b = await col.findOne({ botId, jenis: "reseller" });
      if (!b) return NextResponse.json({ error: "Bot tidak ditemukan." }, { status: 404 });
      await col.updateOne({ botId }, { $set: { dibekukan: beku, updatedAt: new Date() } });
      // Membekukan menghentikan penarikan komisinya, TIDAK menghapus
      // komisinya. Uang yang sudah jadi hak orang tidak dihapus karena
      // dugaan; kalau terbukti, itu keputusan terpisah.
      return NextResponse.json({ ok: true, pesan: beku ? "Bot dibekukan." : "Pembekuan dicabut." });
    }

    if (aksi === "matikan") {
      const b = await col.findOne({ botId, jenis: "reseller" });
      if (!b) return NextResponse.json({ error: "Bot tidak ditemukan." }, { status: 404 });
      await lepasWebhook(b.token);
      await col.updateOne({ botId }, { $set: { aktif: false, updatedAt: new Date() } });
      return NextResponse.json({ ok: true, pesan: "Bot dimatikan dan webhooknya dilepas." });
    }

    return NextResponse.json({ error: "Aksi tidak dikenali." }, { status: 400 });
  } catch (err) {
    console.error("[admin/reseller POST]", err?.message || err);
    return NextResponse.json({ error: "Gagal memproses." }, { status: 500 });
  }
}
