"use client";

import { useEffect, useState } from "react";
import { csBuka } from "@/lib/jamCs";

/**
 * Status jam kerja CS untuk komponen klien. Awalnya `null` (belum diketahui) supaya HTML server dan klien sama
 * dan tidak terjadi galat hidrasi; sesudah dipasang dihitung dari jam perangkat → WIB dan disegarkan tiap 30 detik.
 */
export function useCsBuka() {
  const [buka, setBuka] = useState(null);
  useEffect(() => {
    const hitung = () => setBuka(csBuka());
    hitung();
    const t = setInterval(hitung, 30_000);
    return () => clearInterval(t);
  }, []);
  return buka;
}
