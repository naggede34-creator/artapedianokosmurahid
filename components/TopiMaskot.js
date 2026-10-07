"use client";

// Aksesori kostum maskot (topi, mahkota, dst.) sesuai skin yang aktif. Letakkan di dalam elemen yang `position: relative`
// dan membungkus gambar maskot; ia menempel di atas kepala. Tidak merender apa pun untuk skin tanpa aksesori.
import { useEffect, useState } from "react";
import { SKIN_PETA } from "@/lib/gaya";

export default function TopiMaskot({ ukuran = "1em", geser = "" }) {
  const [id, setId] = useState("");
  useEffect(() => {
    const baca = () => setId(document.documentElement.getAttribute("data-skin") || "");
    baca();
    window.addEventListener("artapedia-skin", baca);
    return () => window.removeEventListener("artapedia-skin", baca);
  }, []);
  const a = SKIN_PETA[id]?.aksesori;
  if (!a) return null;
  return <span className={`topi-maskot ${geser}`} style={{ fontSize: ukuran }} aria-hidden="true">{a}</span>;
}
