"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { markComicDone, onIntroDone } from "@/lib/introGate";

// Komik pembuka empat panel, PENUH LAYAR, tampil sesudah animasi loading.
//
//   1 — pembeli kebingungan: "Beli nokos murah di mana sih?"
//   2 — masalahnya diperjelas: yang murah gagal, yang aman mahal
//   3 — maskot elang menjawab: "Di ARTA PEDIA!"
//   4 — penutup: apa yang didapat, lalu ajakan mulai belanja
//
// Sekali per sesi peramban. Komik yang muncul lagi tiap pindah halaman berubah
// dari sambutan jadi gangguan, dan orang akan belajar menekan Lewati tanpa
// membacanya.
//
// Selalu memanggil markComicDone — saat selesai, saat dilewati, DAN saat
// memutuskan tidak tampil. Sapaan maskot menunggu tanda itu; kalau komiknya
// diam saja, sapaannya tidak akan pernah muncul seumur sesi itu.

const KEY = "artapedia_comic_seen";

// Panel yang berisi banyak teks diberi waktu baca lebih panjang. Angka yang
// sama untuk semua panel membuat panel pendek terasa lambat dan panel panjang
// terasa terpotong.
//
// Totalnya sengaja dijaga di bawah 10 detik. Komik ini muncul SESUDAH loader,
// jadi yang dihitung pengunjung adalah jumlah keduanya — dan yang datang dari
// iklan tidak menunggu setengah menit untuk melihat satu harga pun. Panel
// terakhir menunggu ditekan, jadi yang memang mau membaca tidak dikejar.
const JEDA = [3000, 3200, 3600, 0]; // 0 = menunggu ditekan

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

  const lanjut = useCallback(() => {
    clearTimeout(timerRef.current);
    setPanel((p) => {
      if (p >= JEDA.length - 1) {
        tutup();
        return p;
      }
      return p + 1;
    });
  }, [tutup]);

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

  // Panel berganti sendiri kecuali yang terakhir, yang menunggu ditekan.
  useEffect(() => {
    if (!tampil) return undefined;
    const jeda = JEDA[panel];
    if (!jeda) return undefined;
    timerRef.current = setTimeout(() => setPanel((p) => Math.min(p + 1, JEDA.length - 1)), jeda);
    return () => clearTimeout(timerRef.current);
  }, [tampil, panel]);

  // Selama komik terbuka, halaman di belakangnya tidak boleh ikut tergulir.
  useEffect(() => {
    if (!tampil) return undefined;
    const sebelumnya = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = sebelumnya;
    };
  }, [tampil]);

  useEffect(() => {
    if (!tampil) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") tutup();
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowRight") {
        e.preventDefault();
        lanjut();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tampil, tutup, lanjut]);

  if (!tampil) return null;

  const terakhir = panel === JEDA.length - 1;

  return (
    <div className={`comic-intro ${keluar ? "is-out" : ""}`} role="dialog" aria-label="Komik pembuka Arta Pedia">
      {/* Seluruh panel bisa ditekan untuk lanjut — di layar sentuh itu yang
          pertama dicoba orang, jauh sebelum mencari tombolnya. */}
      <div className="comic-intro-sheet" onClick={lanjut}>
        {/* ── Panel 1: bingung ──────────────────────────────────── */}
        <figure className={`ci-panel ci-panel-1 ${panel === 0 ? "is-on" : "is-off"}`} aria-hidden={panel !== 0}>
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

        {/* ── Panel 2: masalahnya ───────────────────────────────── */}
        <figure className={`ci-panel ci-panel-2 ${panel === 1 ? "is-on" : "is-off"}`} aria-hidden={panel !== 1}>
          <span className="ci-halftone" />
          <span className="ci-rays ci-rays-fast" />

          <div className="ci-bubble ci-bubble-left ci-bubble-wide">
            <p>
              Yang murah <b>OTP-nya nggak masuk</b>… yang aman <b>mahal banget</b>!
            </p>
            <span className="ci-tail" />
          </div>

          <Orang mood="kesal" />

          <span className="ci-ono ci-ono-zonk">ZONK!</span>
          <span className="ci-no">2</span>
        </figure>

        {/* ── Panel 3: maskot menjawab ──────────────────────────── */}
        <figure className={`ci-panel ci-panel-3 ${panel === 2 ? "is-on" : "is-off"}`} aria-hidden={panel !== 2}>
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
              tampil, jadi elangnya hilang tepat di detik-detik yang paling
              menentukan kesan pertama. */}
          <div className="ci-elang">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/maskot-sm.webp" alt="" width={528} height={750} className="ci-elang-img" />
          </div>

          <span className="ci-ono ci-ono-pow">POW!</span>
          <span className="ci-no">3</span>
        </figure>

        {/* ── Panel 4: penutup ──────────────────────────────────── */}
        <figure className={`ci-panel ci-panel-4 ${panel === 3 ? "is-on" : "is-off"}`} aria-hidden={panel !== 3}>
          <span className="ci-halftone" />
          <span className="ci-burst ci-burst-gold" />

          <div className="ci-elang ci-elang-kecil">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/maskot-sm.webp" alt="" width={528} height={750} className="ci-elang-img" />
          </div>

          <div className="ci-kartu">
            <p className="ci-kartu-judul">Kenapa di sini?</p>
            <ul className="ci-kartu-list">
              <li>⚡ OTP masuk otomatis, hitungan detik</li>
              <li>💸 Gagal? Saldo balik sendiri</li>
              <li>🕘 Buka 24 jam, QRIS semua e-wallet</li>
              <li>🏆 Belanja terbanyak dapat hadiah mingguan</li>
            </ul>
          </div>

          <span className="ci-ono ci-ono-yes">LET&apos;S GO!</span>
          <span className="ci-no">4</span>
        </figure>

        {/* ── Kendali ───────────────────────────────────────────── */}
        <div className="ci-bar" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="ci-skip" onClick={tutup}>
            Lewati
          </button>

          <div className="ci-dots" aria-hidden="true">
            {JEDA.map((_, i) => (
              <span key={i} className={panel === i ? "on" : ""} />
            ))}
          </div>

          <button type="button" className="ci-next" onClick={lanjut}>
            {terakhir ? "Mulai Belanja →" : "Lanjut →"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Digambar sebagai SVG, bukan gambar raster: karakternya cuma dipakai di
// komik ini, dan sebuah PNG untuknya menambah berkas yang harus diunduh semua
// pengunjung hanya untuk beberapa detik pertama.
function Orang({ mood = "bingung" }) {
  const kesal = mood === "kesal";
  return (
    <svg className="ci-orang" viewBox="0 0 220 260" role="img" aria-label={kesal ? "Pembeli yang kesal" : "Pembeli yang kebingungan"}>
      <ellipse cx="110" cy="248" rx="70" ry="9" fill="rgb(11 22 44 / .18)" />

      {/* badan */}
      <path d="M45 260 Q48 182 110 176 Q172 182 175 260 Z" fill={kesal ? "#FF6B6B" : "#2E86FF"} stroke="#0B162C" strokeWidth="5" strokeLinejoin="round" />
      <path d="M110 176 L96 214 L110 226 L124 214 Z" fill="#E8EFFC" stroke="#0B162C" strokeWidth="4" strokeLinejoin="round" />

      {/* leher */}
      <path d="M96 156 h28 v24 h-28 z" fill="#F0B98B" stroke="#0B162C" strokeWidth="5" strokeLinejoin="round" />

      {/* kepala */}
      <rect x="60" y="56" width="100" height="106" rx="42" fill="#F7C79B" stroke="#0B162C" strokeWidth="5" />

      {/* rambut */}
      <path d="M58 100 Q54 44 110 44 Q166 44 162 100 Q150 76 110 76 Q70 76 58 100 Z" fill="#101A30" stroke="#0B162C" strokeWidth="5" strokeLinejoin="round" />

      {kesal ? (
        <>
          {/* mata memicing */}
          <path d="M80 112 q10 -6 20 0" stroke="#0B162C" strokeWidth="6" fill="none" strokeLinecap="round" />
          <path d="M122 112 q10 -6 20 0" stroke="#0B162C" strokeWidth="6" fill="none" strokeLinecap="round" />
          {/* alis menukik */}
          <path d="M78 96 q12 4 22 10" stroke="#0B162C" strokeWidth="5" fill="none" strokeLinecap="round" />
          <path d="M142 96 q-12 4 -22 10" stroke="#0B162C" strokeWidth="5" fill="none" strokeLinecap="round" />
          {/* mulut melengkung ke bawah */}
          <path d="M94 142 q16 -12 32 0" stroke="#0B162C" strokeWidth="4.5" fill="none" strokeLinecap="round" />
          {/* urat kesal */}
          <path d="M150 62 l8 8 M158 62 l-8 8" stroke="#E11D48" strokeWidth="4" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="90" cy="112" r="7.5" fill="#0B162C" />
          <circle cx="132" cy="112" r="7.5" fill="#0B162C" />
          <circle cx="92.5" cy="109.5" r="2.4" fill="#fff" />
          <circle cx="134.5" cy="109.5" r="2.4" fill="#fff" />
          <path d="M80 96 q10 -7 20 -2" stroke="#0B162C" strokeWidth="4.5" fill="none" strokeLinecap="round" />
          <path d="M122 92 q10 -3 20 4" stroke="#0B162C" strokeWidth="4.5" fill="none" strokeLinecap="round" />
          <path d="M96 138 q14 8 30 -2" stroke="#0B162C" strokeWidth="4.5" fill="none" strokeLinecap="round" />
        </>
      )}

      {/* tangan memegang HP */}
      <path d="M166 208 q24 -16 18 -44" stroke="#0B162C" strokeWidth="5" fill="none" strokeLinecap="round" />
      <rect x="168" y="146" width="34" height="52" rx="7" fill="#101A30" stroke="#0B162C" strokeWidth="5" />
      <rect x="174" y="153" width="22" height="38" rx="3" fill={kesal ? "#FF9AA2" : "#6EB0FF"} />
    </svg>
  );
}
