/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}"
  ],
  theme: {
    extend: {
      colors: {
        // Base silver-blue-putih — dasar netral terang.
        bg: "#EEF2F9",
        surface: "#FFFFFF",
        surface2: "#E6EBF4",
        line: "#D6DDE9",
        ink: "#0D1117",
        muted: "#6B7684",

        // "amber" -> BIRU jadi warna brand utama.
        amber: {
          DEFAULT: "#2F6FED",
          soft: "#E5EDFF",
          bright: "#1D4ED8"
        },
        // "teal" -> PINK, dipakai untuk status sukses/aktif.
        teal: {
          DEFAULT: "#EC4899",
          soft: "#FCE7F3",
          bright: "#BE185D"
        },
        // "rose" -> pink kemerahan tua untuk warning/bahaya.
        rose: {
          DEFAULT: "#D6336C",
          soft: "#FBE4ED",
          bright: "#9D174D"
        },
        // Aksen tambahan (silver) untuk highlight & ilustrasi kecil.
        ochre: {
          DEFAULT: "#AEB8C7",
          soft: "#F1F3F8"
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
        soft: "0 1px 2px rgba(13,17,23,0.05), 0 10px 28px -14px rgba(13,17,23,0.16)",
        lift: "0 18px 38px -16px rgba(13,17,23,0.28)",
        glow: "0 0 0 1px rgba(47,111,237,0.14), 0 12px 30px -12px rgba(47,111,237,0.45)",
        "glow-pink": "0 0 0 1px rgba(236,72,153,0.14), 0 12px 30px -12px rgba(236,72,153,0.45)",
        "3d": "0 1px 0 rgba(255,255,255,0.7) inset, 0 -3px 0 rgba(13,17,23,0.12) inset, 0 20px 40px -16px rgba(47,111,237,0.35)",
        "3d-pressed": "0 1px 0 rgba(255,255,255,0.5) inset, 0 -1px 0 rgba(13,17,23,0.1) inset, 0 6px 14px -8px rgba(47,111,237,0.35)",
        "card-3d": "0 2px 4px rgba(13,17,23,0.04), 0 24px 48px -24px rgba(47,111,237,0.28), 0 12px 24px -16px rgba(236,72,153,0.14)"
      },
      backgroundImage: {
        grain:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E\")",
        dotgrid:
          "radial-gradient(circle, rgba(13,17,23,0.08) 1px, transparent 1px)",
        "aurora-1": "radial-gradient(circle at 30% 30%, rgba(47,111,237,0.55), transparent 60%)",
        "aurora-2": "radial-gradient(circle at 70% 60%, rgba(236,72,153,0.45), transparent 60%)",
        "conic-glow": "conic-gradient(from 0deg, #2F6FED, #EC4899, #AEB8C7, #2F6FED)"
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
          "0%, 100%": { transform: "translateY(0) rotate(0deg)" },
          "50%": { transform: "translateY(-10px) rotate(-1deg)" }
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" }
        },
        expandDown: {
          "0%": { opacity: "0", transform: "translateY(-6px) scaleY(0.96)" },
          "100%": { opacity: "1", transform: "translateY(0) scaleY(1)" }
        },
        blobMove: {
          "0%, 100%": { transform: "translate(0,0) scale(1)" },
          "33%": { transform: "translate(4%,-6%) scale(1.08)" },
          "66%": { transform: "translate(-3%,4%) scale(0.96)" }
        },
        spinSlow: {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" }
        },
        platformSpin: {
          "0%, 100%": { transform: "rotateX(70deg) rotate(0deg)" },
          "50%": { transform: "rotateX(70deg) rotate(8deg)" }
        },
        sheetUp: {
          "0%": { transform: "translateY(100%)" },
          "100%": { transform: "translateY(0)" }
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" }
        }
      },
      animation: {
        "fade-up": "fadeUp 0.6s cubic-bezier(0.22,1,0.36,1) both",
        "scale-in": "scaleIn 0.35s cubic-bezier(0.22,1,0.36,1) both",
        "float-slow": "floatSlow 5s ease-in-out infinite",
        shimmer: "shimmer 2.2s linear infinite",
        "expand-down": "expandDown 0.22s cubic-bezier(0.22,1,0.36,1) both",
        "blob-move": "blobMove 14s ease-in-out infinite",
        "spin-slow": "spinSlow 6s linear infinite",
        "platform-spin": "platformSpin 6s ease-in-out infinite",
        "sheet-up": "sheetUp 0.32s cubic-bezier(0.22,1,0.36,1) both",
        "fade-in": "fadeIn 0.22s ease-out both"
      }
    }
  },
  plugins: []
};
