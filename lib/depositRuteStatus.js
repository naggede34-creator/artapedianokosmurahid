// Diagnosa rute deposit untuk admin: tiap penyedia "siap" atau tidak (dan kenapa), hasil 24 jam terakhir, galat terakhir.
import { cfg } from "@/lib/config";
import { getSettings, manualDepositReady, manualDepositHours } from "@/lib/settings";
import { warungNokosConfigured } from "@/lib/warungnokos";
import { rumahOtpConfigured } from "@/lib/rumahotp";
import { atlanticConfigured } from "@/lib/atlantic";
import { austinConfigured } from "@/lib/austinpay";
import { depositRuteLogCol } from "@/lib/db";
import { ambilRute } from "@/lib/depositRute";
import { tesKoneksiPakasir } from "@/lib/pakasir";
import { diagnoseWarungNokos } from "@/lib/warungnokos";
import { diagnosaAustin } from "@/lib/austinpay";
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
      key: k, nama: providerName(k), siap, alasan, bobot: rute.bobot?.[k] || 1,
      sukses: sendiri.length - gagal.length, gagal: gagal.length,
      galatTerakhir: gagal[0] ? { alasan: gagal[0].alasan, at: gagal[0].at, nominal: gagal[0].nominal } : null
    });
  }
  const totalBobot = penyedia.filter((p) => p.siap).reduce((a, p) => a + p.bobot, 0) || 1;
  for (const p of penyedia) p.peluang = p.siap ? Math.round((p.bobot / totalBobot) * 100) : 0;
  return { mode: rute.utama ? "utama" : rute.aktif ? "nominal" : "mati", batas: rute.batas, penyedia, total24: baris.length };
}

/** Tes koneksi satu penyedia TANPA transaksi nyata. Mengembalikan { ok, pesan, ms?, detail? } — tidak pernah memuat API key. */
export async function tesKoneksi(k) {
  const mulai = Date.now();
  try {
    if (k === "pakasir") return await tesKoneksiPakasir(await cfg("PAKASIR_PROJECT"), await cfg("PAKASIR_APIKEY"));
    if (k === "warungnokos") {
      const d = await diagnoseWarungNokos();
      if (!d.configured) return { ok: false, pesan: d.error };
      if (d.profile?.error) return { ok: false, ms: Date.now() - mulai, pesan: `Gagal membaca akun WarungNokos: ${d.profile.error}` };
      return { ok: true, ms: Date.now() - mulai, pesan: `Terhubung${d.profile?.username ? ` sebagai ${d.profile.username}` : ""}${d.profile?.balance != null ? ` · saldo akun Rp${Number(d.profile.balance).toLocaleString("id-ID")}` : ""}.` };
    }
    if (k === "qrisfast") {
      const d = await diagnosaAustin();
      return { ok: !!d.ok, ms: Date.now() - mulai, pesan: d.pesan + (d.ok && d.saldo != null ? ` Saldo AustinPay Rp${Number(d.saldo).toLocaleString("id-ID")}.` : "") };
    }
    if (k === "manual") {
      const s = await getSettings();
      const siap = manualDepositReady(s);
      return { ok: siap, pesan: siap ? "QRIS manual siap (gambar QRIS terunggah)." : "QRIS manual belum disiapkan (unggah gambar QRIS)." };
    }
    return { ok: false, pesan: "Penyedia ini belum punya tes koneksi." };
  } catch (e) {
    return { ok: false, ms: Date.now() - mulai, pesan: String(e?.message || "gagal").slice(0, 200) };
  }
}
