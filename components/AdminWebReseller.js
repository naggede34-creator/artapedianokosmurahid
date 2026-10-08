"use client";

// Kartu "Web Reseller" di Pengaturan Umum: memantau web reseller buatan pengguna, membekukan yang bermasalah.
// Saklar fitur (RW_AKTIF), domain induk (RW_DOMAIN_ROOT), dan markup maksimal ada di Konfigurasi → grup Reseller.
import { useCallback, useEffect, useState } from "react";
import { rupiah, fmtWIB } from "@/components/ui";

export default function AdminWebReseller() {
  const [data, setData] = useState(null);
  const [q, setQ] = useState("");
  const [pesan, setPesan] = useState("");
  const [sibuk, setSibuk] = useState("");

  const muat = useCallback(async () => {
    try {
      const r = await fetch(`/api/admin/web-reseller?q=${encodeURIComponent(q.trim())}`, { cache: "no-store" });
      const d = await r.json();
      if (r.ok) setData(d); else setPesan(d.error || "Gagal memuat.");
    } catch { setPesan("Jaringan bermasalah."); }
  }, [q]);
  useEffect(() => { const t = setTimeout(muat, 250); return () => clearTimeout(t); }, [muat]);

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
      <div className="mt-3 grid grid-cols-3 gap-2.5">
        {[["Web", rs?.web ?? "…"], ["Pesanan selesai", rs?.pesanan ?? "…"], ["Komisi dibayar", rs ? rupiah(rs.komisi) : "…"]].map(([l, v]) => (
          <div key={l} className="rounded-xl border border-line bg-surface p-3"><p className="text-[11px] text-muted">{l}</p><p className="text-base font-black text-ink">{v}</p></div>
        ))}
      </div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama web / merek" className="mt-3 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-amber sm:w-72" />
      {pesan && <p className="mt-2 text-xs font-bold text-rose">{pesan}</p>}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead><tr className="border-b border-line text-left text-xs text-muted">
            <th className="px-3 py-2 font-medium">Web</th><th className="px-3 py-2 font-medium">Markup</th><th className="px-3 py-2 font-medium">Kunjungan</th>
            <th className="px-3 py-2 font-medium">Pesanan</th><th className="px-3 py-2 font-medium">Omzet</th><th className="px-3 py-2 font-medium">Komisi</th><th className="px-3 py-2 text-right font-medium">Aksi</th>
          </tr></thead>
          <tbody>
            {(data?.items || []).map((w) => (
              <tr key={w.slug} className="border-b border-line/60">
                <td className="px-3 py-2"><a href={w.tautan} target="_blank" rel="noreferrer" className="font-bold text-amber-bright underline">{w.nama}</a><span className="block text-[10px] text-muted">{w.slug} · {w.pemilik} · {fmtWIB(w.createdAt)}</span></td>
                <td className="px-3 py-2">{w.markupPersen}%</td>
                <td className="px-3 py-2">{w.kunjungan}</td>
                <td className="px-3 py-2">{w.pesananSelesai}/{w.pesananTotal}</td>
                <td className="px-3 py-2">{rupiah(w.omzet)}</td>
                <td className="px-3 py-2">{rupiah(w.komisiTotal)}{w.komisiTertunda > 0 && <span className="block text-[10px] text-muted">+{rupiah(w.komisiTertunda)} tertunda</span>}</td>
                <td className="px-3 py-2 text-right">
                  <button disabled={sibuk === w.slug} onClick={() => beku(w)} className={`rounded-lg border px-3 py-1 text-xs font-bold disabled:opacity-50 ${w.dibekukan ? "border-success/40 text-success" : "border-rose/40 text-rose"}`}>
                    {w.dibekukan ? "Buka blokir" : "Bekukan"}
                  </button>
                </td>
              </tr>
            ))}
            {data && data.items.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-xs text-muted">Belum ada web reseller.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
