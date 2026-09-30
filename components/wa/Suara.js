"use client";

// Penghubung React untuk mesin suara game (lib/suara.js): tombol musik/efek dan pengait musik latar.
import { useEffect, useState } from "react";
import { aturPref, bacaPref, bangunkan, efek, klaimMusik, langgananSuara, musikBerjalan } from "@/lib/suara";

export function usePrefSuara() {
  const [p, setP] = useState({ musik: true, efek: true });
  useEffect(() => { setP(bacaPref()); return langgananSuara(setP); }, []);
  return p;
}

/** Memutar musik latar selama komponen terpasang (klaim terakhir menang). */
export function useMusik(tema = "lounge", aktif = true) {
  useEffect(() => (aktif ? klaimMusik(tema) : undefined), [tema, aktif]);
}

/** Dipasang di onClickCapture layar game: bunyi klik untuk semua tombol yang bisa ditekan. */
export function bunyiKlik(e) {
  const el = e.target?.closest?.("button, a, [role=tab]");
  if (!el || el.disabled || el.getAttribute("aria-disabled") === "true" || el.dataset.senyap) return;
  efek("klik");
}

export function TombolSuara({ className = "" }) {
  const p = usePrefSuara();
  // Peramban menahan suara sampai layar disentuh: denyutkan tombol musik sampai benar-benar berbunyi.
  const [jalan, setJalan] = useState(true);
  useEffect(() => { const id = setInterval(() => setJalan(musikBerjalan()), 500); return () => clearInterval(id); }, []);
  const ubah = (k) => { bangunkan(); aturPref({ [k]: !p[k] }); if (k === "efek" && !p.efek) setTimeout(() => efek("pop"), 30); };
  return (
    <span className={`sw-suara ${p.musik && !jalan ? "tunggu" : ""} ${className}`} role="group" aria-label="Suara">
      <button type="button" data-senyap="1" className={p.musik ? "on" : ""} aria-pressed={p.musik} aria-label={p.musik ? "Matikan musik" : "Nyalakan musik"} title="Musik latar" data-testid="suara-musik" onClick={() => ubah("musik")}>{p.musik ? "🎵" : "🔇"}</button>
      <button type="button" data-senyap="1" className={p.efek ? "on" : ""} aria-pressed={p.efek} aria-label={p.efek ? "Matikan efek suara" : "Nyalakan efek suara"} title="Efek suara" data-testid="suara-efek" onClick={() => ubah("efek")}>{p.efek ? "🔊" : "🔈"}</button>
    </span>
  );
}
