/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}"
  ],
  theme: {
    extend: {
      colors: {
        bg: "#F1F4F9",
        surface: "#FFFFFF",
        surface2: "#F3F6FB",
        line: "#E4E9F1",
        ink: "#121826",
        muted: "#6B7385",
        amber: {
          DEFAULT: "#F0A939",
          soft: "#FDF3E3",
          bright: "#C9860E"
        },
        teal: {
          DEFAULT: "#0FB8A0",
          soft: "#E3FAF5",
          bright: "#0A8A78"
        },
        rose: {
          DEFAULT: "#E14F68",
          soft: "#FCE9EC"
        }
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"]
      },
      maxWidth: {
        content: "1160px"
      }
    }
  },
  plugins: []
};
