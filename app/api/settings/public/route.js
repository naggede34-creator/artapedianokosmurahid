import { ambilRute } from "@/lib/depositRute";
import { NextResponse } from "next/server";
import {
  getSettings,
  alamatDokumentasi,
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
import { austinConfigured } from "@/lib/austinpay";
import { CHANNEL_URL, SITE_URL } from "@/lib/links";
import { infoJaminan } from "@/lib/jaminan";
import { loginWajib } from "@/lib/webAuth";
import { sapuDepositTertunda } from "@/lib/depositService";
import { tahan } from "@/lib/tahan";
import { pindaiDiLatar } from "@/lib/keamanan";
import { sapuWdInstan } from "@/lib/wdInstan";
import { sapuSetorGmail } from "@/lib/setorGmail";
import { brandDariSettings, brandUntukWeb } from "@/lib/brand";
import { rwDariReq } from "@/lib/rwKonteks";
import { ringkasLogo } from "@/lib/logo";
import { pengingatDeposit } from "@/lib/depositPengingat";

export const dynamic = "force-dynamic";

const CHANNELS = () => ({
  channelInfo: CHANNEL_URL
});

export async function GET(req) {
  // Lalu lintas web biasa ikut menyapu deposit QRIS yang menggantung (maks 1× per 30 detik per instance, di latar):
  // cadangan bila webhook provider tidak sampai dan cron eksternal belum dipasang.
  tahan(sapuDepositTertunda({ maks: 6, jeda: 30000, anggaranMs: 8000 }).catch(() => {}));
  tahan(sapuWdInstan({ maks: 6, jeda: 30000 }).catch(() => {}));
  tahan(sapuSetorGmail({ maks: 6, jeda: 30000 }).catch(() => {}));
  tahan(pengingatDeposit({ maks: 10, jeda: 30000 }).catch(() => {}));
  pindaiDiLatar(); // pemindaian keamanan berkala (maks 1× per 10 menit di seluruh sistem)
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
    if (!(await austinConfigured())) providers.qrisfast = false;
    if (!manualDepositReady(settings)) providers.manual = false;

    // Jam buka TIDAK mematikan providers.manual. Kalau dimatikan, metodenya
    // hilang dari daftar dan orang mengira tokonya tidak punya QRIS manual sama
    // sekali; yang benar adalah metodenya ada, cuma sedang tutup — dan itu yang
    // ditampilkan halaman deposit lewat manualDeposit.open di bawah.
    const jam = manualDepositHours(settings);

    // Rute deposit otomatis: pembeli tidak melihat daftar penyedia — hanya satu pilihan "QRIS" (penyedianya dipilih server
    // berdasarkan nominal, lihat lib/depositRute.js) + QRIS manual bila tersedia. Kunci "qrisfast" hanya pembawa pilihan;
    // server mengabaikannya dan memilih sendiri.
    const rute = await ambilRute().catch(() => null);
    const ruteSiap = !!rute?.aktif && [...(rute.utama ? rute.pool : [...rute.atas, ...rute.bawah])].some((k) => providers[k]);
    let depositProvidersKeluar = providers;
    let depositFeeKeluar = depositFeePercent;
    let depositMethodsKeluar = PROVIDER_KEYS.map((k) => depositDisplay(settings, k));
    let depositMinKeluar = limits.min;
    if (ruteSiap) {
      // Mode QRIS UTAMA: QRIS manual ikut kolam acak, jadi tidak tampil sebagai pilihan terpisah.
      depositProvidersKeluar = { qrisfast: true, manual: rute.utama ? false : !!providers.manual };
      depositFeeKeluar = { ...(depositFeePercent || {}), qrisfast: 0 };
      depositMethodsKeluar = [
        { key: "qrisfast", name: rute.utama ? "QRIS UTAMA" : "QRIS", badge: rute.utama ? "UTAMA" : "", desc: "Semua e-wallet & m-banking. Saldo masuk otomatis.", speed: "± 10–60 detik" },
        ...(rute.utama ? [] : depositMethodsKeluar.filter((m) => m.key === "manual"))
      ];
      depositMinKeluar = Math.min(limits.min, rute.min);
    }
    return NextResponse.json({
      maintenance: !!maintenance,
      // Saklar admin: true = pengunjung wajib daftar/masuk.
      // Web reseller selalu minta daftar/masuk: akunnya terpisah dari web utama.
      loginWajib: (await loginWajib().catch(() => false)) || !!(await rwDariReq(req)),
      csUsername: csUsername || "teatlas",
      brand: await (async () => {
        const utama = brandDariSettings(settings, await ringkasLogo());
        const web = await rwDariReq(req);
        return web ? brandUntukWeb(utama, web) : utama;
      })(),
      maintenanceMsg,
      maintenanceTitle: maintenanceTitle || "Sedang Maintenance",
      maintenanceButtonLabel: maintenanceButtonLabel || "",
      maintenanceButtonUrl: maintenanceButtonUrl || "",
      depositProviders: depositProvidersKeluar,
      depositFeePercent: depositFeeKeluar,
      depositRute: ruteSiap,
      // Status QRIS FAST yang sebenarnya (dompet Poin Game tidak ikut rute otomatis, jadi butuh nilai asli).
      qrisfastAsli: !!providers.qrisfast,
      // Jaminan OTP: { aktif, persen, menit }. Dipakai lembar beli untuk
      // menampilkan (atau menyembunyikan) pilihan jaminan.
      jaminan: await infoJaminan().catch(() => ({ aktif: false, persen: 0, menit: 4 })),
      // Nama & label metode deposit yang diatur admin.
      depositMethods: depositMethodsKeluar,
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
      depositMin: depositMinKeluar,
      depositMax: limits.max,
      // Daftar karakternya dikosongkan saat panelnya dimatikan, bukan dikirim
      // lalu disembunyikan halaman: kalau dikirim, gambar dan teks tiap
      // karakter tetap diunduh semua pengunjung untuk sesuatu yang tidak
      // pernah tampil.
      heroCharsEnabled: settings.heroCharsEnabled !== false,
      comicIntroEnabled: settings.comicIntroEnabled !== false,
      heroChars: settings.heroCharsEnabled === false ? [] : heroChars || [],
      warranty: { enabled: settings.warranty?.enabled !== false, note: settings.warranty?.note || "" },
      // Alamat dasar yang ditampilkan di dokumentasi API (diatur admin).
      docs: alamatDokumentasi(settings, SITE_URL),
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
      docs: { api: SITE_URL, gateway: SITE_URL },
      ...CHANNELS()
    });
  }
}
