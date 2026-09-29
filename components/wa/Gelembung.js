"use client";

// Gelembung pesan bergaya panel komik: garis tinta tebal, bayangan keras, ekor
// gelembung ucapan. Berisi juga pemutar suara, jajak pendapat, dan tautan.
import { memo, useEffect, useRef, useState } from "react";
import { Ik, Lencana, jam, durasiTeks, warnaNama } from "@/components/wa/kit";

export const EMOJI_REAKSI = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🔥", "💯"];

// ─────────────────────────── TAUTAN ───────────────────────────
const RE_URL = /(https?:\/\/[^\s<>"']+)/gi;
function Teks({ teks }) {
  const bagian = String(teks || "").split(RE_URL);
  return (
    <>
      {bagian.map((b, i) => {
        if (i % 2 === 1) {
          const bersih = b.replace(/[.,;:!?)]+$/, "");
          const sisa = b.slice(bersih.length);
          // Tautan ke WEARTA CHAT sendiri (?u= kontak, ?gabung= grup) dibuka di dalam aplikasi.
          let dalam = null;
          try {
            const u = new URL(bersih);
            if (typeof window !== "undefined" && u.origin === window.location.origin && u.pathname === "/chat" && (u.searchParams.get("u") || u.searchParams.get("gabung"))) dalam = u.search;
          } catch {}
          return (
            <span key={i}>
              {dalam ? (
                <a href={bersih} className="wa-tautan wa-tautan-dalam" onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.dispatchEvent(new CustomEvent("wa-tautan", { detail: dalam })); }}>
                  {dalam.includes("u=") ? "👤 Buka kontak" : "👥 Gabung grup"}
                </a>
              ) : (
              <a href={bersih} target="_blank" rel="noopener noreferrer nofollow" className="wa-tautan" onClick={(e) => e.stopPropagation()}>{bersih}</a>
              )}
              {sisa}
            </span>
          );
        }
        return b;
      })}
    </>
  );
}

// ─────────────────────────── SUARA ───────────────────────────
const BATANG = Array.from({ length: 28 }, (_, i) => 5 + Math.abs(Math.sin(i * 0.9 + 1) * 6 + Math.cos(i * 0.45) * 5));

export function PemutarSuara({ src, durasi = 0, saya }) {
  const [main, setMain] = useState(false);
  const [progres, setProgres] = useState(0);
  const [detik, setDetik] = useState(0);
  const [total, setTotal] = useState(durasi || 0);
  const audio = useRef(null);

  useEffect(() => () => { try { audio.current?.pause(); } catch {} }, []);

  function ketuk(e) {
    e.stopPropagation();
    if (!audio.current) {
      const a = new Audio(src);
      a.preload = "metadata";
      a.onloadedmetadata = () => { if (Number.isFinite(a.duration) && a.duration > 0) setTotal(Math.round(a.duration)); };
      a.onended = () => { setMain(false); setProgres(0); setDetik(0); };
      a.ontimeupdate = () => {
        const d = Number.isFinite(a.duration) && a.duration > 0 ? a.duration : total || 1;
        setProgres(Math.min(1, a.currentTime / d));
        setDetik(Math.floor(a.currentTime));
      };
      a.onerror = () => setMain(false);
      audio.current = a;
    }
    const a = audio.current;
    if (main) { a.pause(); setMain(false); } else { a.play().then(() => setMain(true)).catch(() => setMain(false)); }
  }

  function geser(e) {
    e.stopPropagation();
    const a = audio.current;
    if (!a || !Number.isFinite(a.duration)) return;
    const r = e.currentTarget.getBoundingClientRect();
    a.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * a.duration;
  }

  return (
    <div className="wa-suara">
      <button className="wa-suara-tombol" onClick={ketuk} aria-label={main ? "Jeda" : "Putar pesan suara"}>
        <Ik n={main ? "pause" : "play"} s={20} />
      </button>
      <div className="wa-suara-tengah">
        <div className="wa-suara-gelombang" onClick={geser}>
          {BATANG.map((h, i) => (
            <i key={i} style={{ height: h, opacity: i / BATANG.length <= progres ? 1 : 0.32 }} />
          ))}
        </div>
        <span className="wa-suara-waktu">{main || detik ? durasiTeks(detik) : durasiTeks(total)}</span>
      </div>
      <span className="wa-suara-mik" aria-hidden><Ik n="mic" s={16} /></span>
    </div>
  );
}

// ─────────────────────────── JAJAK PENDAPAT ───────────────────────────
function Jajak({ poll, onVote }) {
  const jumlah = poll.opsi.reduce((a, o) => a + o.suara, 0);
  return (
    <div className="wa-poll">
      <div className="wa-poll-tanya"><Ik n="poll" s={16} /> {poll.pertanyaan}</div>
      <div className="wa-poll-info">Pilih satu jawaban</div>
      {poll.opsi.map((o) => {
        const pct = jumlah ? Math.round((o.suara / jumlah) * 100) : 0;
        return (
          <button key={o.id} className={`wa-poll-opsi${o.saya ? " dipilih" : ""}`} onClick={(e) => { e.stopPropagation(); onVote(o.id); }}>
            <span className="wa-poll-bar" style={{ width: `${pct}%` }} />
            <span className="wa-poll-radio">{o.saya ? <Ik n="check" s={13} /> : null}</span>
            <span className="wa-poll-teks">{o.teks}</span>
            <b className="wa-poll-n">{o.suara}</b>
          </button>
        );
      })}
      <div className="wa-poll-info">{jumlah} suara</div>
    </div>
  );
}

// ─────────────────────────── CENTANG ───────────────────────────
function Centang({ m, umum }) {
  if (m.tunda) return <span className="wa-centang tunda" title="Mengirim…"><Ik n="refresh" s={13} className="wa-putar" /></span>;
  if (m.gagal) return <span className="wa-centang gagal" title="Gagal terkirim">!</span>;
  if (umum || m.status === "kirim") return <span className="wa-centang"><Ik n="check" s={14} /></span>;
  return <span className={`wa-centang${m.status === "baca" ? " baca" : ""}`} title={m.status === "baca" ? "Dibaca" : "Sampai"}><Ik n="checks" s={15} /></span>;
}

// ─────────────────────────── GELEMBUNG ───────────────────────────
function GelembungAsli({ m, grup, umum, pengirim, awalGrup, sorot, onMenu, onBalas, onLihatGambar, onVote, onLompat, onProfil, onUlang, adminUmum }) {
  const geser = useRef({ x: 0, y: 0, dx: 0, aktif: false, tahan: null });
  const [dx, setDx] = useState(0);
  const bodi = useRef(null);

  const profil = pengirim?.[m.dari];
  const nama = m.isAI ? m.namaDari : profil?.nama || m.namaDari || "Pengguna";

  // Pesan sistem / panggilan: pil di tengah.
  if (m.jenis === "sistem" || m.jenis === "call") {
    return (
      <div className="wa-sistem" id={`msg-${m.id}`}>
        <span className={m.jenis === "call" ? "wa-sistem-call" : ""}>{m.teks}</span>
      </div>
    );
  }

  const mine = m.mine;
  const dihapus = m.jenis === "dihapus";

  function mulai(e) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const g = geser.current;
    g.x = e.clientX; g.y = e.clientY; g.dx = 0; g.aktif = true;
    clearTimeout(g.tahan);
    g.tahan = setTimeout(() => { if (g.aktif) { g.aktif = false; navigator.vibrate?.(15); onMenu(m); } }, 480);
  }
  function gerak(e) {
    const g = geser.current;
    if (!g.aktif) return;
    const ddx = e.clientX - g.x, ddy = e.clientY - g.y;
    if (Math.abs(ddx) > 8 || Math.abs(ddy) > 8) clearTimeout(g.tahan);
    if (e.pointerType !== "mouse" && ddx > 0 && Math.abs(ddx) > Math.abs(ddy) * 1.4) { g.dx = ddx; setDx(Math.min(ddx, 72)); }
  }
  function selesai() {
    const g = geser.current;
    clearTimeout(g.tahan);
    if (g.aktif && g.dx > 56 && !dihapus) { navigator.vibrate?.(10); onBalas(m); }
    g.aktif = false; g.dx = 0; setDx(0);
  }

  const kelas = ["wa-gel", mine ? "saya" : "lain", awalGrup ? "awal" : "", m.jenis === "stiker" ? "stiker" : "", dihapus ? "hapus" : "", sorot ? "sorot" : "", m.gagal ? "gagal" : ""].filter(Boolean).join(" ");
  const tampilNama = !mine && (grup || umum) && awalGrup && !dihapus;

  return (
    <div className={`wa-baris ${mine ? "saya" : "lain"}${awalGrup ? " awal" : ""}`} id={`msg-${m.id}`}>
      {!mine && (grup || umum) ? (
        <div className="wa-baris-avatar">
          {awalGrup && !m.isAI ? (
            <button className="wa-mini-avatar" style={{ background: warnaNama(nama) }} onClick={() => m.dari && onProfil?.(m.dari)} aria-label={`Profil ${nama}`}>
              {profil?.fotoV ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/wa/foto/${m.dari}?v=${profil.fotoV}`} alt="" loading="lazy" />
              ) : (
                <b>{nama.slice(0, 1).toUpperCase()}</b>
              )}
            </button>
          ) : m.isAI && awalGrup ? (
            <span className="wa-mini-avatar ai" aria-hidden>🤖</span>
          ) : null}
        </div>
      ) : null}
      <div
        ref={bodi}
        className={kelas}
        style={dx ? { transform: `translateX(${dx}px)` } : undefined}
        onPointerDown={mulai}
        onPointerMove={gerak}
        onPointerUp={selesai}
        onPointerCancel={selesai}
        onPointerLeave={() => { clearTimeout(geser.current.tahan); }}
        onContextMenu={(e) => { e.preventDefault(); if (!dihapus || true) onMenu(m); }}
      >
        {dx > 24 && <span className="wa-geser-ikon" style={{ opacity: Math.min(1, dx / 60) }}><Ik n="reply" s={20} /></span>}
        {!dihapus && (
          <button className="wa-gel-panah" onClick={(e) => { e.stopPropagation(); onMenu(m); }} aria-label="Menu pesan"><Ik n="down" s={20} /></button>
        )}

        {tampilNama && (
          <div className="wa-gel-nama" style={{ color: m.isAI ? "#6366f1" : warnaNama(nama) }}>
            <button onClick={() => !m.isAI && m.dari && onProfil?.(m.dari)}>{nama}</button>
            {profil?.lencana ? <Lencana warna={profil.lencana} size={14} /> : null}
            {m.isAI ? <em>AI</em> : null}
          </div>
        )}

        {dihapus ? (
          <div className="wa-gel-hapus"><Ik n="block" s={14} /> {mine ? "Kamu menghapus pesan ini" : "Pesan ini telah dihapus"}</div>
        ) : (
          <>
            {m.diteruskan ? <div className="wa-gel-teruskan"><Ik n="forward" s={13} /> Diteruskan</div> : null}
            {m.balas ? (
              <button className="wa-gel-kutip" onClick={(e) => { e.stopPropagation(); onLompat(m.balas.msgId); }}>
                <b>{m.balas.nama || "Pesan"}</b>
                <span>{m.balas.preview}</span>
              </button>
            ) : null}

            {m.jenis === "gambar" && m.media ? (
              <button className="wa-gel-gambar" onClick={(e) => { e.stopPropagation(); onLihatGambar(m.media, m.teks); }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.media} alt={m.teks || "Foto"} loading="lazy" />
              </button>
            ) : null}
            {m.jenis === "suara" && m.media ? <PemutarSuara src={m.media} durasi={m.durasi || 0} saya={mine} /> : null}
            {m.jenis === "stiker" ? <div className="wa-gel-stiker">{m.stiker}</div> : null}
            {m.jenis === "poll" && m.poll ? <Jajak poll={m.poll} onVote={(o) => onVote(m, o)} /> : null}
            {(m.jenis === "teks" || (m.jenis === "gambar" && m.teks)) && (
              <div className={`wa-gel-teks${m.jenis === "gambar" ? " keterangan" : ""}`}><Teks teks={m.teks} /></div>
            )}
          </>
        )}

        <div className="wa-gel-kaki">
          {m.pinned ? <Ik n="pin" s={12} /> : null}
          {m.bintang ? <Ik n="star" s={12} style={{ color: "#f59e0b" }} /> : null}
          {m.diedit && !dihapus ? <span>diedit</span> : null}
          <time>{jam(m.createdAt)}</time>
          {mine && !dihapus ? <Centang m={m} umum={umum} /> : null}
        </div>

        {m.gagal ? (
          <button className="wa-gel-ulang" onClick={(e) => { e.stopPropagation(); onUlang(m); }}>⚠ Gagal — ketuk untuk kirim ulang</button>
        ) : null}

        {!dihapus && Object.keys(m.reaksi || {}).length > 0 ? (
          <div className="wa-reaksi">
            {Object.entries(m.reaksi).map(([e, v]) => (
              <span key={e} className={v.saya ? "saya" : ""}>{e}{v.n > 1 ? <b>{v.n}</b> : null}</span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export const Gelembung = memo(GelembungAsli, (a, b) =>
  a.m === b.m && a.sorot === b.sorot && a.awalGrup === b.awalGrup && a.grup === b.grup && a.umum === b.umum && a.pengirim?.[a.m.dari] === b.pengirim?.[b.m.dari] && a.adminUmum === b.adminUmum
);
