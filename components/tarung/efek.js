// Partikel & efek visual Arena Pendekar (ruang dunia, y ke atas): kilat pukulan, percikan, debu, es, api, asap,
// batu, gelombang kejut, tebasan. Teks melayang (angka/label) disimpan di sini tetapi digambar HUD di ruang layar.
const TAU = Math.PI * 2;

export class Efek {
  constructor(acak = Math.random) {
    this.p = [];
    this.teks = [];
    this.acak = acak;
    this.mutu = 1; // 0 = hemat (HP lemah): partikel dikurangi
  }
  tambah(o) {
    const batas = this.mutu ? 520 : 220;
    if (this.p.length >= batas) this.p.shift();
    o.umur = 0;
    o.rot = o.rot || 0;
    this.p.push(o);
    return o;
  }
  r(a, b) { return a + (b - a) * this.acak(); }

  perbarui(dt) {
    for (const q of this.p) {
      q.umur += dt;
      if (q.g) q.vy -= q.g * dt;
      if (q.gesek) { const f = Math.max(0, 1 - q.gesek * dt); q.vx *= f; q.vy *= f; }
      q.x += (q.vx || 0) * dt;
      q.y += (q.vy || 0) * dt;
      if (q.vr) q.rot += q.vr * dt;
      if (q.lantai && q.y < q.lantai0) { q.y = q.lantai0; q.vy = -q.vy * 0.32; q.vx *= 0.6; q.vr = (q.vr || 0) * 0.6; }
    }
    this.p = this.p.filter((q) => q.umur < q.maks);
    for (const t of this.teks) { t.umur += dt; t.y += (t.vy || 0) * dt; }
    this.teks = this.teks.filter((t) => t.umur < t.maks);
  }

  // ─────────────────────────── pemancar ───────────────────────────
  /** Percikan benturan. jenis: pukul | berat | blok | sempurna | es | api | tebas | armor */
  percik(x, y, jenis = "pukul", arah = 1, kuat = 1) {
    const W = {
      pukul: ["#fff6c8", "#ffd23f", "#ff8a1f"], berat: ["#ffffff", "#ffe066", "#ff5a1f"], blok: ["#e8fbff", "#7fe7ff", "#3d8bff"],
      sempurna: ["#ffffff", "#c8f7ff", "#ffffff"], es: ["#ffffff", "#9ff2ff", "#3fa9ff"], api: ["#fff3b0", "#ff9a2e", "#ff3d0a"],
      tebas: ["#ffffff", "#ff7aa2", "#ff2e55"], armor: ["#fff0c0", "#ffb347", "#c96a12"]
    }[jenis] || ["#fff", "#ffd23f", "#ff8a1f"];
    const besar = (jenis === "berat" || jenis === "sempurna" ? 1.5 : 1) * kuat;
    this.tambah({ k: "kilat", x, y, r: 46 * besar, maks: 0.14, w: W[0], w2: W[1] });
    this.tambah({ k: "cincinUdara", x, y, r: 12, vr0: 520 * besar, maks: 0.22, w: W[1], tebal: 5 });
    const n = Math.round((jenis === "blok" ? 9 : jenis === "berat" ? 16 : 11) * (this.mutu ? 1 : 0.5));
    for (let i = 0; i < n; i++) {
      // percikan menyebar terutama searah dorongan (setengah lingkaran)
      const a = (jenis === "blok" ? Math.PI : 0) + (arah > 0 ? 0 : Math.PI) + this.r(-1.25, 1.25);
      const v = this.r(380, 980) * besar;
      this.tambah({ k: "garis", x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v + 120, g: 900, gesek: 4, maks: this.r(0.16, 0.32), w: W[this.acak() < 0.5 ? 1 : 2], tebal: this.r(3, 6) * besar, panjang: this.r(0.022, 0.04) });
    }
    if (jenis === "es") for (let i = 0; i < 8; i++) this.tambah({ k: "es", x, y, vx: this.r(-420, 420), vy: this.r(80, 520), g: 1500, vr: this.r(-12, 12), maks: this.r(0.5, 0.9), s: this.r(6, 13), lantai: true, lantai0: 2 });
    if (jenis === "api") for (let i = 0; i < 9; i++) this.tambah({ k: "api", x: x + this.r(-20, 20), y: y + this.r(-20, 20), vx: this.r(-160, 160), vy: this.r(80, 320), gesek: 2, maks: this.r(0.35, 0.6), r: this.r(16, 34) });
    if (jenis === "sempurna") for (let i = 0; i < 6; i++) this.tambah({ k: "bintang", x: x + this.r(-40, 40), y: y + this.r(-40, 40), vx: this.r(-120, 120), vy: this.r(40, 220), maks: 0.5, r: this.r(10, 20) });
    if (jenis === "tebas") this.tebasan(x, y, arah, 90 * kuat);
  }
  debu(x, n = 6, arah = 0, kuat = 1, warna = "rgba(214,196,170,") {
    const m = Math.round(n * (this.mutu ? 1 : 0.5));
    for (let i = 0; i < m; i++) {
      this.tambah({ k: "debu", x: x + this.r(-30, 30), y: this.r(4, 22), vx: (arah || this.r(-1, 1)) * this.r(60, 260) * kuat, vy: this.r(20, 120), gesek: 2.2, maks: this.r(0.45, 0.8), r: this.r(16, 30) * kuat, w: warna });
    }
  }
  asap(x, y, n = 12, warna = "rgba(60,20,90,") {
    for (let i = 0; i < n; i++) this.tambah({ k: "debu", x: x + this.r(-40, 40), y: y + this.r(-60, 120), vx: this.r(-200, 200), vy: this.r(-60, 200), gesek: 2.5, maks: this.r(0.4, 0.75), r: this.r(24, 46), w: warna });
  }
  cincin(x, kuat = 1, warna = "rgba(255,240,200,") {
    this.tambah({ k: "cincin", x, y: 3, r: 20, vr0: 900 * kuat, maks: 0.45, w: warna, tebal: 10 * kuat });
  }
  batu(x, n = 8, kuat = 1) {
    for (let i = 0; i < n; i++) this.tambah({ k: "batu", x: x + this.r(-40, 40), y: this.r(10, 60), vx: this.r(-380, 380) * kuat, vy: this.r(380, 900) * kuat, g: 2200, vr: this.r(-10, 10), maks: this.r(0.9, 1.4), s: this.r(10, 24) * kuat, lantai: true, lantai0: 6, w: this.acak() < 0.5 ? "#7a5236" : "#5e3d27" });
  }
  bara(x, y, n = 10) {
    for (let i = 0; i < n; i++) this.tambah({ k: "titik", x: x + this.r(-30, 30), y: y + this.r(-30, 30), vx: this.r(-120, 120), vy: this.r(120, 420), g: 300, maks: this.r(0.5, 1.1), r: this.r(2.5, 5), w: this.acak() < 0.5 ? "#ffcf4a" : "#ff6a1a", lampu: true });
  }
  tebasan(x, y, arah = 1, r = 90, warna = "#ffffff") {
    const a0 = arah > 0 ? 1.9 : -1.25;
    this.tambah({ k: "tebasan", x, y, r, a0, a1: a0 + (arah > 0 ? -2.4 : 2.4), maks: 0.22, w: warna });
  }
  /** Teks melayang di posisi dunia (angka damage, COUNTER!, dll.) */
  label(x, y, teks, opsi = {}) {
    this.teks.push({ x, y, teks, umur: 0, maks: opsi.maks || 0.9, vy: opsi.vy ?? 90, w: opsi.warna || "#ffffff", w2: opsi.warna2 || "#ff3b2f", ukuran: opsi.ukuran || 30, besar: opsi.besar || false });
  }

  // ─────────────────────────── gambar (ruang dunia, y ke atas) ───────────────────────────
  gambar(ctx) {
    for (const q of this.p) {
      const a = q.umur / q.maks, sisa = 1 - a;
      switch (q.k) {
        case "kilat": {
          ctx.save(); ctx.globalCompositeOperation = "lighter";
          const r = q.r * (0.55 + a * 0.9);
          const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, r);
          g.addColorStop(0, q.w); g.addColorStop(0.35, q.w2); g.addColorStop(1, "rgba(255,200,80,0)");
          ctx.globalAlpha = sisa; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, TAU); ctx.fill();
          ctx.restore();
          break;
        }
        case "cincinUdara": {
          ctx.save(); ctx.globalAlpha = sisa * 0.9; ctx.strokeStyle = q.w; ctx.lineWidth = q.tebal * sisa + 0.5;
          ctx.beginPath(); ctx.arc(q.x, q.y, q.r + q.vr0 * q.umur * 0.25, 0, TAU); ctx.stroke(); ctx.restore();
          break;
        }
        case "garis": {
          ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = sisa; ctx.strokeStyle = q.w; ctx.lineCap = "round";
          ctx.lineWidth = q.tebal * sisa + 0.6;
          ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x - q.vx * q.panjang, q.y - q.vy * q.panjang); ctx.stroke(); ctx.restore();
          break;
        }
        case "titik": {
          ctx.save(); if (q.lampu) ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = sisa; ctx.fillStyle = q.w;
          ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, TAU); ctx.fill(); ctx.restore();
          break;
        }
        case "debu": {
          ctx.save(); ctx.fillStyle = `${q.w}${(0.42 * sisa).toFixed(3)})`;
          ctx.beginPath(); ctx.arc(q.x, q.y, q.r * (1 + a * 1.3), 0, TAU); ctx.fill(); ctx.restore();
          break;
        }
        case "api": {
          ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = sisa;
          const r = q.r * (0.7 + a * 0.8);
          const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, r);
          g.addColorStop(0, "rgba(255,245,190,.95)"); g.addColorStop(0.4, "rgba(255,150,40,.7)"); g.addColorStop(1, "rgba(255,60,0,0)");
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, TAU); ctx.fill(); ctx.restore();
          break;
        }
        case "es": {
          ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.globalAlpha = Math.min(1, sisa * 2);
          ctx.fillStyle = "#dff9ff"; ctx.strokeStyle = "#2f7fbf"; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(0, q.s); ctx.lineTo(q.s * 0.45, -q.s * 0.4); ctx.lineTo(-q.s * 0.45, -q.s * 0.4); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.restore();
          break;
        }
        case "batu": {
          ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.globalAlpha = Math.min(1, sisa * 3);
          ctx.fillStyle = q.w; ctx.strokeStyle = "#20140c"; ctx.lineWidth = 2;
          ctx.beginPath(); for (let i = 0; i < 6; i++) { const t = (i / 6) * TAU, rr = q.s * (0.75 + ((i * 37) % 10) / 25); ctx.lineTo(Math.cos(t) * rr, Math.sin(t) * rr); } ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.restore();
          break;
        }
        case "cincin": {
          ctx.save(); ctx.strokeStyle = `${q.w}${(0.8 * sisa).toFixed(3)})`; ctx.lineWidth = q.tebal * sisa + 1;
          const rx = q.r + q.vr0 * q.umur; ctx.beginPath(); ctx.ellipse(q.x, q.y, rx, rx * 0.16, 0, 0, TAU); ctx.stroke(); ctx.restore();
          break;
        }
        case "bintang": {
          ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = sisa; ctx.fillStyle = "#ffffff"; ctx.translate(q.x, q.y); ctx.rotate(q.umur * 6);
          const r = q.r * (1 - a * 0.4);
          ctx.beginPath(); for (let i = 0; i < 8; i++) { const t = (i / 8) * TAU, rr = i % 2 ? r * 0.28 : r; ctx.lineTo(Math.cos(t) * rr, Math.sin(t) * rr); } ctx.closePath(); ctx.fill(); ctx.restore();
          break;
        }
        case "tebasan": {
          ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = sisa;
          const t = Math.min(1, a * 2.2), aa = q.a0 + (q.a1 - q.a0) * t;
          ctx.strokeStyle = q.w; ctx.lineCap = "round"; ctx.lineWidth = 12 * sisa + 2;
          ctx.beginPath(); ctx.arc(q.x, q.y, q.r, Math.min(q.a0, aa), Math.max(q.a0, aa)); ctx.stroke();
          ctx.lineWidth = 4; ctx.strokeStyle = "#ffffff"; ctx.stroke();
          ctx.restore();
          break;
        }
        default: break;
      }
    }
  }
}
