"use client";

// Ubin mahjong bergambar untuk slot "Mahjong Spin 1024" — digambar dengan SVG (bambu, lingkaran, aksara,
// naga hijau/merah/putih) agar terlihat seperti ubin mahjong sungguhan, bukan sekadar huruf.
// Indeks simbol mengikuti mesin (lib/game/slotmj.js): 0 tertinggi … 8 terendah, 9 = WILD, 10 = SCATTER.
export const WILD = 9;
export const SCATTER = 10;
export const NAMA_SIMBOL = ["Naga Hijau 發", "Naga Merah 中", "Naga Putih 白", "Delapan Wan 八萬", "Sembilan Tong 九筒", "Lima Sok 五索", "Tiga Wan 三萬", "Dua Tong 二筒", "Dua Sok 二索"];

const FONT = '"Noto Serif CJK SC","Noto Sans CJK SC","PingFang SC","Microsoft YaHei","WenQuanYi Zen Hei",serif';
const HIJAU = "#15803d", MERAH = "#dc2626", BIRU = "#1d4ed8", HITAM = "#1f2937";

const Aksara = ({ x = 50, y = 80, ukuran = 74, warna, garis = "#00000055", children }) => (
  <text x={x} y={y} textAnchor="middle" fontSize={ukuran} fontWeight="900" fontFamily={FONT} fill={warna} stroke={garis} strokeWidth="1.2" paintOrder="stroke">{children}</text>
);

const Tong = ({ x, y, r = 11, warna }) => (
  <g>
    <circle cx={x} cy={y} r={r} fill={warna} stroke="#0f172a" strokeWidth="1.4" />
    <circle cx={x} cy={y} r={r * 0.68} fill="none" stroke="#fff" strokeWidth={r * 0.16} opacity=".9" />
    <circle cx={x} cy={y} r={r * 0.3} fill="#fef3c7" stroke="#0f172a" strokeWidth="0.8" />
  </g>
);

const Sok = ({ x, y, tinggi = 28, warna = "#16a34a", lebar = 12 }) => (
  <g>
    <rect x={x - lebar / 2} y={y - tinggi / 2} width={lebar} height={tinggi} rx={lebar / 2.4} fill={warna} stroke="#052e16" strokeWidth="1.3" />
    <rect x={x - lebar / 2 + 2} y={y - tinggi / 2 + 3} width={2.4} height={tinggi - 6} rx="1.2" fill="#fff" opacity=".35" />
    <line x1={x - lebar / 2} x2={x + lebar / 2} y1={y} y2={y} stroke="#052e16" strokeWidth="1.6" />
    <line x1={x - lebar / 2} x2={x + lebar / 2} y1={y - tinggi / 4} y2={y - tinggi / 4} stroke="#052e16" strokeWidth="1" opacity=".55" />
    <line x1={x - lebar / 2} x2={x + lebar / 2} y1={y + tinggi / 4} y2={y + tinggi / 4} stroke="#052e16" strokeWidth="1" opacity=".55" />
  </g>
);

function Gambar({ s }) {
  switch (s) {
    case 0: return <Aksara warna={HIJAU} ukuran={78} y={82}>發</Aksara>;
    case 1: return <Aksara warna={MERAH} ukuran={78} y={82}>中</Aksara>;
    case 2: return (
      <g>
        <rect x="22" y="20" width="56" height="72" rx="6" fill="none" stroke={BIRU} strokeWidth="6" />
        <rect x="31" y="29" width="38" height="54" rx="3" fill="none" stroke={BIRU} strokeWidth="2.5" />
      </g>
    );
    case 3: return (<g><Aksara warna={HITAM} ukuran={44} y={50}>八</Aksara><Aksara warna={MERAH} ukuran={46} y={95}>萬</Aksara></g>);
    case 4: return (
      <g>
        {[26, 50, 74].map((x) => [["#16a34a", 27], ["#dc2626", 56], ["#1d4ed8", 85]].map(([c, y]) => <Tong key={`${x}${y}`} x={x} y={y} r={11} warna={c} />))}
      </g>
    );
    case 5: return (
      <g>
        {[[30, 32], [70, 32], [30, 80], [70, 80]].map(([x, y]) => <Sok key={`${x}${y}`} x={x} y={y} tinggi={34} lebar={13} />)}
        <Sok x={50} y={56} tinggi={34} lebar={13} warna="#dc2626" />
      </g>
    );
    case 6: return (<g><Aksara warna={HITAM} ukuran={44} y={50}>三</Aksara><Aksara warna={MERAH} ukuran={46} y={95}>萬</Aksara></g>);
    case 7: return (<g><Tong x={50} y={32} r={19} warna="#16a34a" /><Tong x={50} y={80} r={19} warna="#1d4ed8" /></g>);
    case 8: return (<g><Sok x={50} y={30} tinggi={40} lebar={16} /><Sok x={50} y={82} tinggi={40} lebar={16} /></g>);
    case WILD: return (
      <g>
        <defs>
          <linearGradient id="sl-pita" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#ef4444" /><stop offset="1" stopColor="#991b1b" /></linearGradient>
        </defs>
        <Aksara warna="#7f1d1d" garis="#fde047" ukuran={70} y={66}>龍</Aksara>
        <rect x="8" y="76" width="84" height="22" rx="5" fill="url(#sl-pita)" stroke="#450a0a" strokeWidth="1.6" />
        <text x="50" y="92" textAnchor="middle" fontSize="17" fontWeight="900" fill="#fde047" stroke="#450a0a" strokeWidth="1" paintOrder="stroke" letterSpacing="2">WILD</text>
      </g>
    );
    case SCATTER: return (
      <g>
        <defs>
          <radialGradient id="sl-koin" cx="35%" cy="30%" r="80%"><stop offset="0" stopColor="#fef08a" /><stop offset=".6" stopColor="#f59e0b" /><stop offset="1" stopColor="#b45309" /></radialGradient>
        </defs>
        <circle cx="50" cy="56" r="40" fill="url(#sl-koin)" stroke="#78350f" strokeWidth="3" />
        <circle cx="50" cy="56" r="33" fill="none" stroke="#78350f" strokeWidth="1.6" strokeDasharray="3 3" opacity=".7" />
        <circle cx="50" cy="56" r="24" fill="#b91c1c" stroke="#450a0a" strokeWidth="2" />
        <Aksara warna="#fde047" ukuran={38} y={69} garis="#450a0a">福</Aksara>
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
    <div className={`sl-ubin ${jenis}${emas ? " emas" : ""} ${kelas}`} style={gaya} data-s={s} data-emas={emas ? 1 : 0} title={s < 9 ? NAMA_SIMBOL[s] : s === WILD ? "WILD naga emas" : "SCATTER koin emas"}>
      <svg viewBox="0 0 100 112" className="sl-gambar" aria-hidden="true"><Gambar s={s} /></svg>
      {emas ? <i className="sl-kilau" /> : null}
    </div>
  );
}
