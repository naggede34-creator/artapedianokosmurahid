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

    let batal = false;
    let lepas = null;

    // Pengaturan ditanyakan DULU, baru komiknya dipasang. Kalau dibalik —
    // komik tampil lalu dimatikan setelah jawabannya datang — pengunjung
    // sempat melihatnya sekejap dan itu terbaca sebagai halaman yang rusak,
    // bukan sebagai fitur yang memang dimatikan.
    fetch("/api/settings/public")
      .then((r) => r.json())
      .then((d) => {
        if (batal) return;
        if (d?.comicIntroEnabled === false) {
          // Dimatikan admin: komiknya dilewati, dan "selesai" tetap ditandai
          // supaya halaman di belakangnya tidak menunggu sesuatu yang tidak
          // akan pernah muncul.
          lepas = onIntroDone(markComicDone);
          return;
        }
        lepas = onIntroDone(() => {
          try {
            sessionStorage.setItem(KEY, "1");
          } catch {}
          setTampil(true);
        });
      })
      .catch(() => {
        // Pengaturan tidak terbaca: komiknya tetap tampil. Ini fitur tampilan,
        // bukan jalur uang — gagal ke arah "tetap jalan seperti biasa".
        if (batal) return;
        lepas = onIntroDone(() => {
          try {
            sessionStorage.setItem(KEY, "1");
          } catch {}
          setTampil(true);
        });
      });

    return () => {
      batal = true;
      if (lepas) lepas();
    };
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

// Digambar sebagai SVG, bukan gambar raster: karakternya cuma dipakai di komik
// ini, dan sebuah PNG untuknya menambah berkas yang harus diunduh SEMUA
// pengunjung hanya untuk beberapa detik pertama — justru di detik-detik ketika
// mereka paling mudah menutup tab.
//
// Sosoknya seluruh badan, bukan cuma kepala dan bahu: pose berpikir dengan
// tangan di dagu itu yang menyampaikan "bingung" tanpa perlu satu kata pun,
// dan pose tidak terbaca kalau tangannya tidak ikut kelihatan.
function Orang({ mood = "bingung" }) {
  const kesal = mood === "kesal";
  const kaos = kesal ? "#E8502F" : "#2E6FD8";
  const kaosGelap = kesal ? "#C33A1D" : "#1F529F";
  const kulit = "#F3C193";
  const tinta = "#0B162C";

  return (
    <svg className="ci-orang" viewBox="0 0 260 560" role="img" aria-label={kesal ? "Pembeli yang kesal" : "Pembeli yang kebingungan"}>
      <ellipse cx="130" cy="548" rx="86" ry="11" fill="rgb(11 22 44 / .18)" />

      {/* ── KAKI ── */}
      <path d="M96 318 L92 470 L88 512 h44 l6 -44 L146 330 Z" fill="#26364F" stroke={tinta} strokeWidth="5" strokeLinejoin="round" />
      <path d="M146 330 L152 470 L156 512 h44 l-4 -46 L176 318 Z" fill="#2C3E5C" stroke={tinta} strokeWidth="5" strokeLinejoin="round" />
      {/* saku kargo */}
      <rect x="96" y="372" width="30" height="40" rx="5" fill="#1D2C44" stroke={tinta} strokeWidth="4" />
      <rect x="166" y="372" width="30" height="40" rx="5" fill="#1D2C44" stroke={tinta} strokeWidth="4" />

      {/* ── SEPATU ── */}
      <path d="M84 512 h50 v20 q0 8 -10 8 H74 q-8 0 -8 -8 q0 -12 18 -20 Z" fill="#FFFFFF" stroke={tinta} strokeWidth="5" strokeLinejoin="round" />
      <path d="M204 512 h-50 v20 q0 8 10 8 h50 q8 0 8 -8 q0 -12 -18 -20 Z" fill="#FFFFFF" stroke={tinta} strokeWidth="5" strokeLinejoin="round" />
      <path d="M84 512 h24 l-10 20 H74 Z" fill={kaos} />
      <path d="M204 512 h-24 l10 20 h24 Z" fill={kaos} />

      {/* ── IKAT PINGGANG ── */}
      <rect x="92" y="306" width="92" height="20" rx="4" fill="#8B5A2B" stroke={tinta} strokeWidth="5" />
      <rect x="128" y="306" width="18" height="20" fill="#C08A4A" stroke={tinta} strokeWidth="4" />

      {/* ── KAOS ── */}
      <path d="M88 200 q-6 -34 22 -46 l20 -8 h20 l20 8 q28 12 22 46 l-8 116 q-54 14 -88 0 Z"
            fill={kaos} stroke={tinta} strokeWidth="5" strokeLinejoin="round" />
      {/* lipatan bawah kaos, biar tidak terbaca seperti papan rata */}
      <path d="M96 292 q34 12 72 0" stroke={kaosGelap} strokeWidth="5" fill="none" strokeLinecap="round" />
      {/* kerah */}
      <path d="M112 152 q18 18 36 0" fill="none" stroke={tinta} strokeWidth="5" strokeLinecap="round" />

      {/* Tulisan dada. Ukurannya dipilih supaya berakhir sebelum x=166 — di
          sebelah kanan itu lengan yang diangkat lewat, dan tulisan yang
          tertutup lengan terbaca seperti kesalahan gambar, bukan sebagai pose. */}
      <text x="132" y="222" textAnchor="middle" fontSize="18" fontWeight="900" fill="#FFFFFF"
            stroke={tinta} strokeWidth="5" paintOrder="stroke" fontFamily="system-ui, sans-serif">ARTA</text>
      <text x="132" y="244" textAnchor="middle" fontSize="18" fontWeight="900" fill="#FFFFFF"
            stroke={tinta} strokeWidth="5" paintOrder="stroke" fontFamily="system-ui, sans-serif">PEDIA</text>

      {/* ── LENGAN KIRI (menggantung, tangan masuk saku) ── */}
      <path d="M92 196 q-16 44 -10 86 q2 16 16 16 q12 0 14 -14" fill={kaos} stroke={tinta} strokeWidth="5" strokeLinejoin="round" />

      {/* ── LENGAN KANAN: siku keluar, lengan bawah naik ke dagu ──
          Inilah pose berpikirnya. Sikunya sengaja dibuang jauh ke kanan supaya
          lengan bawahnya naik di LUAR tulisan dada. */}
      <path d="M162 190 q40 14 42 56 q2 14 -11 16 q-13 2 -15 -11 q-5 -30 -26 -43 Z"
            fill={kaos} stroke={tinta} strokeWidth="5" strokeLinejoin="round" />
      {/* Lengan bawah digambar dua kali: garis tebal gelap sebagai tinta luar,
          lalu garis kulit yang lebih tipis di atasnya. Stroke tidak punya
          outline sendiri, jadi begini cara memberinya. */}
      <path d="M200 250 q-12 -66 -46 -100" stroke={tinta} strokeWidth="32" fill="none" strokeLinecap="round" />
      <path d="M200 250 q-12 -66 -46 -100" stroke={kulit} strokeWidth="22" fill="none" strokeLinecap="round" />
      {/* gelang manik di pergelangan */}
      <path d="M176 176 q12 6 12 16" stroke="#C0622A" strokeWidth="7" fill="none" strokeLinecap="round" strokeDasharray="2 5" />
      {/* kepalan tangan di bawah dagu */}
      <circle cx="152" cy="148" r="15" fill={kulit} stroke={tinta} strokeWidth="5" />

      {/* ── LEHER ── */}
      <path d="M114 128 h32 v30 h-32 z" fill={kulit} stroke={tinta} strokeWidth="5" strokeLinejoin="round" />
      <path d="M114 138 q16 12 32 0" fill="rgb(11 22 44 / .2)" stroke="none" />

      {/* kalung */}
      <path d="M116 158 q14 16 28 0" fill="none" stroke="#D9DEE8" strokeWidth="3.5" />
      <circle cx="130" cy="170" r="4" fill="#D9DEE8" stroke={tinta} strokeWidth="2" />

      {/* ── KEPALA ── */}
      <rect x="86" y="36" width="88" height="100" rx="38" fill={kulit} stroke={tinta} strokeWidth="5" />

      {/* rambut berjambul */}
      <path d="M84 84 Q78 26 130 22 Q182 26 176 84 Q170 62 156 58 L166 40 L140 52 L146 30
               L124 48 L118 28 L104 52 L92 44 Z"
            fill="#161F36" stroke={tinta} strokeWidth="5" strokeLinejoin="round" />

      {kesal ? (
        <>
          <path d="M104 84 q10 -6 20 0" stroke={tinta} strokeWidth="6" fill="none" strokeLinecap="round" />
          <path d="M136 84 q10 -6 20 0" stroke={tinta} strokeWidth="6" fill="none" strokeLinecap="round" />
          <path d="M102 68 q12 4 22 10" stroke={tinta} strokeWidth="5" fill="none" strokeLinecap="round" />
          <path d="M158 68 q-12 4 -22 10" stroke={tinta} strokeWidth="5" fill="none" strokeLinecap="round" />
          <path d="M116 116 q14 -12 28 0" stroke={tinta} strokeWidth="4.5" fill="none" strokeLinecap="round" />
          <path d="M164 44 l8 8 M172 44 l-8 8" stroke="#E11D48" strokeWidth="4" strokeLinecap="round" />
        </>
      ) : (
        <>
          {/* mata biru, satu alis terangkat — raut bertanya-tanya */}
          <ellipse cx="112" cy="84" rx="7.5" ry="8.5" fill="#2E6FD8" />
          <ellipse cx="148" cy="84" rx="7.5" ry="8.5" fill="#2E6FD8" />
          <circle cx="112" cy="84" r="3.6" fill={tinta} />
          <circle cx="148" cy="84" r="3.6" fill={tinta} />
          <circle cx="114.5" cy="81" r="2.2" fill="#fff" />
          <circle cx="150.5" cy="81" r="2.2" fill="#fff" />
          <path d="M100 64 q12 -8 24 -2" stroke={tinta} strokeWidth="5" fill="none" strokeLinecap="round" />
          <path d="M138 58 q12 -2 22 8" stroke={tinta} strokeWidth="5" fill="none" strokeLinecap="round" />
          {/* mulut kecil mengerucut — sedang berpikir, bukan tersenyum */}
          <path d="M124 116 q8 6 16 0" stroke={tinta} strokeWidth="4.5" fill="none" strokeLinecap="round" />
          {/* setetes keringat */}
          <path d="M176 62 q6 10 0 14 q-6 -4 0 -14 Z" fill="#8FC7FF" stroke={tinta} strokeWidth="2.5" />
        </>
      )}

      {/* Jari telunjuk menempel di dagu. Satu garis ini yang mengubah
          "tangan kebetulan ada di dekat wajah" jadi "sedang berpikir". */}
      <path d="M146 136 q-6 -8 -12 -8" stroke={tinta} strokeWidth="6" fill="none" strokeLinecap="round" />
    </svg>
  );
}

