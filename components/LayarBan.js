"use client";

import { useEffect } from "react";
import { PESAN_BAN } from "@/lib/ipHash";

// Layar penuh untuk akun yang di-ban: hanya satu kalimat. Sengaja tanpa tombol, tautan, atau tawaran banding.
export default function LayarBan() {
  useEffect(() => {
    const lama = document.title;
    document.title = "Arta Pedia ID";
    document.body.style.overflow = "hidden";
    return () => { document.title = lama; document.body.style.overflow = ""; };
  }, []);
  return (
    <main
      role="alert"
      data-testid="layar-ban"
      style={{
        position: "fixed", inset: 0, zIndex: 2147483000, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: 32, textAlign: "center", color: "#fff", background: "radial-gradient(circle at 50% 30%, #3a0d14 0%, #0b0b10 65%)"
      }}
    >
      <div style={{ fontSize: 64, lineHeight: 1 }} aria-hidden="true">🚫</div>
      <h1 style={{ margin: "20px 0 0", maxWidth: 560, fontSize: "clamp(20px, 5vw, 30px)", lineHeight: 1.35, fontWeight: 800, letterSpacing: ".02em", color: "#ff5a67", textTransform: "uppercase" }}>
        {PESAN_BAN}
      </h1>
    </main>
  );
}
