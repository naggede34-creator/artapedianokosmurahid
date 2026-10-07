// Backup otomatis: Backup Penuh + Database Akun, dikirim ke chat pemilik.
//
// Cara panggil manual/eksternal:
//   GET https://domain-kamu.vercel.app/api/cron/backup?secret=ISI_CRON_SECRET
// Vercel Cron mengirim header Authorization: Bearer <CRON_SECRET>.
//
// PENTING: di vercel.json jadwalnya HARUS 1x sehari. Paket Vercel Hobby
// menolak cron yang lebih sering dan seluruh DEPLOYMENT jadi gagal. Jarak
// 1 atau 2 hari diatur di dasbor admin dan ditegakkan DI SINI, bukan di
// jadwal cron-nya.
//
// ─────────────────────────────────────────────────────────────────────────
// APA YANG SEBENARNYA DIKIRIM
//
// Berkas ini memuat KODE AKUN SEMUA PENGGUNA, dan kode akun adalah kredensial
// di situs ini: siapa pun yang memegangnya bisa membuka akun itu dan
// membelanjakan saldonya. Backup penuh juga memuat nomor telepon dan kode OTP
// di riwayat pesanan.
//
// Karena itu tujuannya dibatasi keras di lib/kirimBerkas.js: hanya id dari
// environment, dan id grup/channel (selalu negatif di Telegram) DITOLAK. Satu
// id grup yang keliru masuk daftar berarti membagikan seluruh akun toko ke
// setiap anggotanya, dan berkas Telegram tidak bisa ditarik kembali setelah
// terkirim.
// ─────────────────────────────────────────────────────────────────────────
import { NextResponse } from "next/server";
import { cronSah } from "@/lib/cronAuth";
import { getSettings, updateSettings } from "@/lib/settings";
import { bangunBackupPenuh, bangunDatabaseAkun } from "@/lib/backupData";
import {
  tokenPengirim,
  tujuanBackup,
  mampatkan,
  kirimDokumen,
  kirimPesan,
  ukuranTerbaca
} from "@/lib/kirimBerkas";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function isAuthorized(req) {
  return cronSah(req);
}

function tanggalWIB(d = new Date()) {
  return new Date(d).toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export async function GET(req) {
  if (!(await isAuthorized(req))) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const paksa = new URL(req.url).searchParams.get("paksa") === "1";

  let settings = {};
  try {
    settings = await getSettings();
  } catch (e) {
    return NextResponse.json({ error: "Pengaturan tidak terbaca.", detail: String(e?.message || e) }, { status: 500 });
  }

  if (settings.autoBackup === false && !paksa) {
    return NextResponse.json({ ok: true, dilewati: "Backup otomatis dimatikan admin." });
  }

  // Jarak antar backup ditegakkan di sini, bukan di jadwal cron-nya, karena
  // Vercel Hobby cuma membolehkan cron harian. Cron jalan tiap hari; yang
  // memutuskan kirim atau tidak adalah jarak ini.
  const jarakHari = settings.autoBackupHari === 2 ? 2 : 1;
  const terakhir = settings.autoBackupTerakhir ? new Date(settings.autoBackupTerakhir) : null;
  if (!paksa && terakhir && Number.isFinite(terakhir.getTime())) {
    const lewat = (Date.now() - terakhir.getTime()) / 86400000;
    // Toleransi 2 jam: cron tidak pernah jalan di detik yang sama tiap hari,
    // dan tanpa toleransi ini backup 2-harian akan terlewat jadi 3 hari.
    if (lewat < jarakHari - 2 / 24) {
      return NextResponse.json({
        ok: true,
        dilewati: `Backup terakhir ${lewat.toFixed(1)} hari lalu, jaraknya diatur ${jarakHari} hari.`
      });
    }
  }

  const { token, asal } = await tokenPengirim(settings);
  if (!token) {
    return NextResponse.json(
      { error: "Tidak ada token bot. Isi TELEGRAM_BOT_TOKEN atau SHOP_BOT_TOKEN di Dasbor Admin → Konfigurasi (atau Environment Variables Vercel)." },
      { status: 400 }
    );
  }

  const { sah, ditolak } = await tujuanBackup();
  if (!sah.length) {
    return NextResponse.json(
      {
        error:
          "Tidak ada chat pemilik yang sah. Isi TELEGRAM_OWNER_IDS dengan id chat PRIBADI pemilik (angka positif). Id grup/channel ditolak karena backup memuat kode akun semua pengguna.",
        ditolak
      },
      { status: 400 }
    );
  }

  const stempel = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  const berkas = [];
  const gagalBangun = [];

  try {
    const penuh = await bangunBackupPenuh();
    const b = mampatkan(penuh.teks, `artapedia-backup-penuh-${stempel}.json`);
    berkas.push({
      ...b,
      judul: "Backup Penuh",
      rincian:
        `${penuh.jumlahUser.toLocaleString("id-ID")} user, ${Object.keys(penuh.ringkasan).length} koleksi` +
        (penuh.terpotong.length ? `\n⚠️ Terpotong: ${penuh.terpotong.join(", ")}` : "")
    });
  } catch (e) {
    console.error("[cron/backup] backup penuh gagal:", e?.message || e);
    gagalBangun.push(`Backup Penuh: ${String(e?.message || e).slice(0, 150)}`);
  }

  try {
    const akun = await bangunDatabaseAkun();
    const b = mampatkan(akun.teks, `artapedia-akun-${stempel}.json`);
    berkas.push({
      ...b,
      judul: "Database Akun",
      rincian:
        `${akun.jumlah.toLocaleString("id-ID")} akun (token, nama, saldo)` +
        (akun.terpotong ? `\n⚠️ Terpotong dari ${akun.total.toLocaleString("id-ID")} akun` : "")
    });
  } catch (e) {
    console.error("[cron/backup] database akun gagal:", e?.message || e);
    gagalBangun.push(`Database Akun: ${String(e?.message || e).slice(0, 150)}`);
  }

  // Satu berkas gagal dibangun tidak boleh membatalkan pengiriman yang lain.
  // Yang berhasil tetap dikirim, dan yang gagal dilaporkan di chat yang sama —
  // backup yang diam-diam tidak terkirim adalah backup yang tidak ada.
  if (!berkas.length) {
    for (const chatId of sah) {
      await kirimPesan(
        token,
        chatId,
        `❌ <b>BACKUP OTOMATIS GAGAL</b>\n\n${gagalBangun.join("\n") || "Tidak ada berkas yang bisa dibuat."}\n\n<i>${tanggalWIB()} WIB</i>`
      );
    }
    return NextResponse.json({ error: "Tidak ada berkas yang berhasil dibuat.", gagalBangun }, { status: 500 });
  }

  const hasil = [];
  for (const chatId of sah) {
    for (const f of berkas) {
      const caption =
        `\u{1F5C4}️ <b>${f.judul}</b>\n` +
        `${f.rincian}\n\n` +
        `\u{1F4E6} ${ukuranTerbaca(f.ukuranGz)} (asli ${ukuranTerbaca(f.ukuranAsli)})\n` +
        `\u{1F553} ${tanggalWIB()} WIB\n\n` +
        `⚠️ <b>Berkas ini memuat kode akun semua pengguna.</b> Kode akun itu kredensial — ` +
        `siapa pun yang memegang berkas ini bisa membuka akun mana pun di dalamnya. Jangan diteruskan ke siapa pun.`;

      const r = await kirimDokumen({ token, chatId, buffer: f.buffer, namaBerkas: f.nama, caption });
      hasil.push({ chatId, berkas: f.judul, ok: r.ok, alasan: r.alasan || null });
      if (!r.ok) console.error(`[cron/backup] ${f.judul} ke ${chatId} gagal:`, r.alasan);
    }
  }

  const adaGagal = hasil.some((h) => !h.ok) || gagalBangun.length > 0;
  if (adaGagal) {
    const rincian = [
      ...gagalBangun.map((g) => `• ${g}`),
      ...hasil.filter((h) => !h.ok).map((h) => `• ${h.berkas} → ${h.chatId}: ${h.alasan}`)
    ].join("\n");
    for (const chatId of sah) {
      await kirimPesan(token, chatId, `⚠️ <b>Sebagian backup tidak terkirim</b>\n\n${rincian}`);
    }
  }

  // Waktu terakhir HANYA dicatat kalau ada yang benar-benar terkirim. Kalau
  // dicatat walau gagal, penjaga jarak di atas akan menganggap backup hari ini
  // sudah beres dan percobaan berikutnya baru besok — satu hari hilang tanpa
  // backup, diam-diam.
  const adaTerkirim = hasil.some((h) => h.ok);
  if (adaTerkirim) {
    try {
      await updateSettings({ autoBackupTerakhir: new Date().toISOString() });
    } catch (e) {
      console.error("[cron/backup] gagal menyimpan waktu backup:", e?.message || e);
    }
  }

  return NextResponse.json({
    ok: adaTerkirim,
    lewatBot: asal,
    tujuan: sah.length,
    ditolak,
    berkas: berkas.map((f) => ({ judul: f.judul, ukuranGz: f.ukuranGz, ukuranAsli: f.ukuranAsli })),
    hasil,
    gagalBangun
  });
}
