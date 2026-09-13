/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}"
  ],
  theme: {
    extend: {
      colors: {
        // Semua warna semantik dibaca dari CSS variable (lihat globals.css),
        // supaya otomatis berubah saat mode terang/gelap ditukar tanpa perlu
        // menyentuh className di tiap komponen.
        bg: "rgb(var(--c-bg) / <alpha-value>)",
        surface: "rgb(var(--c-surface) / <alpha-value>)",
        surface2: "rgb(var(--c-surface2) / <alpha-value>)",
        surface3: "rgb(var(--c-surface3) / <alpha-value>)",
        line: "rgb(var(--c-line) / <alpha-value>)",
        ink: "rgb(var(--c-ink) / <alpha-value>)",
        muted: "rgb(var(--c-muted) / <alpha-value>)",

        // Biru — warna brand utama.
        amber: {
          DEFAULT: "rgb(var(--c-blue) / <alpha-value>)",
          soft: "rgb(var(--c-blue-soft) / <alpha-value>)",
          bright: "rgb(var(--c-blue-bright) / <alpha-value>)"
        },
        // Biru tua / navy — aksen kedua & status aktif.
        teal: {
          DEFAULT: "rgb(var(--c-navy) / <alpha-value>)",
          soft: "rgb(var(--c-navy-soft) / <alpha-value>)",
          bright: "rgb(var(--c-navy-bright) / <alpha-value>)"
        },
        // Merah — dipakai khusus untuk warning/bahaya/gagal.
        rose: {
          DEFAULT: "rgb(var(--c-danger) / <alpha-value>)",
          soft: "rgb(var(--c-danger-soft) / <alpha-value>)",
          bright: "rgb(var(--c-danger-bright) / <alpha-value>)"
        },
        // Silver — aksen netral & dekorasi.
        ochre: {
          DEFAULT: "rgb(var(--c-silver) / <alpha-value>)",
          soft: "rgb(var(--c-silver-soft) / <alpha-value>)"
        },
        // Hijau — status sukses (dipakai terpisah dari palet utama).
        success: {
          DEFAULT: "rgb(var(--c-success) / <alpha-value>)",
          soft: "rgb(var(--c-success-soft) / <alpha-value>)"
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
        soft: "0 1px 2px rgba(2,8,23,0.05), 0 10px 28px -14px rgba(2,8,23,0.16)",
        lift: "0 18px 38px -16px rgba(2,8,23,0.28)",
        glow: "0 0 0 1px rgba(37,99,235,0.14), 0 12px 30px -12px rgba(37,99,235,0.45)",
        "glow-pink": "0 0 0 1px rgba(15,23,42,0.14), 0 12px 30px -12px rgba(15,23,42,0.45)",
        "3d": "0 1px 0 rgba(255,255,255,0.7) inset, 0 -3px 0 rgba(2,8,23,0.12) inset, 0 20px 40px -16px rgba(37,99,235,0.35)",
        "3d-pressed": "0 1px 0 rgba(255,255,255,0.5) inset, 0 -1px 0 rgba(2,8,23,0.1) inset, 0 6px 14px -8px rgba(37,99,235,0.35)",
        "card-3d": "0 2px 4px rgba(2,8,23,0.04), 0 24px 48px -24px rgba(37,99,235,0.28), 0 12px 24px -16px rgba(15,23,42,0.14)"
      },
      backgroundImage: {
        grain:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E\")",
        dotgrid:
          "radial-gradient(circle, rgb(var(--c-ink) / 0.08) 1px, transparent 1px)",
        "aurora-1": "radial-gradient(circle at 30% 30%, rgb(var(--c-blue) / 0.5), transparent 60%)",
        "aurora-2": "radial-gradient(circle at 70% 60%, rgb(var(--c-navy) / 0.4), transparent 60%)",
        "conic-glow": "conic-gradient(from 0deg, rgb(var(--c-blue)), rgb(var(--c-navy)), rgb(var(--c-silver)), rgb(var(--c-blue)))"
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
        },
        slideInLeft: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(0)" }
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
        "fade-in": "fadeIn 0.22s ease-out both",
        "slide-in-left": "slideInLeft 0.28s cubic-bezier(0.22,1,0.36,1) both"
      }
    }
  },
  plugins: []
};
