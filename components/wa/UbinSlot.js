"use client";

// Ubin mahjong bergambar untuk slot "Mahjong Spin 1024" — digambar dengan SVG bergaya ubin mahjong modern:
// aksara naga 發/中 berkilau 3D, angka 八萬, lingkaran (tong) & bambu (sok) berwarna, serta ubin emas berpola.
// Indeks simbol mengikuti mesin (lib/game/slotmj.js): 0 tertinggi … 8 terendah, 9 = WILD, 10 = SCATTER.
export const WILD = 9;
export const SCATTER = 10;
export const NAMA_SIMBOL = ["Naga Hijau 發", "Naga Merah 中", "Delapan Wan 八萬", "Lima Tong 五筒", "Lima Sok 五索", "Tiga Tong 三筒", "Dua Tong 二筒", "Dua Sok 二索", "Tiga Wan 三萬"];

const FONT = '"Noto Serif CJK SC","Noto Sans CJK SC","PingFang SC","Microsoft YaHei","WenQuanYi Zen Hei",serif';

/** Gradien bersama (id unik per jenis; isi identik di semua ubin sehingga aman dipakai berulang). */
function Defs() {
  return (
    <defs>
      <linearGradient id="slg-merah" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ff8a78" /><stop offset=".45" stopColor="#e1261c" /><stop offset="1" stopColor="#8e0b0b" /></linearGradient>
      <linearGradient id="slg-hijau" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8be28f" /><stop offset=".45" stopColor="#1f9d3d" /><stop offset="1" stopColor="#0b5a1f" /></linearGradient>
      <linearGradient id="slg-biru" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8da2ff" /><stop offset=".5" stopColor="#3a45d6" /><stop offset="1" stopColor="#1b1f86" /></linearGradient>
      <linearGradient id="slg-bambu" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#0e6b2a" /><stop offset=".35" stopColor="#3fc15d" /><stop offset=".7" stopColor="#1a9a3a" /><stop offset="1" stopColor="#0a5420" /></linearGradient>
      <linearGradient id="slg-bambu-merah" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#8e0b0b" /><stop offset=".35" stopColor="#ff5a48" /><stop offset=".7" stopColor="#d41c1c" /><stop offset="1" stopColor="#7a0808" /></linearGradient>
      <radialGradient id="slg-tong-hijau" cx="38%" cy="32%" r="75%"><stop offset="0" stopColor="#9bf0a0" /><stop offset=".6" stopColor="#1f9d3d" /><stop offset="1" stopColor="#0b5a1f" /></radialGradient>
      <radialGradient id="slg-tong-merah" cx="38%" cy="32%" r="75%"><stop offset="0" stopColor="#ff9a88" /><stop offset=".6" stopColor="#e1261c" /><stop offset="1" stopColor="#8e0b0b" /></radialGradient>
      <radialGradient id="slg-tong-biru" cx="38%" cy="32%" r="75%"><stop offset="0" stopColor="#a6b6ff" /><stop offset=".6" stopColor="#3a45d6" /><stop offset="1" stopColor="#1b1f86" /></radialGradient>
      <radialGradient id="slg-koin" cx="35%" cy="30%" r="80%"><stop offset="0" stopColor="#fff2a8" /><stop offset=".55" stopColor="#f5a60b" /><stop offset="1" stopColor="#a4570a" /></radialGradient>
      <linearGradient id="slg-emas" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff3b0" /><stop offset=".5" stopColor="#f7c53a" /><stop offset="1" stopColor="#c47d0e" /></linearGradient>
    </defs>
  );
}

/** Aksara tebal berkilau: garis luar gelap + isi gradien + kilau di bagian atas. */
const Aksara = ({ x = 50, y = 82, ukuran = 82, isi, luar, miring = 0, children }) => (
  <g transform={`skewX(${miring})`} style={{ transformOrigin: "50px 56px" }}>
    <text x={x} y={y + 2} textAnchor="middle" fontSize={ukuran} fontWeight="900" fontFamily={FONT} fill={luar} stroke={luar} strokeWidth="7" strokeLinejoin="round">{children}</text>
    <text x={x} y={y} textAnchor="middle" fontSize={ukuran} fontWeight="900" fontFamily={FONT} fill={`url(#${isi})`} stroke={luar} strokeWidth="1.6" strokeLinejoin="round" paintOrder="stroke">{children}</text>
    <text x={x - 1.2} y={y - 1.6} textAnchor="middle" fontSize={ukuran} fontWeight="900" fontFamily={FONT} fill="#fff" opacity=".22">{children}</text>
  </g>
);

const Tong = ({ x, y, r = 11, warna = "merah" }) => (
  <g>
    <circle cx={x} cy={y} r={r + 1.6} fill="#0b1020" opacity=".25" />
    <circle cx={x} cy={y} r={r} fill={`url(#slg-tong-${warna})`} stroke="#0b1020" strokeWidth="1.2" />
    <circle cx={x} cy={y} r={r * 0.72} fill="none" stroke="#fff" strokeWidth={r * 0.14} opacity=".85" />
    <circle cx={x} cy={y} r={r * 0.4} fill="none" stroke="#0b1020" strokeWidth={r * 0.1} opacity=".5" />
    <circle cx={x} cy={y} r={r * 0.2} fill="#fff7d6" />
  </g>
);

const Sok = ({ x, y, tinggi = 30, lebar = 11, merah = false }) => (
  <g>
    <rect x={x - lebar / 2 + 1} y={y - tinggi / 2 + 2} width={lebar} height={tinggi} rx={lebar / 2.2} fill="#0b1020" opacity=".22" />
    <rect x={x - lebar / 2} y={y - tinggi / 2} width={lebar} height={tinggi} rx={lebar / 2.2} fill={`url(#${merah ? "slg-bambu-merah" : "slg-bambu"})`} stroke={merah ? "#5a0606" : "#06381a"} strokeWidth="1.2" />
    <line x1={x - lebar / 2} x2={x + lebar / 2} y1={y} y2={y} stroke={merah ? "#5a0606" : "#06381a"} strokeWidth="1.6" />
    <rect x={x - lebar / 2 + 2} y={y - tinggi / 2 + 3} width="2.2" height={tinggi - 6} rx="1.1" fill="#fff" opacity=".4" />
  </g>
);

function Gambar({ s }) {
  switch (s) {
    case 0: return <Aksara isi="slg-hijau" luar="#073a14" miring={-4}>發</Aksara>;
    case 1: return <Aksara isi="slg-merah" luar="#5a0606" miring={-4}>中</Aksara>;
    case 2: return (
      <g>
        <Aksara isi="slg-biru" luar="#10135a" y={52} ukuran={46}>八</Aksara>
        <Aksara isi="slg-merah" luar="#5a0606" y={96} ukuran={48}>萬</Aksara>
      </g>
    );
    case 3: return (
      <g>
        <Tong x={30} y={32} r={13} warna="hijau" /><Tong x={70} y={32} r={13} warna="biru" />
        <Tong x={50} y={56} r={13} warna="merah" />
        <Tong x={30} y={80} r={13} warna="biru" /><Tong x={70} y={80} r={13} warna="hijau" />
      </g>
    );
    case 4: return (
      <g>
        {[[32, 32], [68, 32], [32, 80], [68, 80]].map(([x, y]) => <Sok key={`${x}${y}`} x={x} y={y} tinggi={34} lebar={12} />)}
        <Sok x={50} y={56} tinggi={30} lebar={12} merah />
      </g>
    );
    case 5: return (
      <g>
        <Tong x={28} y={28} r={13} warna="hijau" /><Tong x={50} y={56} r={13} warna="merah" /><Tong x={72} y={84} r={13} warna="biru" />
      </g>
    );
    case 6: return (<g><Tong x={50} y={32} r={17} warna="biru" /><Tong x={50} y={80} r={17} warna="biru" /></g>);
    case 7: return (<g><Sok x={50} y={30} tinggi={40} lebar={15} /><Sok x={50} y={82} tinggi={40} lebar={15} /></g>);
    case 8: return (
      <g>
        <Aksara isi="slg-biru" luar="#10135a" y={52} ukuran={46}>三</Aksara>
        <Aksara isi="slg-merah" luar="#5a0606" y={96} ukuran={48}>萬</Aksara>
      </g>
    );
    case WILD: return (
      // Ubin emas berpola (bingkai biru-emas bersusun) dengan batang emas di tengah.
      <g>
        <rect x="9" y="9" width="82" height="94" rx="12" fill="url(#slg-emas)" stroke="#8a5a06" strokeWidth="2" />
        <rect x="16" y="16" width="68" height="80" rx="9" fill="none" stroke="#2e2f9e" strokeWidth="4" />
        <rect x="23" y="23" width="54" height="66" rx="7" fill="none" stroke="#2e2f9e" strokeWidth="2" opacity=".85" />
        <path d="M23 36 Q16 28 23 23 M77 36 Q84 28 77 23 M23 76 Q16 84 23 89 M77 76 Q84 84 77 89" fill="none" stroke="#2e2f9e" strokeWidth="2.2" strokeLinecap="round" />
        <rect x="31" y="31" width="38" height="50" rx="6" fill="#fff4b8" opacity=".55" />
        <path d="M36 62 Q50 50 64 62 L60 70 Q50 64 40 70 Z" fill="url(#slg-koin)" stroke="#7a4a05" strokeWidth="1.6" strokeLinejoin="round" />
        <ellipse cx="50" cy="56" rx="10" ry="4" fill="url(#slg-koin)" stroke="#7a4a05" strokeWidth="1.4" />
      </g>
    );
    case SCATTER: return (
      <g>
        <circle cx="50" cy="58" r="41" fill="#0b1020" opacity=".25" />
        <circle cx="50" cy="56" r="40" fill="url(#slg-koin)" stroke="#78350f" strokeWidth="3" />
        <circle cx="50" cy="56" r="33" fill="none" stroke="#78350f" strokeWidth="1.6" strokeDasharray="3 3" opacity=".7" />
        <circle cx="50" cy="56" r="24" fill="#b91c1c" stroke="#450a0a" strokeWidth="2" />
        <Aksara isi="slg-emas" luar="#450a0a" y={69} ukuran={36}>福</Aksara>
      </g>
    );
    default: return null;
  }
}

/** Satu ubin di papan. `sel` = [simbol, emas?]; null = sel kosong. */
export function Ubin({ sel, kelas = "", gaya }) {
  if (!sel) return <div className="sl-ubin kosong" />;
  const [s, emas] = sel;
  const jenis = s === WILD ? "wild" : s === SCATTER ? "scatter" : `s${s}`;
  return (
    <div className={`sl-ubin ${jenis}${emas ? " emas" : ""} ${kelas}`} style={gaya} data-s={s} data-emas={emas ? 1 : 0} title={s < 9 ? NAMA_SIMBOL[s] : s === WILD ? "WILD ubin emas" : "SCATTER koin emas"}>
      <svg viewBox="0 0 100 112" className="sl-gambar" aria-hidden="true"><Defs /><Gambar s={s} /></svg>
      {emas ? <i className="sl-kilau" /> : null}
    </div>
  );
}
