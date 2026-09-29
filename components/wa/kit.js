"use client";

// Perkakas bersama WEARTA CHAT: ikon, avatar, lencana, format, klien API,
// pengolah gambar, dan konteks.
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { LENCANA } from "@/lib/wa/lencanaWarna";

export const WaCtx = createContext(null);
export const useWa = () => useContext(WaCtx);

// ─────────────────────────── IKON ───────────────────────────
const P = {
  back: "M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z",
  search: "M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z",
  more: <><circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" /></>,
  send: "M2.01 21L23 12 2.01 3 2 10l15 2-15 2z",
  mic: "M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z",
  micoff: "M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z",
  plus: "M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z",
  camera: "M9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8a3 3 0 100 6 3 3 0 000-6z",
  image: "M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z",
  phone: "M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z",
  video: "M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z",
  videooff: "M21 6.5l-4 4V7c0-.55-.45-1-1-1H9.82L21 17.18V6.5zM3.27 2L2 3.27 4.73 6H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.21 0 .39-.08.55-.18L19.73 21 21 19.73 3.27 2z",
  close: "M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z",
  check: "M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z",
  checks: "M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41L6 19l1.41-1.41L1.83 12 .41 13.41z",
  pin: "M16 9V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z",
  star: "M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z",
  reply: "M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z",
  forward: "M14 9V5l7 7-7 7v-4.1c-5 0-8.5 1.6-11 5.1 1-5 4-10 11-11z",
  trash: "M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z",
  edit: "M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z",
  smile: "M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-10c.83 0 1.5-.67 1.5-1.5S16.33 7 15.5 7 14 7.67 14 8.5s.67 1.5 1.5 1.5zm-7 0C9.33 10 10 9.33 10 8.5S9.33 7 8.5 7 7 7.67 7 8.5 7.67 10 8.5 10zm3.5 7.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z",
  poll: "M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z",
  users: "M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z",
  userplus: "M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z",
  user: "M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z",
  block: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM4 12c0-4.42 3.58-8 8-8 1.85 0 3.55.63 4.9 1.69L5.69 16.9A7.902 7.902 0 014 12zm8 8c-1.85 0-3.55-.63-4.9-1.69L18.31 7.1A7.902 7.902 0 0120 12c0 4.42-3.58 8-8 8z",
  mute: "M20 18.69L7.84 6.14 5.27 3.49 4 4.76l2.8 2.8v.01c-.52.99-.8 2.16-.8 3.42v5l-2 2v1h13.73l2 2L21 19.72l-1-1.03zM12 22c1.11 0 2-.89 2-2h-4c0 1.11.89 2 2 2zm6-7.32V11c0-3.08-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68c-.15.03-.29.08-.42.12L18 14.68z",
  bell: "M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z",
  archive: "M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.48-.17-.93-.46-1.27zM12 17.5L6.5 12H10v-2h4v2h3.5L12 17.5zM5.12 5l.81-1h12l.94 1H5.12z",
  lock: "M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z",
  chat: "M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z",
  status: <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="7 3.2" />,
  flip: "M20 4h-3.17L15 2H9L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-5 11.5V13H9v2.5L5.5 12 9 8.5V11h6V8.5l3.5 3.5-3.5 3.5z",
  copy: "M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z",
  info: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z",
  link: "M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z",
  logout: "M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z",
  down: "M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z",
  speaker: "M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z",
  eye: "M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z",
  play: "M8 5v14l11-7z",
  pause: <><rect x="6" y="5" width="4" height="14" rx="1.5" /><rect x="14" y="5" width="4" height="14" rx="1.5" /></>,
  gear: "M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z",
  sticker: "M21 11.5V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h6.5L21 11.5zM19 5v5.5h-4.5c-1.1 0-2 .9-2 2V19H5V5h14z",
  text: "M5 4v3h5.5v12h3V7H19V4z",
  refresh: "M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"
};

export function Ik({ n, s = 22, style, className = "" }) {
  const isi = P[n];
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="currentColor" aria-hidden="true" style={style} className={className}>
      {typeof isi === "string" ? <path d={isi} /> : isi}
    </svg>
  );
}

// ─────────────────────────── LENCANA ───────────────────────────
const BADGE_PATH = "M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.71 4.2L6.8 12.46l1.41-1.42 2.26 2.26 4.8-5.23 1.47 1.36-6.2 6.77z";

/** Lencana verifikasi bulat bergerigi. `warna` = kunci palet ("biru", "hitam", ...). */
export function Lencana({ warna, size = 16 }) {
  const w = warna && LENCANA[warna];
  if (!w) return null;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className="wa-lencana" role="img" aria-label={`Terverifikasi (${w.label})`} style={{ color: w.warna }}>
      <title>{`Terverifikasi · ${w.label}`}</title>
      <path d={BADGE_PATH} fill="currentColor" />
    </svg>
  );
}

// ─────────────────────────── AVATAR ───────────────────────────
const WARNA_AVATAR = ["#f77c22", "#2e86ff", "#ec4899", "#16a34a", "#8b5cf6", "#ef4444", "#14b8a6", "#eab308", "#0ea5e9", "#e11d48"];
export function warnaNama(nama = "") {
  let h = 0;
  for (const c of String(nama)) h = (h * 31 + c.charCodeAt(0)) & 0xffffff;
  return WARNA_AVATAR[h % WARNA_AVATAR.length];
}
export function inisial(nama = "") {
  const p = String(nama).trim().split(/\s+/).filter(Boolean);
  if (!p.length) return "?";
  return (p.length >= 2 ? p[0][0] + p[1][0] : p[0].slice(0, 2)).toUpperCase();
}

/** Foto bila ada (dan bisa dimuat), kalau tidak inisial berwarna. */
export function Avatar({ nama, foto, ada = true, size = 46, online = false, ring = null, umum = false, onClick }) {
  const [rusak, setRusak] = useState(false);
  useEffect(() => setRusak(false), [foto]);
  const tampilFoto = foto && ada && !rusak;
  return (
    <span
      className={`wa-avatar${onClick ? " is-klik" : ""}${ring ? ` ring-${ring}` : ""}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38), background: tampilFoto ? "rgb(var(--c-surface2))" : warnaNama(nama) }}
      onClick={onClick}
      role={onClick ? "button" : undefined}
    >
      {tampilFoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={foto} alt="" loading="lazy" onError={() => setRusak(true)} />
      ) : umum ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/maskot-sm.webp" alt="" className="wa-avatar-maskot" />
      ) : (
        <b>{inisial(nama)}</b>
      )}
      {online && <i className="wa-online" aria-label="online" />}
    </span>
  );
}

export function NamaLencana({ nama, lencana, size = 15, className = "" }) {
  return (
    <span className={`wa-nama ${className}`}>
      <span className="wa-nama-teks">{nama}</span>
      {lencana ? <Lencana warna={lencana} size={size} /> : null}
    </span>
  );
}

// ─────────────────────────── FORMAT ───────────────────────────
export const jam = (d) => (d ? new Date(d).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false }).replace(".", ":") : "");
const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
function mulaiHari(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); }
export function labelHari(d) {
  if (!d) return "";
  const selisih = Math.round((mulaiHari(Date.now()) - mulaiHari(d)) / 86400000);
  if (selisih <= 0) return "Hari ini";
  if (selisih === 1) return "Kemarin";
  if (selisih < 7) return HARI[new Date(d).getDay()];
  return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: new Date(d).getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
}
/** Untuk daftar chat: jam kalau hari ini, "Kemarin", nama hari, atau tanggal pendek. */
export function waktuDaftar(d) {
  if (!d || new Date(d).getTime() < 86400000) return "";
  const selisih = Math.round((mulaiHari(Date.now()) - mulaiHari(d)) / 86400000);
  if (selisih <= 0) return jam(d);
  if (selisih === 1) return "Kemarin";
  if (selisih < 7) return HARI[new Date(d).getDay()];
  return new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "2-digit" });
}
/** "online", "terakhir dilihat hari ini pukul 10:22", … */
export function teksTerakhir(p) {
  if (!p) return "";
  if (p.online) return "online";
  if (!p.lastSeen) return "offline";
  const h = labelHari(p.lastSeen);
  return `terakhir dilihat ${h === "Hari ini" ? "hari ini" : h.toLowerCase() === "kemarin" ? "kemarin" : h} pukul ${jam(p.lastSeen)}`;
}
export const durasiTeks = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

// ─────────────────────────── KLIEN API ───────────────────────────
/** Pembungkus fetch: tidak pernah melempar; hasil { ok, status, data }. */
export function bikinApi(token) {
  async function panggil(path, opsi = {}) {
    try {
      const r = await fetch(path, { cache: "no-store", ...opsi });
      const data = await r.json().catch(() => null);
      return { ok: r.ok && !data?.error, status: r.status, data: data || {}, error: data?.error || (r.ok ? null : "Gagal terhubung.") };
    } catch {
      return { ok: false, status: 0, data: {}, error: "Tidak ada koneksi." };
    }
  }
  const q = (path) => path + (path.includes("?") ? "&" : "?") + "token=" + encodeURIComponent(token);
  return {
    get: (path) => panggil(q(path)),
    post: (path, body) => panggil(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, token }) })
  };
}

// ─────────────────────────── GAMBAR ───────────────────────────
export function bacaFile(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(new Error("Gagal membaca berkas."));
    r.readAsDataURL(file);
  });
}

function muatGambar(src) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error("Gambar tidak bisa dibuka."));
    im.src = src;
  });
}

/**
 * Perkecil gambar jadi JPEG data URL di bawah `maksBytes`. `persegi` memotong
 * bagian tengah (untuk foto profil).
 */
export async function kecilkanGambar(file, { sisi = 1280, maksBytes = 800_000, persegi = false } = {}) {
  const im = await muatGambar(await bacaFile(file));
  let sw = im.naturalWidth, sh = im.naturalHeight, sx = 0, sy = 0;
  if (persegi) { const m = Math.min(sw, sh); sx = (sw - m) / 2; sy = (sh - m) / 2; sw = sh = m; }
  let skala = Math.min(1, sisi / Math.max(sw, sh));
  for (let coba = 0; coba < 6; coba++) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(sw * skala));
    c.height = Math.max(1, Math.round(sh * skala));
    const g = c.getContext("2d");
    g.fillStyle = "#fff";
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(im, sx, sy, sw, sh, 0, 0, c.width, c.height);
    for (const mutu of [0.85, 0.72, 0.58, 0.45]) {
      const url = c.toDataURL("image/jpeg", mutu);
      // panjang base64 ≈ 4/3 ukuran berkas
      if ((url.length * 3) / 4 <= maksBytes) return url;
    }
    skala *= 0.75;
  }
  throw new Error("Gambar terlalu besar.");
}

// ─────────────────────────── TAUTAN KONTAK ───────────────────────────
/** Tautan pribadi seseorang: membuka chat dengannya (menggantikan kartu kontak). */
export const tautanKontak = (pid) => `${typeof window !== "undefined" ? window.location.origin : ""}/chat?u=${encodeURIComponent(pid)}`;

/** Bagikan lewat menu bagikan perangkat; jika tak ada, salin ke papan klip. Mengembalikan "bagikan" | "salin" | "gagal". */
export async function bagikanTautan({ judul, teks, url }) {
  try {
    if (navigator.share) {
      await navigator.share({ title: judul, text: teks, url });
      return "bagikan";
    }
  } catch (err) {
    if (err?.name === "AbortError") return "batal";
  }
  return (await salin(`${teks ? teks + "\n" : ""}${url}`)) ? "salin" : "gagal";
}

// ─────────────────────────── UMUM ───────────────────────────
export function useInterval(fn, ms, aktif = true) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!aktif || !ms) return undefined;
    const id = setInterval(() => ref.current(), ms);
    return () => clearInterval(id);
  }, [ms, aktif]);
}

export const salin = async (teks) => {
  try {
    await navigator.clipboard.writeText(teks);
    return true;
  } catch {
    try {
      const t = document.createElement("textarea");
      t.value = teks;
      document.body.appendChild(t);
      t.select();
      const ok = document.execCommand("copy");
      t.remove();
      return ok;
    } catch {
      return false;
    }
  }
};

/** Lembar dasar: layar penuh di ponsel, kartu di desktop. Klik latar menutup. */
export function Lembar({ judul, onTutup, children, aksi = null, lebar = 460, kiri = null }) {
  useEffect(() => {
    const k = (e) => { if (e.key === "Escape") onTutup?.(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onTutup]);
  return (
    <div className="wa-lembar-latar" onMouseDown={(e) => { if (e.target === e.currentTarget) onTutup?.(); }}>
      <div className="wa-lembar" style={{ maxWidth: lebar }} role="dialog" aria-modal="true" aria-label={judul}>
        <div className="wa-lembar-kepala">
          {kiri || (
            <button className="wa-ikon" onClick={onTutup} aria-label="Tutup"><Ik n="close" s={22} /></button>
          )}
          <h2>{judul}</h2>
          <div className="wa-lembar-aksi">{aksi}</div>
        </div>
        <div className="wa-lembar-isi">{children}</div>
      </div>
    </div>
  );
}

export function Konfirmasi({ judul, isi, tombol = [], onTutup }) {
  return (
    <div className="wa-lembar-latar wa-konfirmasi-latar" onMouseDown={(e) => { if (e.target === e.currentTarget) onTutup?.(); }}>
      <div className="wa-konfirmasi" role="alertdialog" aria-label={judul}>
        <h3>{judul}</h3>
        {isi ? <p>{isi}</p> : null}
        <div className="wa-konfirmasi-tombol">
          {tombol.map((t, i) => (
            <button key={i} className={`wa-tombol ${t.gaya || ""}`} onClick={t.onClick} disabled={t.mati}>{t.label}</button>
          ))}
          <button className="wa-tombol polos" onClick={onTutup}>Batal</button>
        </div>
      </div>
    </div>
  );
}
