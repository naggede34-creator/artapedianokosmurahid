// Pustaka pose & gerak Arena Pendekar: kunci-bingkai animasi + data bingkai (hitbox, damage) untuk mode aksi real-time.
// Waktu dalam detik. Hitbox: x = jarak ke depan dari pusat petarung, y = tinggi dari lantai (gerak udara: dari kaki petarung).
import { lengkap, campur } from "./kerangka";
import { KARAKTER } from "@/lib/tarung/karakter";

/** Kuda-kuda dasar; tiap petarung boleh menimpa sudut lengannya (rupa.kuda) agar cocok dengan gambarnya. */
export const KUDA = { bd: 8, kp: -4, ad1: 34, ad2: 116, ab1: 16, ab2: 128, kd1: 24, kd2: 22, kb1: -16, kb2: 8 };

/** Pustaka pose dari kuda-kuda dasar `S` (pose yang tidak menyebut lengan/kaki mewarisi kuda-kuda). */
export function buatPose(S = KUDA) {
  const p = (o) => lengkap({ ...S, ...o });
  return {
    siaga: p({}),
    jongkok: p({ bd: 24, kp: -10, ad1: 52, ad2: 98, ab1: 34, ab2: 112, kd1: 64, kd2: 124, kb1: -2, kb2: 96 }),
    lompat: p({ bd: 4, kp: -6, ad1: 46, ad2: 96, ab1: 24, ab2: 118, kd1: 78, kd2: 120, kb1: 32, kb2: 112, ud: 1 }),
    tangkis: p({ bd: 0, kp: 8, ad1: 74, ad2: 118, ab1: 62, ab2: 128, kd1: 20, kd2: 28, kb1: -20, kb2: 18 }),
    tangkisBawah: p({ bd: 26, kp: -6, ad1: 66, ad2: 84, ab1: 54, ab2: 96, kd1: 64, kd2: 124, kb1: -2, kb2: 96 }),
    jalanA: p({ kd1: 34, kd2: 14, kb1: -26, kb2: 20 }),
    jalanB: p({ kd1: 8, kd2: 30, kb1: -2, kb2: 6 }),
    // pukulan
    pukulTarik: p({ bd: 4, ad1: 18, ad2: 138, kd1: 26, kd2: 24 }),
    pukul: p({ bd: 16, kp: -6, ad1: 88, ad2: 3, ab1: 12, ab2: 132, kd1: 30, kd2: 16, kb1: -24, kb2: 4 }),
    pukul2: p({ bd: 24, kp: -8, ad1: 22, ad2: 124, ab1: 94, ab2: 2, kd1: 34, kd2: 18, kb1: -28, kb2: 2 }),
    pukulBawah: p({ bd: 30, kp: -10, ad1: 74, ad2: 6, ab1: 34, ab2: 112, kd1: 64, kd2: 124, kb1: -2, kb2: 96 }),
    uppercut: p({ bd: 2, kp: 10, ad1: 150, ad2: 30, ab1: 20, ab2: 120, kd1: 36, kd2: 10, kb1: -30, kb2: 6 }),
    // tendangan kapak (overhead)
    tendangAngkat: p({ bd: -12, kp: 6, ad1: 54, ad2: 88, ab1: -26, ab2: 70, kd1: 126, kd2: 104, kb1: -6, kb2: 6 }),
    tendangPuncak: p({ bd: -18, kp: 4, ad1: 64, ad2: 70, ab1: -38, ab2: 52, kd1: 168, kd2: 8, kb1: -2, kb2: 0 }),
    tendangHantam: p({ bd: 20, kp: -10, ad1: 40, ad2: 102, ab1: -6, ab2: 96, kd1: 74, kd2: 0, kb1: -14, kb2: 10 }),
    // sapuan
    sapuTurun: p({ bd: 34, kp: -10, ad1: 76, ad2: 40, ab1: 100, ab2: 30, kd1: 70, kd2: 128, kb1: 4, kb2: 100 }),
    sapu: p({ bd: 40, kp: -12, ad1: 96, ad2: 30, ab1: 112, ab2: 24, kd1: 90, kd2: 0, kb1: 8, kb2: 104 }),
    // udara
    pukulUdara: p({ bd: 22, kp: -8, ad1: 120, ad2: 4, ab1: 30, ab2: 110, kd1: 70, kd2: 112, kb1: 26, kb2: 104, ud: 1 }),
    tendangUdara: p({ bd: -6, kp: -4, ad1: 40, ad2: 90, ab1: -20, ab2: 70, kd1: 70, kd2: 4, kb1: 16, kb2: 118, ud: 1 }),
    // bantingan
    bantingRaih: p({ bd: 22, kp: -6, ad1: 82, ad2: 24, ab1: 78, ab2: 30, kd1: 34, kd2: 26, kb1: -26, kb2: 10, tg: 1 }),
    bantingAngkat: p({ bd: -14, kp: 6, ad1: 166, ad2: 16, ab1: 160, ab2: 20, kd1: 26, kd2: 30, kb1: -26, kb2: 18, tg: 1 }),
    bantingLempar: p({ bd: 36, kp: -12, ad1: 110, ad2: 10, ab1: 104, ab2: 14, kd1: 40, kd2: 22, kb1: -30, kb2: 6, tg: 1 }),
    // reaksi
    kena: p({ bd: -16, kp: 20, ad1: 12, ad2: 62, ab1: -8, ab2: 52, kd1: 12, kd2: 22, kb1: -24, kb2: 14 }),
    kenaBawah: p({ bd: 36, kp: -20, ad1: 30, ad2: 40, ab1: 20, ab2: 40, kd1: 20, kd2: 40, kb1: -10, kb2: 30 }),
    kenaBerat: p({ bd: -30, kp: 24, rot: 8, ad1: -24, ad2: 34, ab1: -34, ab2: 24, kd1: 22, kd2: 34, kb1: -30, kb2: 12 }),
    melayang: p({ bd: -24, kp: 20, rot: 34, ad1: -40, ad2: 20, ab1: -60, ab2: 20, kd1: 40, kd2: 50, kb1: 10, kb2: 40, ud: 1 }),
    rebah: p({ bd: -6, kp: 6, rot: 90, ad1: -30, ad2: 20, ab1: -50, ab2: 30, kd1: 20, kd2: 30, kb1: 6, kb2: 14, rb: 1 }),
    bangun: p({ bd: 40, kp: -14, ad1: 60, ad2: 40, ab1: 40, ab2: 50, kd1: 74, kd2: 126, kb1: -4, kb2: 100 }),
    dilempar: p({ bd: -20, kp: 24, rot: 150, ad1: 150, ad2: 20, ab1: 140, ab2: 30, kd1: 30, kd2: 40, kb1: 0, kb2: 20, ud: 1 }),
    pusing: p({ bd: -6, kp: 18, ad1: 6, ad2: 30, ab1: -6, ab2: 30, kd1: 14, kd2: 18, kb1: -14, kb2: 10 }),
    // khusus
    tolak: p({ bd: 18, kp: -6, ad1: 92, ad2: 0, ab1: 86, ab2: 6, kd1: 44, kd2: 12, kb1: -34, kb2: 0, tg: 1 }),
    tolakTarik: p({ bd: -6, kp: 4, ad1: -30, ad2: 120, ab1: -36, ab2: 116, kd1: 30, kd2: 26, kb1: -30, kb2: 10, tg: 1 }),
    terbangTendang: p({ bd: -10, kp: -8, rot: -14, ad1: 120, ad2: 10, ab1: -110, ab2: 10, kd1: 96, kd2: 0, kb1: 10, kb2: 120, ud: 1 }),
    tebas: p({ bd: 28, kp: -8, ad1: 140, ad2: -40, ab1: -20, ab2: 60, kd1: 48, kd2: 20, kb1: -36, kb2: 4 }),
    tebasAkhir: p({ bd: 34, kp: -10, ad1: 40, ad2: -10, ab1: -40, ab2: 50, kd1: 52, kd2: 26, kb1: -40, kb2: 4 }),
    hantamTanah: p({ bd: 60, kp: -14, ad1: 130, ad2: 20, ab1: 120, ab2: 30, kd1: 70, kd2: 120, kb1: -10, kb2: 80 }),
    angkatTangan: p({ bd: -6, kp: 10, ad1: 170, ad2: 10, ab1: 165, ab2: 12, kd1: 26, kd2: 20, kb1: -24, kb2: 10, tg: 1 }),
    // kemenangan
    menangGaruda: p({ bd: 2, kp: -10, ad1: 170, ad2: 0, ab1: -60, ab2: 30, kd1: 110, kd2: 120, kb1: -4, kb2: 4, tg: 1 }),
    menangNaga: p({ bd: 4, kp: -4, ad1: 96, ad2: 80, ab1: 84, ab2: 90, kd1: 4, kd2: 6, kb1: -4, kb2: 4, tg: 1 }),
    menangRaksasa: p({ bd: -4, kp: -14, ad1: 120, ad2: 110, ab1: 110, ab2: 116, kd1: 26, kd2: 14, kb1: -26, kb2: 10 }),
    menangBayangan: p({ bd: 10, kp: 10, ad1: 60, ad2: 110, ab1: 20, ab2: 40, kd1: 30, kd2: 40, kb1: -30, kb2: 30 }),
    menangMerapi: p({ bd: -6, kp: -10, ad1: 175, ad2: 0, ab1: 30, ab2: 120, kd1: 20, kd2: 12, kb1: -20, kb2: 8, tg: 1 }),
    kalahLutut: p({ bd: 46, kp: 30, ad1: 10, ad2: 20, ab1: -4, ab2: 20, kd1: 80, kd2: 100, kb1: -10, kb2: 100 })
  };
}
export const POSE = buatPose(KUDA);
const pustaka = new Map();
/** Pustaka pose khusus petarung (kuda-kuda disesuaikan dengan gambarnya). */
export function poseUntuk(kid) {
  let L = pustaka.get(kid);
  if (!L) { L = buatPose({ ...KUDA, ...(KARAKTER[kid]?.rupa?.kuda || {}) }); pustaka.set(kid, L); }
  return L;
}

/**
 * Gerak (mode aksi & naskah duel). `kf`: [waktu, nama pose atau objek pose]. `dur` total.
 * aktif: [mulai, akhir] jendela hitbox · level: atas/overhead/bawah/udara/tengah · kotak: { x:[a,b], y:[a,b] }
 * stun: lama terhuyung bila kena · blokStun · dorong: kecepatan dorong · jatuh: bikin rebah · berat: guncang layar
 */
export const GERAK = {
  pukul: { dur: 0.3, kf: [[0, "siaga"], [0.05, "pukulTarik"], [0.09, "pukul"], [0.16, "pukul"], [0.3, "siaga"]], aktif: [0.08, 0.15], dmg: 6, level: "atas", kotak: { x: [40, 128], y: [200, 268] }, stun: 0.26, blokStun: 0.16, dorong: 150, energi: 4, rantai: ["pukul2", "tendang", "jurus", "pamungkas"], titik: "ld" },
  pukul2: { dur: 0.36, kf: [[0, "pukul"], [0.06, "siaga"], [0.11, "pukul2"], [0.19, "pukul2"], [0.36, "siaga"]], aktif: [0.1, 0.18], dmg: 7, level: "atas", kotak: { x: [40, 138], y: [196, 266] }, stun: 0.3, blokStun: 0.18, dorong: 190, energi: 5, rantai: ["tendang", "jurus", "pamungkas"], titik: "lb" },
  pukulBawah: { dur: 0.28, jongkok: true, kf: [[0, "jongkok"], [0.07, "pukulBawah"], [0.14, "pukulBawah"], [0.28, "jongkok"]], aktif: [0.06, 0.13], dmg: 5, level: "bawah", kotak: { x: [36, 122], y: [60, 140] }, stun: 0.22, blokStun: 0.14, dorong: 110, energi: 3, rantai: ["sapu", "jurus", "pamungkas"], titik: "ld" },
  tendang: { dur: 0.58, kf: [[0, "siaga"], [0.12, "tendangAngkat"], [0.21, "tendangPuncak"], [0.29, "tendangHantam"], [0.4, "tendangHantam"], [0.58, "siaga"]], aktif: [0.24, 0.34], dmg: 12, level: "overhead", kotak: { x: [55, 168], y: [110, 300] }, stun: 0.42, blokStun: 0.24, dorong: 260, berat: 1, energi: 8, rantai: ["jurus", "pamungkas"], titik: "kd" },
  sapu: { dur: 0.6, jongkok: true, kf: [[0, "jongkok"], [0.1, "sapuTurun"], [0.18, "sapu"], [0.32, "sapu"], [0.6, "jongkok"]], aktif: [0.17, 0.3], dmg: 9, level: "bawah", kotak: { x: [40, 180], y: [0, 62] }, jatuh: true, blokStun: 0.22, dorong: 120, energi: 7, rantai: ["jurus", "pamungkas"], titik: "kd" },
  pukulUdara: { dur: 9, udara: true, kf: [[0, "lompat"], [0.06, "pukulUdara"]], aktif: [0.05, 0.4], dmg: 7, level: "udara", kotak: { x: [30, 116], y: [150, 250] }, stun: 0.3, blokStun: 0.16, dorong: 150, energi: 4, titik: "ld" },
  tendangUdara: { dur: 9, udara: true, kf: [[0, "lompat"], [0.08, "tendangUdara"]], aktif: [0.08, 0.6], dmg: 10, level: "udara", kotak: { x: [20, 142], y: [40, 150] }, stun: 0.38, blokStun: 0.2, dorong: 220, berat: 1, energi: 6, titik: "kd" },
  banting: { dur: 0.52, kf: [[0, "siaga"], [0.06, "bantingRaih"], [0.2, "bantingRaih"], [0.52, "siaga"]], aktif: [0.05, 0.12], banting: true, jangkau: 105, dmg: 14, energi: 8 },
  balasTangkis: { dur: 0.34, kf: [[0, "tangkis"], [0.06, "pukulTarik"], [0.1, "pukul2"], [0.2, "pukul2"], [0.34, "siaga"]], aktif: [0.09, 0.18], dmg: 6, level: "atas", kotak: { x: [40, 138], y: [196, 266] }, stun: 0.3, dorong: 190, titik: "lb" },
  balasBawah: { dur: 0.46, kf: [[0, "tangkisBawah"], [0.08, "jongkok"], [0.16, "uppercut"], [0.28, "uppercut"], [0.46, "siaga"]], aktif: [0.14, 0.26], dmg: 8, level: "atas", kotak: { x: [30, 120], y: [150, 300] }, stun: 0.4, dorong: 200, berat: 1, titik: "ld" }
};

/** Gerak jurus khusus tiap petarung (data bingkai mode aksi). */
export const JURUS = {
  garuda: { dur: 0.9, udara: true, kf: [[0, "jongkok"], [0.12, "lompat"], [0.2, "terbangTendang"]], aktif: [0.18, 0.85], dmg: 14, level: "udara", kotak: { x: [10, 150], y: [20, 170] }, jatuh: true, blokStun: 0.26, dorong: 260, berat: 1, lompat: { vx: 640, vy: 720 }, titik: "kd" },
  naga: { dur: 0.62, kf: [[0, "siaga"], [0.12, "tolakTarik"], [0.2, "tolak"], [0.42, "tolak"], [0.62, "siaga"]], lepas: 0.2, proyektil: { jenis: "es", vx: 900, dmg: 10, efek: { beku: 2.5 }, y: 205 } },
  raksasa: { dur: 0.95, kf: [[0, "siaga"], [0.1, "bantingRaih"], [0.3, "bantingRaih"], [0.95, "siaga"]], aktif: [0.1, 0.32], banting: true, perintah: true, armor: [0, 0.32], maju: 380, jangkau: 125, dmg: 20, berat: 2 },
  bayangan: { dur: 0.95, kf: [[0, "siaga"], [0.12, "jongkok"], [0.42, "jongkok"], [0.5, "tebas"], [0.66, "tebasAkhir"], [0.95, "siaga"]], hilang: [0.12, 0.44], teleport: 0.44, aktif: [0.5, 0.64], dmg: 11, level: "tembus", kotak: { x: [20, 150], y: [40, 290] }, jatuh: true, dorong: 220, berat: 1, titik: "ld" },
  merapi: { dur: 0.7, kf: [[0, "siaga"], [0.14, "tolakTarik"], [0.24, "tolak"], [0.48, "tolak"], [0.7, "siaga"]], lepas: 0.24, proyektil: { jenis: "api", vx: 640, dmg: 8, efek: { bakar: 3 }, y: 200 } }
};

const mudah = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/** Pose pada waktu t untuk kunci-bingkai kf (nama pose dicari di pustaka `L`). */
export function poseKf(kf, t, L = POSE) {
  if (t <= kf[0][0]) return ambil(kf[0][1], L);
  for (let i = 1; i < kf.length; i++) {
    const [t1, p1] = kf[i];
    if (t <= t1) {
      const [t0, p0] = kf[i - 1];
      const u = t1 > t0 ? (t - t0) / (t1 - t0) : 1;
      return campur(ambil(p0, L), ambil(p1, L), mudah(u));
    }
  }
  return ambil(kf[kf.length - 1][1], L);
}
export const ambil = (x, L = POSE) => (typeof x === "string" ? L[x] : lengkap(x));

export const POSE_MENANG = { garuda: "menangGaruda", naga: "menangNaga", raksasa: "menangRaksasa", bayangan: "menangBayangan", merapi: "menangMerapi" };

/** Siklus jalan (fase 0..1). */
export function poseJalan(f, mundur = false, L = POSE) {
  const s = Math.sin(f * Math.PI * 2);
  const a = L.jalanA, b = L.jalanB;
  const q = campur(a, b, (s + 1) / 2);
  q.bd += mundur ? -4 : 2;
  q.ty = Math.abs(Math.cos(f * Math.PI * 2)) * 4;
  return q;
}

/** Napas siaga (goyang kecil). */
export function poseSiaga(t, dasar = POSE.siaga) {
  const q = { ...dasar };
  const s = Math.sin(t * 3.2);
  q.bd += s * 1.6;
  q.ad2 += s * 4;
  q.ab2 -= s * 3;
  q.kd2 += s * 2.4;
  q.kb2 += s * 1.6;
  q.ty = (q.ty || 0) - (s + 1) * 1.5;
  return q;
}
