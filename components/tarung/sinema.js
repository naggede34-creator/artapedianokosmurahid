// Sinema jurus pamungkas Arena Pendekar: layar gelap, kamera mendekat, nama jurus, lalu adegan khas tiap petarung
// (sayap emas & serbuan tendangan, naga es, pilar batu gempa, seribu bayangan, pilar lahar). Bisa dipaksa hasilnya
// (kena / ditangkis / meleset / bentrok) oleh sutradara duel agar sama persis dengan hasil server.
import { gambarSprite } from "./sprite";
import { gambarPetarung } from "./gambar";
import { fontTampil } from "./hud";

const TAU = Math.PI * 2;
const jepit = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const lembut = (t) => { const x = jepit(t, 0, 1); return x * x * (3 - 2 * x); };
const AKTIVASI = 0.75;

function rgbDari(hex) { const c = hex.replace("#", ""); return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)]; }

/**
 * paksa: { hasil: "kena"|"ditangkis"|"meleset"|"bentrok", dmg, dmgKeA (bentrok), naskah: bool }
 */
export function buatSinema(d, A, B, paksa = {}) {
  const S = {
    t: 0, selesai: false, kamera: { x: A.x, lebar: 620 }, hasil: paksa.hasil || null, A, B, d,
    dmgTotal: 0, dmgSudah: 0, hitKe: 0, hitTotal: 1, objek: [], naskah: !!paksa.naskah, paksa, akhir: 2.3
  };
  const h = A.hadap;
  const bentrok = paksa.hasil === "bentrok";
  const keadaanB = B.keadaan;
  const tumbangB = ["rebah", "bangun", "melayang", "dibanting"].includes(keadaanB) || B.hilang;
  const jagaB = keadaanB === "tangkis" || keadaanB === "blokstun";
  const asalA = { x: A.x, y: A.y }, asalB = { x: B.x, y: B.y };
  const [ar, ag, ab] = rgbDari(A.k.rupa.aura);
  A.ke("naskah", 0.08); A.poseNaskah = { ...A.P.angkatTangan }; A.aura = 1; A.diUdara = false; A.gerak = null;
  A.vx = 0; A.vy = 0;
  if (!tumbangB || bentrok) { B.ke("naskah", 0.05); B.poseNaskah = { ...(B.pose || B.P.siaga) }; B.vx = 0; }
  if (bentrok) { B.poseNaskah = { ...B.P.angkatTangan }; B.aura = 1; }
  d.gelapTarget = 1;
  d.kilat = 0.5;
  d.suara("tPamungkas");
  d.umumkan(A.k.pamungkas.nama);
  for (const p of d.proyektil) if (!p.onSampai) p.hidup = false;

  const tentukan = () => {
    if (!S.hasil) S.hasil = tumbangB ? "meleset" : jagaB ? "ditangkis" : "kena";
    const dasar = Math.round(A.k.pamungkas.dmg * A.k.stat.kuat * B.k.stat.tahan);
    S.dmgTotal = paksa.dmg != null ? paksa.dmg : S.hasil === "meleset" ? 0 : S.hasil === "ditangkis" ? Math.max(1, Math.round(dasar * 0.5)) : dasar;
    if (bentrok) S.dmgKeA = paksa.dmgKeA ?? Math.round(B.k.pamungkas.dmg * 0.5);
  };

  /** Satu pukulan dari rangkaian pamungkas; porsi bagian dari total damage (pukulan terakhir mengambil sisanya). */
  const pukul = (porsi, opsi = {}) => {
    const titik = opsi.titik || [B.x - h * 30, B.y + 150 * B.u.t];
    S.hitKe += 1;
    if (S.hasil === "meleset") { d.suara("tDesir", { kuat: 1 }); return; }
    let dmg = opsi.akhir ? S.dmgTotal - S.dmgSudah : Math.min(S.dmgTotal - S.dmgSudah, Math.round(S.dmgTotal * porsi));
    dmg = Math.max(0, dmg);
    S.dmgSudah += dmg;
    if (dmg > 0) d.kurangiHp(B, dmg, A);
    if (!S.naskah) d.isiEnergi(B, dmg * 0.9);
    if (S.hasil === "ditangkis") {
      B.poseNaskah = { ...(B.rendah ? B.P.tangkisBawah : B.P.tangkis) };
      d.ef.percik(titik[0], titik[1], "blok", h, 1.1);
      d.suara("tTangkis");
    } else {
      B.poseNaskah = { ...(S.hitKe % 2 ? B.P.kenaBerat : B.P.kena) };
      B.kilau = 0.7;
      d.ef.percik(titik[0], titik[1], opsi.jenis || "berat", h, 1.2);
      d.suara(opsi.akhir ? "tHantam" : "tPukul", { nada: 0.85 + Math.random() * 0.3 });
      B.comboDiterima += 1;
      A.comboTampil = B.comboDiterima; A.comboT = 1.4;
      A.stat.comboMaks = Math.max(A.stat.comboMaks, B.comboDiterima);
    }
    if (d.angkaDamage && dmg > 0) d.ef.label(B.x, B.y + B.tinggi * 0.95, `-${dmg}`, { warna: "#fff", warna2: S.hasil === "ditangkis" ? "#1f5bff" : "#c40000", ukuran: 30, vy: 130 });
    d.guncang = Math.max(d.guncang, opsi.akhir ? 18 : 8);
    if (opsi.akhir) d.kilat = Math.max(d.kilat, 0.45);
  };

  // ── adegan per petarung (dipanggil tiap langkah sesudah aktivasi; u = waktu sejak aktivasi)
  const adegan = {
    garuda(u, sekali) {
      const tujuan = B.x - h * 130;
      if (u < 0.2) { A.x = lerp(asalA.x, tujuan, lembut(u / 0.2)); A.poseNaskah = { ...A.P.pukul, bd: 30 }; }
      const jadwal = [[0.25, "tendangHantam"], [0.4, "pukul2"], [0.55, "tendangPuncak"], [0.7, "pukul"]];
      jadwal.forEach(([w, pose], i) => sekali(`h${i}`, u >= w, () => { A.poseNaskah = { ...A.P[pose] }; pukul(0.16, { titik: [B.x - h * 30, B.y + (i % 2 ? 200 : 140) * B.u.t] }); d.ef.tebasan(B.x - h * 20, B.y + 160, h, 70, "#ffd84a"); }));
      sekali("akhir", u >= 0.9, () => {
        A.poseNaskah = { ...A.P.terbangTendang };
        pukul(0, { akhir: true, titik: [B.x - h * 20, B.y + 120] });
        if (S.hasil === "kena") { B.ke("melayang", 0.04); B.diUdara = true; B.vy = 820; B.vx = h * 380; B.putar = 0; }
      });
      if (u >= 0.9) { const w = (u - 0.9) / 0.6; A.y = Math.max(0, 260 * Math.sin(Math.min(1, w) * Math.PI)); A.x = tujuan + h * 60 * Math.min(1, w); }
      return u >= 1.55;
    },
    naga(u, sekali) {
      A.poseNaskah = { ...A.P.tolak };
      const naga = S.objek.naga || (S.objek.naga = { jejak: [], x: A.x + h * 80, y: A.y + 150 });
      let kx, ky;
      if (u < 0.45) { const w = lembut(u / 0.45); kx = lerp(A.x + h * 80, B.x, w); ky = 150 + Math.sin(w * Math.PI * 2) * 90; }
      else { const w = (u - 0.45) * 7; kx = B.x + Math.cos(w) * 95; ky = 150 + Math.sin(w) * 120 + (u - 0.45) * 40; }
      naga.x = kx; naga.y = ky;
      naga.jejak.unshift([kx, ky]); if (naga.jejak.length > 60) naga.jejak.pop();
      if (Math.random() < 0.7) d.ef.tambah({ k: "titik", x: kx, y: ky, vx: (Math.random() - 0.5) * 200, vy: (Math.random() - 0.5) * 200, maks: 0.5, r: 3, w: "#e3fbff", lampu: true });
      [0.5, 0.7, 0.9].forEach((w, i) => sekali(`h${i}`, u >= w, () => { pukul(0.2, { jenis: "es" }); if (S.hasil === "kena") B.efek.beku = Math.max(B.efek.beku, 1.2); }));
      sekali("akhir", u >= 1.15, () => {
        pukul(0, { akhir: true, jenis: "es" });
        for (let i = 0; i < 3; i++) d.ef.percik(B.x + (Math.random() - 0.5) * 80, B.y + 80 + i * 70, "es", h, 1.2);
        S.objek.naga = null;
        if (S.hasil === "kena") { B.efek.beku = 2.5; B.ke("melayang", 0.04); B.diUdara = true; B.vy = 560; B.vx = h * 260; B.putar = 0; }
      });
      return u >= 1.45;
    },
    raksasa(u, sekali) {
      if (u < 0.3) { A.y = 170 * Math.sin((u / 0.3) * Math.PI * 0.5); A.poseNaskah = { ...A.P.lompat, ud: 1 }; }
      else if (u < 0.36) { A.y = lerp(170, 0, (u - 0.3) / 0.06); A.poseNaskah = { ...A.P.hantamTanah }; }
      else { A.y = 0; A.poseNaskah = { ...A.P.hantamTanah }; }
      sekali("hantam", u >= 0.36, () => { d.guncang = 26; d.kilat = 0.35; d.ef.cincin(A.x, 2); d.ef.debu(A.x, 16, 0, 1.8); d.ef.batu(A.x, 10, 1.2); d.suara("tLedak"); d.suara("tBanting", { gempa: true }); S.objek.pilar = []; });
      if (u >= 0.36) {
        const jarak = Math.abs(B.x - A.x), langkah = 75, n = Math.ceil(jarak / langkah) + 1;
        const ke = Math.min(n, Math.floor((u - 0.36) / 0.045) + 1);
        while (S.objek.pilar && S.objek.pilar.length < ke) {
          const i = S.objek.pilar.length, x = A.x + h * Math.min(jarak, (i + 1) * langkah);
          S.objek.pilar.push({ x, t0: u, tinggi: 90 + (i % 3) * 35 + (i === n - 1 ? 120 : 0), lebar: 55 + (i % 2) * 20 });
          d.ef.batu(x, 3, 0.8); d.ef.debu(x, 3, 0, 0.9);
        }
        const tiba = 0.36 + 0.045 * (n - 1);
        sekali("h1", u >= tiba, () => { pukul(0.55, { titik: [B.x, B.y + 80] }); if (S.hasil === "kena") { B.diUdara = true; } });
        if (S.hasil === "kena" && u >= tiba && u < tiba + 0.35) { B.y = 230 * Math.sin(((u - tiba) / 0.35) * Math.PI * 0.5); B.poseNaskah = { ...B.P.melayang }; }
        sekali("akhir", u >= tiba + 0.35, () => {
          pukul(0, { akhir: true, titik: [B.x, B.y + 120] });
          d.ef.batu(B.x, 12, 1.3);
          if (S.hasil === "kena") { B.ke("melayang", 0.04); B.diUdara = true; B.vy = 200; B.vx = h * 220; B.putar = 30; }
        });
        return u >= tiba + 0.7;
      }
      return false;
    },
    bayangan(u, sekali) {
      sekali("hilang", true, () => { A.alpha = 0; d.ef.asap(A.x, A.y, 16, "rgba(90,10,30,"); d.suara("tTeleport"); S.objek.klon = []; });
      for (let i = 0; i < 5; i++) {
        const t0 = 0.1 + i * 0.16;
        sekali(`k${i}`, u >= t0, () => S.objek.klon.push({ i, t0, sisi: i % 2 ? -1 : 1 }));
        sekali(`h${i}`, u >= t0 + 0.07, () => { pukul(0.14, { jenis: "tebas", titik: [B.x, B.y + 120 + (i % 3) * 50] }); d.ef.tebasan(B.x, B.y + 150, i % 2 ? -1 : 1, 110, "#ff3b5c"); });
      }
      sekali("muncul", u >= 0.95, () => {
        A.alpha = 1; A.x = B.x + h * 125; A.hadap = -h; A.poseNaskah = { ...A.P.tebasAkhir };
        d.ef.asap(A.x, A.y, 10, "rgba(90,10,30,");
      });
      sekali("akhir", u >= 1.05, () => {
        pukul(0, { akhir: true, jenis: "tebas", titik: [B.x, B.y + 150] });
        d.ef.tebasan(B.x, B.y + 150, -h, 150, "#ffffff");
        if (S.hasil === "kena") { B.ke("melayang", 0.04); B.diUdara = true; B.vy = 520; B.vx = -h * 160; B.putar = 0; }
      });
      if (u >= 0.95 && u < 1.05) A.poseNaskah = { ...A.P.tebas };
      return u >= 1.4;
    },
    merapi(u, sekali) {
      A.poseNaskah = u < 0.22 ? { ...A.P.angkatTangan } : { ...A.P.hantamTanah };
      sekali("hantam", u >= 0.22, () => { d.guncang = 12; d.ef.debu(A.x, 8, 0, 1.2); d.suara("tApi"); S.objek.retak = { x: B.x, t0: u }; });
      sekali("letus", u >= 0.45, () => { S.objek.pilar = { x: B.x, t0: u }; d.suara("tLedak"); d.kilat = 0.3; d.guncang = 18; });
      [0.5, 0.67, 0.84].forEach((w, i) => sekali(`h${i}`, u >= w, () => { pukul(0.22, { jenis: "api", titik: [B.x, B.y + 90 + i * 40] }); d.ef.bara(B.x, B.y + 100, 8); }));
      if (S.hasil === "kena" && u >= 0.5 && u < 0.95) { B.y = lerp(0, 240, lembut((u - 0.5) / 0.4)); B.poseNaskah = { ...B.P.melayang }; }
      sekali("akhir", u >= 0.95, () => {
        pukul(0, { akhir: true, jenis: "api", titik: [B.x, B.y + 140] });
        if (S.hasil === "kena") { B.efek.bakar = 3; B.ke("melayang", 0.04); B.diUdara = true; B.vy = 300; B.vx = h * 200; B.putar = 10; }
      });
      if (S.objek.pilar && u > 1.25) S.objek.pilar.pudar = true;
      return u >= 1.35;
    }
  };

  const tanda = new Set();
  const sekali = (kunci, syarat, fn) => { if (syarat && !tanda.has(kunci)) { tanda.add(kunci); fn(); } };

  S.perbarui = (dt) => {
    S.t += dt;
    const t = S.t;
    if (t < AKTIVASI) {
      S.kamera = { x: lerp(asalA.x, (asalA.x + asalB.x) / 2, 0) + h * 40, lebar: 600 };
      A.aura = 1;
      if (Math.random() < 0.6) d.ef.tambah({ k: "titik", x: A.x + (Math.random() - 0.5) * 160, y: A.y + Math.random() * 60, vx: 0, vy: 300 + Math.random() * 300, maks: 0.6, r: 3 + Math.random() * 3, w: A.k.rupa.aura, lampu: true });
      if (bentrok && Math.random() < 0.6) d.ef.tambah({ k: "titik", x: B.x + (Math.random() - 0.5) * 160, y: B.y + Math.random() * 60, vx: 0, vy: 300 + Math.random() * 300, maks: 0.6, r: 4, w: B.k.rupa.aura, lampu: true });
      return;
    }
    if (!S.ditentukan) { S.ditentukan = true; tentukan(); }
    const u = t - AKTIVASI;
    S.kamera = { x: (A.x + B.x) / 2, lebar: Math.max(700, Math.abs(A.x - B.x) + 520) };
    let habis;
    if (bentrok) habis = adeganBentrok(u, sekali);
    else habis = adegan[A.kid] ? adegan[A.kid](u, sekali) : u > 1;
    // B yang terlempar di tengah adegan tetap jatuh dengan fisika dunia
    for (const f of [A, B]) if (f.keadaan === "melayang") d.updMelayang(f, dt);
    if (habis) akhiri();
  };

  function adeganBentrok(u, sekali) {
    const tengah = (asalA.x + asalB.x) / 2;
    if (u < 0.3) {
      A.x = lerp(asalA.x, tengah - h * 70, lembut(u / 0.3)); B.x = lerp(asalB.x, tengah + h * 70, lembut(u / 0.3));
      A.poseNaskah = { ...A.P.pukul }; B.poseNaskah = { ...B.P.pukul };
    }
    sekali("bentur", u >= 0.3, () => {
      d.kilat = 0.9; d.guncang = 28; d.ef.cincin(tengah, 2.2); d.ef.percik(tengah, 160, "berat", 1, 2); d.ef.percik(tengah, 160, "sempurna", -1, 1.6);
      d.suara("tLedak"); d.suara("tHantam");
      const dA = S.dmgKeA ?? 0, dB = S.dmgTotal ?? 0;
      if (dA > 0) d.kurangiHp(A, dA, B);
      if (dB > 0) d.kurangiHp(B, dB, A);
      if (d.angkaDamage) { if (dA) d.ef.label(A.x, A.y + A.tinggi, `-${dA}`, { warna: "#fff", warna2: "#c40000", ukuran: 30 }); if (dB) d.ef.label(B.x, B.y + B.tinggi, `-${dB}`, { warna: "#fff", warna2: "#c40000", ukuran: 30 }); }
      d.ef.label(tengah, 320, "BENTROK!", { warna: "#fff", warna2: "#ff9a1f", ukuran: 34, maks: 1 });
      for (const [f, arah] of [[A, -h], [B, h]]) { f.ke("melayang", 0.04); f.diUdara = true; f.vy = 520; f.vx = arah * 380; f.putar = 0; f.aura = 0; }
    });
    return u >= 0.95;
  }

  function akhiri() {
    if (S.selesai) return;
    S.selesai = true;
    d.gelapTarget = 0;
    A.alpha = 1; A.aura = 0;
    if (A.keadaan === "naskah") {
      if (A.y > 1) { A.ke("lompat", 0.08); A.diUdara = true; A.vy = 0; A.udaraDipakai = true; } else A.ke("siaga", 0.12);
    }
    if (B.keadaan === "naskah") {
      if (S.hasil === "ditangkis") { B.ke("blokstun", 0.05); B.stun = 0.3; B.vx = h * 180; }
      else if (S.hasil === "kena") { B.ke("melayang", 0.05); B.diUdara = true; B.vy = 400; B.vx = h * 240; B.putar = 0; }
      else B.ke("siaga", 0.1);
    }
    if (bentrok && B.aura) B.aura = 0;
    d.kabar("pamungkas", { oleh: A.sisi, hasil: S.hasil, dmg: S.dmgSudah });
  }

  // ─────────────────────────── gambar ───────────────────────────
  S.gambarLatar = (ctx, W, H) => {
    // garis kecepatan memusat berwarna aura
    const a = Math.min(1, S.t / 0.3) * (S.selesai ? 0 : 1);
    if (a <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const cx = W / 2, cy = H * 0.45;
    for (let i = 0; i < 36; i++) {
      const sud = (i / 36) * TAU + Math.sin(i * 7.3) * 0.08 + S.t * 0.2;
      const r0 = Math.max(W, H) * (0.25 + ((i * 37) % 10) / 40), r1 = Math.max(W, H) * 0.9;
      ctx.strokeStyle = `rgba(${ar},${ag},${ab},${(0.16 * a).toFixed(3)})`;
      ctx.lineWidth = 2 + (i % 4) * 2;
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(sud) * r0, cy + Math.sin(sud) * r0); ctx.lineTo(cx + Math.cos(sud) * r1, cy + Math.sin(sud) * r1); ctx.stroke();
    }
    ctx.restore();
  };

  S.gambarBelakang = (ctx) => {
    if (A.kid === "garuda" && !bentrok) gambarSayap(ctx, A, S.t, ar, ag, ab);
    if (A.kid === "merapi" && S.objek.retak) {
      const r = S.objek.retak;
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      const g = ctx.createRadialGradient(r.x, 4, 4, r.x, 4, 170);
      g.addColorStop(0, "rgba(255,200,80,.9)"); g.addColorStop(0.4, "rgba(255,90,20,.5)"); g.addColorStop(1, "rgba(255,40,0,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(r.x, 4, 170, 30, 0, 0, TAU); ctx.fill();
      ctx.restore();
    }
  };

  S.gambarDepan = (ctx) => {
    if (S.objek.naga) gambarNaga(ctx, S.objek.naga, h);
    if (Array.isArray(S.objek.pilar)) for (const p of S.objek.pilar) gambarPilarBatu(ctx, p, S.t - AKTIVASI);
    if (S.objek.pilar && !Array.isArray(S.objek.pilar)) gambarPilarLahar(ctx, S.objek.pilar, S.t - AKTIVASI, d.jam);
    if (S.objek.klon) for (const k of S.objek.klon) {
      const w = (S.t - AKTIVASI - k.t0) / 0.16;
      if (w < 0 || w > 1.3) continue;
      const x = B.x + k.sisi * lerp(-280, 280, jepit(w, 0, 1));
      const arg = { k: A.k, pose: { ...A.P[w < 0.5 ? "tebas" : "tebasAkhir"] }, x, y: B.y, hadap: k.sisi, alpha: 0.85 * (1 - Math.max(0, w - 1) / 0.3), tintBayang: 0.6, t: d.jam };
      if (!gambarSprite(ctx, arg)) gambarPetarung(ctx, arg);
    }
  };

  S.gambarLayar = (ctx, W, H) => {
    const t = S.t;
    if (t > 1.6 || S.selesai) return;
    const masuk = lembut(t / 0.25), keluar = 1 - lembut((t - 1.3) / 0.3);
    const a = Math.min(masuk, keluar);
    if (a <= 0) return;
    const y = H * 0.26, tinggi = Math.max(46, H * 0.11);
    ctx.save();
    ctx.globalAlpha = a;
    const geser = (1 - masuk) * W * (h > 0 ? -1 : 1);
    ctx.translate(geser, 0);
    const g = ctx.createLinearGradient(0, y - tinggi / 2, 0, y + tinggi / 2);
    g.addColorStop(0, `rgba(${ar},${ag},${ab},.0)`); g.addColorStop(0.2, `rgba(${ar},${ag},${ab},.85)`); g.addColorStop(0.8, `rgba(${Math.round(ar * 0.5)},${Math.round(ag * 0.5)},${Math.round(ab * 0.5)},.85)`); g.addColorStop(1, `rgba(${ar},${ag},${ab},0)`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(0, y - tinggi / 2); ctx.lineTo(W, y - tinggi / 2 - 10); ctx.lineTo(W, y + tinggi / 2 - 10); ctx.lineTo(0, y + tinggi / 2); ctx.closePath(); ctx.fill();
    const uk = Math.round(tinggi * 0.62);
    ctx.font = `${uk}px ${fontTampil()}`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const teks = (bentrok ? "BENTROK PAMUNGKAS!" : A.k.pamungkas.nama.toUpperCase());
    ctx.lineWidth = Math.max(4, uk * 0.14); ctx.strokeStyle = "#140810"; ctx.strokeText(teks, W / 2, y - 4);
    ctx.fillStyle = "#ffffff"; ctx.fillText(teks, W / 2, y - 4);
    ctx.font = `${Math.round(uk * 0.38)}px ${fontTampil()}`;
    ctx.fillStyle = "#fff4c8";
    ctx.fillText(`⚡ JURUS PAMUNGKAS · ${A.nama.toUpperCase()}`, W / 2, y + uk * 0.62);
    ctx.restore();
  };

  return S;
}

// ─────────────────────────── gambar khusus ───────────────────────────
function gambarSayap(ctx, A, t, r, g, b) {
  const buka = lembut(t / 0.5) * (1 - lembut((t - 2.1) / 0.3));
  if (buka <= 0.01 || A.alpha < 0.1) return;
  const pusatX = A.x - A.hadap * 10, pusatY = A.y + A.tinggi * 0.62;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const sisi of [-1, 1]) {
    for (let i = 0; i < 8; i++) {
      const sud = (Math.PI / 2) + sisi * (0.25 + i * 0.17 * buka) + Math.sin(t * 9 + i) * 0.04;
      const pj = (150 + (i < 4 ? i * 22 : (7 - i) * 22) + 40) * buka;
      const x1 = pusatX + Math.cos(sud) * pj * sisi * 0.0 + Math.sin(sud - Math.PI / 2) * pj * sisi;
      const y1 = pusatY + Math.cos(sud - Math.PI / 2) * pj * 0.55 + i * 6;
      const gr = ctx.createLinearGradient(pusatX, pusatY, x1, y1);
      gr.addColorStop(0, `rgba(${r},${g},${b},.55)`); gr.addColorStop(1, "rgba(255,250,220,.9)");
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.moveTo(pusatX, pusatY);
      const nx = -(y1 - pusatY), ny = x1 - pusatX, L = Math.hypot(nx, ny) || 1;
      ctx.quadraticCurveTo((pusatX + x1) / 2 + (nx / L) * 18, (pusatY + y1) / 2 + (ny / L) * 18, x1, y1);
      ctx.quadraticCurveTo((pusatX + x1) / 2 - (nx / L) * 10, (pusatY + y1) / 2 - (ny / L) * 10, pusatX, pusatY);
      ctx.fill();
    }
  }
  ctx.restore();
}

function gambarNaga(ctx, n, h) {
  const j = n.jejak;
  if (j.length < 3) return;
  ctx.save();
  // cahaya
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < j.length; i += 4) {
    const [x, y] = j[i], r = 60 * (1 - i / j.length) + 15;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(160,240,255,.35)"); g.addColorStop(1, "rgba(80,180,255,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";
  // badan bersisik dari ekor ke kepala
  for (let i = j.length - 1; i >= 0; i -= 2) {
    const [x, y] = j[i];
    const r = 8 + 26 * (1 - i / j.length);
    const g = ctx.createRadialGradient(x - r * 0.3, y + r * 0.3, 1, x, y, r);
    g.addColorStop(0, "#ffffff"); g.addColorStop(0.5, "#9ee8ff"); g.addColorStop(1, "#2b86c9");
    ctx.fillStyle = g; ctx.strokeStyle = "#0f3a63"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.stroke();
    if (i % 6 === 0) { ctx.fillStyle = "#e9fbff"; ctx.beginPath(); ctx.moveTo(x - 6, y + r * 0.8); ctx.lineTo(x, y + r * 1.6); ctx.lineTo(x + 6, y + r * 0.8); ctx.closePath(); ctx.fill(); }
  }
  // kepala
  const [hx, hy] = j[0], [px, py] = j[2];
  const sud = Math.atan2(hy - py, hx - px);
  ctx.translate(hx, hy); ctx.rotate(sud);
  ctx.fillStyle = "#c9f4ff"; ctx.strokeStyle = "#0f3a63"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(62, 0); ctx.lineTo(20, 26); ctx.lineTo(-24, 22); ctx.lineTo(-30, -20); ctx.lineTo(20, -24); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.moveTo(-10, 20); ctx.lineTo(-48, 52); ctx.lineTo(-2, 26); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-10, -18); ctx.lineTo(-50, -40); ctx.lineTo(-2, -22); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#ff3b5c"; ctx.beginPath(); ctx.arc(18, 8, 5, 0, TAU); ctx.fill();
  ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(62, 0); ctx.lineTo(30, -2); ctx.stroke();
  void h;
  ctx.restore();
}

function gambarPilarBatu(ctx, p, u) {
  const w = u - p.t0;
  if (w < 0) return;
  const naik = lembut(w / 0.08), runtuh = lembut((w - 0.75) / 0.3);
  const tinggi = p.tinggi * naik * (1 - runtuh);
  if (tinggi < 2) return;
  ctx.save();
  const x = p.x, l = p.lebar;
  const g = ctx.createLinearGradient(x - l / 2, 0, x + l / 2, 0);
  g.addColorStop(0, "#5a3a25"); g.addColorStop(0.45, "#9c6b45"); g.addColorStop(1, "#3e2717");
  ctx.fillStyle = g; ctx.strokeStyle = "#1c110a"; ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - l / 2, 0); ctx.lineTo(x - l * 0.42, tinggi * 0.7); ctx.lineTo(x - l * 0.15, tinggi); ctx.lineTo(x + l * 0.12, tinggi * 0.86); ctx.lineTo(x + l * 0.4, tinggi * 0.64); ctx.lineTo(x + l / 2, 0); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.strokeStyle = "rgba(255,220,170,.35)"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x - l * 0.15, tinggi); ctx.lineTo(x - l * 0.05, tinggi * 0.3); ctx.stroke();
  ctx.restore();
}

function gambarPilarLahar(ctx, p, u, jam) {
  const w = u - p.t0;
  const naik = lembut(w / 0.12), pudar = p.pudar ? Math.max(0, 1 - (w - 0.8) / 0.3) : 1;
  if (pudar <= 0) return;
  const tinggi = 900 * naik, x = p.x;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = pudar;
  for (const [lebar, warna] of [[150, "rgba(255,60,0,.35)"], [100, "rgba(255,140,30,.55)"], [52, "rgba(255,240,170,.85)"]]) {
    ctx.fillStyle = warna;
    ctx.beginPath();
    ctx.moveTo(x - lebar / 2, 0);
    for (let y = 0; y <= tinggi; y += 30) ctx.lineTo(x - lebar / 2 + Math.sin(y * 0.03 + jam * 14) * 10, y);
    for (let y = tinggi; y >= 0; y -= 30) ctx.lineTo(x + lebar / 2 + Math.sin(y * 0.035 + jam * 12 + 1) * 10, y);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
