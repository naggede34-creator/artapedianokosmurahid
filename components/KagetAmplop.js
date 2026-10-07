"use client";

import "./kaget.css";

const WARNA = ["#f43f5e", "#f59e0b", "#10b981", "#3b82f6", "#a855f7", "#eab308"];

/** Amplop merah ala angpao. terbuka = tutupnya membuka & kartu emas naik; goyang = mengundang diketuk. */
export function KagetAmplop({ terbuka = false, goyang = false, kecil = false, teks = "" }) {
  return (
    <div className={`kg-amplop ${kecil ? "kg-kecil" : ""} ${terbuka ? "kg-terbuka" : ""} ${goyang && !terbuka ? "kg-goyang" : ""}`} aria-hidden="true">
      <svg viewBox="0 0 168 124">
        <defs>
          <linearGradient id="kgBadan" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#fb7185" /><stop offset="1" stopColor="#be123c" /></linearGradient>
          <linearGradient id="kgTutup" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#f43f5e" /><stop offset="1" stopColor="#9f1239" /></linearGradient>
          <linearGradient id="kgEmas" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#fde68a" /><stop offset=".6" stopColor="#f59e0b" /><stop offset="1" stopColor="#b45309" /></linearGradient>
        </defs>
        <g className="kg-kartu"><rect x="26" y="20" width="116" height="76" rx="8" fill="#fff7ed" stroke="#fcd34d" strokeWidth="2" />
          <text x="84" y="64" textAnchor="middle" fontSize="15" fontWeight="900" fill="#be123c">{teks || "KAGET!"}</text></g>
        <rect x="4" y="22" width="160" height="98" rx="12" fill="url(#kgBadan)" />
        <path d="M4 34 L84 84 L164 34" fill="none" stroke="#881337" strokeOpacity=".35" strokeWidth="2" />
        <path d="M4 120 L66 70 M164 120 L102 70" stroke="#881337" strokeOpacity=".3" strokeWidth="2" />
        <g className="kg-tutup"><path d="M4 22 Q4 10 16 10 L152 10 Q164 10 164 22 L84 80 Z" fill="url(#kgTutup)" /></g>
        <circle cx="84" cy="62" r="15" fill="url(#kgEmas)" stroke="#92400e" strokeOpacity=".4" strokeWidth="2" />
        <text x="84" y="68" textAnchor="middle" fontSize="17" fontWeight="900" fill="#7c2d12">Rp</text>
      </svg>
    </div>
  );
}

/** Hujan konfeti sekali jalan — pasang dengan key baru untuk memutarnya lagi. */
export function KagetKonfeti({ jumlah = 36 }) {
  return (
    <div className="kg-konfeti" aria-hidden="true">
      {Array.from({ length: jumlah }).map((_, i) => (
        <i key={i} style={{ left: `${(i * 97) % 100}%`, background: WARNA[i % WARNA.length], animationDelay: `${(i % 12) * 0.08}s`, animationDuration: `${2 + (i % 5) * 0.35}s`, width: 6 + (i % 3) * 2 }} />
      ))}
    </div>
  );
}
