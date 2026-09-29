// Coba lagi otomatis saat provider gagal memberi nomor.
//
// Sebelum ini, satu penolakan dari provider (stok habis di detik terakhir,
// gangguan sesaat) langsung jadi galat untuk pembeli, yang lalu harus memilih
// ulang dan mencoba lagi sendiri. Kebanyakan penolakan itu bukan karena
// layanannya habis — hanya penyedia yang dipilih yang gagal, sementara
// penyedia lain untuk negara yang sama masih punya stok.
//
// ATURAN YANG TIDAK BOLEH DILANGGAR: cadangan tidak pernah lebih mahal.
// Pembeli sudah setuju pada satu harga. Cadangan dengan harga modal lebih
// tinggi akan memakan margin (atau lebih buruk, menjual dengan rugi), jadi
// hanya yang harga modalnya SAMA ATAU LEBIH MURAH yang dipertimbangkan. Yang
// lebih murah tidak diturunkan ke pembeli: harga yang disepakati tetap.

export const MAKS_CADANGAN = 2;
// Panggilan ke provider bisa memakan 20–30 detik. Rute pesanan dibatasi 60
// detik, jadi pencarian cadangan berhenti di sini walau jatahnya belum habis —
// fungsinya tidak boleh dibunuh di tengah jalan saat saldo sudah terpotong.
export const BATAS_WAKTU_MS = 32_000;

/**
 * Memilih cadangan dari daftar penyedia untuk negara yang sama.
 *
 * @param daftar   [{ id, harga, stok, ... }] semua penyedia untuk negara itu
 * @param dipilih  id penyedia yang gagal
 * @param hargaMaks harga modal penyedia yang gagal (batas atas)
 * @returns urut dari yang termurah, maksimal MAKS_CADANGAN
 */
export function pilihCadangan(daftar, dipilih, hargaMaks) {
  return (Array.isArray(daftar) ? daftar : [])
    .filter((p) => {
      if (!p || String(p.id) === String(dipilih)) return false;
      const harga = Number(p.harga);
      if (!Number.isFinite(harga) || harga <= 0) return false;
      if (harga > Number(hargaMaks)) return false; // tidak pernah lebih mahal
      if (p.stok === 0 || p.tersedia === false) return false; // jelas-jelas habis
      return true;
    })
    .sort((a, b) => Number(a.harga) - Number(b.harga))
    .slice(0, MAKS_CADANGAN);
}

/**
 * Mencoba tiap cadangan berurutan sampai ada yang memberi nomor.
 *
 * @param coba  async (cadangan) => hasil | null. Melempar sama dengan null:
 *              satu cadangan yang error tidak boleh menghentikan yang lain.
 * @returns { hasil, cadangan, percobaan } atau null kalau semuanya gagal
 */
export async function cobaBerurutan(cadangan, coba, { batasMs = BATAS_WAKTU_MS, mulai = Date.now(), sekarang = Date.now } = {}) {
  let percobaan = 0;
  for (const c of cadangan || []) {
    // Sisa waktu diperiksa SEBELUM tiap percobaan: satu percobaan lagi yang
    // memakan 25 detik tidak akan sempat selesai kalau tinggal 5 detik.
    if (sekarang() - mulai >= batasMs) break;
    percobaan += 1;
    try {
      const hasil = await coba(c);
      if (hasil) return { hasil, cadangan: c, percobaan };
    } catch {
      // lanjut ke cadangan berikutnya
    }
  }
  return null;
}
