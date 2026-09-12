/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}"
  ],
  theme: {
    extend: {
      colors: {
        // Warm paper base — bukan biru-abu generik.
        bg: "#F5F1E8",
        surface: "#FFFDF9",
        surface2: "#EFE7D8",
        line: "#E3D9C4",
        ink: "#211C16",
        muted: "#7C7264",

        // "amber" -> clay terracotta jadi warna brand utama.
        amber: {
          DEFAULT: "#C1592D",
          soft: "#FBEADD",
          bright: "#93401C"
        },
        // "teal" -> pine hijau tua, dipakai untuk status sukses/aktif.
        teal: {
          DEFAULT: "#2F6E58",
          soft: "#E3EEE6",
          bright: "#1F4E3E"
        },
        // "rose" -> berry keunguan-merah tua untuk warning/bahaya.
        rose: {
          DEFAULT: "#A23E4C",
          soft: "#F5E7E7",
          bright: "#7C2E39"
        },
        // Aksen tambahan untuk highlight & ilustrasi kecil.
        ochre: {
          DEFAULT: "#D9A441",
          soft: "#FBF2DE"
        }
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"]
      },
      fontSize: {
        "display-lg": ["3.25rem", { lineHeight: "1.04", letterSpacing: "-0.03em" }],
        "display-md": ["2.5rem", { lineHeight: "1.08", letterSpacing: "-0.025em" }],
        "display-sm": ["1.75rem", { lineHeight: "1.15", letterSpacing: "-0.015em" }]
      },
      maxWidth: {
        content: "1160px"
      },
      boxShadow: {
        soft: "0 1px 2px rgba(33,28,22,0.05), 0 10px 28px -14px rgba(33,28,22,0.16)",
        lift: "0 18px 38px -16px rgba(33,28,22,0.28)",
        glow: "0 0 0 1px rgba(193,89,45,0.12), 0 12px 30px -12px rgba(193,89,45,0.35)"
      },
      backgroundImage: {
        grain:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E\")",
        dotgrid:
          "radial-gradient(circle, rgba(33,28,22,0.09) 1px, transparent 1px)"
      },
      backgroundSize: {
        dotgrid: "18px 18px"
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" }
        },
        floatSlow: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" }
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" }
        },
        expandDown: {
          "0%": { opacity: "0", transform: "translateY(-6px) scaleY(0.96)" },
          "100%": { opacity: "1", transform: "translateY(0) scaleY(1)" }
        }
      },
      animation: {
        "fade-up": "fadeUp 0.6s cubic-bezier(0.22,1,0.36,1) both",
        "scale-in": "scaleIn 0.35s cubic-bezier(0.22,1,0.36,1) both",
        "float-slow": "floatSlow 5s ease-in-out infinite",
        shimmer: "shimmer 2.2s linear infinite",
        "expand-down": "expandDown 0.22s cubic-bezier(0.22,1,0.36,1) both"
      }
    }
  },
  plugins: []
};
