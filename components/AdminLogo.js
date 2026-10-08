"use client";

// Kartu "Logo" di Pengaturan Situs: unggah logo sendiri, atau kembali ke logo bawaan.
// Berdiri sendiri (memuat & menyimpan sendiri) seperti AdminAlamatApi.
import { useCallback, useEffect, useRef, useState } from "react";

const SLOT = [
  {
    jenis: "utama",
    judul: "🖼️ Logo lebar",
    dipakai: "Layar pemuatan dan gambar pratinjau tautan (WhatsApp/Telegram/Facebook).",
    saran: "Mendatar, latar transparan, mis. 800×500 px.",
    bawaan: "/logo.svg",
    lebar: 800,
    persegi: false
  },
  {
    jenis: "ikon",
    judul: "🔷 Logo ikon (persegi)",
    dipakai: "Bilah atas, footer, favicon tab, ikon aplikasi (PWA/Android), dan notifikasi.",
    saran: "Persegi, mis. 512×512 px, jangan terlalu banyak ruang kosong di tepi.",
    bawaan: "/logo-mark.png",
    lebar: 512,
    persegi: true
  },
  {
    jenis: "sambutan",
    judul: "🤖 Gambar sambutan bot",
    dipakai: "Gambar di pesan sambutan bot Telegram toko (menggantikan bot-welcome.jpg).",
    saran: "Mendatar ±16:9 atau persegi panjang, mis. 1280×720 px. SVG tidak didukung Telegram.",
    bawaan: "/bot-welcome.jpg",
    lebar: 1280,
    persegi: false,
    jpg: true,
    tanpaSvg: true
  }
];

// Gambar raster dikecilkan di peramban dan disimpan sebagai PNG (transparansi terjaga). SVG dikirim apa adanya.
function siapkan(file, s, onDone, onErr) {
  if (!file) return;
  if (file.size > 12 * 1024 * 1024) return onErr("Berkas terlalu besar (maks 12 MB).");
  if (file.type === "image/svg+xml" && s.tanpaSvg) return onErr("Gambar bot harus PNG, JPG, atau WebP.");
  if (file.type === "image/svg+xml") {
    if (file.size > 300_000) return onErr("SVG maksimal 300 KB.");
    const r = new FileReader();
    r.onload = (ev) => onDone(String(ev.target.result));
    r.onerror = () => onErr("Berkas tidak bisa dibaca.");
    return r.readAsDataURL(file);
  }
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return onErr("Pakai PNG, JPG, WebP, atau SVG.");
  const r = new FileReader();
  r.onload = (ev) => {
    const img = new window.Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      if (s.persegi) {
        const sisi = s.lebar;
        c.width = c.height = sisi;
        const rasio = Math.min(sisi / img.width, sisi / img.height);
        const w = img.width * rasio, h = img.height * rasio;
        c.getContext("2d").drawImage(img, (sisi - w) / 2, (sisi - h) / 2, w, h);
      } else {
        const rasio = Math.min(s.lebar / img.width, 1);
        c.width = Math.round(img.width * rasio);
        c.height = Math.round(img.height * rasio);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      }
      let out = s.jpg ? c.toDataURL("image/jpeg", 0.88) : c.toDataURL("image/png");
      if (s.jpg && out.length > 1_150_000) out = c.toDataURL("image/jpeg", 0.7);
      if (out.length > 1_150_000) return onErr("Logo masih terlalu besar. Pakai gambar yang lebih sederhana/kecil.");
      onDone(out);
    };
    img.onerror = () => onErr("Berkas itu bukan gambar yang bisa dibaca.");
    img.src = ev.target.result;
  };
  r.onerror = () => onErr("Berkas tidak bisa dibaca.");
  r.readAsDataURL(file);
}

export default function AdminLogo() {
  const [logo, setLogo] = useState({ utama: null, ikon: null });
  const [sibuk, setSibuk] = useState("");
  const [pesan, setPesan] = useState(null); // { ok, teks }
  const input = useRef({});

  const muat = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/logo", { cache: "no-store" });
      const d = await r.json();
      if (r.ok) setLogo(d.logo);
    } catch {}
  }, []);
  useEffect(() => { muat(); }, [muat]);

  async function kirim(jenis, body) {
    setSibuk(jenis); setPesan(null);
    try {
      const r = await fetch("/api/admin/logo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jenis, ...body }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Gagal menyimpan.");
      setLogo(d.logo);
      setPesan({ ok: true, teks: body.hapus ? "Kembali ke logo bawaan." : "Logo tersimpan. Pengunjung melihatnya dalam beberapa detik (ikon aplikasi di HP perlu pasang ulang)." });
    } catch (e) { setPesan({ ok: false, teks: e.message }); }
    finally { setSibuk(""); }
  }

  function pilih(s, e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    siapkan(file, s, (data) => kirim(s.jenis, { data }), (t) => setPesan({ ok: false, teks: t }));
  }

  return (
    <div className="glass rounded-2xl p-5 shadow-soft sm:p-6" data-testid="admin-logo">
      <h2 className="font-display text-base font-semibold text-ink">🎨 Logo</h2>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        Unggah logo sendiri; tanpa unggahan, situs memakai logo bawaan Arta Pedia. Format PNG, JPG, WebP, atau SVG.
        Gambar otomatis dikecilkan. Ada juga gambar sambutan bot Telegram.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SLOT.map((s) => {
          const custom = logo?.[s.jenis];
          const src = custom ? `/api/logo/${s.jenis}?v=${custom.v}` : s.bawaan;
          return (
            <div key={s.jenis} className="rounded-xl border border-line bg-surface2 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-ink">{s.judul}</p>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${custom ? "bg-amber-soft text-amber-bright" : "bg-surface text-muted"}`}>{custom ? "Kustom" : "Bawaan"}</span>
              </div>
              <div className="mt-3 flex h-28 items-center justify-center rounded-lg border border-dashed border-line bg-[repeating-conic-gradient(rgb(var(--c-line)/0.35)_0%_25%,transparent_0%_50%)] [background-size:16px_16px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`Pratinjau ${s.judul}`} className="max-h-24 max-w-[85%] object-contain" data-testid={`logo-pratinjau-${s.jenis}`} />
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-muted">{s.dipakai}</p>
              <p className="text-[11px] leading-relaxed text-muted">Saran: {s.saran}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <input ref={(el) => (input.current[s.jenis] = el)} type="file" accept={s.tanpaSvg ? "image/png,image/jpeg,image/webp" : "image/png,image/jpeg,image/webp,image/svg+xml"} className="hidden" onChange={(e) => pilih(s, e)} data-testid={`logo-berkas-${s.jenis}`} />
                <button type="button" disabled={!!sibuk} onClick={() => input.current[s.jenis]?.click()} className="rounded-lg bg-ink px-3 py-1.5 text-xs font-bold text-bg press disabled:opacity-60">
                  {sibuk === s.jenis ? "Menyimpan…" : "Unggah logo"}
                </button>
                {custom && (
                  <button type="button" disabled={!!sibuk} onClick={() => kirim(s.jenis, { hapus: true })} className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-muted disabled:opacity-60">
                    Kembali ke bawaan
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {pesan && (
        <p className={`mt-3 rounded-lg border px-3 py-2 text-[11px] font-medium ${pesan.ok ? "border-success/40 bg-success-soft text-success" : "border-rose/40 bg-rose-soft text-rose"}`} role="status">
          {pesan.ok ? "✅ " : "⚠️ "}{pesan.teks}
        </p>
      )}
    </div>
  );
}
