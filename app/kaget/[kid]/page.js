"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useUser } from "@/app/providers";
import { CopyButton, fmtWIB, rupiah, Spinner, timeAgo } from "@/components/ui";
import { KagetAmplop, KagetKonfeti } from "@/components/KagetAmplop";
import TombolBagikan from "@/components/KagetBagikan";
import { sisaWaktu, tautanKaget } from "@/lib/kagetUi";

export const dynamic = "force-dynamic";

const JUDUL_STATUS = {
  habis: ["😢", "Kaget ini sudah habis", "Semua bagian sudah diambil. Coba lagi di Kaget berikutnya!"],
  berakhir: ["⌛", "Kaget ini sudah berakhir", "Masa berlakunya habis. Bagian yang tersisa dikembalikan ke pembuatnya."],
  dibatalkan: ["🚫", "Kaget ini ditutup", "Pembuatnya menutup paket ini lebih awal."]
};

export default function KagetDetailPage({ params }) {
  const { kid: kidRaw } = use(params);
  const kid = String(kidRaw || "").toUpperCase();
  const { token, ready, refreshBalance } = useUser();
  const [d, setD] = useState(null);
  const [galat, setGalat] = useState("");
  const [proses, setProses] = useState(false);
  const [hasil, setHasil] = useState(null); // { jumlah, sudah }
  const [konfeti, setKonfeti] = useState(0);
  const [, tik] = useState(0);
  const dimuat = useRef(false);

  const muat = useCallback(async () => {
    try {
      const r = await fetch(`/api/kaget/lihat?kid=${encodeURIComponent(kid)}${token ? `&token=${encodeURIComponent(token)}` : ""}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) { setGalat(j.error || "Paket Kaget tidak ditemukan."); return; }
      setD(j); setGalat("");
    } catch { setGalat("Jaringan bermasalah. Muat ulang halaman."); }
  }, [kid, token]);

  useEffect(() => { if (ready && !dimuat.current) { dimuat.current = true; muat(); } }, [ready, muat]);
  useEffect(() => { if (ready && dimuat.current) muat(); /* token berubah (login) */ }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
  // Segarkan berkala selama paket aktif (melihat klaim orang lain & hitung mundur).
  useEffect(() => {
    if (!d || d.status !== "aktif") return;
    const t1 = setInterval(muat, 8000);
    const t2 = setInterval(() => tik((x) => x + 1), 30000);
    return () => { clearInterval(t1); clearInterval(t2); };
  }, [d?.status, muat]); // eslint-disable-line react-hooks/exhaustive-deps

  async function ambil() {
    if (!token || proses) return;
    setProses(true); setGalat("");
    try {
      const r = await fetch("/api/kaget/klaim", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, kid }) });
      const j = await r.json();
      if (!r.ok && r.status !== 202) throw new Error(j.error || "Gagal mengambil Kaget.");
      if (r.status === 202) { setGalat(j.error); } else { setHasil({ jumlah: j.jumlah, sudah: j.sudah }); setKonfeti((n) => n + 1); }
      refreshBalance?.();
      muat();
    } catch (e) { setGalat(e.message); muat(); } finally { setProses(false); }
  }

  if (galat && !d) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-5xl" aria-hidden="true">🧧</p>
        <p className="mt-3 text-lg font-black text-ink">{galat}</p>
        <p className="mt-1 text-sm text-muted">Pastikan tautan atau kodenya benar.</p>
        <Link href="/kaget" className="btn-3d mt-5 inline-block rounded-xl bg-amber px-5 py-2.5 text-sm font-black text-white">Ke Saldo Kaget</Link>
      </div>
    );
  }
  if (!d) return <div className="mx-auto max-w-md px-4 py-10"><div className="skeleton h-80 rounded-3xl" /></div>;

  const pct = d.jumlah ? Math.round((d.diklaim / d.jumlah) * 100) : 0;
  const sudahAmbil = !!(d.saya && d.saya.jumlah > 0) || !!hasil;
  const jumlahSaya = hasil?.jumlah ?? d.saya?.jumlah ?? 0;
  const info = JUDUL_STATUS[d.status];

  return (
    <div className="mx-auto max-w-md px-4 py-6 sm:py-10">
      <div className="fade-up kg-hero relative p-6 text-center" data-testid="kaget-detail">
        {konfeti > 0 && <KagetKonfeti key={konfeti} jumlah={48} />}
        <div className="relative z-[1]">
          <p className="text-xs font-bold uppercase tracking-widest text-white/70">Saldo Kaget dari</p>
          <p className="mt-0.5 text-xl font-black" data-testid="kaget-pembuat">{d.pembuat}</p>
          <div className="my-5"><KagetAmplop terbuka={sudahAmbil} goyang={d.bisaKlaim} teks={sudahAmbil ? rupiah(jumlahSaya) : "KAGET!"} /></div>
          {d.pesan && <p className="mx-auto max-w-[260px] text-sm italic text-white/90">“{d.pesan}”</p>}

          {sudahAmbil ? (
            <div className="mt-4" data-testid="kaget-hasil">
              <p className="text-xs font-bold text-white/75">{hasil?.sudah || (!hasil && d.saya) ? "Kamu sudah mengambil" : "Selamat! Kamu dapat"}</p>
              <p className="kg-angka kg-emas text-5xl font-black" data-testid="kaget-jumlah-saya">{rupiah(jumlahSaya)}</p>
              <p className="mt-1 text-xs text-white/75">sudah masuk ke saldomu 🎉</p>
            </div>
          ) : d.status === "aktif" ? (
            <div className="mt-4">
              <p className="kg-angka text-3xl font-black">{rupiah(d.total)}</p>
              <p className="text-xs text-white/75">dibagi {d.mode === "rata" ? "rata" : "acak"} ke {d.jumlah} orang</p>
            </div>
          ) : (
            <div className="mt-4" data-testid="kaget-tutup-info">
              <p className="text-3xl">{info?.[0]}</p>
              <p className="mt-1 text-lg font-black">{info?.[1]}</p>
              <p className="mx-auto mt-1 max-w-[260px] text-xs text-white/75">{info?.[2]}</p>
            </div>
          )}
        </div>
      </div>

      <div className="card-shadow mt-4 rounded-2xl border border-line bg-surface p-5">
        {d.bisaKlaim && (
          <button type="button" onClick={ambil} disabled={proses} data-testid="kaget-ambil" className="btn-3d w-full rounded-2xl bg-amber shadow-3d py-4 text-base font-black text-white disabled:opacity-60">
            {proses ? <span className="inline-flex items-center gap-2"><Spinner className="h-5 w-5" /> Membuka amplop…</span> : "🧧 Ambil Kaget"}
          </button>
        )}
        {!token && ready && d.status === "aktif" && <p className="text-center text-sm text-muted">Memuat akunmu… kalau tidak muncul, <Link href="/" className="font-bold text-amber-bright underline">masuk dulu</Link>.</p>}
        {d.milikku && d.status === "aktif" && (
          <div>
            <p className="text-sm font-black text-ink">Ini paket buatanmu</p>
            <p className="mt-0.5 text-xs text-muted">Bagikan tautan ini ke teman. Kamu tidak bisa mengambil paketmu sendiri.</p>
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-dashed border-amber bg-amber-soft px-3 py-2.5">
              <code className="min-w-0 flex-1 truncate text-xs font-bold text-ink">{tautanKaget(kid)}</code>
              <CopyButton value={tautanKaget(kid)} />
            </div>
            <div className="mt-3"><TombolBagikan data={{ kid, total: d.total, jumlah: d.jumlah, pembuat: "aku" }} /></div>
            <Link href="/kaget?tab=kagetku" className="mt-3 inline-block text-xs font-bold text-amber-bright underline">Kelola / tutup paket →</Link>
          </div>
        )}
        {d.milikku && d.refund && (
          <p className="rounded-xl bg-amber-soft px-4 py-3 text-xs font-bold text-amber-bright" data-testid="kaget-refund">
            {d.refund.status === "selesai" ? `${rupiah(d.refund.jumlah)} yang belum diambil sudah dikembalikan ke saldomu.` : "Sisa yang belum diambil sedang dikembalikan ke saldomu…"}
          </p>
        )}
        {galat && <p className="mt-3 rounded-xl bg-rose-soft px-4 py-2.5 text-xs font-bold text-rose" role="alert" data-testid="kaget-galat">{galat}</p>}

        <div className={d.bisaKlaim || d.milikku ? "mt-5 border-t border-line pt-4" : ""}>
          <div className="flex items-center justify-between text-xs font-bold text-muted">
            <span>{d.diklaim}/{d.jumlah} sudah mengambil</span>
            <span>{d.status === "aktif" ? sisaWaktu(d.berakhirPada) : `selesai ${d.selesaiPada ? timeAgo(d.selesaiPada) : ""}`}</span>
          </div>
          <div className="mt-2 kg-bar"><span style={{ width: `${pct}%` }} /></div>
          {d.status === "aktif" && <p className="mt-1.5 text-[11px] text-muted">Sisa {rupiah(d.sisaRp)} untuk {d.sisaSlot} orang lagi.</p>}
        </div>
      </div>

      <div className="card-shadow mt-4 rounded-2xl border border-line bg-surface">
        <h2 className="px-5 pt-4 text-sm font-black text-ink">Siapa saja yang sudah mengambil</h2>
        {d.klaim.length === 0 ? (
          <p className="px-5 py-6 text-center text-xs text-muted">Belum ada yang mengambil. Jadilah yang pertama!</p>
        ) : (
          <ul className="mt-2 divide-y divide-line pb-1" data-testid="kaget-daftar-klaim">
            {d.klaim.map((c, i) => (
              <li key={i} className={`flex items-center justify-between gap-3 px-5 py-2.5 ${c.terbesar ? "kg-baris-terbesar" : ""}`}>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-ink">{c.terbesar ? "👑 " : ""}{c.nama}</p>
                  <p className="text-[11px] text-muted">{c.terbesar ? "Paling beruntung · " : ""}{fmtWIB(c.waktu)}</p>
                </div>
                <span className="kg-angka shrink-0 text-sm font-black text-success">{rupiah(c.jumlah)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-4 text-center text-[11px] text-muted">
        Saldo dari Kaget masuk sebagai saldo biasa (untuk beli nokos). <Link href="/kaget" className="font-bold text-amber-bright underline">Buat Kaget sendiri</Link>
      </p>
    </div>
  );
}
