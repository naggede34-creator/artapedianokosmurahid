"use client";

import { useBrand } from "@/app/providers";

import { useEffect, useState } from "react";
import { PESAN_BAN, gayaBan } from "@/lib/ipHash";

function fmtSisa(ms) {
  const d = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(d / 86400), j = Math.floor((d % 86400) / 3600), m = Math.floor((d % 3600) / 60), dt = d % 60;
  const p = (n) => String(n).padStart(2, "0");
  return `${h ? `${h} hari ` : ""}${p(j)}:${p(m)}:${p(dt)}`;
}
// Detik demi detik menuju `sampai` (epoch ms); 0 = tidak ada hitung mundur.
function useSisa(sampai) {
  const [kini, setKini] = useState(() => Date.now());
  useEffect(() => {
    if (!(sampai > 0)) return;
    const t = setInterval(() => setKini(Date.now()), 1000);
    return () => clearInterval(t);
  }, [sampai]);
  return Math.max(0, sampai - kini);
}

const hrefAman = (v) => (/^(\/(?!\/)[A-Za-z0-9\-._~/?=&%#:+@!$()*,;]*|https:\/\/[^\s"'<>]+)$/.test(String(v || "")) ? v : "");

/**
 * Tampilan layar akun di-ban. `cfg` = tampilan kustom dari admin (kosong/aktif=false → bawaan: hanya satu kalimat).
 * `tertanam` = dipakai untuk pratinjau di dasbor admin (tidak menutupi layar).
 * HTML kustom dirender di iframe ber-sandbox TANPA skrip: aman dari XSS, dan tidak bisa membuka dasbor/menavigasi halaman induk.
 */
export function LayarBanView({ cfg, tertanam = false, sampai = 0 }) {
  const brand = useBrand();
  const sisa = useSisa(sampai);
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
      {sampai > 0 && (
        <p data-testid="ban-hitung" style={{ margin: "16px 0 0", fontSize: 14, fontWeight: 700, opacity: 0.9 }}>
          ⏳ Blokir berakhir dalam <span style={{ fontVariantNumeric: "tabular-nums", fontSize: 22, display: "block", marginTop: 4 }}>{fmtSisa(sisa)}</span>
        </p>
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
  const brand = useBrand();
  const [cfg, setCfg] = useState(null);
  const sampai = cfg?.sampai || 0;
  // Hitung mundur habis → minta server membuka ban, lalu muat ulang bila sudah terbuka.
  useEffect(() => {
    if (!(sampai > 0)) return;
    const tunggu = Math.max(1000, sampai - Date.now() + 1500);
    const t = setTimeout(async () => {
      try {
        const k = localStorage.getItem("artapedia_token") || "";
        const r = await fetch(`/api/ban-tampilan?t=${encodeURIComponent(k)}&c=1`, { cache: "no-store" }).then((x) => x.json());
        if (r.dibuka) window.location.reload();
      } catch {}
    }, Math.min(tunggu, 2147483000));
    return () => clearTimeout(t);
  }, [sampai]);
  useEffect(() => {
    const lama = document.title;
    document.title = brand.namaLengkap;
    document.body.style.overflow = "hidden";
    let batal = false;
    let k = "";
    try { k = localStorage.getItem("artapedia_token") || ""; } catch {}
    fetch(`/api/ban-tampilan${k ? `?t=${encodeURIComponent(k)}` : ""}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null).then((j) => { if (batal) return; if (j?.dibuka) { window.location.reload(); return; } setCfg(j || { aktif: false }); });
    return () => { batal = true; document.title = lama; document.body.style.overflow = ""; };
  }, []);
  // Sebelum konfigurasi terbaca: latar polos (tanpa kedipan teks bawaan lalu berganti).
  if (!cfg) return <div style={{ position: "fixed", inset: 0, zIndex: 2147483000, background: "#0b0b10" }} />;
  return <LayarBanView cfg={cfg} sampai={cfg.sampai || 0} />;
}
