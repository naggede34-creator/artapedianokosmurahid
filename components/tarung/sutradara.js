// Sutradara duel Arena Pendekar: memutar hasil satu giliran dari server (riwayat duel tarung) sebagai adegan tarung
// di dunia mode "duel". Hasil (siapa kena, damage, ditangkis, dibanting, pamungkas, K.O.) persis sama dengan server;
// klien hanya menata gerakannya. Pemain sendiri selalu di kiri (f[0]), lawan di kanan (f[1]).
import { GERAK, JURUS } from "./gerak";

const NETRAL = 190;

export class Sutradara {
  constructor(d, pidSaya, pidLawan) {
    this.d = d;
    this.pid = [pidSaya, pidLawan];
    this.antre = [];
    this.jalan = false;
    this.diputar = new Set();
    this.selesaiCb = null;
  }
  idx(pid) { return pid === this.pid[0] ? 0 : 1; }
  f(pid) { return this.d.f[this.idx(pid)]; }

  tunggu(dt) { return new Promise((res) => this.d.jadwal(Math.max(0, dt), res)); }
  async tungguSinema() { while (this.d.sinema) await this.tunggu(0.05); }
  async tungguTenang(maks = 2.5) {
    let t = 0;
    const tenang = () => this.d.f.every((f) => ["siaga", "jongkok", "tangkis", "naskah", "menang", "kalah"].includes(f.keadaan));
    while (!tenang() && t < maks) { await this.tunggu(0.05); t += 0.05; }
  }

  /** Samakan nyawa/energi/efek/menang dengan papan server (dipakai saat diam / pertama kali). */
  sinkron(papan) {
    const sisi = [papan.saya, papan.lawan];
    sisi.forEach((x, i) => {
      const f = this.d.f[i];
      if (x.hp != null) { f.hp = x.hp; f.hpJejak = Math.max(f.hp, Math.min(f.hpJejak, f.hpMaks)); }
      if (x.hpMaks) f.hpMaks = x.hpMaks;
      f.energi = x.energi ?? f.energi;
      f.efek.beku = x.efek?.beku > 0 ? 999 : 0;
      f.efek.bakar = x.efek?.bakar > 0 ? 999 : 0;
      this.d.menang[i] = x.menang || 0;
    });
    this.d.ronde = papan.ronde || 1;
  }

  /** Tandai rekaman yang sudah ada sebagai sudah diputar (saat membuka duel di tengah jalan). */
  lewati(riwayat) { for (const r of riwayat || []) this.diputar.add(r.ke); }

  /** Antrekan rekaman baru dari riwayat papan. */
  terima(riwayat, papan) {
    for (const r of riwayat || []) {
      if (this.diputar.has(r.ke)) continue;
      this.diputar.add(r.ke);
      this.antre.push({ r, papan });
    }
    if (!this.jalan) this.proses();
  }

  async proses() {
    this.jalan = true;
    while (this.antre.length) {
      const { r, papan } = this.antre.shift();
      try {
        if (r.tipe === "mulai") await this.mulai(r);
        else await this.giliran(r, papan);
      } catch (e) { console.error(e); }
    }
    this.jalan = false;
    this.selesaiCb?.();
  }
  get sibuk() { return this.jalan; }

  async mulai(r) {
    const d = this.d;
    for (const f of d.f) { f.resetRonde(); f.x = f.sisi ? NETRAL : -NETRAL; f.ke("intro", 0.01); }
    d.ronde = r.ronde || 1;
    d.umum(`RONDE ${d.ronde}`, { maks: 1.1, gaya: "ronde" }); d.umumkan(`Ronde ${d.ronde}`); d.suara("tRonde");
    await this.tunggu(1.3);
    d.umum("TARUNG!", { maks: 0.8, gaya: "tarung" }); d.umumkan("Tarung!"); d.suara("tTarung");
    for (const f of d.f) f.ke("siaga", 0.25);
    await this.tunggu(0.6);
  }

  // ─────────────────────────── satu giliran ───────────────────────────
  async giliran(r, papan) {
    const d = this.d;
    const [p0, p1] = this.pid;
    const gerak = { [p0]: r.aksi[p0], [p1]: r.aksi[p1] };
    const utama = {}, balas = {}, bakar = [];
    for (const b of r.babak || []) {
      if (b.tipe === "bakar") bakar.push(b);
      else if (b.balasan) balas[b.oleh] = b;
      else if (!utama[b.oleh]) utama[b.oleh] = b;
    }
    const F = { [p0]: d.f[0], [p1]: d.f[1] };
    const lain = (p) => (p === p0 ? p1 : p0);
    for (const f of d.f) { f.comboDiterima = 0; if (f.keadaan === "naskah") f.ke("siaga"); }
    // label pilihan di atas kepala
    for (const p of [p0, p1]) {
      const nama = this.namaGerak(F[p], gerak[p]);
      d.ef.label(F[p].x, F[p].y + F[p].tinggi + 40, `${r.auto?.[p] ? "⏱ " : ""}${nama}`, { warna: "#ffffff", warna2: F[p].k.rupa.aura, ukuran: 20, maks: 1.1, vy: 30 });
    }
    await this.tunggu(0.35);

    const pam = [p0, p1].filter((p) => gerak[p] === "pamungkas");
    if (pam.length === 2) {
      // dua pamungkas bertabrakan
      d.mulaiPamungkas(F[p0], F[p1], { hasil: "bentrok", dmg: utama[p0]?.dmg || 0, dmgKeA: utama[p1]?.dmg || 0, naskah: true });
      await this.tungguSinema();
    } else if (pam.length === 1) {
      const U = pam[0], O = lain(U);
      const hasil = utama[U]?.hasil === "ditangkis" ? "ditangkis" : "kena";
      if (hasil === "ditangkis") { F[O].rendah = gerak[O] === "rendah"; F[O].ke("tangkis", 0.05); }
      else this.mulaiAnimasi(F[O], gerak[O], true);
      d.mulaiPamungkas(F[U], F[O], { hasil, dmg: utama[U]?.dmg || 0, naskah: true });
      await this.tungguSinema();
    } else {
      await this.bentrokan(r, gerak, utama, balas, F, lain);
    }
    await this.tungguTenang();
    // efek bakar (akhir giliran)
    for (const b of bakar) {
      const f = F[b.sasaran];
      d.kurangiHp(f, b.dmg);
      f.kilau = 0.6;
      d.ef.percik(f.x, f.y + 140, "api", 1, 0.7);
      d.ef.label(f.x, f.y + f.tinggi, `🔥 -${b.dmg}`, { warna: "#ffe2a0", warna2: "#c43a00", ukuran: 24 });
      d.suara("tApi");
      await this.tunggu(0.35);
    }
    // samakan persis dengan server
    for (const p of [p0, p1]) {
      const f = F[p];
      f.hp = Math.max(0, r.hp[p]);
      f.hpJejak = Math.max(f.hp, f.hpJejak);
      f.energi = r.energi[p];
      f.efek.beku = r.efek?.[p]?.beku > 0 ? 999 : 0;
      f.efek.bakar = r.efek?.[p]?.bakar > 0 ? 999 : 0;
    }
    d.koBaru = [];
    if (r.akhirRonde) await this.akhirRonde(r, papan, F);
    else await this.kembaliNetral();
  }

  namaGerak(f, g) {
    if (g === "jurus") return f.k.jurus.nama;
    if (g === "pamungkas") return f.k.pamungkas.nama;
    return { pukul: "Pukulan", tendang: "Tendangan Kapak", sapu: "Sapuan", banting: "Bantingan", tangkis: "Tangkis Atas", rendah: "Tangkis Bawah" }[g] || g;
  }

  /** Mulai animasi gerak pilihan (tanpa efek ke lawan). */
  mulaiAnimasi(f, g, sebentar = false) {
    const d = this.d;
    if (g === "tangkis" || g === "rendah") { f.rendah = g === "rendah"; f.ke("tangkis", 0.05); return; }
    if (g === "pamungkas") { f.ke("naskah", 0.1); f.poseNaskah = { ...f.P.angkatTangan }; f.aura = 1; return; }
    const nama = g === "sapu" ? "sapu" : g === "tendang" ? "tendang" : g === "banting" ? "banting" : g === "jurus" ? "jurus" : "pukul";
    if (sebentar && nama === "jurus" && (f.kid === "naga" || f.kid === "merapi")) f.naskahProyektil = () => {};
    d.mulaiGerak(f, nama, true);
  }

  /** Waktu (detik) dari mulai gerak sampai mengenai. */
  waktuKena(f, g) {
    const k = f.kecSerang || 1;
    if (g === "pukul") return 0.1 / k;
    if (g === "tendang") return 0.27 / k;
    if (g === "sapu") return 0.21 / k;
    if (g === "banting") return 0.1 / k;
    if (g === "jurus") return { garuda: 0.34, raksasa: 0.22, bayangan: 0.55, naga: 0, merapi: 0 }[f.kid] / k;
    if (g === "balas") return 0.15;
    return 0.15;
  }
  dataGerak(f, g) {
    if (g === "jurus") return JURUS[f.kid];
    if (g === "balas") return GERAK.balasTangkis;
    return GERAK[g] || GERAK.pukul;
  }

  async kembaliNetral(lama = 0.45) {
    const d = this.d;
    const tengah = Math.max(-500, Math.min(500, (d.f[0].x + d.f[1].x) / 2));
    for (const f of d.f) { f.tujuanX = tengah + (f.sisi ? NETRAL : -NETRAL); f.lajuTujuan = Math.max(200, Math.abs(f.tujuanX - f.x) / lama); }
    await this.tunggu(lama + 0.1);
  }

  async majuKe(jarak, lama = 0.32) {
    const d = this.d;
    const tengah = (d.f[0].x + d.f[1].x) / 2;
    for (const f of d.f) {
      if (!f.bebas) continue;
      f.tujuanX = tengah + (f.sisi ? jarak / 2 : -jarak / 2);
      f.lajuTujuan = Math.max(160, Math.abs(f.tujuanX - f.x) / lama);
    }
    await this.tunggu(lama);
  }

  async bentrokan(r, gerak, utama, balas, F, lain) {
    const d = this.d;
    const [p0, p1] = this.pid;
    const urut = r.babak?.find((b) => !b.tipe && !b.balasan)?.oleh || p0;
    const pemain = [urut, lain(urut)];
    const proyektil = (p) => gerak[p] === "jurus" && (F[p].kid === "naga" || F[p].kid === "merapi");
    const pegang = (p) => gerak[p] === "banting" || (gerak[p] === "jurus" && F[p].kid === "raksasa");
    // jarak tempur
    if (pegang(p0) || pegang(p1)) await this.majuKe(150);
    else if (proyektil(p0) || proyektil(p1)) await this.majuKe(Math.max(360, Math.abs(F[p0].x - F[p1].x)));
    else if (["tangkis", "rendah"].includes(gerak[p0]) && ["tangkis", "rendah"].includes(gerak[p1])) await this.majuKe(300);
    else await this.majuKe(180);

    // keduanya bertahan
    if (utama[p0]?.hasil === "diam" && utama[p1]?.hasil === "diam") {
      for (const p of pemain) this.mulaiAnimasi(F[p], gerak[p]);
      d.ef.label((F[p0].x + F[p1].x) / 2, 330, "SALING JAGA", { warna: "#e8f1ff", warna2: "#3b4a9e", ukuran: 26, maks: 1 });
      await this.tunggu(0.8);
      for (const f of d.f) f.ke("siaga", 0.1);
      return;
    }
    // dua bantingan saling lepas
    if (utama[p0]?.hasil === "lepas" && utama[p1]?.hasil === "lepas") {
      for (const p of pemain) d.mulaiGerak(F[p], "banting", true);
      await this.tunggu(0.14);
      d.ef.percik((F[p0].x + F[p1].x) / 2, 170, "blok", 1, 1.2);
      d.ef.label((F[p0].x + F[p1].x) / 2, 330, "LEPAS!", { warna: "#fff", warna2: "#ff9a1f", ukuran: 28 });
      d.suara("tTangkis");
      F[p0].vx = -260; F[p1].vx = 260;
      await this.tunggu(0.5);
      return;
    }

    // jadwalkan tiap pemain
    const tugas = [];
    let tKe = 0;
    for (const p of pemain) {
      const b = utama[p];
      const g = gerak[p];
      const f = F[p], o = F[lain(p)];
      const mulai = b?.hasil === "terpotong" ? 0.06 : tKe;
      tKe += 0.04;
      tugas.push(this.jalankanPemain(p, f, o, g, b, mulai, gerak[lain(p)]));
    }
    await Promise.all(tugas);
    // balasan (tangkis / tangkis bawah lalu membalas)
    for (const p of [p0, p1]) {
      const b = balas[p];
      if (!b) continue;
      const f = F[p], o = F[lain(p)];
      await this.tungguTenang(1);
      const nama = gerak[p] === "rendah" ? "balasBawah" : "balasTangkis";
      f.hadap = o.x > f.x ? 1 : -1;
      d.mulaiGerak(f, nama, true);
      await this.tunggu(nama === "balasBawah" ? 0.2 : 0.12);
      d.terapkanKena(f, o, GERAK[nama], { dmg: b.dmg, naskah: true, label: "BALASAN!" });
      await this.tunggu(0.3);
    }
  }

  async jalankanPemain(p, f, o, g, b, mulai, gLawan) {
    const d = this.d;
    await this.tunggu(mulai);
    const hasil = b?.hasil;
    // bertahan
    if (g === "tangkis" || g === "rendah") {
      f.rendah = g === "rendah"; f.ke("tangkis", 0.05); f.tTangkis = 9;
      return;
    }
    // proyektil
    if (g === "jurus" && (f.kid === "naga" || f.kid === "merapi")) {
      const tiba = new Promise((res) => {
        f.naskahProyektil = (pr) => {
          if (hasil === "kena" || hasil === "tukar") d.terapkanKena(f, o, { level: "proyektil", stun: 0.34, dorong: 210 }, { dmg: b.dmg, naskah: true, efek: f.k.jurus.efek, proyektil: true, arah: Math.sign(pr.vx), titik: [pr.x, pr.y], jenisPercik: f.kid === "naga" ? "es" : "api", counter: b.counter });
          else if (hasil === "ditangkis") d.terapkanBlok(f, o, { blokStun: 0.22, dorong: 200 }, { dmg: b.dmg, naskah: true, proyektil: true, arah: Math.sign(pr.vx), titik: [pr.x, pr.y] });
          else if (hasil === "bentrok") { d.ef.percik(pr.x, pr.y, "berat", 1, 1.2); d.suara("tLedak"); d.ef.label(pr.x, pr.y + 80, "BENTROK!", { warna: "#fff", warna2: "#ff9a1f", ukuran: 26 }); }
          else { d.ef.label(pr.x, pr.y + 80, "MELESET", { warna: "#eee", warna2: "#555", ukuran: 22 }); }
          res();
        };
      });
      d.mulaiGerak(f, "jurus", true);
      if (hasil === "bentrok") {
        // kedua tembakan meledak di tengah
        await this.tunggu(0.3);
        for (const pr of d.proyektil) pr.tibaX = (d.f[0].x + d.f[1].x) / 2;
      }
      await Promise.race([tiba, this.tunggu(2.2)]);
      return;
    }
    // bantingan / bantingan perintah
    if (g === "banting" || (g === "jurus" && f.kid === "raksasa")) {
      const gempa = g === "jurus";
      d.mulaiGerak(f, g === "jurus" ? "jurus" : "banting", true);
      await this.tunggu(this.waktuKena(f, g));
      if (hasil === "kena" && f.keadaan === "serang") {
        if (Math.abs(o.x - f.x) > 160) f.x = o.x - f.hadap * 120;
        if (b.armor) { o.kilau = 0.8; d.ef.label(f.x, f.y + f.tinggi + 10, "ARMOR!", { warna: "#ffe2a8", warna2: "#c96a12", ukuran: 22 }); }
        d.mulaiBanting(f, o, gempa, { dmg: b.dmg });
        await this.tunggu(gempa ? 1.1 : 0.85);
      } else if (hasil === "meleset") {
        d.ef.label(f.x + f.hadap * 80, f.y + 200, "MELESET", { warna: "#eee", warna2: "#555", ukuran: 22 });
      }
      return;
    }
    // serangan biasa / jurus garuda / teleport bayangan
    if (hasil === "terpotong" || hasil === "diam") {
      this.mulaiAnimasi(f, g);
      return;
    }
    if (g === "pamungkas") return;
    this.mulaiAnimasi(f, g);
    await this.tunggu(this.waktuKena(f, g));
    const data = this.dataGerak(f, g);
    if (hasil === "kena" || hasil === "tukar" || hasil === "armor") {
      if (g === "jurus" && f.kid === "garuda") f.vx = 0;
      if (Math.abs(o.x - f.x) > 260 && !(g === "jurus" && f.kid === "bayangan")) f.x = o.x - f.hadap * 170;
      if (hasil === "armor") {
        d.kurangiHp(o, b.dmg, f);
        o.kilau = 0.9;
        d.ef.percik(o.x - o.hadap * 30, o.y + 180, "armor", f.hadap);
        d.ef.label(o.x, o.y + o.tinggi + 10, "ARMOR!", { warna: "#ffe2a8", warna2: "#c96a12", ukuran: 22 });
        if (d.angkaDamage && b.dmg) d.ef.label(o.x, o.y + o.tinggi * 0.9, `-${b.dmg}`, { warna: "#fff", warna2: "#c40000", ukuran: 28 });
        d.suara("tArmor");
      } else {
        const lawanJaga = gLawan === "tangkis" || gLawan === "rendah";
        if (lawanJaga) { o.rendah = gLawan === "rendah"; }
        d.terapkanKena(f, o, data, { dmg: b.dmg, naskah: true, counter: b.counter, level: data.level, efek: g === "jurus" ? f.k.jurus.efek : null, label: lawanJaga ? (o.rendah ? "TANGKIS SALAH!" : g === "jurus" && f.kid === "bayangan" ? "TEMBUS!" : "TANGKIS SALAH!") : null });
      }
    } else if (hasil === "ditangkis") {
      d.terapkanBlok(f, o, data, { dmg: b.dmg, naskah: true });
    } else if (hasil === "meleset") {
      d.ef.label(f.x + f.hadap * 90, f.y + 220, "MELESET", { warna: "#eeeeee", warna2: "#444", ukuran: 22 });
      if (gLawan === "sapu" || gLawan === "rendah") { o.ke("jongkok", 0.05); }
    } else if (hasil === "bentrok") {
      d.ef.percik((f.x + o.x) / 2, 170, "berat", f.hadap, 1.1);
      d.suara("tLedak");
    }
    await this.tunggu(0.25);
  }

  async akhirRonde(r, papan, F) {
    const d = this.d;
    const a = r.akhirRonde;
    const pm = a.pemenang;
    for (const p of this.pid) d.menang[this.idx(p)] = a.menang?.[p] ?? d.menang[this.idx(p)];
    if (a.alasan.startsWith("K.O.")) {
      for (const p of this.pid) {
        const f = F[p];
        if (f.hp <= 0 && !["melayang", "rebah"].includes(f.keadaan)) { f.ke("melayang", 0.04); f.diUdara = true; f.vy = 620; f.vx = -f.hadap * 300; f.y = 1; f.putar = 0; }
        if (f.hp <= 0) f.ko = true;
      }
      d.skalaWaktu = 0.3; d.tSlow = 1.1; d.kilat = 0.5; d.guncang = 14;
      d.umum(a.alasan === "K.O. ganda" ? "K.O. GANDA" : "K.O.", { maks: 1.6, gaya: "ko" }); d.umumkan("K O!"); d.suara("tKo");
      await this.tunggu(1.7 * 0.6);
    } else {
      d.umum("WAKTU HABIS", { maks: 1.5, gaya: "ko" }); d.umumkan("Waktu habis"); d.suara("gong");
      await this.tunggu(1.3);
    }
    if (pm) { F[pm].ke("menang", 0.2); F[pm].aura = 1; const o = this.pid.find((p) => p !== pm); if (F[o].keadaan !== "rebah") F[o].ke("kalah", 0.3); }
    await this.tunggu(1.4);
    const selesai = papan?.selesai || (this.pid.some((p) => (a.menang?.[p] || 0) >= 2));
    if (selesai) {
      const saya = pm === this.pid[0];
      d.umum(pm == null ? "IMBANG" : saya ? "KAMU MENANG!" : "KAMU KALAH", { maks: 3, gaya: saya ? "menang" : "ko", sub: `${d.menang[0]}–${d.menang[1]}` });
      d.suara(pm == null ? "seri" : saya ? "menangBesar" : "kalah");
      return;
    }
    d.umum(pm ? `${F[pm].nama.toUpperCase()} MENANG` : "IMBANG", { maks: 1.4, sub: `Ronde ${a.ronde}` });
    await this.tunggu(1.4);
    // ronde baru
    for (const f of d.f) { const e = f.energi, ef = { ...f.efek }; f.resetRonde(); f.energi = e; f.efek.beku = ef.beku; f.efek.bakar = 0; f.x = f.sisi ? NETRAL : -NETRAL; f.ke("intro", 0.01); }
    d.ronde = (a.ronde || d.ronde) + 1;
    d.umum(`RONDE ${d.ronde}`, { maks: 1.1, gaya: "ronde" }); d.umumkan(`Ronde ${d.ronde}`); d.suara("tRonde");
    await this.tunggu(1.3);
    d.umum("TARUNG!", { maks: 0.8, gaya: "tarung" }); d.suara("tTarung");
    for (const f of d.f) f.ke("siaga", 0.25);
    await this.tunggu(0.5);
  }
}
