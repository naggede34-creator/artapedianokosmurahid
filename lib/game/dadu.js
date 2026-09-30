// Dadu Naga — tebak apakah angka acak 00,00–99,99 jatuh di BAWAH atau di ATAS garis yang kamu pilih.
//
// Kamu memilih peluang menang T% (5–95) dan arah:
//   • "bawah": menang bila angka <  T            • "atas": menang bila angka ≥ 100 − T
// Kedua arah berpeluang persis T% (10.000 hasil berbobot sama). Pengali = RTP ÷ peluang, dibulatkan KE BAWAH
// 2 desimal, sehingga RTP ≤ 96% untuk setiap pilihan (paling sering tepat 96,0%).
export const RTP_TARGET = 0.96;
export const TARGET_MIN = 5;
export const TARGET_MAKS = 95;
export const ARAH = ["bawah", "atas"];

export const info = { kode: "dadu", nama: "Dadu Naga", ikon: "🎲", ringkas: "tebak di bawah/atas, pengali hingga ×19,2" };

/** Pengali untuk peluang menang T% (T bilangan bulat). */
export const pengaliUntuk = (T) => Math.floor((RTP_TARGET * 10000) / T) / 100;
export const sahParam = (arah, T) => ARAH.includes(arah) && Number.isInteger(T) && T >= TARGET_MIN && T <= TARGET_MAKS;
export const rtpUntuk = (T) => (T / 100) * pengaliUntuk(T);

/** Satu lemparan. `rng()` ∈ [0,1). */
export function lempar(arah, T, rng) {
  if (!sahParam(arah, T)) return null;
  const r = Math.floor(rng() * 10000); // 0..9999 → angka 00,00..99,99
  const menang = arah === "bawah" ? r < T * 100 : r >= 10000 - T * 100;
  return { angka: r / 100, arah, target: T, menang, pengali: menang ? pengaliUntuk(T) : 0 };
}
