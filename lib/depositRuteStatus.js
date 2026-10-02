// Diagnosa rute deposit untuk admin: tiap penyedia "siap" atau tidak (dan kenapa), hasil 24 jam terakhir, galat terakhir.
import { cfg } from "@/lib/config";
import { getSettings, manualDepositReady, manualDepositHours } from "@/lib/settings";
import { warungNokosConfigured } from "@/lib/warungnokos";
import { rumahOtpConfigured } from "@/lib/rumahotp";
import { atlanticConfigured } from "@/lib/atlantic";
import { austinConfigured } from "@/lib/austinpay";
import { depositRuteLogCol } from "@/lib/db";
import { ambilRute } from "@/lib/depositRute";
import { providerName } from "@/lib/paymentProviders";

const SIAP = {
  warungnokos: async () => (await warungNokosConfigured()) || "API key WarungNokos belum diisi (Konfigurasi → Pembayaran)",
  pakasir: async () => (!!((await cfg("PAKASIR_PROJECT")) && (await cfg("PAKASIR_APIKEY")))) || "Slug proyek / API key Pakasir belum diisi (Konfigurasi → Pembayaran)",
  qrisfast: async () => (await austinConfigured()) || "API key/secret AustinPay belum diisi",
  rumahotp: async () => (await rumahOtpConfigured()) || "API key RumahOTP belum diisi",
  atlantic: async () => (await atlanticConfigured()) || "API key Atlantic belum diisi",
};

export async function statusRute() {
  const rute = await ambilRute();
  const settings = await getSettings();
  const dp = settings.depositProviders || {};
  const dalamRute = rute.utama ? rute.pool : [...new Set([...rute.atas, ...rute.bawah])];
  const col = await depositRuteLogCol();
  const sejak = new Date(Date.now() - 24 * 3600 * 1000);
  const baris = await col.find({ at: { $gte: sejak } }).sort({ at: -1 }).limit(2000).toArray();
  const penyedia = [];
  for (const k of dalamRute) {
    let siap = true, alasan = "";
    if (k === "manual") {
      if (!dp.manual) { siap = false; alasan = "Metode QRIS Manual dimatikan di pengaturan deposit"; }
      else if (!manualDepositReady(settings)) { siap = false; alasan = "QRIS manual belum disiapkan (gambar QRIS belum diunggah)"; }
      else if (!manualDepositHours(settings).open) { siap = false; alasan = "QRIS manual sedang di luar jam layanan"; }
    } else if (!dp[k]) { siap = false; alasan = "Metode ini dimatikan di pengaturan deposit (saklar metode di dasbor admin)"; }
    else if (SIAP[k]) { const h = await SIAP[k](); if (h !== true) { siap = false; alasan = h; } }
    const sendiri = baris.filter((b) => b.prov === k);
    const gagal = sendiri.filter((b) => !b.ok);
    penyedia.push({
      key: k, nama: providerName(k), siap, alasan,
      sukses: sendiri.length - gagal.length, gagal: gagal.length,
      galatTerakhir: gagal[0] ? { alasan: gagal[0].alasan, at: gagal[0].at, nominal: gagal[0].nominal } : null
    });
  }
  return { mode: rute.utama ? "utama" : rute.aktif ? "nominal" : "mati", batas: rute.batas, penyedia, total24: baris.length };
}
