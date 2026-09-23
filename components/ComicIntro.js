"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { markComicDone, onIntroDone } from "@/lib/introGate";

// Komik pembuka dua panel, tampil sesudah animasi loading.
//
//   Panel 1 — seorang pembeli kebingungan: "Beli nokos murah di mana sih?"
//   Panel 2 — maskot elang menjawab: "Di ARTA PEDIA."
//
// Sekali per sesi peramban. Komik yang muncul lagi tiap pindah halaman berubah
// dari sambutan jadi gangguan, dan orang akan belajar menekan Lewati tanpa
// membacanya.
//
// Selalu memanggil markComicDone — saat selesai, saat dilewati, DAN saat
// memutuskan tidak tampil. Sapaan maskot menunggu tanda itu; kalau komiknya
// diam saja, sapaannya tidak akan pernah muncul seumur sesi itu.

const KEY = "artapedia_comic_seen";
const JEDA_OTOMATIS = 4200; // panel 1 berganti sendiri kalau tidak disentuh

export default function ComicIntro() {
  const [tampil, setTampil] = useState(false);
  const [panel, setPanel] = useState(0);
  const [keluar, setKeluar] = useState(false);
  const timerRef = useRef(null);

  const tutup = useCallback(() => {
    clearTimeout(timerRef.current);
    setKeluar(true);
    // Ditandai setelah animasi keluarnya selesai, supaya sapaan maskot tidak
    // menimpa komik yang masih memudar.
    setTimeout(() => {
      setTampil(false);
      markComicDone();
    }, 420);
  }, []);

  useEffect(() => {
    let sudah = false;
    try {
      sudah = sessionStorage.getItem(KEY) === "1";
    } catch {
      // sessionStorage diblokir (mode privat) — anggap belum pernah lihat.
    }
    if (sudah) {
      onIntroDone(markComicDone);
      return undefined;
    }

    const off = onIntroDone(() => {
      try {
        sessionStorage.setItem(KEY, "1");
      } catch {}
      setTampil(true);
    });
    return off;
  }, []);

  // Panel pertama berganti sendiri; panel kedua menunggu orangnya menekan.
  useEffect(() => {
    if (!tampil || panel !== 0) return undefined;
    timerRef.current = setTimeout(() => setPanel(1), JEDA_OTOMATIS);
    return () => clearTimeout(timerRef.current);
  }, [tampil, panel]);

  // Esc melewati, seperti dialog mana pun.
  useEffect(() => {
    if (!tampil) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") tutup();
      if (e.key === "Enter" || e.key === " ") lanjut();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function lanjut() {
    clearTimeout(timerRef.current);
    if (panel === 0) setPanel(1);
    else tutup();
  }

  if (!tampil) return null;

  return (
    <div className={`comic-intro ${keluar ? "is-out" : ""}`} role="dialog" aria-label="Komik pembuka Arta Pedia">
      <div className="comic-intro-sheet">
        {/* ── Panel 1 ───────────────────────────────────────────── */}
        <figure className={`ci-panel ${panel === 0 ? "is-on" : "is-off"}`} aria-hidden={panel !== 0}>
          <span className="ci-halftone" />
          <span className="ci-rays" />

          <div className="ci-bubble ci-bubble-left">
            <p>Beli nokos murah di mana sih…?</p>
            <span className="ci-tail" />
          </div>

          <Orang />

          <span className="ci-ono ci-ono-q">?!</span>
          <span className="ci-no">1</span>
        </figure>

        {/* ── Panel 2 ───────────────────────────────────────────── */}
        <figure className={`ci-panel ci-panel-2 ${panel === 1 ? "is-on" : "is-off"}`} aria-hidden={panel !== 1}>
          <span className="ci-halftone" />
          <span className="ci-burst" />

          {/* Balon ditaruh di KIRI walau yang bicara elang di kanan: kalau
              di kanan, balonnya menutupi kepala elangnya dan yang terlihat
              cuma badan tanpa muka. Ekornya yang menunjuk ke kanan, ke arah
              pembicaranya. */}
          <div className="ci-bubble ci-bubble-left ci-bubble-say">
            <p>
              Di <b>ARTA PEDIA!</b> Murah, buka 24 jam, OTP masuk otomatis.
            </p>
            <span className="ci-tail ci-tail-right" />
          </div>

          {/* <img> biasa, bukan next/image, dan memakai berkas kecilnya.
              Lewat pengoptimal gambar, permintaannya harus ditranskode dulu di
              server — dan di pemunculan pertama itu belum selesai saat panelnya
              tampil, jadi elangnya hilang tepat di empat detik yang paling
              menentukan kesan pertama. maskot-sm.webp 19 KB, lebih dari cukup
              untuk lebar 170-an piksel di sini. */}
          <div className="ci-elang">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/maskot-sm.webp" alt="" width={528} height={750} className="ci-elang-img" />
          </div>

          <span className="ci-ono ci-ono-pow">POW!</span>
          <span className="ci-no">2</span>
        </figure>

        {/* ── Kendali ───────────────────────────────────────────── */}
        <div className="ci-bar">
          <button type="button" className="ci-skip" onClick={tutup}>
            Lewati
          </button>

          <div className="ci-dots" aria-hidden="true">
            <span className={panel === 0 ? "on" : ""} />
            <span className={panel === 1 ? "on" : ""} />
          </div>

          <button type="button" className="ci-next" onClick={lanjut}>
            {panel === 0 ? "Lanjut →" : "Mulai Belanja →"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Digambar sebagai SVG, bukan gambar raster: karakternya cuma dipakai sekali
// di satu tempat, dan sebuah PNG untuk itu menambah berkas yang harus diunduh
// semua pengunjung hanya untuk empat detik pertama.
function Orang() {
  return (
    <svg className="ci-orang" viewBox="0 0 220 260" role="img" aria-label="Pembeli yang kebingungan">
      <ellipse cx="110" cy="248" rx="70" ry="9" fill="rgb(11 22 44 / .18)" />

      {/* badan */}
      <path d="M45 260 Q48 182 110 176 Q172 182 175 260 Z" fill="#2E86FF" stroke="#0B162C" strokeWidth="5" strokeLinejoin="round" />
      <path d="M110 176 L96 214 L110 226 L124 214 Z" fill="#E8EFFC" stroke="#0B162C" strokeWidth="4" strokeLinejoin="round" />

      {/* leher */}
      <path d="M96 156 h28 v24 h-28 z" fill="#F0B98B" stroke="#0B162C" strokeWidth="5" strokeLinejoin="round" />

      {/* kepala */}
      <rect x="60" y="56" width="100" height="106" rx="42" fill="#F7C79B" stroke="#0B162C" strokeWidth="5" />

      {/* rambut */}
      <path d="M58 100 Q54 44 110 44 Q166 44 162 100 Q150 76 110 76 Q70 76 58 100 Z" fill="#101A30" stroke="#0B162C" strokeWidth="5" strokeLinejoin="round" />

      {/* mata bingung */}
      <circle cx="90" cy="112" r="7.5" fill="#0B162C" />
      <circle cx="132" cy="112" r="7.5" fill="#0B162C" />
      <circle cx="92.5" cy="109.5" r="2.4" fill="#fff" />
      <circle cx="134.5" cy="109.5" r="2.4" fill="#fff" />

      {/* alis naik sebelah */}
      <path d="M80 96 q10 -7 20 -2" stroke="#0B162C" strokeWidth="4.5" fill="none" strokeLinecap="round" />
      <path d="M122 92 q10 -3 20 4" stroke="#0B162C" strokeWidth="4.5" fill="none" strokeLinecap="round" />

      {/* mulut miring */}
      <path d="M96 138 q14 8 30 -2" stroke="#0B162C" strokeWidth="4.5" fill="none" strokeLinecap="round" />

      {/* tangan memegang HP */}
      <path d="M166 208 q24 -16 18 -44" stroke="#0B162C" strokeWidth="5" fill="none" strokeLinecap="round" />
      <rect x="168" y="146" width="34" height="52" rx="7" fill="#101A30" stroke="#0B162C" strokeWidth="5" />
      <rect x="174" y="153" width="22" height="38" rx="3" fill="#6EB0FF" />
    </svg>
  );
}
