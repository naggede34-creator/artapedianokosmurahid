// Maskot hero: karakter anime chibi lucu yang lagi pegang HP dengan kode OTP di layarnya.
// Sengaja digambar manual pakai bentuk-bentuk SVG (bukan gambar impor) supaya
// ringan dan gampang diubah warnanya kalau brand berubah nanti.
// Palet: biru (rambut & hoodie), hitam (outline & aksen), putih (kulit & layar), pink (blush & aksen), silver (highlight).

export default function OtpMascot() {
  return (
    <div className="float-slow relative mx-auto w-full max-w-[280px]">
      <div className="absolute -inset-8 -z-10 rounded-full bg-amber/14 blur-3xl" />
      <div className="mascot-platform absolute bottom-2 left-1/2 -z-10 h-16 w-[220px] -translate-x-1/2 rounded-full" aria-hidden="true" />

      <svg viewBox="0 0 300 335" className="w-full drop-shadow-[0_18px_30px_rgba(13,17,23,0.18)]">
        <defs>
          <clipPath id="mascotScreen">
            <rect x="99" y="159" width="102" height="147" rx="14" />
          </clipPath>
          <linearGradient id="hairGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1D2A4A" />
            <stop offset="100%" stopColor="#0D1117" />
          </linearGradient>
        </defs>

        {/* bayangan di lantai */}
        <ellipse cx="150" cy="320" rx="72" ry="10" fill="#0D1117" opacity="0.08" />

        {/* kilau dekoratif: pink & silver */}
        <path
          d="M40 50 L42.5 57.5 L50 60 L42.5 62.5 L40 70 L37.5 62.5 L30 60 L37.5 57.5 Z"
          fill="#EC4899"
          className="twinkle"
        />
        <path
          d="M258 77 L260 83 L266 85 L260 87 L258 93 L256 87 L250 85 L256 83 Z"
          fill="#AEB8C7"
          className="twinkle twinkle-delay-1"
        />
        <circle cx="248" cy="228" r="4" fill="#EC4899" className="twinkle twinkle-delay-2" />

        {/* hoodie / badan */}
        <rect x="58" y="150" width="184" height="165" rx="72" fill="#2F6FED" />
        <path d="M58 210 Q150 246 242 210 L242 315 Q150 340 58 315 Z" fill="#1D4ED8" opacity="0.55" />
        {/* resleting hoodie */}
        <line x1="150" y1="176" x2="150" y2="300" stroke="#AEB8C7" strokeWidth="2.5" strokeDasharray="1 6" strokeLinecap="round" />
        {/* tali hoodie */}
        <line x1="132" y1="180" x2="128" y2="214" stroke="#0D1117" strokeWidth="3" strokeLinecap="round" />
        <line x1="168" y1="180" x2="172" y2="214" stroke="#0D1117" strokeWidth="3" strokeLinecap="round" />
        <circle cx="128" cy="217" r="4.5" fill="#EC4899" />
        <circle cx="172" cy="217" r="4.5" fill="#EC4899" />

        {/* lengan (di belakang HP) */}
        <rect x="46" y="188" width="60" height="26" rx="13" fill="#1D4ED8" transform="rotate(-20 46 201)" />
        <rect x="194" y="188" width="60" height="26" rx="13" fill="#1D4ED8" transform="rotate(20 254 201)" />

        {/* rambut belakang (di belakang kepala) */}
        <path
          d="M150 24 C104 24 76 58 76 100 C76 122 82 138 90 150 C86 118 96 96 108 90 C104 108 106 124 112 136 C150 150 150 90 150 90 C150 90 150 150 188 136 C194 124 196 108 192 90 C204 96 214 118 210 150 C218 138 224 122 224 100 C224 58 196 24 150 24 Z"
          fill="url(#hairGrad)"
        />

        {/* wajah (kulit) */}
        <ellipse cx="150" cy="108" rx="62" ry="58" fill="#FFF4EC" />

        {/* pipi blush pink */}
        <ellipse cx="110" cy="128" rx="12" ry="7" fill="#EC4899" opacity="0.45" />
        <ellipse cx="190" cy="128" rx="12" ry="7" fill="#EC4899" opacity="0.45" />

        {/* mata anime besar - kiri */}
        <ellipse cx="122" cy="112" rx="16" ry="19" fill="#FFFFFF" />
        <ellipse cx="123.5" cy="115" rx="11" ry="13.5" fill="#2F6FED" />
        <ellipse cx="123.5" cy="115" rx="11" ry="13.5" fill="none" stroke="#0D1117" strokeWidth="2" />
        <circle cx="127" cy="109" r="3.4" fill="#FFFFFF" />
        <circle cx="120" cy="120" r="1.8" fill="#FFFFFF" opacity="0.85" />
        <path d="M107 100 Q122 90 138 99" stroke="#0D1117" strokeWidth="2.6" strokeLinecap="round" fill="none" />

        {/* mata anime besar - kanan */}
        <ellipse cx="178" cy="112" rx="16" ry="19" fill="#FFFFFF" />
        <ellipse cx="176.5" cy="115" rx="11" ry="13.5" fill="#2F6FED" />
        <ellipse cx="176.5" cy="115" rx="11" ry="13.5" fill="none" stroke="#0D1117" strokeWidth="2" />
        <circle cx="180" cy="109" r="3.4" fill="#FFFFFF" />
        <circle cx="173" cy="120" r="1.8" fill="#FFFFFF" opacity="0.85" />
        <path d="M162 99 Q178 90 193 100" stroke="#0D1117" strokeWidth="2.6" strokeLinecap="round" fill="none" />

        {/* hidung & mulut kecil */}
        <path d="M148 128 Q150 131 152 128" stroke="#E8A98C" strokeWidth="1.6" strokeLinecap="round" fill="none" />
        <path d="M139 140 Q150 148 161 140" stroke="#0D1117" strokeWidth="2.6" strokeLinecap="round" fill="none" />

        {/* poni rambut depan */}
        <path
          d="M88 96 C86 66 112 44 150 44 C188 44 214 66 212 96 C204 78 192 88 188 78 C182 92 172 74 166 84 C160 72 150 88 150 88 C150 88 140 72 134 84 C128 74 118 92 112 78 C108 88 96 78 88 96 Z"
          fill="url(#hairGrad)"
        />
        {/* highlight silver di rambut */}
        <path d="M100 68 Q108 54 124 50" stroke="#AEB8C7" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.8" />

        {/* jambul kecil di atas */}
        <path d="M146 30 Q150 12 158 28 Q152 24 146 30 Z" fill="url(#hairGrad)" />

        {/* HP yang dipegang */}
        <rect x="90" y="150" width="120" height="165" rx="22" fill="#0D1117" />
        <rect x="99" y="159" width="102" height="147" rx="14" fill="#FFFFFF" />
        <g clipPath="url(#mascotScreen)">
          <circle className="signal-pulse" cx="112" cy="178" r="4" fill="#EC4899" />
          <text x="121" y="182" fontSize="9" fill="#1D4ED8" fontWeight="600">
            Kode masuk
          </text>
          <text x="150" y="206" textAnchor="middle" fontSize="8.5" fill="#6B7684" fontFamily="ui-monospace, monospace">
            +62 812•••9931
          </text>
          <line x1="107" y1="217" x2="193" y2="217" stroke="#D6DDE9" strokeWidth="1" />
          <text
            x="150"
            y="253"
            textAnchor="middle"
            fontSize="25"
            fontWeight="700"
            letterSpacing="3"
            fill="#1D4ED8"
            fontFamily="ui-monospace, monospace"
          >
            482 913
          </text>
          <text x="150" y="273" textAnchor="middle" fontSize="8" fill="#6B7684">
            kode diterima otomatis
          </text>
        </g>

        {/* tangan mungil di tepi HP, seolah lagi megang */}
        <circle cx="100" cy="207" r="15" fill="#1D4ED8" />
        <circle cx="200" cy="207" r="15" fill="#1D4ED8" />
        <circle cx="100" cy="207" r="15" fill="none" stroke="#0D1117" strokeWidth="1.4" opacity="0.25" />
        <circle cx="200" cy="207" r="15" fill="none" stroke="#0D1117" strokeWidth="1.4" opacity="0.25" />

        {/* badge sukses di pojok HP */}
        <circle cx="213" cy="150" r="16" fill="#EC4899" stroke="#FFFFFF" strokeWidth="3" />
        <path d="M205 150 l5.5 5.5 L221 143" stroke="#FFFFFF" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    </div>
  );
}
