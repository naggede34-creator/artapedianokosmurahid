"use client";

import { useEffect, useState } from "react";
import { PESAN_BAN, gayaBan } from "@/lib/ipHash";

const hrefAman = (v) => (/^(\/(?!\/)[A-Za-z0-9\-._~/?=&%#:+@!$()*,;]*|https:\/\/[^\s"'<>]+)$/.test(String(v || "")) ? v : "");

/**
 * Tampilan layar akun di-ban. `cfg` = tampilan kustom dari admin (kosong/aktif=false → bawaan: hanya satu kalimat).
 * `tertanam` = dipakai untuk pratinjau di dasbor admin (tidak menutupi layar).
 * HTML kustom dirender di iframe ber-sandbox TANPA skrip: aman dari XSS, dan tidak bisa membuka dasbor/menavigasi halaman induk.
 */
export function LayarBanView({ cfg, tertanam = false }) {
  const aktif = !!(cfg && cfg.aktif);
  const c = aktif ? cfg : {};
  const g = gayaBan(cfg);
  const judul = aktif ? (String(c.judul || "").trim() || (c.teks || c.html ? "" : PESAN_BAN)) : PESAN_BAN;
  const href = hrefAman(c.tombolHref);
  const tinggi = Math.max(80, Math.min(900, Math.floor(Number(c.htmlTinggi) || 320)));
  const pos = tertanam ? { position: "relative", minHeight: 420, borderRadius: 16 } : { position: "fixed", inset: 0, zIndex: 2147483000 };
  return (
    <main
      role="alert"
      data-testid={tertanam ? "layar-ban-pratinjau" : "layar-ban"}
      style={{ ...pos, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 20px", textAlign: "center", color: g.teks, background: g.latar, overflowY: "auto" }}
    >
      {c.gambar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={c.gambar} alt="" data-testid="ban-gambar" style={{ maxWidth: "min(420px,90%)", maxHeight: 300, borderRadius: 18, objectFit: "contain" }} />
      ) : c.html ? null : (
        <div style={{ fontSize: 64, lineHeight: 1 }} aria-hidden="true">🚫</div>
      )}
      {judul && (
        <h1 data-testid="ban-judul" style={{ margin: "20px 0 0", maxWidth: 560, fontSize: "clamp(20px, 5vw, 30px)", lineHeight: 1.35, fontWeight: 800, letterSpacing: ".02em", color: g.judul, textTransform: aktif ? "none" : "uppercase" }}>{judul}</h1>
      )}
      {c.teks && <p data-testid="ban-teks" style={{ margin: "14px 0 0", maxWidth: 560, fontSize: 15, lineHeight: 1.6, whiteSpace: "pre-line" }}>{c.teks}</p>}
      {c.html && <iframe data-testid="ban-html" sandbox="" srcDoc={c.html} title="Informasi" style={{ marginTop: 18, width: "min(640px,100%)", height: tinggi, border: 0, borderRadius: 14, background: "transparent" }} />}
      {href && c.tombolTeks && (
        <a data-testid="ban-tombol" href={href} style={{ display: "inline-block", marginTop: 22, padding: "12px 22px", borderRadius: 12, background: g.judul, color: "#111", fontWeight: 800, textDecoration: "none" }}>{c.tombolTeks}</a>
      )}
    </main>
  );
}

// Layar penuh untuk akun yang di-ban. Tanpa dasbor/navigasi; tampilan (judul, foto, HTML, tombol, latar) diatur admin.
export default function LayarBan() {
  const [cfg, setCfg] = useState(null);
  useEffect(() => {
    const lama = document.title;
    document.title = "Arta Pedia ID";
    document.body.style.overflow = "hidden";
    let batal = false;
    fetch("/api/ban-tampilan", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null).then((j) => { if (!batal) setCfg(j || { aktif: false }); });
    return () => { batal = true; document.title = lama; document.body.style.overflow = ""; };
  }, []);
  // Sebelum konfigurasi terbaca: latar polos (tanpa kedipan teks bawaan lalu berganti).
  if (!cfg) return <div style={{ position: "fixed", inset: 0, zIndex: 2147483000, background: "#0b0b10" }} />;
  return <LayarBanView cfg={cfg} />;
}
