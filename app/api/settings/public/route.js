import { NextResponse } from "next/server";
import {
  getSettings,
  depositLimits,
  depositDisplay,
  manualDepositReady,
  manualDepositHours,
  cashbackPercentFor
} from "@/lib/settings";
import { PROVIDER_KEYS, DEPOSIT_PROVIDERS } from "@/lib/paymentProviders";
import { warungNokosConfigured } from "@/lib/warungnokos";
import { rumahOtpConfigured } from "@/lib/rumahotp";
import { atlanticConfigured } from "@/lib/atlantic";
import { CHANNEL_URL } from "@/lib/links";
import { infoJaminan } from "@/lib/jaminan";
import { loginWajib } from "@/lib/webAuth";

export const dynamic = "force-dynamic";

const CHANNELS = () => ({
  channelInfo: CHANNEL_URL
});

export async function GET() {
  const limits = depositLimits();
  try {
    const settings = await getSettings();
    const { csUsername, maintenance, maintenanceMsg, maintenanceTitle, maintenanceButtonLabel, maintenanceButtonUrl, depositProviders, depositFeePercent, heroChars } = settings;
    const providers = { ...depositProviders };
    if (!(await warungNokosConfigured())) providers.warungnokos = false;
    if ((await rumahOtpConfigured())) {
      if (providers.rumahotp === undefined || providers.rumahotp === null) providers.rumahotp = true;
    } else {
      providers.rumahotp = false;
    }
    // Metode yang belum siap dipaksa mati di sini, bukan cuma disembunyikan di
    // halaman: kalau cuma disembunyikan, siapa pun masih bisa memanggil
    // /api/deposit/create dengan metode itu dan mendapat error yang
    // membingungkan setelah mengisi nominal.
    if (!(await atlanticConfigured())) providers.atlantic = false;
    if (!manualDepositReady(settings)) providers.manual = false;

    // Jam buka TIDAK mematikan providers.manual. Kalau dimatikan, metodenya
    // hilang dari daftar dan orang mengira tokonya tidak punya QRIS manual sama
    // sekali; yang benar adalah metodenya ada, cuma sedang tutup — dan itu yang
    // ditampilkan halaman deposit lewat manualDeposit.open di bawah.
    const jam = manualDepositHours(settings);
    return NextResponse.json({
      maintenance: !!maintenance,
      // Saklar admin: true = pengunjung wajib daftar/masuk.
      loginWajib: await loginWajib().catch(() => false),
      csUsername: csUsername || "teatlas",
      maintenanceMsg,
      maintenanceTitle: maintenanceTitle || "Sedang Maintenance",
      maintenanceButtonLabel: maintenanceButtonLabel || "",
      maintenanceButtonUrl: maintenanceButtonUrl || "",
      depositProviders: providers,
      depositFeePercent,
      // Jaminan OTP: { aktif, persen, menit }. Dipakai lembar beli untuk
      // menampilkan (atau menyembunyikan) pilihan jaminan.
      jaminan: await infoJaminan().catch(() => ({ aktif: false, persen: 0, menit: 4 })),
      // Nama & label metode deposit yang diatur admin.
      depositMethods: PROVIDER_KEYS.map((k) => depositDisplay(settings, k)),
      // Keterangan singkat QRIS manual untuk ditampilkan sebelum deposit dibuat.
      // Gambar QRIS-nya sengaja TIDAK ikut: ratusan kilobita yang harus diunduh
      // semua orang di tiap halaman, padahal cuma dipakai saat benar-benar
      // memilih metode ini. Gambarnya ikut di respons pembuatan deposit.
      manualDeposit: {
        accountName: settings.manualDeposit?.accountName || "",
        accountLabel: settings.manualDeposit?.accountLabel || "",
        instructions: settings.manualDeposit?.instructions || "",
        // Verifikasi otomatis bukti transfer (OCR) menyala? Dipakai halaman deposit untuk
        // menjelaskan kode unik & proses pengecekan ke user.
        ocrAktif: Boolean(settings.manualDeposit?.ocrAktif),
        ocrMaks: Number(settings.manualDeposit?.ocrMaks) || 0,
        open: jam.open,
        openHour: jam.openHour,
        closeHour: jam.closeHour,
        hoursLabel: jam.label,
        // Dipakai popup untung-rugi sebelum deposit manual dibuat.
        cashbackPercent: cashbackPercentFor(settings, "manual"),
        normalCashbackPercent: Number(settings.loyalty?.cashbackDepositPercent) || 0
      },
      depositMin: limits.min,
      depositMax: limits.max,
      // Daftar karakternya dikosongkan saat panelnya dimatikan, bukan dikirim
      // lalu disembunyikan halaman: kalau dikirim, gambar dan teks tiap
      // karakter tetap diunduh semua pengunjung untuk sesuatu yang tidak
      // pernah tampil.
      heroCharsEnabled: settings.heroCharsEnabled !== false,
      comicIntroEnabled: settings.comicIntroEnabled !== false,
      heroChars: settings.heroCharsEnabled === false ? [] : heroChars || [],
      warranty: { enabled: settings.warranty?.enabled !== false, note: settings.warranty?.note || "" },
      ...CHANNELS()
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({
      maintenance: false,
      depositProviders: {
        warungnokos: (await warungNokosConfigured()),
        pakasir: true,
        rumahotp: (await rumahOtpConfigured()),
        atlantic: false,
        manual: false
      },
      depositFeePercent: { warungnokos: 0, pakasir: 0, rumahotp: 0.7, atlantic: 0, manual: 0 },
      depositMethods: DEPOSIT_PROVIDERS.map((p) => ({ key: p.key, name: p.name, badge: "", desc: p.desc, speed: p.speed })),
      csUsername: "teatlas",
      depositMin: limits.min,
      depositMax: limits.max,
      ...CHANNELS()
    });
  }
}
