"use client";

// Kartu "Web Reseller" di Pengaturan Umum: memantau web reseller buatan pengguna, membekukan yang bermasalah.
// Saklar fitur (RW_AKTIF), domain induk (RW_DOMAIN_ROOT), dan markup maksimal ada di Konfigurasi → grup Reseller.
import { useCallback, useEffect, useState } from "react";
import { rupiah, fmtWIB, timeAgo } from "@/components/ui";

export default function AdminWebReseller() {
  const [data, setData] = useState(null);
  const [q, setQ] = useState("");
  const [pesan, setPesan] = useState("");
  const [sibuk, setSibuk] = useState("");
  const [detail, setDetail] = useState(null);
  const [muatDetail, setMuatDetail] = useState("");

  const muat = useCallback(async () => {
    try {
      const r = await fetch(`/api/admin/web-reseller?q=${encodeURIComponent(q.trim())}`, { cache: "no-store" });
      const d = await r.json();
      if (r.ok) setData(d); else setPesan(d.error || "Gagal memuat.");
    } catch { setPesan("Jaringan bermasalah."); }
  }, [q]);
  useEffect(() => { const t = setTimeout(muat, 250); return () => clearTimeout(t); }, [muat]);

  async function bukaDetail(w) {
    if (detail?.slug === w.slug) { setDetail(null); return; }
    setMuatDetail(w.slug); setPesan("");
    try {
      const r = await fetch(`/api/admin/web-reseller?slug=${encodeURIComponent(w.slug)}`, { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Gagal memuat detail.");
      setDetail(d);
    } catch (e) { setPesan(e.message); } finally { setMuatDetail(""); }
  }

  async function beku(w) {
    const mau = !w.dibekukan;
    if (mau && !window.confirm(`Bekukan web "${w.nama}" (${w.slug})? Pengunjung akan melihat web utama.`)) return;
    setSibuk(w.slug); setPesan("");
    try {
      const r = await fetch("/api/admin/web-reseller", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: w.slug, dibekukan: mau }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Gagal.");
      muat();
    } catch (e) { setPesan(e.message); } finally { setSibuk(""); }
  }

  const rs = data?.ringkasan;
  return (
    <div className="glass rounded-2xl p-5 shadow-soft sm:p-6" data-testid="admin-web-reseller">
      <h2 className="font-display text-base font-semibold text-ink">🌐 Web Reseller</h2>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        Web jualan buatan pengguna (satu per akun). Komisi pemilik cair saat OTP masuk dan ditarik otomatis lewat AustinPay
        (minimal Rp11.000, biaya Rp1.000). Saklar, domain induk subdomain, dan markup maksimal: tab <b>Konfigurasi</b> → grup Reseller (kunci <code>RW_*</code>).
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {[["Web", rs?.web ?? "…"], ["Pengguna web reseller", rs?.pengguna ?? "…"], ["Pesanan selesai", rs?.pesanan ?? "…"], ["Komisi dibayar", rs ? rupiah(rs.komisi) : "…"]].map(([l, v]) => (
          <div key={l} className="rounded-xl border border-line bg-surface p-3"><p className="text-[11px] text-muted">{l}</p><p className="text-base font-black text-ink">{v}</p></div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2" data-testid="rw-backup">
        <span className="text-xs font-bold text-ink">💾 Backup semua web reseller:</span>
        <a href="/api/admin/backup-reseller?jenis=web&format=json" className="rounded-lg bg-ink px-3 py-1.5 text-xs font-bold text-bg" data-testid="rw-backup-json">JSON lengkap</a>
        <a href="/api/admin/backup-reseller?jenis=web&format=csv" className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-ink" data-testid="rw-backup-csv">CSV pengguna</a>
        <span className="text-[10px] text-muted">berisi token akun (kredensial) — simpan aman</span>
      </div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama web / merek" className="mt-3 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-amber sm:w-72" />
      {pesan && <p className="mt-2 text-xs font-bold text-rose">{pesan}</p>}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead><tr className="border-b border-line text-left text-xs text-muted">
            <th className="px-3 py-2 font-medium">Web</th><th className="px-3 py-2 font-medium">Markup</th><th className="px-3 py-2 font-medium">Pengguna</th><th className="px-3 py-2 font-medium">Kunjungan</th>
            <th className="px-3 py-2 font-medium">Pesanan</th><th className="px-3 py-2 font-medium">Omzet</th><th className="px-3 py-2 font-medium">Komisi</th><th className="px-3 py-2 text-right font-medium">Aksi</th>
          </tr></thead>
          <tbody>
            {(data?.items || []).map((w) => (
              <tr key={w.slug} className="border-b border-line/60">
                <td className="px-3 py-2"><a href={w.tautan} target="_blank" rel="noreferrer" className="font-bold text-amber-bright underline">{w.nama}</a><span className="block text-[10px] text-muted">{w.slug} · {w.pemilik} · {fmtWIB(w.createdAt)}</span></td>
                <td className="px-3 py-2">{w.markupPersen}%</td>
                <td className="px-3 py-2 font-bold" data-testid="rw-pengguna">{w.pengguna}</td>
                <td className="px-3 py-2">{w.kunjungan}</td>
                <td className="px-3 py-2">{w.pesananSelesai}/{w.pesananTotal}</td>
                <td className="px-3 py-2">{rupiah(w.omzet)}</td>
                <td className="px-3 py-2">{rupiah(w.komisiTotal)}{w.komisiTertunda > 0 && <span className="block text-[10px] text-muted">+{rupiah(w.komisiTertunda)} tertunda</span>}</td>
                <td className="space-x-1.5 whitespace-nowrap px-3 py-2 text-right">
                  <button onClick={() => bukaDetail(w)} disabled={muatDetail === w.slug} data-testid={`rw-detail-${w.slug}`} className="rounded-lg border border-line px-3 py-1 text-xs font-bold text-ink disabled:opacity-50">{muatDetail === w.slug ? "…" : detail?.slug === w.slug ? "Tutup" : "Statistik"}</button>
                  <button disabled={sibuk === w.slug} onClick={() => beku(w)} className={`rounded-lg border px-3 py-1 text-xs font-bold disabled:opacity-50 ${w.dibekukan ? "border-success/40 text-success" : "border-rose/40 text-rose"}`}>
                    {w.dibekukan ? "Buka blokir" : "Bekukan"}
                  </button>
                </td>
              </tr>
            ))}
            {data && data.items.length === 0 && <tr><td colSpan={8} className="px-3 py-8 text-center text-xs text-muted">Belum ada web reseller.</td></tr>}
          </tbody>
        </table>
      </div>
      {detail && (
        <div className="mt-4 rounded-xl border border-line bg-surface p-4" data-testid="rw-detail">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-black text-ink">📊 {detail.nama} <span className="font-mono text-xs font-normal text-muted">({detail.slug} · pemilik {detail.pemilik} · dibuat {fmtWIB(detail.dibuat)})</span></p>
            <div className="flex gap-2">
              <a href={`/api/admin/backup-reseller?jenis=web&id=${detail.slug}&format=json`} className="rounded-lg bg-ink px-3 py-1 text-xs font-bold text-bg">Backup JSON web ini</a>
              <a href={`/api/admin/backup-reseller?jenis=web&id=${detail.slug}&format=csv`} className="rounded-lg border border-line px-3 py-1 text-xs font-bold text-ink">CSV</a>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {[["Pengguna", detail.jumlahPengguna], ["Kunjungan", detail.statistik.kunjungan], ["Pesanan", `${detail.statistik.pesananSelesai}/${detail.statistik.pesananTotal}`], ["Omzet", rupiah(detail.statistik.omzet)], ["Komisi total", rupiah(detail.statistik.komisiTotal)], ["Komisi tertunda", rupiah(detail.statistik.komisiTertunda)], ["Saldo pemilik", rupiah(detail.statistik.saldo)], ["Markup", `${detail.markupPersen}%`]].map(([l, v]) => (
              <div key={l} className="rounded-lg border border-line bg-surface2 p-2.5"><p className="text-[10px] text-muted">{l}</p><p className="text-sm font-black text-ink">{v}</p></div>
            ))}
          </div>
          <div className="mt-3 flex h-24 items-end gap-1" role="img" aria-label="Komisi 14 hari terakhir">
            {(() => { const m = Math.max(1, ...detail.statistik.hari.map((h) => h.komisi)); return detail.statistik.hari.map((h) => (
              <div key={h.tanggal} title={`${h.tanggal} · ${h.pesanan} pesanan · ${rupiah(h.komisi)} · ${h.kunjungan} kunjungan`} className="flex-1 rounded-t bg-amber/80" style={{ height: `${Math.max(3, (h.komisi / m) * 100)}%` }} />
            )); })()}
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-xs font-black text-ink">Pesanan terbaru</p>
              {detail.statistik.terbaru.length === 0 ? <p className="mt-1 text-xs text-muted">Belum ada.</p> : (
                <ul className="mt-1 divide-y divide-line text-xs">{detail.statistik.terbaru.map((o, i) => <li key={i} className="flex justify-between gap-2 py-1.5"><span className="truncate">{o.layanan} · {o.negara} <span className="text-muted">({o.selesai ? "selesai" : "menunggu"})</span></span><b className="shrink-0">+{rupiah(o.komisi)}</b></li>)}</ul>
              )}
            </div>
            <div>
              <p className="text-xs font-black text-ink">Pengguna terbaru ({detail.jumlahPengguna} total)</p>
              {detail.penggunaTerbaru.length === 0 ? <p className="mt-1 text-xs text-muted">Belum ada yang mendaftar.</p> : (
                <ul className="mt-1 divide-y divide-line text-xs">{detail.penggunaTerbaru.map((u, i) => <li key={i} className="flex justify-between gap-2 py-1.5"><span className="truncate">{u.nama || "(tanpa nama)"} <span className="font-mono text-muted">{u.token}</span></span><span className="shrink-0 text-muted">{rupiah(u.saldo)} · {timeAgo(u.dibuat)}</span></li>)}</ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
