// HUD Arena Pendekar (ruang layar): bar nyawa bergaya arkade dengan jejak damage, potret, nama, medali ronde,
// pewaktu, bar energi (jurus 35 · pamungkas 100), penghitung combo, teks melayang, dan pengumuman besar.
import { RIG_SPRITE } from "./dataSprite";
import { urlPotret } from "./sprite";
import { potret as potretVektor } from "./gambar";

let fontCache = null;
/** Keluarga huruf judul situs (Bangers) bila tersedia, dengan cadangan tebal. */
export function fontTampil() {
  if (fontCache) return fontCache;
  let f = "";
  try { f = getComputedStyle(document.body).getPropertyValue("--font-display").trim(); } catch {}
  fontCache = `${f ? f + "," : ""}"Bangers","Impact","Arial Black",system-ui,sans-serif`;
  return fontCache;
}

const gambarPotret = new Map();
function ambilPotret(k) {
  const url = urlPotret(k);
  if (!url || typeof Image === "undefined") return null;
  let e = gambarPotret.get(url);
  if (!e) { e = { img: new Image(), siap: false }; e.img.onload = () => { e.siap = true; }; e.img.src = url; gambarPotret.set(url, e); }
  return e.siap ? e.img : null;
}

/** Potret kepala dalam lingkaran (x, y = pusat). */
export function gambarKepalaPotret(ctx, k, x, y, r, cermin = false) {
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.closePath();
  const g = ctx.createRadialGradient(x, y - r * 0.3, r * 0.1, x, y, r);
  g.addColorStop(0, k.rupa.aura); g.addColorStop(1, "#140b22");
  ctx.fillStyle = g; ctx.fill();
  ctx.clip();
  const img = ambilPotret(k);
  const R = RIG_SPRITE[k.rupa.sprite];
  if (img && R) {
    const [bx, by, bw] = R.potret;
    const sisi = bw * 0.62;
    const cx = R.kepala[0] - bx, cy = R.kepala[1] - by + sisi * 0.06;
    ctx.translate(x, y);
    if (cermin) ctx.scale(-1, 1);
    ctx.drawImage(img, cx - sisi / 2, cy - sisi / 2, sisi, sisi, -r * 1.05, -r * 1.05, r * 2.1, r * 2.1);
  } else {
    const c = potretVektor(k.id, 120);
    if (c) { ctx.translate(x, y); if (cermin) ctx.scale(-1, 1); ctx.drawImage(c, -r, -r, r * 2, r * 2); }
  }
  ctx.restore();
  ctx.save();
  ctx.lineWidth = Math.max(2, r * 0.12); ctx.strokeStyle = "#ffd75e";
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = Math.max(1, r * 0.05); ctx.strokeStyle = "#2a1600";
  ctx.beginPath(); ctx.arc(x, y, r + ctx.lineWidth * 2, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

function teksTebal(ctx, teks, x, y, ukuran, isi, garis = "#120810", opsi = {}) {
  ctx.font = `${ukuran}px ${fontTampil()}`;
  ctx.textAlign = opsi.rata || "left";
  ctx.textBaseline = opsi.dasar || "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(2, ukuran * 0.2);
  ctx.strokeStyle = garis;
  ctx.strokeText(teks, x, y);
  ctx.fillStyle = isi;
  ctx.fillText(teks, x, y);
}

function bar(ctx, x, y, w, h, nilai, jejak, kanan, warna, kritis, kedip) {
  // bingkai miring
  const miring = h * 0.6;
  ctx.save();
  ctx.beginPath();
  if (!kanan) { ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w - miring, y + h); ctx.lineTo(x, y + h); }
  else { ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + h); ctx.lineTo(x + miring, y + h); }
  ctx.closePath();
  ctx.fillStyle = "rgba(10,6,20,.82)"; ctx.fill();
  ctx.save(); ctx.clip();
  const isi = (v) => { const L = w * Math.max(0, Math.min(1, v)); return kanan ? [x + w - L, L] : [x, L]; };
  // jejak (merah) lalu nyawa
  const [jx, jl] = isi(jejak);
  ctx.fillStyle = "#e0262f"; ctx.fillRect(jx, y, jl, h);
  const [nx, nl] = isi(nilai);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  const [a, b] = kritis && kedip ? ["#ff8a8a", "#d11a1a"] : warna;
  g.addColorStop(0, a); g.addColorStop(1, b);
  ctx.fillStyle = g; ctx.fillRect(nx, y, nl, h);
  ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.fillRect(nx, y + 1, nl, h * 0.3);
  ctx.restore();
  ctx.lineWidth = Math.max(1.5, h * 0.14); ctx.strokeStyle = "#ffd75e"; ctx.stroke();
  ctx.restore();
}

/** HUD utama. */
export function gambarHud(ctx, d, W, H) {
  const s = Math.min(W / 760, H / 430) * 1.0;
  const pad = 10 * s;
  const tengah = W / 2;
  const lebarBar = Math.min(W * 0.34, 330 * s);
  const tinggiBar = Math.max(9, 17 * s);
  const yBar = pad + 18 * s;
  const kedip = Math.sin(d.jam * 14) > 0;
  const r = 21 * s;
  d.f.forEach((f, i) => {
    const kanan = i === 1;
    const x = kanan ? tengah + 34 * s : tengah - 34 * s - lebarBar;
    const kritis = f.hp / f.hpMaks < 0.25;
    bar(ctx, x, yBar, lebarBar, tinggiBar, f.hp / f.hpMaks, f.hpJejak / f.hpMaks, kanan, ["#fff27a", "#f5a20a"], kritis, kedip);
    // potret di ujung luar
    const px = kanan ? x + lebarBar + r * 0.6 : x - r * 0.6;
    gambarKepalaPotret(ctx, f.k, px, yBar + tinggiBar / 2, r, kanan);
    // nama
    const yNama = yBar + tinggiBar + 11 * s;
    teksTebal(ctx, f.nama.toUpperCase(), kanan ? x + lebarBar - 4 * s : x + 4 * s, yNama, Math.round(14 * s), "#ffffff", "#120810", { rata: kanan ? "right" : "left" });
    // medali ronde
    for (let m = 0; m < 2; m++) {
      const mx = kanan ? x + 8 * s + m * 15 * s : x + lebarBar - 8 * s - m * 15 * s;
      const my = yNama + 0.5 * s;
      const menang = d.menang[i] > m;
      ctx.beginPath(); ctx.arc(mx, my + 12 * s, 5.5 * s, 0, Math.PI * 2);
      ctx.fillStyle = menang ? "#ffd75e" : "rgba(0,0,0,.55)"; ctx.fill();
      ctx.lineWidth = 1.5 * s; ctx.strokeStyle = menang ? "#7a4a00" : "rgba(255,215,94,.6)"; ctx.stroke();
    }
    // status beku / bakar
    const ikon = [];
    if (f.efek.beku > 0) ikon.push("❄");
    if (f.efek.bakar > 0) ikon.push("🔥");
    if (ikon.length) { ctx.font = `${Math.round(13 * s)}px system-ui`; ctx.textAlign = kanan ? "left" : "right"; ctx.fillText(ikon.join(" "), kanan ? x + 4 * s : x + lebarBar - 4 * s, yNama + 26 * s); }
    // energi (bawah layar)
    const lebarE = Math.min(W * 0.3, 240 * s), tinggiE = Math.max(6, 10 * s);
    const ex = kanan ? W - pad - lebarE : pad, ey = H - pad - tinggiE - 12 * s;
    ctx.save();
    ctx.fillStyle = "rgba(10,6,20,.8)"; ctx.fillRect(ex, ey, lebarE, tinggiE);
    const penuh = f.energi >= 100;
    const ge = ctx.createLinearGradient(ex, 0, ex + lebarE, 0);
    ge.addColorStop(0, "#2fd3ff"); ge.addColorStop(0.6, "#7a5cff"); ge.addColorStop(1, penuh ? "#ffe066" : "#d14cff");
    ctx.fillStyle = f.energiKurang > 0 && kedip ? "#ff4040" : ge;
    const le = lebarE * Math.min(1, f.energi / 100);
    ctx.fillRect(kanan ? ex + lebarE - le : ex, ey, le, tinggiE);
    // tanda 35 (jurus)
    const t35 = kanan ? ex + lebarE * 0.65 : ex + lebarE * 0.35;
    ctx.fillStyle = "#ffffff"; ctx.fillRect(t35 - 1, ey - 2 * s, 2, tinggiE + 4 * s);
    ctx.lineWidth = 1.5; ctx.strokeStyle = penuh && kedip ? "#fff7b0" : "#ffd75e"; ctx.strokeRect(ex, ey, lebarE, tinggiE);
    ctx.restore();
    teksTebal(ctx, penuh ? "⚡ PAMUNGKAS SIAP!" : `ENERGI ${Math.floor(f.energi)}`, kanan ? ex + lebarE : ex, ey - 8 * s, Math.round(11 * s), penuh ? "#ffe066" : "#cfe9ff", "#120810", { rata: kanan ? "right" : "left" });
    // combo
    if (f.comboTampil >= 2 && f.comboT > 0) {
      const a = Math.min(1, f.comboT / 0.3);
      ctx.save(); ctx.globalAlpha = a;
      const cx = kanan ? W - pad - 10 * s : pad + 10 * s, cy = H * 0.36;
      const uk = Math.round((34 + Math.min(4, f.comboTampil) * 3) * s);
      teksTebal(ctx, `${f.comboTampil} HIT`, cx, cy, uk, "#ffe14d", "#5a0b00", { rata: kanan ? "right" : "left" });
      teksTebal(ctx, "COMBO!", cx, cy + uk * 0.75, Math.round(uk * 0.5), "#ffffff", "#5a0b00", { rata: kanan ? "right" : "left" });
      ctx.restore();
    }
  });
  // pewaktu
  const bw = 54 * s, bh = 42 * s, bx = tengah - bw / 2, by = pad + 6 * s;
  ctx.save();
  ctx.fillStyle = "rgba(10,6,20,.88)";
  ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + bw, by); ctx.lineTo(bx + bw - 6 * s, by + bh); ctx.lineTo(bx + 6 * s, by + bh); ctx.closePath(); ctx.fill();
  ctx.lineWidth = 2 * s; ctx.strokeStyle = "#ffd75e"; ctx.stroke();
  ctx.restore();
  let waktu;
  if (d.mode === "duel") waktu = d.hudWaktu != null ? String(d.hudWaktu) : "VS";
  else if (d.mode === "latihan") waktu = "∞";
  else waktu = String(Math.max(0, Math.ceil(d.waktu)));
  const habis = d.mode === "solo" && d.waktu <= 10 && d.fase === "tarung";
  teksTebal(ctx, waktu, tengah, by + bh / 2 + 1 * s, Math.round((waktu.length > 2 ? 22 : 30) * s), habis && kedip ? "#ff5a4e" : "#ffffff", "#120810", { rata: "center" });
  const info = d.mode === "duel" ? d.hudInfo : d.mode === "latihan" ? "LATIHAN" : `RONDE ${d.ronde}`;
  if (info) teksTebal(ctx, info, tengah, by + bh + 9 * s, Math.round(10 * s), "#ffd75e", "#120810", { rata: "center" });
}

/** Teks melayang (posisi dunia → layar). */
export function gambarTeksMelayang(ctx, d, W, H) {
  const L = d.layar;
  if (!L || !d.ef.teks.length) return;
  const s = Math.min(W / 760, H / 430);
  for (const t of d.ef.teks) {
    const a = t.umur / t.maks;
    const sx = W / 2 + (t.x - d.kam.x) * L.z + L.gx;
    const sy = L.lantaiY - t.y * L.z + L.gy;
    const pop = a < 0.15 ? 0.6 + (a / 0.15) * 0.5 : a < 0.25 ? 1.1 - ((a - 0.15) / 0.1) * 0.1 : 1;
    ctx.save();
    ctx.globalAlpha = Math.min(1, (1 - a) * 2.2);
    ctx.translate(sx, sy); ctx.scale(pop, pop);
    teksTebal(ctx, t.teks, 0, 0, Math.round(t.ukuran * s), t.w, t.w2, { rata: "center" });
    ctx.restore();
  }
}

/** Pengumuman besar di tengah layar (RONDE 1, TARUNG!, K.O., …). */
export function gambarPengumuman(ctx, d, W, H) {
  const p = d.pengumuman;
  if (!p) return;
  const s = Math.min(W / 760, H / 430);
  const a = p.umur / p.maks;
  const masuk = Math.min(1, p.umur / 0.18);
  const keluar = a > 0.82 ? (1 - a) / 0.18 : 1;
  const skala = p.gaya === "tarung" || p.gaya === "ko" ? 1.6 - 0.6 * masuk : 0.7 + 0.3 * masuk;
  const warna = {
    ronde: ["#fff6c8", "#ffb31a"], tarung: ["#ffffff", "#ff3b2f"], ko: ["#ffe14d", "#e0101b"], menang: ["#fff6c8", "#ffb31a"],
    sempurna: ["#ffffff", "#2fd3ff"], biasa: ["#ffffff", "#ffb31a"]
  }[p.gaya] || ["#fff", "#ffb31a"];
  const uk = Math.round((p.gaya === "ko" ? 110 : p.gaya === "tarung" ? 96 : p.teks.length > 14 ? 52 : 72) * s);
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(masuk * 1.5, keluar));
  ctx.translate(W / 2, H * 0.42);
  ctx.scale(skala, skala);
  ctx.font = `${uk}px ${fontTampil()}`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.lineJoin = "round";
  // bayangan tebal + garis + isi bergradasi metal
  ctx.lineWidth = uk * 0.24; ctx.strokeStyle = "#1a0606"; ctx.strokeText(p.teks, 0, uk * 0.06);
  const g = ctx.createLinearGradient(0, -uk * 0.5, 0, uk * 0.5);
  g.addColorStop(0, warna[0]); g.addColorStop(0.55, warna[1]); g.addColorStop(1, "#7a1200");
  ctx.lineWidth = uk * 0.08; ctx.strokeStyle = "#fffbe8"; ctx.strokeText(p.teks, 0, 0);
  ctx.fillStyle = g; ctx.fillText(p.teks, 0, 0);
  if (p.sub) {
    ctx.font = `${Math.round(uk * 0.32)}px ${fontTampil()}`;
    ctx.lineWidth = uk * 0.07; ctx.strokeStyle = "#1a0606"; ctx.strokeText(p.sub, 0, uk * 0.7);
    ctx.fillStyle = "#ffffff"; ctx.fillText(p.sub, 0, uk * 0.7);
  }
  ctx.restore();
}
