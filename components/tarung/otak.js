// Kecerdasan petarung CPU Arena Pendekar: membaca jarak & gerak lawan, menangkis dengan waktu reaksi manusiawi,
// menghukum lawan yang terbuka, merangkai combo, memakai jurus & pamungkas. Tiga tingkat: 0 mudah, 1 sedang, 2 sulit.
// Juga "boneka" untuk mode latihan (diam / selalu menangkis / melawan ringan).
import { BIAYA_JURUS, BIAYA_PAMUNGKAS } from "@/lib/tarung/karakter";

const PARAM = [
  { pikir: 0.62, reaksi: 0.34, tangkis: 0.16, tepat: 0.55, combo: 0.25, hukum: 0.18, antiUdara: 0.12, pamungkas: 0.3, jurus: 0.25, agresif: 0.45, jaga: 0.5 },
  { pikir: 0.36, reaksi: 0.21, tangkis: 0.44, tepat: 0.8, combo: 0.6, hukum: 0.5, antiUdara: 0.42, pamungkas: 0.55, jurus: 0.45, agresif: 0.62, jaga: 0.75 },
  { pikir: 0.2, reaksi: 0.13, tangkis: 0.7, tepat: 0.93, combo: 0.9, hukum: 0.82, antiUdara: 0.72, pamungkas: 0.8, jurus: 0.6, agresif: 0.78, jaga: 0.95 }
];

export class Otak {
  constructor(d, sisi, level = 1, opsi = {}) {
    this.d = d;
    this.sisi = sisi;
    this.boneka = level === "boneka" ? opsi.boneka || "diam" : null;
    this.level = this.boneka ? 0 : Math.max(0, Math.min(2, Math.round(Number(level) || 0)));
    this.P = PARAM[this.level];
    this.reset();
  }
  reset() {
    this.tunggu = 0.5; this.rencana = []; this.reaksiId = 0; this.tahan = 0; this.tahanRendah = false;
    this.jalan = 0; this.arahJalan = 0; this.lihatP = new Set(); this.tertunda = null; this.tahanBawah = 0;
  }
  lepas() { const i = this.f.input; i.kiri = i.kanan = i.bawah = i.tangkis = false; this.rencana = []; this.tertunda = null; this.tahan = 0; }
  get f() { return this.d.f[this.sisi]; }
  get L() { return this.d.f[1 - this.sisi]; }
  acak() { return this.d.acak(); }
  bisa() { const f = this.f; return f.bebas && !f.antri; }
  tunda(t, fn) { this.tertunda = { t, fn }; }
  jaga(rendah, lama) { this.tahan = lama; this.tahanRendah = rendah; this.jalan = 0; }
  maju(t) { this.jalan = t; this.arahJalan = 1; }
  mundur(t) { this.jalan = t; this.arahJalan = -1; }
  lompatMaju() { this.maju(0.14); this.f.tekan("lompat"); }
  lompatMundur() { this.mundur(0.14); this.f.tekan("lompat"); }
  punyaTembakan() { return this.f.kid === "naga" || this.f.kid === "merapi"; }
  jangkauan(L, g) {
    if (g.proyektil) return 2000;
    return ((g.kotak?.x?.[1] ?? g.jangkau ?? 130) + (g.maju ? g.maju * 0.3 : 0)) * L.u.t + this.f.lebar;
  }

  perbarui(dt) {
    const f = this.f, L = this.L, inp = f.input, P = this.P;
    if (this.boneka) { this.perbaruiBoneka(); return; }
    const jarak = Math.abs(L.x - f.x);
    if (this.tertunda) { this.tertunda.t -= dt; if (this.tertunda.t <= 0) { const a = this.tertunda; this.tertunda = null; a.fn(); } }
    if (this.tahanBawah > 0) { this.tahanBawah -= dt; inp.bawah = this.tahanBawah > 0; }
    // sedang menahan tangkisan
    if (this.tahan > 0) {
      this.tahan -= dt;
      inp.tangkis = true; inp.bawah = this.tahanRendah; inp.kiri = inp.kanan = false;
      if (this.tahan <= 0) { inp.tangkis = false; inp.bawah = false; }
      // lawan terhuyung di depan mata → lepas tangkisan & balas
      if (L.keadaan === "kena" && jarak < 210 && this.acak() < P.hukum * dt * 10) { this.tahan = 0; inp.tangkis = false; inp.bawah = false; this.combo(); }
      return;
    }
    // membaca serangan lawan (sekali per serangan)
    if (L.keadaan === "serang" && L.gerak && L.serangId !== this.reaksiId) {
      this.reaksiId = L.serangId;
      const g = L.gerak;
      const dekat = jarak < this.jangkauan(L, g) + 60 || g.udara;
      if (dekat && this.acak() < P.tangkis) {
        const sisa = (g.aktif?.[0] ?? g.lepas ?? 0.15) - L.t;
        if (g.banting) {
          if (this.acak() < P.tepat * 0.55) this.tunda(P.reaksi * 0.6, () => { if (this.bisa()) this.lompatMundur(); });
        } else if (sisa > P.reaksi * 0.6 || this.level === 2) {
          const benarRendah = g.level === "bawah";
          const rendah = this.acak() < P.tepat ? benarRendah : !benarRendah;
          const lama = Math.max(0.16, (g.aktif?.[1] ?? 0.35) - L.t + 0.12);
          this.tunda(Math.max(0, Math.min(P.reaksi, sisa - 0.04)), () => this.jaga(rendah, lama));
        }
      }
    }
    // tembakan yang mendekat
    for (const p of this.d.proyektil) {
      if (p.pemilik === f || this.lihatP.has(p)) continue;
      const mendekat = Math.sign(p.vx) === Math.sign(f.x - p.x);
      if (!mendekat || Math.abs(p.x - f.x) > 560) continue;
      this.lihatP.add(p);
      if (this.acak() < P.tangkis + 0.12) {
        const t = Math.max(0, (Math.abs(p.x - f.x) - 100) / Math.abs(p.vx || 1));
        if (f.kid === "garuda" && f.energi >= BIAYA_JURUS && this.level >= 1 && this.acak() < 0.45) this.tunda(Math.max(0, t - 0.2), () => this.bisa() && f.tekan("jurus"));
        else if (this.level >= 1 && this.acak() < 0.25) this.tunda(Math.max(0, t - 0.18), () => this.bisa() && this.lompatMaju());
        else this.tunda(Math.max(0, t - 0.08), () => this.jaga(false, 0.45));
      }
    }
    if (this.lihatP.size > 20) this.lihatP = new Set([...this.lihatP].filter((p) => p.hidup));
    // lanjutan combo
    if (this.rencana.length && !f.antri) {
      if (f.keadaan === "serang" && f.kontak) f.tekan(this.rencana.shift());
      else if (f.keadaan === "serang" && f.gerak && f.t > (f.gerak.aktif?.[1] ?? 0.3) && !f.kontak) this.rencana = []; // meleset: batalkan
      else if (this.bisa() && jarak < 230) f.tekan(this.rencana.shift());
      else if (this.bisa()) this.rencana = [];
    }
    // berjalan
    if (this.jalan > 0) {
      this.jalan -= dt;
      const kanan = (this.arahJalan > 0) === (f.hadap > 0);
      inp.kanan = kanan; inp.kiri = !kanan;
      if (this.jalan <= 0 || (this.arahJalan > 0 && jarak < f.lebar + L.lebar + 40)) { inp.kiri = inp.kanan = false; this.jalan = 0; }
    }
    this.tunggu -= dt;
    if (this.tunggu > 0) return;
    this.tunggu = P.pikir * (0.6 + this.acak() * 0.8);
    if (!this.bisa() || this.tertunda) return;
    this.putuskan(jarak);
  }

  putuskan(jarak) {
    const f = this.f, L = this.L, P = this.P, inp = f.input;
    inp.tangkis = false;
    if (this.tahanBawah <= 0) inp.bawah = false;
    const g = L.gerak;
    const lawanTerbuka = (L.keadaan === "serang" && g && L.t > (g.aktif?.[1] ?? 0.3) && !L.kontak) || L.keadaan === "mendarat" || L.keadaan === "kena" || L.keadaan === "blokstun";
    const lawanJaga = L.keadaan === "tangkis";
    const lawanUdara = L.diUdara && L.keadaan !== "melayang";
    const lawanTumbang = L.keadaan === "rebah" || L.keadaan === "bangun" || L.hilang;
    if (f.energi >= BIAYA_PAMUNGKAS && !lawanTumbang && this.acak() < P.pamungkas * 0.45) { f.tekan("pamungkas"); return; }
    if (lawanUdara && jarak < 290 && this.acak() < P.antiUdara) { f.tekan("pukul"); return; }
    if (lawanTerbuka && jarak < 220 && this.acak() < P.hukum) { this.combo(); return; }
    if (lawanTumbang) { if (jarak > 260) this.maju(0.3); else if (this.acak() < 0.5) this.jaga(false, 0.4); return; }
    if (jarak > 420) {
      if (this.punyaTembakan() && f.energi >= BIAYA_JURUS && this.acak() < P.jurus) { f.tekan("jurus"); return; }
      if (f.kid === "garuda" && f.energi >= BIAYA_JURUS && jarak < 640 && this.acak() < P.jurus * 0.5) { f.tekan("jurus"); return; }
      if (this.acak() < 0.2 * P.agresif) { this.lompatMaju(); return; }
      this.maju(0.35 + this.acak() * 0.5);
      return;
    }
    if (jarak > 215) {
      const r = this.acak();
      if (this.punyaTembakan() && f.energi >= BIAYA_JURUS && r < P.jurus * 0.55) { f.tekan("jurus"); return; }
      if (f.kid === "raksasa" && f.energi >= BIAYA_JURUS && jarak < 330 && r < P.jurus * 0.7) { f.tekan("jurus"); return; }
      if (f.kid === "bayangan" && f.energi >= BIAYA_JURUS && r < P.jurus * 0.5) { f.tekan("jurus"); return; }
      if (r < 0.22 * P.agresif) { this.lompatMaju(); this.rencana = ["tendang"]; return; }
      if (r < 0.72) { this.maju(0.22 + this.acak() * 0.35); return; }
      if (r < 0.86) { this.mundur(0.2 + this.acak() * 0.3); return; }
      this.jaga(this.acak() < 0.3, 0.35);
      return;
    }
    // jarak dekat: pilih menurut bobot
    const pilihan = [
      ["combo", 0.6 + 3 * P.combo],
      ["sapu", 1.1],
      ["tendang", 1.0],
      ["banting", lawanJaga ? 3.2 : 0.6],
      ["jaga", 0.4 + P.jaga],
      ["mundur", 0.45],
      ["pukulBawah", 0.6],
      ["jurus", f.energi >= BIAYA_JURUS ? P.jurus * 2.2 : 0]
    ];
    const total = pilihan.reduce((a, [, w]) => a + w, 0);
    let r = this.acak() * total;
    let pilih = "combo";
    for (const [n, w] of pilihan) { r -= w; if (r <= 0) { pilih = n; break; } }
    switch (pilih) {
      case "combo": this.combo(); break;
      case "sapu": this.tahanBawah = 0.25; inp.bawah = true; f.tekan("tendang"); break;
      case "tendang": f.tekan("tendang"); break;
      case "banting": f.tekan("banting"); break;
      case "jaga": this.jaga(this.acak() < 0.35, 0.3 + this.acak() * 0.4); break;
      case "mundur": this.mundur(0.25 + this.acak() * 0.3); break;
      case "pukulBawah": this.tahanBawah = 0.6; inp.bawah = true; f.tekan("pukul"); this.rencana = this.acak() < P.combo ? ["tendang"] : []; break;
      case "jurus": f.tekan("jurus"); break;
      default: break;
    }
  }

  combo() {
    const f = this.f, P = this.P;
    const r = this.acak();
    if (r < P.combo * 0.65) {
      f.tekan("pukul");
      this.rencana = ["pukul", "tendang"];
      if (f.energi >= BIAYA_PAMUNGKAS && this.acak() < P.pamungkas * 0.6) this.rencana.push("pamungkas");
      else if (f.energi >= BIAYA_JURUS && !this.punyaTembakan() && this.acak() < P.jurus * 0.4) this.rencana.push("jurus");
    } else if (r < P.combo) {
      this.tahanBawah = 0.7; f.input.bawah = true;
      f.tekan("pukul");
      this.rencana = ["tendang"];
    } else {
      f.tekan(this.acak() < 0.5 ? "pukul" : "tendang");
      this.rencana = [];
    }
  }

  /** Boneka latihan: diam, selalu menangkis (tinggi/rendah tepat), atau melawan ringan. */
  perbaruiBoneka() {
    const f = this.f, L = this.L, inp = f.input;
    if (this.boneka === "lawan") { if (!this.cadangan) this.cadangan = new Otak(this.d, this.sisi, 0); this.cadangan.perbarui(1 / 120); return; }
    inp.kiri = inp.kanan = false;
    if (this.boneka === "jaga") {
      inp.tangkis = true;
      const g = L.keadaan === "serang" ? L.gerak : null;
      inp.bawah = !!(g && g.level === "bawah");
      return;
    }
    inp.tangkis = false; inp.bawah = false;
  }
}
