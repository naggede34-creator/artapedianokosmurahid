"use client";

// Menerapkan tampilan event musiman secara OTOMATIS (warna aksen, gaya, skin maskot) selama event berlangsung,
// kecuali pengguna sudah memilih sendiri di halaman Tampilan (pilihan manual selalu menang).
// Saat event berakhir, tampilan otomatis dilepas.
import { useEffect } from "react";
import { pasangGaya, pasangSkin, bacaPilihan, KUNCI_MUSIM } from "@/lib/gaya";
import { bacaTema, pasangTema } from "@/lib/tema";

export default function MusimPenerap() {
  useEffect(() => {
    let batal = false;
    (async () => {
      let d = null;
      try { d = await (await fetch("/api/musim")).json(); } catch { return; }
      if (batal || !d) return;
      const u = d.aktif ? d.utama : null;
      const pilih = bacaPilihan();
      const tema = bacaTema();
      try {
        if (u) localStorage.setItem(KUNCI_MUSIM, JSON.stringify({ id: u.id, gaya: u.gaya || "", skin: u.skin || "", warna: u.warna || "", sampai: u.sampai || 0 }));
        else localStorage.removeItem(KUNCI_MUSIM);
      } catch {}
      // gaya & skin: pilihan manual menang
      pasangGaya(pilih.gaya || (u && u.gaya) || "");
      pasangSkin(pilih.skin || (u && u.skin) || "");
      // warna aksen event: hanya bila pengguna tidak memilih tema/warna sendiri
      if (u && u.warna && tema.id === "default" && !tema.warna) pasangTema("default", u.warna);
      else if (!u && tema.id === "default" && !tema.warna) pasangTema("default", "");
    })();
    return () => { batal = true; };
  }, []);
  return null;
}
