"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useUser } from "@/app/providers";
import { markOpenersFree, onComicDone } from "@/lib/introGate";

// Sapaan ARTA PEDIA SUPPORT tepat setelah animasi loading selesai.
// Tampil sekali per sesi supaya tidak mengganggu saat pindah-pindah halaman.
const SEEN_KEY = "artapedia_mascot_greeted";

const rupiah = (n) => `Rp${Number(n || 0).toLocaleString("id-ID")}`;

function greetingByHour(h) {
  if (h < 4) return "Masih begadang nih";
  if (h < 11) return "Selamat pagi";
  if (h < 15) return "Selamat siang";
  if (h < 18) return "Selamat sore";
  return "Selamat malam";
}

export default function MascotGreeting() {
  const { balance, ready, token } = useUser();
  const [show, setShow] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [typed, setTyped] = useState("");
  const typeRef = useRef(null);

  useEffect(() => {
    let alive = true;
    try {
      if (sessionStorage.getItem(SEEN_KEY) === "1") {
        // Sudah menyapa di sesi ini: langsung persilakan popup lain tampil.
        onComicDone(markOpenersFree);
        return undefined;
      }
    } catch {
      // sessionStorage diblokir (mode privat) — anggap belum pernah menyapa.
    }
    // Menunggu animasi loading selesai supaya sapaannya tidak tertimbun.
    const off = onComicDone(() => {
      if (!alive) return;
      try {
        sessionStorage.setItem(SEEN_KEY, "1");
      } catch {}
      setShow(true);
    });
    return () => {
      alive = false;
      off();
    };
  }, []);

  const hour = new Date().getHours();
  const lowBalance = ready && Number(balance || 0) < 2000;
  const line = !token
    ? "Halo! Aku ARTA PEDIA SUPPORT, elang penjaga web ini. Nokos murah dan cepat semua ada di sini — yuk mulai!"
    : lowBalance
    ? `Saldo kamu tinggal ${rupiah(balance)} nih. Isi dulu yuk biar nggak kehabisan pas butuh OTP!`
    : `Saldo kamu ${rupiah(balance)}, siap dipakai. Mau nokos apa hari ini?`;

  // Efek mengetik supaya terasa dia benar-benar bicara.
  useEffect(() => {
    if (!show) return undefined;
    setTyped("");
    let i = 0;
    typeRef.current = setInterval(() => {
      i += 1;
      setTyped(line.slice(0, i));
      if (i >= line.length) clearInterval(typeRef.current);
    }, 22);
    return () => clearInterval(typeRef.current);
  }, [show, line]);

  // Tutup dengan tombol Escape.
  useEffect(() => {
    if (!show) return undefined;
    const onKey = (e) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [show]);

  // Menutup sendiri sesudah kalimatnya selesai diketik.
  //
  // Ini sapaan, bukan pertanyaan — tidak ada yang perlu diputuskan, jadi tidak
  // pantas menuntut ketukan. Dan yang lebih penting: popup Tutorial &
  // Informasi MENUNGGU sapaan ini ditutup. Selama ia hanya bisa ditutup dengan
  // ketukan, siapa pun yang membiarkannya tidak akan pernah melihat syarat,
  // ketentuan, dan aturan refundnya — padahal itu yang dipegang kalau nanti
  // ada sengketa.
  useEffect(() => {
    if (!show || leaving) return undefined;
    // Panjang kalimat x kecepatan ketik, plus jeda baca.
    const t = setTimeout(close, line.length * 22 + 4500);
    return () => clearTimeout(t);
  }, [show, leaving, line]);

  function close() {
    setLeaving(true);
    setTimeout(() => {
      setShow(false);
      // Giliran InfoModal & popup bonus.
      markOpenersFree();
    }, 260);
  }

  if (!show) return null;

  return (
    <div
      className={`mg-root ${leaving ? "mg-out" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label="Sapaan ARTA PEDIA SUPPORT"
    >
      <button className="mg-backdrop" onClick={close} aria-label="Tutup sapaan" />

      <div className="mg-card halftone">
        <span className="mg-rays" aria-hidden="true" />

        <div className="mg-body">
          <div className="mg-figure">
            <span className="mg-halo" aria-hidden="true" />
            <span className="mg-shadow" aria-hidden="true" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/maskot.webp" alt="ARTA PEDIA SUPPORT" className="mg-img" width="484" height="700" />
          </div>

          <div className="mg-text">
            <p className="mg-hi">
              {greetingByHour(hour)}
              {ready && token ? "!" : " di Arta Pedia!"}
            </p>
            <p className="mg-name">
              ARTA PEDIA SUPPORT
              <span className="mg-badge">online</span>
              <span className="comic-burst">maskot</span>
            </p>

            <div className="mg-bubble">
              <p>
                {typed}
                <span className="mg-caret" aria-hidden="true" />
              </p>
            </div>

            <div className="mg-actions">
              <Link href="/otp" onClick={close} className="mg-btn mg-btn-main">
                Beli Nokos
              </Link>
              <Link href="/deposit" onClick={close} className="mg-btn mg-btn-alt">
                Isi Saldo
              </Link>
              <button onClick={close} className="mg-btn mg-btn-ghost">
                Nanti saja
              </button>
            </div>
          </div>
        </div>

        <button onClick={close} className="mg-close" aria-label="Tutup">
          ✕
        </button>
      </div>
    </div>
  );
}
