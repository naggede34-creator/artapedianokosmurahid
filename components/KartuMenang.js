"use client";

// Kartu kemenangan: gambar komik 1080×1350 yang dibuat di peramban (canvas) lalu dibagikan ke Status WEARTA, Telegram,
// atau aplikasi lain lewat menu bagikan perangkat. Hadiah uang HANYA ditampilkan bila pengguna sendiri memilihnya.
import { useEffect, useRef, useState } from "react";
import { useWa } from "@/components/wa/kit";
import { SKIN_PETA } from "@/lib/gaya";

const W = 1080, H = 1350;

function muat(src) {
  return new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
}
function bulat(c, x, y, w, h, r) {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
function potong(c, teks, maks) {
  let t = String(teks);
  while (t.length > 1 && c.measureText(t).width > maks) t = t.slice(0, -2) + "…";
  return t;
}

export async function gambarKartu({ judul = "MENANG!", subjudul = "", baris = [], nama = "", skin = "", situs = "" }) {
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const c = cv.getContext("2d");
  // latar komik: sinar kuning-oranye + titik halftone
  const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, "#ffd23f"); g.addColorStop(1, "#ff6b35");
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.save(); c.translate(W / 2, 640);
  for (let i = 0; i < 24; i++) { c.rotate((Math.PI * 2) / 24); c.fillStyle = i % 2 ? "rgba(255,255,255,.16)" : "rgba(255,255,255,0)"; c.beginPath(); c.moveTo(0, 0); c.lineTo(1400, -90); c.lineTo(1400, 90); c.closePath(); c.fill(); }
  c.restore();
  c.fillStyle = "rgba(0,0,0,.08)";
  for (let y = 0; y < H; y += 26) for (let x = (y / 26) % 2 ? 13 : 0; x < W; x += 26) { c.beginPath(); c.arc(x, y, 4, 0, 7); c.fill(); }
  // bingkai
  c.lineWidth = 14; c.strokeStyle = "#0b162c"; bulat(c, 28, 28, W - 56, H - 56, 36); c.stroke();
  // judul
  c.textAlign = "center"; c.lineJoin = "round";
  c.font = "900 190px Impact, 'Arial Black', sans-serif";
  c.lineWidth = 26; c.strokeStyle = "#0b162c"; c.strokeText(judul, W / 2, 250);
  c.fillStyle = "#fff"; c.fillText(judul, W / 2, 250);
  c.font = "800 52px 'Arial Black', Arial, sans-serif";
  c.lineWidth = 12; c.strokeText(subjudul, W / 2, 330); c.fillStyle = "#ffe7a1"; c.fillText(subjudul, W / 2, 330);
  // maskot (dengan filter skin bila didukung)
  const im = await muat("/maskot.webp");
  if (im) {
    const h = 640, w = (im.width / im.height) * h;
    c.save();
    const f = SKIN_PETA[skin]?.filter;
    try { if (f) c.filter = f; } catch {}
    c.shadowColor = "rgba(0,0,0,.35)"; c.shadowBlur = 30; c.shadowOffsetY = 14;
    c.drawImage(im, (W - w) / 2, 360, w, h);
    c.restore();
  }
  // panel info
  const py = 1010;
  c.fillStyle = "#fff"; c.strokeStyle = "#0b162c"; c.lineWidth = 10;
  bulat(c, 90, py, W - 180, 190, 28); c.fill(); c.stroke();
  c.fillStyle = "#0b162c"; c.font = "900 58px 'Arial Black', Arial, sans-serif";
  c.fillText(potong(c, nama || "Pendekar", W - 260), W / 2, py + 76);
  c.font = "700 36px Arial, sans-serif"; c.fillStyle = "#3a4a6a";
  baris.slice(0, 2).forEach((b, i) => c.fillText(potong(c, b, W - 260), W / 2, py + 125 + i * 44));
  // kaki
  c.fillStyle = "#0b162c"; c.font = "900 44px 'Arial Black', Arial, sans-serif";
  c.fillText("ARTA PEDIA", W / 2, 1262);
  c.font = "700 30px Arial, sans-serif"; c.fillStyle = "#3a1f00";
  c.fillText(situs || (typeof window !== "undefined" ? window.location.host : ""), W / 2, 1305);
  return cv;
}
const keBlob = (cv) => new Promise((res) => cv.toBlob((b) => res(b), "image/png"));

export default function KartuMenang({ judul = "MENANG!", subjudul = "", baris = [], nama = "", teksBagikan = "", onTutup }) {
  const wa = useWa();
  const ref = useRef(null);
  const [url, setUrl] = useState("");
  const [cvRef, setCv] = useState(null);
  const [pesan, setPesan] = useState("");
  const [sibuk, setSibuk] = useState(false);

  useEffect(() => {
    let batal = false;
    (async () => {
      const skin = (() => { try { return document.documentElement.getAttribute("data-skin") || ""; } catch { return ""; } })();
      const cv = await gambarKartu({ judul, subjudul, baris, nama, skin });
      if (batal) return;
      setCv(cv); setUrl(cv.toDataURL("image/jpeg", 0.88));
    })();
    return () => { batal = true; };
  }, [judul, subjudul, nama, baris.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

  const teks = teksBagikan || `${judul} ${subjudul} — main di ARTA PEDIA!`;
  const situs = typeof window !== "undefined" ? window.location.origin : "";

  async function bagikan() {
    if (!cvRef) return;
    setSibuk(true);
    try {
      // Di aplikasi Android (WebView) menu bagikan lewat jembatan ArtapediaApp.
      if (window.ArtapediaApp?.postMessage) {
        window.ArtapediaApp.postMessage(JSON.stringify({ aksi: "bagikan-gambar", dataUrl: cvRef.toDataURL("image/png"), teks: `${teks}\n${situs}` }));
        setPesan("Membuka menu bagikan…"); setSibuk(false); return;
      }
      const blob = await keBlob(cvRef);
      const file = new File([blob], "kemenangan-artapedia.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], text: `${teks}\n${situs}` }); setPesan("Dibagikan ✅"); }
      else { unduh(); }
    } catch (e) { if (e?.name !== "AbortError") setPesan("Gagal membagikan."); }
    setSibuk(false);
  }
  function unduh() {
    if (!cvRef) return;
    if (window.ArtapediaApp?.postMessage) { bagikan(); return; }
    const a = document.createElement("a"); a.download = "kemenangan-artapedia.png"; a.href = cvRef.toDataURL("image/png"); a.click();
    setPesan("Gambar tersimpan. Kirim ke Telegram / mana saja!");
  }
  async function keTelegram() {
    unduh();
    window.open(`https://t.me/share/url?url=${encodeURIComponent(situs)}&text=${encodeURIComponent(teks)}`, "_blank", "noopener");
  }
  async function keStatus() {
    if (!wa?.api || !url) return;
    setSibuk(true);
    const r = await wa.api.post("/api/wa/status", { aksi: "buat", jenis: "gambar", gambar: url, teks: teks.slice(0, 190) });
    setSibuk(false);
    setPesan(r.ok ? "Terkirim ke Status WEARTA ✅ (aktif 24 jam)" : r.error || "Gagal mengirim ke Status.");
  }

  return (
    <div className="km-latar" role="dialog" aria-label="Bagikan kemenangan" data-testid="km-dialog" onMouseDown={(e) => { if (e.target === e.currentTarget) onTutup?.(); }}>
      <div className="km-kotak">
        <button className="km-x" onClick={onTutup} aria-label="Tutup">✕</button>
        <div className="km-gambar" ref={ref}>{url ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={url} alt="Kartu kemenangan" data-testid="km-gambar" /> : <span className="km-muat">Membuat kartu…</span>}</div>
        <div className="km-aksi">
          <button onClick={bagikan} disabled={!url || sibuk} data-testid="km-bagikan">📤 Bagikan</button>
          {wa?.api && <button onClick={keStatus} disabled={!url || sibuk} data-testid="km-status">💬 Status WEARTA</button>}
          <button onClick={keTelegram} disabled={!url} data-testid="km-telegram">✈️ Telegram</button>
          <button onClick={unduh} disabled={!url} data-testid="km-unduh">⬇️ Unduh</button>
        </div>
        {pesan && <p className="km-pesan" data-testid="km-pesan">{pesan}</p>}
      </div>
    </div>
  );
}
