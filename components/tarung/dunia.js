// Dunia Arena Pendekar: fisika & aturan tarung real-time (solo vs CPU, latihan), kamera, partikel, jurus & pamungkas,
// serta mode "duel" (animasi bernaskah dari hasil giliran server, digerakkan sutradara.js) dan "pajang" (pamer petarung).
// Satuan dunia: tinggi petarung ±300, sumbu y ke atas, lantai y = 0. Semua logika tanpa DOM (bisa diuji di Node).
import { KARAKTER, BIAYA_JURUS, BIAYA_PAMUNGKAS } from "@/lib/tarung/karakter";
import { GERAK, JURUS, POSE_MENANG, poseKf, poseJalan, poseSiaga, poseUntuk } from "./gerak";
import { campur, lengkap, ukuranTubuh } from "./kerangka";
import { gambarPetarung, gambarBayanganLantai, gambarArena } from "./gambar";
import { gambarSprite, muatSprite } from "./sprite";
import { Efek } from "./efek";
import { buatSinema } from "./sinema";
import { Otak } from "./otak";
import { gambarHud, gambarTeksMelayang, gambarPengumuman } from "./hud";

export const DURASI_RONDE = 60;
export const MENANG_RONDE = 2;
export const MAKS_RONDE = 5;
export const TEPI = 760;
const G = 2700;
const LOMPAT_VY = 1050, LOMPAT_VX = 300;
const LANGKAH = 1 / 120;
const BEBAS = new Set(["siaga", "jongkok", "tangkis"]);
const TAK_KENA = new Set(["rebah", "bangun", "dibanting", "intro", "menang", "kalah", "ko"]);

export function mulberry32(a) {
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const jepit = (v, a, b) => (v < a ? a : v > b ? b : v);
const dekati = (v, tujuan, laju) => (v < tujuan ? Math.min(tujuan, v + laju) : Math.max(tujuan, v - laju));
const POSE_HORMAT = { bd: 30, kp: 16, ad1: 64, ad2: 108, ab1: 60, ab2: 112, kd1: 6, kd2: 4, kb1: -6, kb2: 4 };

let nomorSerang = 0;

// ═════════════════════════ PETARUNG ═════════════════════════
export class Petarung {
  constructor(d, sisi, kid, nama) {
    this.d = d;
    this.sisi = sisi;
    this.kid = KARAKTER[kid] ? kid : "garuda";
    this.k = KARAKTER[this.kid];
    this.nama = nama || this.k.nama;
    this.P = poseUntuk(this.kid);
    this.u = ukuranTubuh(this.k.rupa);
    this.tinggi = 300 * (this.k.rupa.tinggi || 1);
    this.lebar = 44 * (this.k.rupa.lebar || 1);
    // nyawa mode aksi disetel agar seimbang dalam tarung real-time (duel giliran memakai stat asli di server)
    const aksi = d.mode === "solo" || d.mode === "latihan";
    this.hpMaks = Math.round(this.k.stat.hp * (aksi ? { raksasa: 0.86, bayangan: 1.12, naga: 1.06 }[this.kid] || 1 : 1));
    this.energi = 0;
    this.kec = 1 + (this.k.stat.cepat || 0) * 0.15 - (this.kid === "raksasa" ? 0.12 : 0);
    // kecepatan gerak serangan real-time: raksasa berat & lambat, ninja bayangan paling gesit
    this.kecSerang = { raksasa: 0.86, bayangan: 1.12, naga: 1.03 }[this.kid] || 1;
    this.stat = { serang: 0, kena: 0, comboMaks: 0, tangkis: 0, sempurna: 0, jurus: 0, pamungkas: 0, damage: 0, banting: 0 };
    this.resetRonde();
  }
  resetRonde() {
    this.hp = this.hpMaks; this.hpJejak = this.hpMaks; this.tJejak = 0;
    this.x = this.sisi ? 240 : -240; this.y = 0; this.vx = 0; this.vy = 0; this.diUdara = false;
    this.hadap = this.sisi ? -1 : 1;
    this.keadaan = "siaga"; this.t = 0;
    this.pose = { ...this.P.siaga }; this.poseAsal = null; this.tCampur = 1; this.lamaCampur = 0.08;
    this.gerak = null; this.namaGerak = ""; this.serangId = 0;
    this.sudahKena = false; this.kontak = false; this.sudahLepas = false; this.lontarSudah = false; this.teleportSudah = false;
    this.stun = 0; this.stunAwal = 0.3; this.jenisKena = "biasa"; this.inv = 0; this.kilau = 0; this.aura = 0; this.alpha = 1; this.hilang = false;
    this.efek = { beku: 0, bakar: 0, tikBakar: 0 };
    this.comboDiterima = 0; this.comboTampil = 0; this.comboT = 0; this.juggle = 0; this.putar = 0;
    this.rendah = false; this.tTangkis = 9;
    this.input = { kiri: false, kanan: false, bawah: false, tangkis: false };
    this.antri = null;
    this.pegang = null; this.dipegang = null; this.banting = null;
    this.udaraDipakai = false; this.fJalan = 0; this.mundur = false;
    this.bayang = []; this.tBayang = 0; this.warnaBayang = null;
    this.tujuanX = null; this.lajuTujuan = 260; this.poseNaskah = null;
    this.kebalProyektil = false; this.armor = false; this.lapisDepan = 0; this.energiKurang = 0;
    this.naskahProyektil = null; this.ko = false; this.tintBayang = 0;
  }
  /** Ganti keadaan (dengan peralihan pose halus). */
  ke(k, lama = 0.08) {
    if (this.keadaan === "serang" && k !== "serang") {
      this.kebalProyektil = false; this.armor = false; this.hilang = false; this.alpha = 1; this.gerak = null;
    }
    this.poseAsal = this.pose ? { ...this.pose } : null;
    this.tCampur = 0;
    this.lamaCampur = Math.max(0.001, lama);
    this.keadaan = k;
    this.t = 0;
  }
  tekan(aksi) { this.antri = { aksi, t: 0.22 }; }
  get bebas() { return BEBAS.has(this.keadaan); }
  /** Kotak badan yang bisa dikenai (null = kebal). */
  kotakBadan() {
    if (this.inv > 0 || this.hilang || TAK_KENA.has(this.keadaan)) return null;
    const k = this.keadaan, t = this.u.t;
    let y0 = this.y, h = 292 * t, w = this.lebar;
    const rendah = k === "jongkok" || ((k === "tangkis" || k === "blokstun") && this.rendah) || (k === "serang" && this.gerak?.jongkok);
    if (rendah) h = 190 * t;
    if (this.diUdara && k !== "melayang") { y0 = this.y + 10 * t; h = 250 * t; }
    if (k === "melayang") { if (this.juggle >= 3) return null; y0 = this.y + 30; h = 210 * t; w = this.lebar * 1.3; }
    return { x0: this.x - w, x1: this.x + w, y0, y1: y0 + h };
  }
}

// ═════════════════════════ DUNIA ═════════════════════════
export class Dunia {
  /**
   * opsi: { mode: "solo"|"latihan"|"duel"|"pajang", p1, p2, nama1, nama2, arena, level (0..2), boneka, benih,
   *         onSuara(nama, opsi), onUmumkan(teks), onAcara(nama, data), hud, angkaDamage, energiPenuh, tunggal }
   */
  constructor(opsi = {}) {
    this.opsi = opsi;
    this.mode = opsi.mode || "solo";
    this.acak = mulberry32((opsi.benih ?? Math.floor(Math.random() * 4294967296)) >>> 0);
    this.f = [new Petarung(this, 0, opsi.p1 || "garuda", opsi.nama1), new Petarung(this, 1, opsi.p2 || "naga", opsi.nama2)];
    this.arena = opsi.arena || this.f[1].k.arena;
    this.ef = new Efek(this.acak);
    this.proyektil = [];
    this.ronde = 1; this.menang = [0, 0]; this.riwayatRonde = [];
    this.waktu = DURASI_RONDE;
    this.fase = this.mode === "duel" || this.mode === "pajang" ? "bebas" : "intro";
    this.tFase = 0; this.bendera = {};
    this.jam = 0; this.sisaDt = 0;
    this.jedaHit = 0; this.skalaWaktu = 1; this.tSlow = 0;
    this.guncang = 0; this.kilat = 0; this.gelap = 0; this.gelapTarget = 0;
    this.kam = { x: 0, lebar: 1000, xT: null, lebarT: null };
    this.sinema = null;
    this.acara = []; this.tAcara = 0;
    this.pengumuman = null;
    this.koBaru = [];
    this.jeda = false;
    this.mutu = 1;
    this.hud = opsi.hud !== false && this.mode !== "pajang";
    this.angkaDamage = !!opsi.angkaDamage;
    this.hudWaktu = null; this.hudInfo = null; // dipakai mode duel (waktu giliran dari server)
    this.selesai = null;
    this.otak = [null, null];
    if (this.mode === "solo") this.otak[1] = new Otak(this, 1, opsi.level ?? 1);
    if (this.mode === "latihan") this.otak[1] = new Otak(this, 1, "boneka", { boneka: opsi.boneka || "diam" });
    if (opsi.cpu0) this.otak[0] = new Otak(this, 0, opsi.level0 ?? 1);
    if (this.mode === "pajang") { this.f[0].x = 0; this.f[1].x = 9999; this.demo = { t: 0.8, i: 0 }; }
    if (this.mode === "duel") { this.f[0].x = -190; this.f[1].x = 190; }
    for (const f of this.f) muatSprite(f.k.rupa.sprite);
    this.kam.x = (this.f[0].x + (this.mode === "pajang" ? this.f[0].x : this.f[1].x)) / 2;
    if (this.mode === "solo" || this.mode === "latihan") this.mulaiRonde(true);
  }

  // ── hubungan ke luar
  lawan(f) { return this.f[1 - f.sisi]; }
  suara(nama, o) { try { this.opsi.onSuara?.(nama, o); } catch {} }
  umumkan(teks) { try { this.opsi.onUmumkan?.(teks); } catch {} }
  kabar(nama, data) { try { this.opsi.onAcara?.(nama, data); } catch {} }
  jadwal(dt, fn) { this.acara.push({ t: this.tAcara + dt, fn }); }
  umum(teks, opsi = {}) { this.pengumuman = { teks, sub: opsi.sub || "", umur: 0, maks: opsi.maks || 1.1, gaya: opsi.gaya || "biasa", warna: opsi.warna || null }; }

  // ── masukan pemain (dipanggil UI)
  arah(sisi, nama, nyala) { const f = this.f[sisi]; if (f && nama in f.input) f.input[nama] = !!nyala; }
  tekan(sisi, aksi) { const f = this.f[sisi]; if (f) f.tekan(aksi); }
  lepasSemua(sisi) { const f = this.f[sisi]; if (f) for (const k of Object.keys(f.input)) f.input[k] = false; }

  bolehMain(f) {
    if (this.mode === "duel" || this.mode === "pajang") return false;
    if (this.fase !== "tarung") return false;
    void f;
    return true;
  }
  serangAktif() { return (this.mode === "solo" || this.mode === "latihan") && this.fase === "tarung"; }

  /** Ringkasan untuk UI/tes. */
  ringkas() {
    return {
      fase: this.fase, ronde: this.ronde, waktu: Math.ceil(this.waktu), menang: [...this.menang],
      hp: this.f.map((f) => Math.round(f.hp)), hpMaks: this.f.map((f) => f.hpMaks), energi: this.f.map((f) => Math.floor(f.energi)),
      keadaan: this.f.map((f) => f.keadaan), selesai: this.selesai
    };
  }

  // ═════════════════════════ LANGKAH WAKTU ═════════════════════════
  langkah(dtNyata) {
    if (this.jeda) return;
    this.sisaDt = Math.min(0.25, this.sisaDt + Math.max(0, dtNyata));
    let n = 0;
    while (this.sisaDt >= LANGKAH && n < 40) { this.perbarui(LANGKAH); this.sisaDt -= LANGKAH; n++; }
  }

  perbarui(dt0) {
    this.jam += dt0;
    this.guncang = Math.max(0, this.guncang - dt0 * 38);
    this.kilat = Math.max(0, this.kilat - dt0 * 3.2);
    this.gelap += (this.gelapTarget - this.gelap) * Math.min(1, dt0 * 7);
    if (this.tSlow > 0) { this.tSlow -= dt0; if (this.tSlow <= 0) this.skalaWaktu = 1; }
    const dt = dt0 * this.skalaWaktu;
    this.ef.perbarui(dt);
    if (this.pengumuman) { this.pengumuman.umur += dt0; if (this.pengumuman.umur > this.pengumuman.maks) this.pengumuman = null; }
    for (const f of this.f) {
      if (f.comboT > 0) { f.comboT -= dt0; if (f.comboT <= 0) f.comboTampil = 0; }
      if (f.energiKurang > 0) f.energiKurang -= dt0;
    }
    if (this.sinema) {
      this.sinema.perbarui(dt);
      for (const f of this.f) { f.kilau = Math.max(0, f.kilau - dt * 9); f.pose = this.poseUntuk(f); f.tCampur = Math.min(1, f.tCampur + dt / f.lamaCampur); }
      if (this.sinema.selesai) { this.sinema = null; this.gelapTarget = 0; if (this.koBaru.length) this.prosesKo(); }
      this.perbaruiKamera(dt0);
      return;
    }
    if (this.jedaHit > 0) { this.jedaHit -= dt0; this.perbaruiKamera(dt0); return; }
    this.tAcara += dt;
    if (this.acara.length) {
      const jatuh = this.acara.filter((a) => a.t <= this.tAcara).sort((a, b) => a.t - b.t);
      if (jatuh.length) { this.acara = this.acara.filter((a) => a.t > this.tAcara); for (const a of jatuh) { try { a.fn(); } catch (e) { console.error(e); } } }
    }
    this.perbaruiFase(dt, dt0);
    if (this.mode === "pajang") this.demoPajang(dt);
    for (const o of this.otak) if (o && this.fase === "tarung") o.perbarui(dt);
    for (const f of this.f) if (!(this.opsi.tunggal || this.mode === "pajang") || f.sisi === 0) this.perbaruiPetarung(f, dt);
    if (this.serangAktif()) { this.cekSerangan(this.f[0], this.f[1]); this.cekSerangan(this.f[1], this.f[0]); }
    this.perbaruiProyektil(dt);
    if (this.koBaru.length) this.prosesKo();
    if (this.mode !== "pajang") this.dorongBadan();
    this.perbaruiKamera(dt0);
  }

  // ═════════════════════════ FASE (solo / latihan) ═════════════════════════
  mulaiRonde(awal = false) {
    for (const f of this.f) { f.resetRonde(); if (!awal) f.energi = Math.min(100, f.energi); }
    if (this.opsi.energiPenuh) this.f[0].energi = 100;
    this.proyektil = [];
    this.waktu = DURASI_RONDE;
    this.fase = "intro"; this.tFase = 0; this.bendera = {};
    for (const f of this.f) f.ke("intro", 0.01);
    this.kam.x = 0; this.kam.lebar = 760;
    this.otak.forEach((o) => o?.reset?.());
  }

  perbaruiFase(dt, dt0) {
    if (this.mode === "duel" || this.mode === "pajang") return;
    this.tFase += dt;
    const B = this.bendera;
    switch (this.fase) {
      case "intro": {
        if (!B.ronde && this.tFase > 0.35) {
          B.ronde = true;
          const akhir = this.menang[0] === MENANG_RONDE - 1 && this.menang[1] === MENANG_RONDE - 1;
          this.umum(akhir ? "RONDE PENENTU" : `RONDE ${this.ronde}`, { maks: 1.15, gaya: "ronde" });
          this.umumkan(akhir ? "Ronde penentu" : `Ronde ${["satu", "dua", "tiga", "empat", "lima"][this.ronde - 1] || this.ronde}`);
          this.suara("tRonde");
        }
        if (!B.tarung && this.tFase > 1.6) {
          B.tarung = true;
          this.umum("TARUNG!", { maks: 0.85, gaya: "tarung" });
          this.umumkan("Tarung!");
          this.suara("tTarung");
          for (const f of this.f) f.ke("siaga", 0.25);
        }
        if (this.tFase > 2.05) { this.fase = "tarung"; this.tFase = 0; this.kabar("tarung", { ronde: this.ronde }); }
        break;
      }
      case "tarung": {
        if (this.mode === "latihan") { this.latihan(dt); break; }
        this.waktu -= dt0;
        if (this.waktu <= 0) { this.waktu = 0; this.akhiriWaktu(); }
        break;
      }
      case "ko": {
        const pm = this.bendera.pemenang;
        if (!B.pose && this.tFase > 1.5 && pm != null) { B.pose = true; this.f[pm].ke("menang", 0.2); this.f[pm].aura = 1; }
        if (this.tFase > 3.1) this.akhiriRonde();
        break;
      }
      case "waktuHabis": {
        const pm = this.bendera.pemenang;
        if (!B.pose && this.tFase > 1.0) {
          B.pose = true;
          if (pm != null) { this.f[pm].ke("menang", 0.2); this.f[1 - pm].ke("kalah", 0.3); }
        }
        if (this.tFase > 3.1) this.akhiriRonde();
        break;
      }
      case "rondeSelesai": {
        if (!B.lanjut && this.tFase > 1.9) {
          B.lanjut = true;
          const juara = this.menang.findIndex((m) => m >= MENANG_RONDE);
          if (juara >= 0 || this.ronde >= MAKS_RONDE) {
            const pm = juara >= 0 ? juara : this.menang[0] === this.menang[1] ? null : this.menang[0] > this.menang[1] ? 0 : 1;
            this.fase = "selesai"; this.tFase = 0;
            this.selesai = { pemenang: pm, menang: [...this.menang], ronde: this.ronde, statistik: this.f.map((f) => ({ ...f.stat })), riwayat: this.riwayatRonde };
            if (pm != null) { this.f[pm].ke("menang", 0.2); this.f[pm].aura = 1; }
            this.umum(pm == null ? "IMBANG" : `${this.f[pm].nama.toUpperCase()} MENANG`, { maks: 2.6, gaya: "menang" });
            this.umumkan(pm == null ? "Imbang" : `${this.f[pm].nama} menang`);
            this.suara(pm === 0 ? "menangBesar" : pm == null ? "seri" : "kalah");
            this.kabar("selesai", this.selesai);
          } else {
            this.ronde += 1;
            this.mulaiRonde();
          }
        }
        break;
      }
      default: break;
    }
  }

  latihan(dt) {
    // Latihan: nyawa pulih sendiri bila tidak dipukul 1,6 detik; energi pemain bisa penuh terus.
    for (const f of this.f) {
      f.pulih = (f.pulih || 0) + dt;
      if (f.pulih > 1.6 && f.hp < f.hpMaks) { f.hp = Math.min(f.hpMaks, f.hp + f.hpMaks * dt * 0.8); f.hpJejak = Math.max(f.hpJejak, f.hp); }
    }
    if (this.opsi.energiPenuh) this.f[0].energi = 100;
  }

  akhiriWaktu() {
    const [a, b] = this.f;
    const pa = a.hp / a.hpMaks, pb = b.hp / b.hpMaks;
    const pm = Math.abs(pa - pb) < 1e-6 ? null : pa > pb ? 0 : 1;
    this.catatRonde(pm, "waktu");
    this.fase = "waktuHabis"; this.tFase = 0; this.bendera = { pemenang: pm };
    this.umum("WAKTU HABIS", { maks: 1.6, gaya: "ko" });
    this.umumkan("Waktu habis");
    this.suara("gong");
  }

  catatRonde(pm, cara) {
    if (pm != null) this.menang[pm] += 1;
    const sempurna = pm != null && this.f[pm].hp >= this.f[pm].hpMaks;
    this.riwayatRonde.push({ ronde: this.ronde, pemenang: pm, cara, sempurna });
    this.kabar("ronde", { ronde: this.ronde, pemenang: pm, cara, sempurna, menang: [...this.menang] });
  }

  akhiriRonde() {
    const r = this.riwayatRonde[this.riwayatRonde.length - 1];
    this.fase = "rondeSelesai"; this.tFase = 0; this.bendera = {};
    if (r?.pemenang != null) {
      const f = this.f[r.pemenang];
      this.umum(r.sempurna ? "SEMPURNA!" : `${f.nama.toUpperCase()} MENANG`, { maks: 1.8, gaya: r.sempurna ? "sempurna" : "biasa", sub: `Ronde ${r.ronde}` });
      if (r.sempurna) { this.umumkan("Sempurna!"); this.suara("tSempurna"); }
    } else this.umum("IMBANG", { maks: 1.8, sub: `Ronde ${r?.ronde || this.ronde}` });
  }

  prosesKo() {
    const korban = [...new Set(this.koBaru)];
    this.koBaru = [];
    if (this.mode === "duel" || this.mode === "pajang") return;
    if (this.fase !== "tarung") return;
    let pm = null;
    if (korban.length === 1) pm = 1 - korban[0].sisi;
    this.catatRonde(pm, "ko");
    this.fase = "ko"; this.tFase = 0; this.bendera = { pemenang: pm };
    for (const f of korban) {
      f.ko = true;
      // K.O. karena terbakar/tergores saat masih berdiri: tumbang
      if (!["melayang", "rebah", "dibanting"].includes(f.keadaan)) { f.ke("melayang", 0.04); f.diUdara = true; f.vy = 520; f.vx = -f.hadap * 240; f.y = Math.max(f.y, 1); f.putar = 0; }
    }
    this.skalaWaktu = 0.28; this.tSlow = 1.15;
    this.kilat = 0.6; this.guncang = 16;
    this.umum(korban.length === 2 ? "K.O. GANDA" : "K.O.", { maks: 1.7, gaya: "ko" });
    this.umumkan("K O!");
    this.suara("tKo");
    this.otak.forEach((o) => o?.lepas?.());
  }

  // ═════════════════════════ PETARUNG PER LANGKAH ═════════════════════════
  perbaruiPetarung(f, dt) {
    const L = this.lawan(f);
    f.kilau = Math.max(0, f.kilau - dt * 9);
    if (f.inv > 0) f.inv = Math.max(0, f.inv - dt);
    if (f.efek.beku > 0) f.efek.beku = Math.max(0, f.efek.beku - dt);
    if (f.efek.bakar > 0) {
      f.efek.bakar = Math.max(0, f.efek.bakar - dt);
      f.efek.tikBakar += dt;
      if (f.efek.tikBakar >= 0.5) { f.efek.tikBakar -= 0.5; this.bakar(f); }
      if (this.acak() < 0.25) this.ef.bara(f.x, f.y + 110 * f.u.t, 1);
    }
    if (f.antri) { f.antri.t -= dt; if (f.antri.t <= 0) f.antri = null; }
    f.tTangkis += dt;
    f.tJejak -= dt;
    if (f.tJejak <= 0 && f.hpJejak > f.hp) f.hpJejak = Math.max(f.hp, f.hpJejak - f.hpMaks * 0.55 * dt);
    if (f.hpJejak < f.hp) f.hpJejak = f.hp;
    const siapPamungkas = f.energi >= BIAYA_PAMUNGKAS && this.fase === "tarung";
    if (f.keadaan !== "menang" && f.keadaan !== "serang") f.aura = dekati(f.aura, siapPamungkas ? 0.5 : 0, dt * 2.5);
    const beku = f.efek.beku > 0 ? 0.72 : 1;
    f.t += dt * (f.keadaan === "serang" || f.keadaan === "membanting" ? beku * f.kecSerang : 1);
    f.tCampur = Math.min(1, f.tCampur + dt / f.lamaCampur);

    switch (f.keadaan) {
      case "siaga": case "jongkok": case "tangkis": this.updBebas(f, L, dt); break;
      case "lompat": this.updLompat(f, L, dt); break;
      case "mendarat": this.gesek(f, dt, 2200); if (f.t >= 0.09) f.ke("siaga", 0.06); break;
      case "serang": this.updSerang(f, L, dt); break;
      case "kena": this.gesek(f, dt, 1500); f.stun -= dt; if (f.stun <= 0) f.ke("siaga", 0.1); break;
      case "blokstun": this.gesek(f, dt, 1500); f.stun -= dt; if (f.stun <= 0) { f.ke(f.input.tangkis && this.bolehMain(f) ? "tangkis" : "siaga", 0.06); } break;
      case "melayang": this.updMelayang(f, dt); break;
      case "rebah":
        this.gesek(f, dt, 2400);
        if (!f.ko && f.t > 0.62 && this.fase !== "ko" && this.fase !== "selesai") f.ke("bangun", 0.05);
        break;
      case "bangun":
        if (f.t >= 0.42) { f.ke("siaga", 0.08); f.inv = 0.14; f.comboDiterima = 0; f.juggle = 0; }
        break;
      case "membanting": this.updBanting(f, dt); break;
      case "dibanting": break; // posisi diatur pembanting
      case "naskah": this.gesek(f, dt, 2000); break;
      default: this.gesek(f, dt, 2200); break; // intro, menang, kalah, ko
    }
    if (f.keadaan !== "dibanting") f.x = jepit(f.x, -TEPI, TEPI);
    f.pose = this.lembut(f, this.poseUntuk(f), dt);
    // bayangan gerak (afterimage) saat jurus/terlempar
    if (f.warnaBayang) {
      f.tBayang -= dt;
      if (f.tBayang <= 0) { f.tBayang = 0.045; f.bayang.push({ x: f.x, y: f.y, hadap: f.hadap, pose: { ...f.pose }, umur: 0 }); if (f.bayang.length > 4) f.bayang.shift(); }
    }
    for (const b of f.bayang) b.umur += dt;
    f.bayang = f.bayang.filter((b) => b.umur < 0.22);
    if (!(f.keadaan === "serang" && f.namaGerak === "jurus")) f.warnaBayang = null;
  }

  gesek(f, dt, laju) { f.vx = dekati(f.vx, 0, laju * dt); f.x += f.vx * dt; if (!f.diUdara) f.y = 0; }

  hadapkan(f, L) {
    if (L.x > f.x + 6) f.hadap = 1; else if (L.x < f.x - 6) f.hadap = -1;
  }

  updBebas(f, L, dt) {
    f.comboDiterima = 0; f.juggle = 0;
    if (!this.bolehMain(f)) {
      // duel / pajang / jeda antar-ronde: hanya berjalan ke tujuan naskah (bila ada)
      if (f.tujuanX != null && Math.abs(f.tujuanX - f.x) > 3) {
        const arah = Math.sign(f.tujuanX - f.x);
        f.vx = arah * f.lajuTujuan;
        f.mundur = arah !== f.hadap;
        f.fJalan += dt * f.lajuTujuan / 150;
        f.x += f.vx * dt;
        if (Math.sign(f.tujuanX - f.x) !== arah) { f.x = f.tujuanX; f.vx = 0; f.tujuanX = null; }
      } else { f.tujuanX = null; this.gesek(f, dt, 2400); }
      if (this.mode !== "pajang") this.hadapkan(f, L);
      return;
    }
    this.hadapkan(f, L);
    if (f.antri && this.mulaiAksi(f, L, f.antri.aksi)) { f.antri = null; return; }
    const inp = f.input;
    const maju = f.hadap > 0 ? inp.kanan : inp.kiri, mundur = f.hadap > 0 ? inp.kiri : inp.kanan;
    if (inp.tangkis) {
      if (f.keadaan !== "tangkis") { f.tTangkis = 0; f.ke("tangkis", 0.05); }
      if (f.rendah !== !!inp.bawah) { f.rendah = !!inp.bawah; f.tCampur = Math.min(f.tCampur, 0.5); }
      f.vx = dekati(f.vx, 0, 2800 * dt);
    } else if (inp.bawah) {
      if (f.keadaan !== "jongkok") f.ke("jongkok", 0.07);
      f.vx = dekati(f.vx, 0, 2800 * dt);
    } else {
      if (f.keadaan !== "siaga") f.ke("siaga", 0.07);
      const kj = (f.efek.beku > 0 ? 0.6 : 1) * f.kec;
      const target = maju ? 235 * kj * f.hadap : mundur ? -185 * kj * f.hadap : 0;
      f.vx = dekati(f.vx, target, 3200 * dt);
      f.mundur = !!mundur && !maju;
      if (Math.abs(f.vx) > 20) f.fJalan += (dt * Math.abs(f.vx)) / 150;
    }
    f.x += f.vx * dt;
    f.y = 0;
  }

  mulaiAksi(f, L, aksi) {
    const jongkok = f.input.bawah;
    if (aksi === "lompat") {
      const maju = f.hadap > 0 ? f.input.kanan : f.input.kiri, mundur = f.hadap > 0 ? f.input.kiri : f.input.kanan;
      f.vy = LOMPAT_VY * (f.efek.beku > 0 ? 0.88 : 1);
      f.vx = (maju ? 1 : mundur ? -1 : 0) * LOMPAT_VX * f.hadap * f.kec;
      f.diUdara = true; f.udaraDipakai = false; f.y = 0.5;
      f.ke("lompat", 0.06);
      this.suara("tLompat");
      this.ef.debu(f.x, 4, -Math.sign(f.vx) || 0, 0.7);
      return true;
    }
    if (aksi === "pukul") return this.mulaiGerak(f, jongkok ? "pukulBawah" : "pukul");
    if (aksi === "tendang") return this.mulaiGerak(f, jongkok ? "sapu" : "tendang");
    if (aksi === "banting") return this.mulaiGerak(f, "banting");
    if (aksi === "jurus") {
      if (f.energi < BIAYA_JURUS) { this.energiKurang(f); return true; }
      return this.mulaiGerak(f, "jurus");
    }
    if (aksi === "pamungkas") {
      if (f.energi < BIAYA_PAMUNGKAS) { this.energiKurang(f); return true; }
      this.mulaiPamungkas(f, L);
      return true;
    }
    return true;
  }

  energiKurang(f) {
    f.energiKurang = 0.7;
    if (f.sisi === 0) { this.ef.label(f.x, f.y + f.tinggi + 30, "ENERGI KURANG", { warna: "#cfd8ff", warna2: "#3b4a9e", ukuran: 20, maks: 0.7 }); this.suara("klik"); }
  }

  /** Mulai gerak bernama (pukul, tendang, jurus, …). `naskah` = dari sutradara duel (tanpa biaya energi). */
  mulaiGerak(f, nama, naskah = false) {
    const g = nama === "jurus" ? JURUS[f.kid] : GERAK[nama];
    if (!g) return false;
    if (nama === "jurus" && !naskah) { f.energi = Math.max(0, f.energi - BIAYA_JURUS); f.stat.jurus++; }
    f.ke("serang", 0.035);
    f.gerak = g; f.namaGerak = nama; f.serangId = ++nomorSerang;
    f.sudahKena = false; f.kontak = false; f.sudahLepas = false; f.lontarSudah = false; f.teleportSudah = false;
    if (!g.udara) { f.vx = ["pukul", "pukul2", "tendang", "balasTangkis"].includes(nama) ? f.hadap * 150 : 0; }
    f.stat.serang++;
    if (g.aktif || g.lepas) this.suara("tDesir", { kuat: g.berat ? 1 : 0.6, tunda: Math.max(0, ((g.aktif?.[0] ?? g.lepas) || 0.1) - 0.05) });
    if (nama === "jurus") this.mulaiJurus(f);
    return true;
  }

  mulaiJurus(f) {
    f.aura = 1;
    if (f.kid === "garuda") { f.kebalProyektil = true; f.warnaBayang = "#ffcc33"; }
    if (f.kid === "raksasa") { f.armor = true; f.warnaBayang = "#ff8a3d"; }
    if (f.kid === "bayangan") f.warnaBayang = "#ff3b5c";
    this.suara("tJurus");
    this.ef.label(f.x, f.y + f.tinggi + 36, f.k.jurus.nama.toUpperCase(), { warna: "#ffffff", warna2: f.k.rupa.aura, ukuran: 24, maks: 0.85, vy: 50 });
  }

  jurusKhusus(f, L, dt) {
    const g = f.gerak, t = f.t;
    if (f.kid === "garuda") {
      if (!f.lontarSudah && t >= 0.12) {
        f.lontarSudah = true;
        f.vy = g.lompat.vy; f.vx = g.lompat.vx * f.hadap; f.diUdara = true; f.y = 0.5;
        this.ef.debu(f.x, 6, -f.hadap, 1);
        this.suara("tLompat");
      }
    } else if (f.kid === "raksasa") {
      f.armor = t <= g.armor[1];
      if (t < g.aktif[1]) f.vx = g.maju * f.hadap;
    } else if (f.kid === "bayangan") {
      const hilang = t >= g.hilang[0] && t < g.hilang[1];
      if (hilang && !f.hilang) { f.hilang = true; this.ef.asap(f.x, f.y, 12); this.suara("tTeleport"); }
      if (!hilang && f.hilang) f.hilang = false;
      f.alpha = hilang ? 0 : 1;
      if (!f.teleportSudah && t >= g.teleport) {
        f.teleportSudah = true;
        let nx = L.x - L.hadap * 125;
        if (Math.abs(nx) > TEPI - 10) nx = L.x + L.hadap * 125;
        f.x = jepit(nx, -TEPI, TEPI);
        f.hadap = L.x >= f.x ? 1 : -1;
        this.ef.asap(f.x, f.y, 10, "rgba(120,10,30,");
      }
    }
    void dt;
  }

  updLompat(f, L, dt) {
    if (this.bolehMain(f) && f.antri && !f.udaraDipakai) {
      const a = f.antri.aksi;
      if (a === "pukul" || a === "tendang") { f.antri = null; f.udaraDipakai = true; this.mulaiGerak(f, a === "pukul" ? "pukulUdara" : "tendangUdara"); return; }
    }
    if (this.fisikaUdara(f, dt)) { f.ke("mendarat", 0.05); this.suara("tMendarat"); this.ef.debu(f.x, 4, 0, 0.7); }
    void L;
  }

  fisikaUdara(f, dt) {
    f.vy -= G * dt;
    f.y += f.vy * dt;
    f.x += f.vx * dt;
    if (f.y <= 0 && f.vy < 0) { f.y = 0; f.vy = 0; f.diUdara = false; f.vx *= 0.3; return true; }
    return false;
  }

  updSerang(f, L, dt) {
    const g = f.gerak;
    if (!g) { f.ke("siaga"); return; }
    if (f.namaGerak === "jurus") this.jurusKhusus(f, L, dt);
    if (f.diUdara) {
      if (this.fisikaUdara(f, dt)) {
        f.ke("mendarat", 0.05); this.suara("tMendarat"); this.ef.debu(f.x, 5, 0, 0.8);
        return;
      }
    } else {
      if (!(f.kid === "raksasa" && f.namaGerak === "jurus")) f.vx = dekati(f.vx, 0, 1500 * dt);
      f.x += f.vx * dt;
      f.y = 0;
    }
    if (g.lepas && !f.sudahLepas && f.t >= g.lepas) { f.sudahLepas = true; this.tembak(f, g.proyektil); }
    // rantai combo: gerak berikutnya membatalkan sisa gerak ini bila serangan sudah kena/ditangkis
    if (f.antri && this.bolehMain(f) && g.rantai) {
      const lanjut = this.namaLanjut(f, f.antri.aksi);
      const lewat = f.t >= (g.aktif?.[0] ?? 0) + 0.02;
      const boleh = f.kontak || (f.namaGerak === "pukul" && lanjut === "pukul2" && f.t >= (g.aktif?.[1] ?? 0));
      if (lanjut && lewat && boleh && g.rantai.includes(lanjut)) {
        if (lanjut === "pamungkas") { if (f.energi >= BIAYA_PAMUNGKAS) { f.antri = null; this.mulaiPamungkas(f, L); return; } }
        else if (lanjut === "jurus") { if (f.energi >= BIAYA_JURUS) { f.antri = null; this.mulaiGerak(f, "jurus"); return; } }
        else { f.antri = null; this.mulaiGerak(f, lanjut); return; }
      }
    }
    if (!g.udara && f.t >= g.dur) {
      f.ke(f.input.bawah && g.jongkok && this.bolehMain(f) ? "jongkok" : "siaga", 0.08);
    } else if (g.udara && !f.diUdara && f.t >= g.dur) {
      f.ke("siaga", 0.08);
    }
  }

  namaLanjut(f, aksi) {
    if (aksi === "pukul") return f.namaGerak === "pukul" ? "pukul2" : f.input.bawah ? "pukulBawah" : "pukul";
    if (aksi === "tendang") return f.input.bawah || f.namaGerak === "pukulBawah" ? "sapu" : "tendang";
    if (aksi === "jurus" || aksi === "pamungkas") return aksi;
    return null;
  }

  updMelayang(f, dt) {
    f.putar = Math.min(80, f.putar + dt * 140);
    f.vy -= G * dt;
    f.y += f.vy * dt;
    f.x += f.vx * dt;
    if (Math.abs(f.x) >= TEPI && f.t > 0.05) { f.vx = -f.vx * 0.35; f.x = jepit(f.x, -TEPI, TEPI); }
    if (f.y <= 0 && f.vy < 0) {
      f.y = 0;
      if (f.vy < -620 && !f.pantul) {
        f.pantul = true; f.vy = 300; f.vx *= 0.5; f.y = 0.5;
        this.ef.debu(f.x, 7, 0, 1); this.suara("tJatuh"); this.guncang = Math.max(this.guncang, 6);
      } else {
        f.vy = 0; f.vx *= 0.4; f.diUdara = false; f.pantul = false;
        f.ke("rebah", 0.06); f.juggle = 0;
        this.ef.debu(f.x, 5, 0, 0.8);
      }
    }
  }

  // ═════════════════════════ PERTARUNGAN ═════════════════════════
  cekSerangan(A, B) {
    if (A.keadaan !== "serang" || !A.gerak || A.sudahKena) return;
    const g = A.gerak, t = A.t;
    if (!g.aktif || t < g.aktif[0] || t > g.aktif[1]) return;
    if (g.banting) {
      const jarak = Math.abs(B.x - A.x);
      const depan = Math.sign(B.x - A.x) === A.hadap || jarak < 20;
      if (depan && jarak <= g.jangkau + B.lebar && this.bisaDibanting(B)) { A.sudahKena = true; A.kontak = true; this.mulaiBanting(A, B, !!g.perintah); }
      return;
    }
    if (!g.kotak) return;
    const s = Math.min(1, A.u.t); // jangkauan sama untuk semua (petarung besar tidak dapat bonus jangkauan)
    const xa = A.x + A.hadap * g.kotak.x[0] * s, xb = A.x + A.hadap * g.kotak.x[1] * s;
    const kx0 = Math.min(xa, xb), kx1 = Math.max(xa, xb);
    const ky0 = A.y + g.kotak.y[0] * s, ky1 = A.y + g.kotak.y[1] * s;
    const b = B.kotakBadan();
    if (!b) return;
    if (kx1 < b.x0 || kx0 > b.x1 || ky1 < b.y0 || ky0 > b.y1) return;
    const titik = [jepit(A.x + A.hadap * g.kotak.x[1] * s * 0.8, b.x0, b.x1), jepit((Math.max(ky0, b.y0) + Math.min(ky1, b.y1)) / 2, b.y0 + 15, b.y1 - 10)];
    this.kenai(A, B, g, { titik, level: g.level });
  }

  bisaDibanting(B) {
    if (B.diUdara || B.inv > 0 || B.hilang) return false;
    return ["siaga", "jongkok", "tangkis", "serang", "mendarat"].includes(B.keadaan) && !(B.keadaan === "serang" && B.gerak?.udara);
  }

  /** Serangan A mengenai badan B (real-time). Memutuskan tangkis / armor / kena. */
  kenai(A, B, g, opsi = {}) {
    const lvl = opsi.level || g.level || "atas";
    if (!opsi.proyektil) { A.sudahKena = true; A.kontak = true; }
    // armor (Bantingan Gempa): serangan atas/overhead/proyektil ditahan, damage setengah tanpa terhuyung
    if (B.keadaan === "serang" && B.armor && lvl !== "bawah") {
      const dmg = Math.max(1, Math.round((opsi.dmg ?? g.dmg) * 0.5 * A.k.stat.kuat * B.k.stat.tahan));
      this.kurangiHp(B, dmg, A);
      B.kilau = 0.9;
      this.ef.percik(...(opsi.titik || [B.x, B.y + 180]), "armor", -B.hadap);
      this.ef.label(B.x, B.y + B.tinggi + 10, "ARMOR!", { warna: "#ffe2a8", warna2: "#c96a12", ukuran: 22, maks: 0.6 });
      this.suara("tArmor");
      this.jedaHit = 0.05;
      return;
    }
    const jaga = B.keadaan === "tangkis" || B.keadaan === "blokstun";
    const menghadap = Math.sign(A.x - B.x) === B.hadap || Math.abs(A.x - B.x) < 24 || opsi.proyektil;
    let blok = false;
    if (jaga && menghadap && lvl !== "tembus") {
      blok = B.rendah ? ["bawah", "proyektil", "atas"].includes(lvl) : ["atas", "overhead", "udara", "proyektil", "tengah"].includes(lvl);
    }
    if (blok) { this.terapkanBlok(A, B, g, { ...opsi, sempurna: B.keadaan === "tangkis" && B.tTangkis < 0.14 }); return; }
    const counter = B.keadaan === "serang" && !B.sudahKena && !opsi.proyektil;
    const skala = Math.max(0.4, 1 - 0.1 * B.comboDiterima);
    const dmg = Math.max(1, Math.round((opsi.dmg ?? g.dmg) * A.k.stat.kuat * B.k.stat.tahan * skala * (counter ? 1.2 : 1)));
    this.terapkanKena(A, B, g, { ...opsi, dmg, counter, level: lvl });
  }

  kurangiHp(B, dmg, A) {
    const awal = B.hp;
    B.hp = Math.max(0, B.hp - dmg);
    if (this.mode === "latihan") B.hp = Math.max(1, B.hp);
    B.tJejak = 0.45;
    B.pulih = 0;
    if (A) A.stat.damage += awal - B.hp;
    if (B.hp <= 0 && awal > 0) this.koBaru.push(B);
  }

  isiEnergi(f, n) {
    if (!(n > 0)) return;
    f.energi = Math.min(100, f.energi + n * (f.k.stat.energi || 1));
  }

  /**
   * B terkena serangan A. opsi: { dmg, counter, level, titik, arah, jatuh, efek, jenisPercik, proyektil, naskah, label }
   * Dipakai mode real-time maupun naskah duel (dmg dari server).
   */
  terapkanKena(A, B, g, o = {}) {
    const dmg = o.dmg ?? 0;
    if (dmg > 0) this.kurangiHp(B, dmg, A);
    B.comboDiterima += 1;
    A.stat.kena += 1;
    if (B.comboDiterima >= 2) {
      A.comboTampil = B.comboDiterima; A.comboT = 1.3;
      A.stat.comboMaks = Math.max(A.stat.comboMaks, B.comboDiterima);
      if (B.comboDiterima === 3 || B.comboDiterima === 5) this.suara("kombo", { level: Math.min(4, B.comboDiterima - 2) });
    }
    if (!o.naskah) { this.isiEnergi(A, (g?.energi ?? dmg * 0.5) + dmg * 0.4); this.isiEnergi(B, dmg * 0.9); }
    if (o.efek?.beku) B.efek.beku = Math.max(B.efek.beku, o.efek.beku);
    if (o.efek?.bakar) B.efek.bakar = Math.max(B.efek.bakar, o.efek.bakar);
    const arah = o.arah ?? (Math.sign(B.x - A.x) || A.hadap);
    // lepas dari gerak/pegangan
    if (B.keadaan === "membanting" && B.pegang) { const P = B.pegang; B.pegang = null; if (P.keadaan === "dibanting") { P.ke("melayang", 0.05); P.vy = 300; P.vx = -arah * 100; P.diUdara = true; } }
    B.gerak = null;
    const berat = g?.berat || o.berat;
    const jatuh = g?.jatuh || o.jatuh || B.diUdara || B.keadaan === "melayang" || B.hp <= 0;
    if (jatuh) {
      const lagi = B.keadaan === "melayang";
      B.ke("melayang", 0.04);
      B.juggle = lagi ? B.juggle + 1 : 0;
      B.diUdara = true;
      B.vy = B.hp <= 0 ? 760 : lagi ? 480 : 640;
      B.vx = arah * (B.hp <= 0 ? 360 : (g?.dorong ?? 220) * 0.9);
      B.y = Math.max(B.y, 1);
      B.putar = 0; B.pantul = false;
    } else {
      B.ke("kena", 0.025);
      B.stun = (g?.stun ?? 0.3) * (B.efek.beku > 0 ? 1.15 : 1);
      B.stunAwal = B.stun;
      B.jenisKena = o.level === "bawah" ? "bawah" : berat ? "berat" : "biasa";
      B.vx = arah * (g?.dorong ?? 160);
    }
    B.kilau = 1;
    // dorong balik penyerang bila lawan sudah menempel tepi
    if (Math.abs(B.x) >= TEPI - 2 && !o.proyektil && A.keadaan === "serang" && !A.diUdara) A.vx = -arah * (g?.dorong ?? 160) * 0.6;
    const titik = o.titik || [B.x - arah * 25, B.y + 170 * B.u.t];
    const jp = o.jenisPercik || (o.efek?.beku ? "es" : o.efek?.bakar ? "api" : berat || jatuh ? "berat" : o.level === "tembus" ? "tebas" : "pukul");
    this.ef.percik(titik[0], titik[1], jp, arah, berat ? 1.15 : 1);
    this.jedaHit = 0.07 + (berat ? 0.05 : 0) + (o.counter ? 0.03 : 0);
    this.guncang = Math.max(this.guncang, berat || jatuh ? 10 : 4);
    this.suara(berat || jatuh ? "tHantam" : "tPukul", { nada: 0.9 + this.acak() * 0.25 });
    if (o.counter) this.ef.label(titik[0], titik[1] + 60, "COUNTER!", { warna: "#ffef9a", warna2: "#ff3b2f", ukuran: 26, maks: 0.7 });
    if (o.label) this.ef.label(titik[0], titik[1] + 60, o.label, { warna: "#ffffff", warna2: "#ff3b2f", ukuran: 24, maks: 0.8 });
    if (this.angkaDamage && dmg > 0) this.ef.label(B.x, B.y + B.tinggi * 0.9, `-${dmg}`, { warna: "#ffffff", warna2: "#c40000", ukuran: 30, maks: 0.9, vy: 120 });
  }

  terapkanBlok(A, B, g, o = {}) {
    const arah = o.arah ?? (Math.sign(B.x - A.x) || A.hadap);
    B.ke("blokstun", 0.03);
    B.stun = (g?.blokStun ?? 0.18) * (o.sempurna ? 0.5 : 1);
    B.vx = arah * (g?.dorong ?? 150) * 0.75;
    const chip = o.dmg != null && o.naskah ? o.dmg : o.proyektil || A.namaGerak === "jurus" ? Math.round((o.dmg ?? g?.dmg ?? 0) * 0.15) : 0;
    if (chip > 0) { const sisa = B.hp - chip; this.kurangiHp(B, sisa < 1 && !o.naskah ? Math.max(0, B.hp - 1) : chip, A); }
    if (!o.naskah) { this.isiEnergi(B, o.sempurna ? 12 : 5); this.isiEnergi(A, 2); }
    B.stat.tangkis += 1;
    const titik = o.titik || [B.x - arah * B.lebar * 0.9, B.y + 170 * B.u.t];
    if (o.sempurna) {
      B.stat.sempurna += 1;
      if (!o.proyektil && A.keadaan === "serang") { A.ke("kena", 0.03); A.stun = 0.34; A.stunAwal = 0.34; A.jenisKena = "biasa"; A.vx = -arah * 120; }
      this.ef.percik(titik[0], titik[1], "sempurna", -arah);
      this.ef.label(B.x, B.y + B.tinggi + 20, "TANGKIS SEMPURNA!", { warna: "#e8fdff", warna2: "#1f8bff", ukuran: 22, maks: 0.8 });
      this.suara("tSempurna");
      this.kilat = Math.max(this.kilat, 0.18);
    } else {
      this.ef.percik(titik[0], titik[1], "blok", -arah);
      this.suara("tTangkis");
    }
    this.jedaHit = 0.05;
    this.guncang = Math.max(this.guncang, 2.5);
    if (this.angkaDamage && chip > 0) this.ef.label(B.x, B.y + B.tinggi * 0.9, `-${chip}`, { warna: "#d8ecff", warna2: "#1f5bff", ukuran: 24, maks: 0.8, vy: 110 });
  }

  bakar(f) {
    if (this.mode !== "solo" && this.mode !== "latihan") return;
    if (this.fase !== "tarung") return;
    const dmg = Math.max(1, Math.round(1 * f.k.stat.tahan));
    this.kurangiHp(f, dmg, this.lawan(f));
    f.kilau = Math.max(f.kilau, 0.3);
    this.ef.percik(f.x, f.y + 140 * f.u.t, "api", 1, 0.5);
  }

  // ── bantingan
  mulaiBanting(A, B, gempa, naskah = null) {
    A.ke("membanting", 0.04);
    A.pegang = B;
    A.banting = { gempa, dmg: naskah?.dmg ?? null, sudah: false, naskah };
    A.gerak = null; A.vx = 0;
    if (B.keadaan === "membanting") B.pegang = null;
    B.ke("dibanting", 0.04);
    B.dipegang = A; B.gerak = null; B.vx = 0; B.vy = 0; B.diUdara = false;
    B.hadap = -A.hadap;
    A.stat.banting += 1;
    this.suara("tRaih");
  }
  waktuBanting(b) { return b.gempa ? { angkat: 0.34, lempar: 0.62, dur: 1.05 } : { angkat: 0.2, lempar: 0.42, dur: 0.8 }; }

  updBanting(A, dt) {
    const B = A.pegang, b = A.banting;
    A.vx = 0; A.y = 0;
    if (!b) { A.ke("siaga"); return; }
    const T = this.waktuBanting(b), t = A.t;
    const tinggiAngkat = (b.gempa ? 210 : 150) * A.u.t;
    if (B && B.keadaan === "dibanting" && !b.sudah) {
      if (t < T.angkat) {
        const a = t / T.angkat;
        B.x = A.x + A.hadap * (75 - 45 * a) * A.u.t; B.y = tinggiAngkat * a;
        B.poseNaskah = campur(B.P.kena, B.P.dilempar, Math.min(1, a * 1.3));
      } else {
        const a = Math.min(1, (t - T.angkat) / (T.lempar - T.angkat));
        B.x = A.x + A.hadap * (30 + 120 * a) * A.u.t;
        B.y = tinggiAngkat * (1 - a * a) + 50 * Math.sin(a * Math.PI);
        B.poseNaskah = campur(B.P.dilempar, B.P.rebah, a * a);
      }
      B.x = jepit(B.x, -TEPI, TEPI);
    }
    if (!b.sudah && t >= T.lempar) {
      b.sudah = true;
      const g = b.gempa ? JURUS.raksasa : GERAK.banting;
      if (B && B.keadaan === "dibanting") {
        B.y = 0; B.dipegang = null;
        const dmg = b.dmg ?? Math.max(1, Math.round(g.dmg * A.k.stat.kuat * B.k.stat.tahan * Math.max(0.5, 1 - 0.1 * B.comboDiterima)));
        if (dmg > 0) this.kurangiHp(B, dmg, A);
        B.comboDiterima += 1;
        if (!b.naskah) { this.isiEnergi(A, (g.energi ?? 8) + dmg * 0.4); this.isiEnergi(B, dmg * 0.9); }
        B.ke("rebah", 0.04); B.vx = A.hadap * 120; B.kilau = 1; B.diUdara = false;
        const x = B.x;
        this.ef.debu(x, 12, 0, b.gempa ? 1.6 : 1.2);
        this.ef.cincin(x, b.gempa ? 1.5 : 1);
        if (b.gempa) this.ef.batu(x, 10, 1.1);
        this.ef.percik(x, 60, "berat", A.hadap, 1.2);
        this.guncang = Math.max(this.guncang, b.gempa ? 22 : 13);
        this.jedaHit = 0.09;
        this.suara("tBanting", { gempa: b.gempa });
        if (this.angkaDamage && dmg > 0) this.ef.label(B.x, B.y + 160, `-${dmg}`, { warna: "#ffffff", warna2: "#c40000", ukuran: 30, maks: 0.9, vy: 120 });
      }
    }
    if (t >= T.dur) { A.ke("siaga", 0.1); A.pegang = null; A.banting = null; }
    void dt;
  }

  // ── proyektil
  tembak(A, pr) {
    if (!pr) return;
    if (this.proyektil.some((p) => p.pemilik === A && p.hidup)) return;
    const p = {
      jenis: pr.jenis, x: A.x + A.hadap * 95 * A.u.t, y: A.y + 150 * A.u.t, vx: pr.vx * A.hadap, pemilik: A,
      dmg: pr.dmg, efek: pr.efek, umur: 0, hidup: true, r: 34, onSampai: A.naskahProyektil || null
    };
    A.naskahProyektil = null;
    this.proyektil.push(p);
    this.suara(pr.jenis === "es" ? "tEs" : "tApi");
    this.ef.percik(p.x, p.y, pr.jenis === "es" ? "es" : "api", A.hadap, 0.6);
  }

  perbaruiProyektil(dt) {
    for (const p of this.proyektil) {
      if (!p.hidup) continue;
      p.umur += dt;
      p.x += p.vx * dt;
      if (this.acak() < (this.mutu ? 0.9 : 0.4)) {
        if (p.jenis === "api") this.ef.tambah({ k: "api", x: p.x - Math.sign(p.vx) * 20, y: p.y + this.ef.r(-12, 12), vx: -p.vx * 0.15, vy: this.ef.r(20, 90), gesek: 3, maks: 0.32, r: this.ef.r(14, 24) });
        else this.ef.tambah({ k: "titik", x: p.x - Math.sign(p.vx) * 30, y: p.y + this.ef.r(-14, 14), vx: -p.vx * 0.1, vy: this.ef.r(-40, 40), maks: 0.35, r: this.ef.r(2, 4), w: "#dffaff", lampu: true });
      }
      if (Math.abs(p.x) > TEPI + 380 || p.umur > 2.8) { p.hidup = false; continue; }
      const B = this.lawan(p.pemilik);
      if (p.onSampai) {
        const arah = Math.sign(p.vx);
        const tujuan = p.tibaX != null ? p.tibaX : B.x - arah * (B.lebar + 10);
        if ((p.x - tujuan) * arah >= 0) { p.hidup = false; try { p.onSampai(p); } catch (e) { console.error(e); } }
        continue;
      }
      for (const q of this.proyektil) {
        if (q === p || !q.hidup || q.pemilik === p.pemilik || q.onSampai) continue;
        if (Math.abs(q.x - p.x) < 56 && Math.abs(q.y - p.y) < 70) {
          p.hidup = q.hidup = false;
          this.ef.percik((p.x + q.x) / 2, (p.y + q.y) / 2, "berat", 1, 1.2);
          this.guncang = Math.max(this.guncang, 8);
          this.suara("tLedak");
        }
      }
      if (!p.hidup || !this.serangAktif() || B.kebalProyektil) continue;
      const b = B.kotakBadan();
      if (!b) continue;
      if (p.x + p.r < b.x0 || p.x - p.r > b.x1 || p.y + p.r < b.y0 || p.y - p.r > b.y1) continue;
      p.hidup = false;
      this.kenai(p.pemilik, B, { level: "proyektil", dmg: p.dmg, stun: 0.34, blokStun: 0.22, dorong: 210, energi: 6 }, { proyektil: true, arah: Math.sign(p.vx), titik: [p.x, p.y], jenisPercik: p.jenis === "es" ? "es" : "api", efek: p.efek, level: "proyektil" });
    }
    this.proyektil = this.proyektil.filter((p) => p.hidup);
  }

  // ── pamungkas (sinema)
  mulaiPamungkas(A, B, paksa = null) {
    if (!paksa) { A.energi = Math.max(0, A.energi - BIAYA_PAMUNGKAS); A.stat.pamungkas += 1; }
    A.antri = null;
    this.proyektil = this.proyektil.filter((p) => p.onSampai);
    this.sinema = buatSinema(this, A, B, paksa || {});
  }

  dorongBadan() {
    const [a, b] = this.f;
    const lewati = (f) => f.hilang || ["dibanting", "membanting", "rebah", "bangun"].includes(f.keadaan) || f.y > 120;
    if (lewati(a) || lewati(b)) return;
    const min = (a.lebar + b.lebar) * 0.92;
    const dx = b.x - a.x, jarak = Math.abs(dx);
    if (jarak >= min) return;
    const s = jarak < 1 ? (a.sisi === 0 ? 1 : -1) : Math.sign(dx);
    const kurang = min - jarak;
    let ga = kurang / 2, gb = kurang / 2;
    if (Math.abs(a.x - s * ga) > TEPI) { gb += ga - Math.max(0, TEPI - Math.abs(a.x)); ga = Math.max(0, TEPI - Math.abs(a.x)); }
    if (Math.abs(b.x + s * gb) > TEPI) { ga += gb - Math.max(0, TEPI - Math.abs(b.x)); gb = Math.max(0, TEPI - Math.abs(b.x)); }
    a.x -= s * ga; b.x += s * gb;
  }

  // ═════════════════════════ POSE ═════════════════════════
  /**
   * Penghalus gerak: pose yang dihitung dilewatkan filter lintas-bingkai supaya perpindahan antar keadaan
   * (jalan↔siaga↔jongkok↔lompat…) tidak patah. Jurus, bantingan, dan terlempar tetap tajam agar waktu pukulan terbaca.
   */
  lembut(f, p, dt) {
    const prev = f.pose;
    if (!prev || !dt) return lengkap(p);
    const tegas = ["serang", "membanting", "dibanting", "melayang", "naskah", "ko", "rebah"].includes(f.keadaan);
    if (tegas || f.diUdara) return lengkap(p);
    const k = 1 - Math.exp(-dt * (f.keadaan === "siaga" ? 18 : 26));
    return campur(prev, lengkap(p), k);
  }

  poseUntuk(f) {
    const P = f.P, t = f.t;
    let p;
    switch (f.keadaan) {
      case "siaga":
        if (Math.abs(f.vx) > 25 && !f.diUdara) p = poseJalan(f.fJalan % 1, f.mundur, P);
        else p = poseSiaga(this.jam + f.sisi * 0.7, P.siaga);
        break;
      case "jongkok": p = { ...P.jongkok }; break;
      case "tangkis": case "blokstun": p = { ...(f.rendah ? P.tangkisBawah : P.tangkis) }; if (f.keadaan === "blokstun") { p.bd -= 7; p.kp += 6; } break;
      case "lompat": {
        p = { ...P.lompat };
        const naik = jepit(f.vy / LOMPAT_VY, -1, 1);
        p.kd1 += (1 - Math.abs(naik)) * 10; p.kb1 += (1 - Math.abs(naik)) * 10;
        break;
      }
      case "mendarat": p = campur(P.jongkok, P.siaga, Math.min(1, t / 0.09)); break;
      case "serang": p = f.gerak ? poseKf(f.gerak.kf, t, P) : { ...P.siaga }; break;
      case "kena": {
        const dasar = f.jenisKena === "bawah" ? P.kenaBawah : f.jenisKena === "berat" ? P.kenaBerat : P.kena;
        const a = 1 - Math.max(0, f.stun) / Math.max(0.01, f.stunAwal);
        p = a > 0.55 ? campur(dasar, P.siaga, (a - 0.55) / 0.45) : { ...dasar };
        break;
      }
      case "melayang": p = { ...P.melayang }; p.rot = 34 + f.putar; break;
      case "rebah": case "ko": p = { ...P.rebah }; break;
      case "bangun": p = t < 0.2 ? campur(P.rebah, P.bangun, t / 0.2) : campur(P.bangun, P.siaga, Math.min(1, (t - 0.2) / 0.22)); break;
      case "dibanting": p = f.poseNaskah ? { ...f.poseNaskah } : { ...P.dilempar }; break;
      case "membanting": {
        const T = f.banting ? this.waktuBanting(f.banting) : { angkat: 0.2, lempar: 0.42, dur: 0.8 };
        p = poseKf([[0, "bantingRaih"], [T.angkat, "bantingAngkat"], [T.lempar, "bantingLempar"], [T.lempar + 0.1, "bantingLempar"], [T.dur, "siaga"]], t, P);
        break;
      }
      case "menang": {
        const m = P[POSE_MENANG[f.kid]] || P.siaga;
        p = { ...m };
        p.ty = (p.ty || 0) + Math.abs(Math.sin(this.jam * 3)) * 6;
        p.ad2 += Math.sin(this.jam * 6) * 5;
        break;
      }
      case "kalah": p = { ...P.kalahLutut }; break;
      case "intro":
        // hormat (membungkuk) lalu kembali ke kuda-kuda
        p = t < 1.2 ? campur(lengkap({ ...P.siaga, ...POSE_HORMAT }), P.siaga, jepit((t - 0.55) / 0.6, 0, 1)) : poseSiaga(this.jam, P.siaga);
        break;
      case "naskah": p = f.poseNaskah ? { ...f.poseNaskah } : { ...P.siaga }; break;
      default: p = { ...P.siaga };
    }
    if (f.tCampur < 1 && f.poseAsal) p = campur(f.poseAsal, p, f.tCampur);
    return lengkap(p);
  }

  // ═════════════════════════ KAMERA ═════════════════════════
  perbaruiKamera(dt) {
    let tx, tl;
    const [a, b] = this.f;
    if (this.sinema?.kamera) { tx = this.sinema.kamera.x; tl = this.sinema.kamera.lebar; }
    else if (this.mode === "pajang") { tx = a.x + 20 * a.hadap; tl = 640; }
    else if (this.kam.xT != null) { tx = this.kam.xT; tl = this.kam.lebarT ?? 900; }
    else {
      tx = (a.x + b.x) / 2;
      tl = jepit(Math.abs(a.x - b.x) + 620, 900, 1500);
      if (this.fase === "intro") tl = 760 + Math.min(1, this.tFase / 1.6) * 140;
      if (this.fase === "ko" || this.fase === "selesai") { const pm = this.bendera.pemenang ?? this.selesai?.pemenang; if (pm != null) { tx = this.f[pm].x * 0.6 + tx * 0.4; tl = 820; } }
    }
    const batas = TEPI + 140;
    tx = jepit(tx, -batas + tl / 2, batas - tl / 2);
    const k = Math.min(1, dt * (this.sinema ? 5 : 5.5));
    this.kam.x += (tx - this.kam.x) * k;
    this.kam.lebar += (tl - this.kam.lebar) * Math.min(1, dt * 4);
  }

  // ═════════════════════════ PAJANG (pilih petarung) ═════════════════════════
  demoPajang(dt) {
    const f = this.f[0], d = this.demo;
    if (f.keadaan !== "siaga" && f.keadaan !== "jongkok") return;
    d.t -= dt;
    if (d.t > 0) return;
    const urut = ["pukul", "pukul2", "tendang", "jurus", "sapu", "lompat", "pukulBawah", "jurus"];
    const nama = urut[d.i % urut.length];
    d.i += 1;
    d.t = 1.05 + this.acak() * 0.5;
    if (nama === "lompat") { f.vy = LOMPAT_VY * 0.9; f.vx = 0; f.diUdara = true; f.y = 0.5; f.ke("lompat", 0.06); f.udaraDipakai = true; this.jadwal(0.22, () => { if (f.keadaan === "lompat") this.mulaiGerak(f, "tendangUdara"); }); return; }
    if (nama === "jurus" && (f.kid === "bayangan" || f.kid === "raksasa")) { this.mulaiGerak(f, f.kid === "raksasa" ? "banting" : "tendang", true); return; }
    this.mulaiGerak(f, nama, true);
    if (nama === "jurus" && f.kid === "garuda") f.vx = 0;
  }

  // ═════════════════════════ GAMBAR ═════════════════════════
  /** Menggambar seluruh adegan ke kanvas (W×H piksel perangkat). */
  gambar(ctx, W, H) {
    const kam = this.kam;
    const pajang = this.mode === "pajang";
    const lebar = Math.max(kam.lebar, (pajang ? 560 : 640) * (W / H));
    const z = W / lebar;
    const lantaiY = H * (pajang ? 0.9 : 0.8);
    const gx = this.guncang > 0 ? (Math.sin(this.jam * 91) + Math.sin(this.jam * 57)) * this.guncang * 0.5 * z : 0;
    const gy = this.guncang > 0 ? Math.cos(this.jam * 73) * this.guncang * 0.45 * z : 0;
    this.layar = { z, lantaiY, gx, gy, W, H };
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    gambarArena(ctx, this.arena, W, H, { x: kam.x - gx / z, z }, lantaiY + gy, this.jam, this.mutu);
    if (this.gelap > 0.01) {
      ctx.fillStyle = `rgba(4,2,10,${(0.74 * this.gelap).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
      this.sinema?.gambarLatar?.(ctx, W, H);
    }
    ctx.setTransform(z, 0, 0, -z, W / 2 - kam.x * z + gx, lantaiY + gy);
    const tampil = pajang || this.opsi.tunggal ? [this.f[0]] : this.f;
    for (const f of tampil) if (f.alpha > 0.05 && f.keadaan !== "dibanting") gambarBayanganLantai(ctx, f.x, 92 * (f.k.rupa.lebar || 1), f.y);
    this.sinema?.gambarBelakang?.(ctx);
    const urut = [...tampil].sort((a, b) => this.lapis(a) - this.lapis(b));
    for (const f of urut) this.gambarPetarungIni(ctx, f);
    for (const p of this.proyektil) this.gambarProyektil(ctx, p);
    this.ef.gambar(ctx);
    this.sinema?.gambarDepan?.(ctx);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    gambarTeksMelayang(ctx, this, W, H);
    if (this.kilat > 0.01) { ctx.fillStyle = `rgba(255,255,255,${Math.min(0.85, this.kilat).toFixed(3)})`; ctx.fillRect(0, 0, W, H); }
    this.sinema?.gambarLayar?.(ctx, W, H);
    // vinyet lembut
    const v = ctx.createRadialGradient(W / 2, H * 0.48, Math.min(W, H) * 0.35, W / 2, H * 0.5, Math.max(W, H) * 0.78);
    v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,.42)");
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    if (this.hud) gambarHud(ctx, this, W, H);
    gambarPengumuman(ctx, this, W, H);
  }

  lapis(f) {
    if (f.keadaan === "serang" || f.keadaan === "membanting") return 2;
    if (f.keadaan === "dibanting") return 1;
    return f.sisi === 0 ? 0.5 : 0;
  }

  gambarPetarungIni(ctx, f) {
    if (f.alpha <= 0.01 && !f.bayang.length) return;
    const dasar = { k: f.k, t: this.jam, ukuran: f.ukuranVektor };
    for (const b of f.bayang) {
      const a = 0.4 * (1 - b.umur / 0.22);
      gambarSprite(ctx, { ...dasar, pose: b.pose, x: b.x, y: b.y, hadap: b.hadap, alpha: a, tintBayang: 0.85, kilau: 0 }) || gambarPetarung(ctx, { ...dasar, pose: b.pose, x: b.x, y: b.y, hadap: b.hadap, alpha: a, tintBayang: 0.85, kilau: 0 });
    }
    if (f.alpha <= 0.01) return;
    if (f.aura > 0.02) this.gambarAura(ctx, f);
    const arg = {
      ...dasar, pose: f.pose, x: f.x, y: f.y, hadap: f.hadap, alpha: f.alpha, kilau: f.kilau,
      tintBeku: f.efek.beku > 0 ? Math.min(1, f.efek.beku * 1.5) : 0,
      tintBakar: f.efek.bakar > 0 ? 0.55 + 0.45 * Math.sin(this.jam * 18) : 0,
      tintBayang: f.tintBayang || 0, aura: f.aura, marah: f.keadaan === "serang"
    };
    let s = gambarSprite(ctx, arg);
    if (!s) { s = gambarPetarung(ctx, arg); f.ukuranVektor = arg.ukuran; }
    f.sendiDunia = s;
    // pecahan es menempel saat beku
    if (f.efek.beku > 0 && this.mutu) {
      ctx.save(); ctx.globalAlpha = Math.min(1, f.efek.beku) * 0.55; ctx.fillStyle = "#e6fbff"; ctx.strokeStyle = "#5fb8e6"; ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) { const x = f.x + Math.sin(i * 2.3) * 40, y = f.y + 40 + i * 45; ctx.beginPath(); ctx.moveTo(x, y + 26); ctx.lineTo(x + 11, y); ctx.lineTo(x - 11, y); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      ctx.restore();
    }
  }

  gambarAura(ctx, f) {
    const warna = f.k.rupa.aura;
    const c = warna.replace("#", "");
    const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const cx = f.x, cy = f.y + f.tinggi * 0.45;
    const rr = f.tinggi * 0.62 * (1 + 0.05 * Math.sin(this.jam * 9));
    const gr = ctx.createRadialGradient(cx, cy, 10, cx, cy, rr);
    gr.addColorStop(0, `rgba(${r},${g},${b},${(0.34 * f.aura).toFixed(3)})`);
    gr.addColorStop(0.6, `rgba(${r},${g},${b},${(0.12 * f.aura).toFixed(3)})`);
    gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.ellipse(cx, cy, rr * 0.8, rr, 0, 0, Math.PI * 2); ctx.fill();
    // lidah energi naik
    for (let i = 0; i < 5; i++) {
      const fase = (this.jam * 1.6 + i / 5) % 1;
      const x = cx + Math.sin(i * 2.1 + this.jam * 3) * f.tinggi * 0.22;
      const y = f.y + fase * f.tinggi * 1.05;
      ctx.fillStyle = `rgba(${r},${g},${b},${(0.5 * (1 - fase) * f.aura).toFixed(3)})`;
      ctx.beginPath(); ctx.ellipse(x, y, 7, 24 * (1 - fase) + 6, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  gambarProyektil(ctx, p) {
    const arah = Math.sign(p.vx) || 1;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(arah, 1);
    if (p.jenis === "es") {
      ctx.globalCompositeOperation = "lighter";
      const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 90);
      g.addColorStop(0, "rgba(200,250,255,.75)"); g.addColorStop(1, "rgba(80,180,255,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(-10, 0, 100, 46, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      // tombak kristal es
      const kil = ctx.createLinearGradient(-90, 0, 60, 0);
      kil.addColorStop(0, "rgba(140,220,255,.2)"); kil.addColorStop(0.5, "#bff4ff"); kil.addColorStop(1, "#ffffff");
      ctx.fillStyle = kil; ctx.strokeStyle = "#2a7fc0"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(62, 0); ctx.lineTo(10, 16); ctx.lineTo(-30, 10); ctx.lineTo(-96, 0); ctx.lineTo(-30, -10); ctx.lineTo(10, -16); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(56, 0); ctx.lineTo(-60, 0); ctx.stroke();
      for (const [dx, dy] of [[-10, 18], [-36, -16], [-58, 12]]) { ctx.fillStyle = "#e9fbff"; ctx.beginPath(); ctx.moveTo(dx, dy); ctx.lineTo(dx - 16, dy * 1.5); ctx.lineTo(dx - 8, dy * 0.4); ctx.closePath(); ctx.fill(); }
    } else {
      ctx.globalCompositeOperation = "lighter";
      const s = 1 + 0.08 * Math.sin(this.jam * 30);
      for (const [r, a, w] of [[95, 0.28, "255,90,20"], [62, 0.55, "255,160,40"], [36, 0.9, "255,240,180"]]) {
        const g = ctx.createRadialGradient(0, 0, 2, 0, 0, r * s);
        g.addColorStop(0, `rgba(${w},${a})`); g.addColorStop(1, `rgba(${w},0)`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(-r * 0.25, 0, r * s * 1.2, r * s * 0.85, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = "rgba(255,255,230,.95)"; ctx.beginPath(); ctx.arc(8, 0, 18, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
}
