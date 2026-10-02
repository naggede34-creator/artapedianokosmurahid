// Rute deposit otomatis: pembeli TIDAK memilih penyedia QRIS — sistem yang memilihkan berdasarkan nominal.
//   nominal ≥ batas (bawaan Rp10.000) → diacak antara penyedia "atas"  (bawaan: Pakasir & QRIS FAST/AustinPay)
//   nominal <  batas (Rp1.000–9.999)  → penyedia "bawah"               (bawaan: WarungNokos)
// Mode alternatif QRIS UTAMA (DEPOSIT_UTAMA_AKTIF): berapa pun nominalnya diacak dari seluruh kolam (DEPOSIT_UTAMA_POOL, boleh termasuk manual).
// Bila penyedia pilihan sedang tidak siap (dimatikan admin / belum dikonfigurasi) atau gagal membuat QRIS, pembuatan diulang ke
// penyedia berikutnya (acak lagi, lalu kelompok satunya) — pembeli tidak melihat pergantian itu. Saklar: DEPOSIT_RUTE_AKTIF.
import crypto from "node:crypto";
import { cfg, cfgAngka } from "@/lib/config";
import { PROVIDER_KEYS } from "@/lib/paymentProviders";
import { depositRuteLogCol } from "@/lib/db";
import { tahan } from "@/lib/tahan";

const daftar = (s, bawaan, denganManual = false) => {
  const arr = String(s || bawaan).toLowerCase().split(/[,\s;]+/).map((x) => x.trim()).filter((x) => PROVIDER_KEYS.includes(x) && (denganManual || x !== "manual"));
  return [...new Set(arr)];
};

/** Acak Fisher–Yates dengan crypto (bukan Math.random). */
export function acak(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export async function ambilRute() {
  const utamaAktif = String((await cfg("DEPOSIT_UTAMA_AKTIF")) ?? "0") === "1";
  return {
    // Mode "QRIS UTAMA": satu metode untuk semua nominal, penyedia diacak dari kolam (termasuk QRIS manual). Menang atas rute per nominal.
    utama: utamaAktif,
    pool: daftar(await cfg("DEPOSIT_UTAMA_POOL"), "warungnokos,pakasir,qrisfast,manual", true),
    aktif: utamaAktif || String((await cfg("DEPOSIT_RUTE_AKTIF")) ?? "1") !== "0",
    batas: Math.max(1000, Math.round(await cfgAngka("DEPOSIT_RUTE_BATAS_RP", 10000))),
    min: Math.max(1, Math.round(await cfgAngka("DEPOSIT_RUTE_MIN_RP", 1000))),
    atas: daftar(await cfg("DEPOSIT_RUTE_ATAS"), "pakasir,qrisfast"),
    bawah: daftar(await cfg("DEPOSIT_RUTE_BAWAH"), "warungnokos")
  };
}

/**
 * Urutan penyedia yang dicoba untuk satu nominal. `siap(key)` → boolean (menyala di pengaturan & sudah dikonfigurasi).
 * Kelompok sesuai nominal diacak dulu; kelompok satunya jadi cadangan.
 */
export async function urutanRute(nominal, rute, siap) {
  if (rute.utama) {
    const hasil = [];
    for (const k of acak(rute.pool)) if (await siap(k)) hasil.push(k);
    return hasil;
  }
  const utama = nominal >= rute.batas ? rute.atas : rute.bawah;
  const cadangan = nominal >= rute.batas ? rute.bawah : rute.atas;
  const hasil = [];
  for (const k of [...acak(utama), ...acak(cadangan)]) {
    if (hasil.includes(k)) continue;
    if (await siap(k)) hasil.push(k);
  }
  return hasil;
}

/** Catat satu percobaan pembuatan QRIS (di latar, tak pernah melempar galat). Dibaca panel diagnosa admin. */
export function catatRute({ prov, nominal, ok, alasan = "", mode = "" }) {
  tahan((async () => {
    const c = await depositRuteLogCol();
    await c.insertOne({ at: new Date(), prov, nominal, ok: !!ok, alasan: String(alasan || "").slice(0, 300), mode });
  })().catch(() => {}));
}
