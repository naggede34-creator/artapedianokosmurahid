"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TEMA, bacaTema, simpanTema, pasangTema, hexKeRgb } from "@/lib/tema";
import { GAYA, SKIN, bacaPilihan, simpanGaya, simpanSkin, pasangGaya, pasangSkin } from "@/lib/gaya";

export const dynamic = "force-dynamic";

export default function TampilanPage() {
  const [gaya, setGaya] = useState("komik");
  const [skinPil, setSkinPil] = useState("klasik");
  const [aktif, setAktif] = useState("default");
  const [warna, setWarna] = useState("");
  const [siap, setSiap] = useState(false);

  useEffect(() => {
    const p = bacaPilihan();
    setGaya(p.gaya || document.documentElement.getAttribute("data-gaya") || "komik");
    setSkinPil(p.skin || document.documentElement.getAttribute("data-skin") || "klasik");
    const t = bacaTema();
    setAktif(t.id);
    setWarna(t.warna);
    setSiap(true);
  }, []);

  function pilihGaya(id) {
    setGaya(id);
    // "komik" = bawaan: pilihan manual disimpan sebagai "komik" supaya event musiman tidak menimpanya.
    simpanGaya(id);
    pasangGaya(id);
  }
  function pakaiSkin(id) {
    setSkinPil(id); simpanSkin(id); pasangSkin(id);
  }

  function pilih(id) {
    setAktif(id);
    // Warna pilihan sendiri dilepas saat memilih tema jadi: kalau tidak, ia
    // tetap menimpa tema barunya dan pengguna mengira temanya rusak.
    setWarna("");
    simpanTema(id, "");
  }

  function pilihWarna(hex) {
    setWarna(hex);
    simpanTema(aktif, hex);
  }

  return (
    <div className="mx-auto max-w-content px-4 py-6 sm:px-5 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="judul-timbul font-display text-2xl font-black tracking-tight text-ink sm:text-3xl">
            🎨 TAMPILAN
          </h1>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted">
            Pilih tema warna yang kamu suka. Perubahannya langsung terlihat dan tersimpan di
            perangkat ini.
          </p>
        </div>
        <Link href="/dashboard" className="btn-ghost shrink-0 px-4 py-2.5 text-sm">← Beranda</Link>
      </div>

      <h2 className="mt-6 font-display text-lg font-black text-ink">Gaya tampilan</h2>
      <p className="mt-1 text-xs text-muted">Bentuk kartu, tombol, dan latar. Bisa dipadukan dengan tema warna di bawah. Bawaan: Komik 3D.</p>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" data-testid="pilih-gaya" role="radiogroup" aria-label="Gaya tampilan">
        {GAYA.map((g) => {
          const dipilih = siap && gaya === g.id;
          return (
            <button key={g.id} type="button" role="radio" aria-checked={dipilih} onClick={() => pilihGaya(g.id)} data-testid={`gaya-${g.id}`}
              className={`rounded-2xl border-2 p-2 text-left transition-all ${dipilih ? "border-amber bg-amber-soft" : "border-ink/10 bg-surface hover:-translate-y-0.5"}`}>
              <div className="gpv" data-g={g.id} aria-hidden="true"><i /><b>Tombol</b></div>
              <p className="mt-2 flex items-center justify-between px-1 text-sm font-black text-ink">{g.nama}{dipilih && <span className="text-base">✓</span>}</p>
              <p className="px-1 pb-1 text-[11px] leading-snug text-muted">{g.ringkas}</p>
            </button>
          );
        })}
      </div>
      {gaya === "neon" && <p className="mt-2 text-[11px] text-muted">Neon selalu bermode gelap, apa pun pilihan terang/gelapmu.</p>}

      <h2 className="mt-7 font-display text-lg font-black text-ink">Skin maskot</h2>
      <p className="mt-1 text-xs text-muted">Kostum elang ARTA PEDIA — semuanya gratis, tinggal pilih. Skin musiman otomatis terpasang untuk semua orang selama event berlangsung.</p>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" data-testid="daftar-skin">
        {SKIN.map((k) => {
          const dipakai = skinPil === k.id || (k.id === "klasik" && !skinPil);
          return (
            <div key={k.id} className={`rounded-2xl border-2 p-3 text-center ${dipakai ? "border-amber bg-amber-soft" : "border-ink/10 bg-surface"}`} data-testid={`skin-${k.id}`}>
              <div className="relative mx-auto h-20 w-16">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/maskot-sm.webp" alt="" className="h-full w-full object-contain object-bottom" style={{ filter: k.filter || "none" }} />
                {k.aksesori && <span className="absolute -top-1 left-1/2 -translate-x-1/2 -rotate-6 text-2xl drop-shadow">{k.aksesori}</span>}
              </div>
              <p className="mt-1 text-xs font-black text-ink">{k.ikon} {k.nama}</p>
              <p className="min-h-[1.6em] text-[10px] leading-tight text-muted">{k.ket}{k.musim ? " · musiman" : ""}</p>
              {dipakai ? <span className="mt-1.5 inline-block rounded-full bg-success px-3 py-1 text-[10px] font-black text-white">Dipakai ✓</span>
                : <button type="button" onClick={() => pakaiSkin(k.id)} data-testid={`pakai-${k.id}`} className="btn-3d mt-1.5 rounded-lg bg-amber px-3 py-1 text-[11px] font-black text-white">Pakai</button>}
            </div>
          );
        })}
      </div>

      <h2 className="mt-7 font-display text-lg font-black text-ink">Tema jadi</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TEMA.map((t) => {
          const dipilih = siap && aktif === t.id && !warna;
          return (
            <button
              key={t.id}
              onClick={() => pilih(t.id)}
              className={`balok-3d rounded-2xl border-2 p-4 text-left transition-all ${
                dipilih ? "border-amber bg-amber-soft" : "border-ink/10 bg-surface hover:-translate-y-0.5"
              }`}
            >
              <div className="flex items-center gap-2">
                {t.warna.map((w) => (
                  <span
                    key={w}
                    className="h-7 w-7 rounded-lg border-2 border-ink/15"
                    style={{ background: w }}
                  />
                ))}
                {dipilih && <span className="ml-auto text-lg">✓</span>}
              </div>
              <p className="mt-2.5 text-sm font-black text-ink">{t.nama}</p>
              <p className="text-[11px] text-muted">{t.ringkas}</p>
            </button>
          );
        })}
      </div>

      <h2 className="mt-7 font-display text-lg font-black text-ink">Warna sendiri</h2>
      <div className="mt-3 rounded-2xl border-2 border-ink/10 bg-surface p-5 shadow-soft">
        <p className="text-xs leading-relaxed text-muted">
          Pilih satu warna, sisanya dihitung sendiri: versi mudanya untuk latar, versi tuanya
          untuk teks supaya tetap terbaca.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            type="color"
            value={warna || "#ED5A0F"}
            onChange={(e) => pilihWarna(e.target.value)}
            className="h-14 w-20 cursor-pointer rounded-xl border-2 border-ink/15 bg-surface2 p-1"
            aria-label="Pilih warna"
          />
          <div className="min-w-0 flex-1">
            <input
              value={warna}
              onChange={(e) => {
                const v = e.target.value;
                setWarna(v);
                // Hanya dipasang kalau hex-nya sudah lengkap — memasang warna
                // separuh diketik membuat layarnya berkedip tiap huruf.
                if (hexKeRgb(v)) simpanTema(aktif, v);
              }}
              placeholder="#ED5A0F"
              className="field w-full py-2.5 font-mono text-sm"
            />
            <p className="mt-1 text-[11px] text-muted">
              {warna && !hexKeRgb(warna) ? "Belum jadi warna yang sah — tulis seperti #ED5A0F." : "Kosongkan untuk kembali ke warna temanya."}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {["#ED5A0F", "#E94E3E", "#16915E", "#0E91A8", "#8248CD", "#D62A3C", "#485670", "#C2410C"].map((w) => (
            <button
              key={w}
              onClick={() => pilihWarna(w)}
              className="h-10 w-10 rounded-xl border-2 border-ink/15 transition-transform hover:scale-110"
              style={{ background: w }}
              aria-label={`Warna ${w}`}
            />
          ))}
        </div>

        {warna && (
          <button
            onClick={() => { setWarna(""); simpanTema(aktif, ""); }}
            className="btn-3d mt-4 w-full rounded-xl border border-line bg-surface2 py-2.5 text-xs font-bold text-ink"
          >
            ↺ Kembali ke warna tema
          </button>
        )}
      </div>

      {/* Pratinjau: komponen asli, bukan gambar.
          Contoh yang digambar terpisah akan berbeda dari tampilan aslinya
          begitu salah satunya diubah, dan yang salah justru yang dilihat
          orang sebelum memilih. */}
      <h2 className="mt-7 font-display text-lg font-black text-ink">Contoh</h2>
      <div className="mt-3 space-y-3 rounded-2xl border-2 border-ink/10 bg-surface p-5 shadow-soft">
        <div className="flex flex-wrap gap-2">
          <button className="btn-3d rounded-xl bg-amber px-5 py-2.5 text-sm font-black text-white">Tombol Utama</button>
          <button className="btn-3d rounded-xl border-2 border-blue bg-blue-soft px-5 py-2.5 text-sm font-black text-blue-bright">
            Tombol Kedua
          </button>
          <button className="btn-ghost px-5 py-2.5 text-sm">Tombol Biasa</button>
        </div>
        <div className="rounded-2xl border-2 border-amber/40 bg-amber-soft p-3.5">
          <p className="text-sm font-black text-amber-bright">Contoh panel berwarna</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
            Beginilah tampilan kotak pemberitahuan dengan tema yang kamu pilih.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-success px-3 py-1 text-[11px] font-black text-white">ON</span>
          <span className="rounded-full bg-rose px-3 py-1 text-[11px] font-black text-white">OFF</span>
          <span className="rounded-full bg-amber px-3 py-1 text-[11px] font-black text-white">BARU</span>
        </div>
        <p className="text-[11px] leading-relaxed text-muted">
          Warna hijau dan merah sengaja <b>tidak ikut berubah</b>: keduanya dipakai untuk
          menyatakan berhasil dan gagal, dan artinya hilang kalau warnanya bebas diganti.
        </p>
      </div>
    </div>
  );
}
