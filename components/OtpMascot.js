// Maskot hero: karakter bulat lucu yang lagi pegang HP dengan kode OTP di layarnya.
// Sengaja digambar manual pakai bentuk-bentuk sederhana (bukan gambar impor) supaya
// ringan dan gampang diubah warnanya kalau brand berubah nanti.

export default function OtpMascot() {
  return (
    <div className="float-slow relative mx-auto w-full max-w-[280px]">
      <div className="absolute -inset-8 -z-10 rounded-full bg-amber/12 blur-3xl" />

      <svg viewBox="0 0 300 335" className="w-full drop-shadow-[0_18px_30px_rgba(33,28,22,0.18)]">
        <defs>
          <clipPath id="mascotScreen">
            <rect x="99" y="159" width="102" height="147" rx="14" />
          </clipPath>
        </defs>

        {/* bayangan di lantai */}
        <ellipse cx="150" cy="320" rx="72" ry="10" fill="#211C16" opacity="0.08" />

        {/* kilau dekoratif */}
        <path
          d="M40 50 L42.5 57.5 L50 60 L42.5 62.5 L40 70 L37.5 62.5 L30 60 L37.5 57.5 Z"
          fill="#D9A441"
          className="twinkle"
        />
        <path
          d="M258 77 L260 83 L266 85 L260 87 L258 93 L256 87 L250 85 L256 83 Z"
          fill="#D9A441"
          className="twinkle twinkle-delay-1"
        />
        <circle cx="248" cy="228" r="4" fill="#D9A441" className="twinkle twinkle-delay-2" />

        {/* badan bulat */}
        <rect x="60" y="25" width="180" height="255" rx="90" fill="#C1592D" />
        <ellipse
          cx="105"
          cy="70"
          rx="30"
          ry="20"
          fill="#FFFFFF"
          opacity="0.14"
          transform="rotate(-18 105 70)"
        />

        {/* lengan (di belakang HP) */}
        <rect x="48" y="188" width="60" height="24" rx="12" fill="#93401C" transform="rotate(-20 48 200)" />
        <rect x="192" y="188" width="60" height="24" rx="12" fill="#93401C" transform="rotate(20 252 200)" />

        {/* wajah */}
        <ellipse cx="120" cy="100" rx="13" ry="15" fill="#FFFDF9" />
        <circle cx="123" cy="103" r="6.5" fill="#211C16" />
        <circle cx="126" cy="99" r="2" fill="#FFFDF9" />
        <ellipse cx="180" cy="100" rx="13" ry="15" fill="#FFFDF9" />
        <circle cx="177" cy="103" r="6.5" fill="#211C16" />
        <circle cx="174" cy="99" r="2" fill="#FFFDF9" />
        <circle cx="98" cy="128" r="11" fill="#F5E7E7" opacity="0.85" />
        <circle cx="202" cy="128" r="11" fill="#F5E7E7" opacity="0.85" />
        <path d="M138 128 Q150 139 162 128" stroke="#211C16" strokeWidth="4" strokeLinecap="round" fill="none" />

        {/* HP yang dipegang */}
        <rect x="90" y="150" width="120" height="165" rx="22" fill="#211C16" />
        <rect x="99" y="159" width="102" height="147" rx="14" fill="#FFFDF9" />
        <g clipPath="url(#mascotScreen)">
          <circle className="signal-pulse" cx="112" cy="178" r="4" fill="#2F6E58" />
          <text x="121" y="182" fontSize="9" fill="#1F4E3E" fontWeight="600">
            Kode masuk
          </text>
          <text x="150" y="206" textAnchor="middle" fontSize="8.5" fill="#7C7264" fontFamily="ui-monospace, monospace">
            +62 812•••9931
          </text>
          <line x1="107" y1="217" x2="193" y2="217" stroke="#E3D9C4" strokeWidth="1" />
          <text
            x="150"
            y="253"
            textAnchor="middle"
            fontSize="25"
            fontWeight="700"
            letterSpacing="3"
            fill="#1F4E3E"
            fontFamily="ui-monospace, monospace"
          >
            482 913
          </text>
          <text x="150" y="273" textAnchor="middle" fontSize="8" fill="#7C7264">
            kode diterima otomatis
          </text>
        </g>

        {/* tangan di tepi HP, seolah lagi megang */}
        <circle cx="100" cy="207" r="15" fill="#93401C" />
        <circle cx="200" cy="207" r="15" fill="#93401C" />

        {/* badge sukses di pojok HP */}
        <circle cx="213" cy="150" r="16" fill="#2F6E58" stroke="#FFFDF9" strokeWidth="3" />
        <path d="M205 150 l5.5 5.5 L221 143" stroke="#FFFDF9" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    </div>
  );
}
