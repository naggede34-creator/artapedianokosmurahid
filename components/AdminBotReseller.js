"use client";

// Kartu "Bot Reseller" di Pengaturan Umum: daftar bot reseller buatan pengguna beserta statistiknya dan backup pengguna bot.
// Token bot (kredensial Telegram) tidak pernah dikirim ke sini maupun masuk ke berkas backup.
import { useEffect, useState } from "react";
import { rupiah, fmtWIB } from "@/components/ui";

export default function AdminBotReseller() {
  const [data, setData] = useState(null);
  const [pesan, setPesan] = useState("");
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/admin/bot-reseller", { cache: "no-store" });
        const d = await r.json();
        if (r.ok) setData(d); else setPesan(d.error || "Gagal memuat.");
      } catch { setPesan("Jaringan bermasalah."); }
    })();
  }, []);
  const rs = data?.ringkasan;
  return (
    <div className="glass rounded-2xl p-5 shadow-soft sm:p-6" data-testid="admin-bot-reseller">
      <h2 className="font-display text-base font-semibold text-ink">🤖 Bot Reseller</h2>
      <p className="mt-1 text-xs leading-relaxed text-muted">Bot Telegram reseller buatan pengguna. Pengguna bot = akun yang mendaftar lewat bot itu.</p>
      <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {[["Bot", rs?.bot ?? "…"], ["Pengguna bot", rs?.pengguna ?? "…"], ["Pesanan selesai", rs?.pesanan ?? "…"], ["Omzet", rs ? rupiah(rs.omzet) : "…"]].map(([l, v]) => (
          <div key={l} className="rounded-xl border border-line bg-surface p-3"><p className="text-[11px] text-muted">{l}</p><p className="text-lg font-black text-ink">{v}</p></div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2" data-testid="bot-backup">
        <span className="text-xs font-bold text-ink">💾 Backup pengguna semua bot reseller:</span>
        <a href="/api/admin/backup-reseller?jenis=bot&format=json" className="rounded-lg bg-ink px-3 py-1.5 text-xs font-bold text-bg" data-testid="bot-backup-json">JSON lengkap</a>
        <a href="/api/admin/backup-reseller?jenis=bot&format=csv" className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-ink" data-testid="bot-backup-csv">CSV pengguna</a>
        <span className="text-[10px] text-muted">berisi token akun (kredensial); token bot tidak ikut</span>
      </div>
      {pesan && <p className="mt-2 text-xs font-bold text-rose">{pesan}</p>}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead><tr className="border-b border-line text-left text-xs text-muted">
            <th className="px-3 py-2 font-medium">Bot</th><th className="px-3 py-2 font-medium">Pemilik</th><th className="px-3 py-2 font-medium">Markup</th>
            <th className="px-3 py-2 font-medium">Pengguna</th><th className="px-3 py-2 font-medium">Pesanan</th><th className="px-3 py-2 font-medium">Omzet</th><th className="px-3 py-2 font-medium">Komisi</th><th className="px-3 py-2 text-right font-medium">Backup</th>
          </tr></thead>
          <tbody>
            {(data?.items || []).map((b) => (
              <tr key={b.botId} className="border-b border-line/60">
                <td className="px-3 py-2"><span className="font-bold text-ink">{b.nama || b.username}</span><span className="block text-[10px] text-muted">@{b.username} · {b.aktif ? "aktif" : "mati"}{b.dimatikanAdmin ? " (admin)" : ""} · {fmtWIB(b.dibuat)}</span></td>
                <td className="px-3 py-2"><span className="text-xs text-ink">{b.ownerUsername ? `@${b.ownerUsername}` : "-"}</span><span className="block font-mono text-[10px] text-muted">{b.pemilik}</span></td>
                <td className="px-3 py-2">{b.markupPersen}%</td>
                <td className="px-3 py-2 font-bold" data-testid="bot-pengguna">{b.pengguna}</td>
                <td className="px-3 py-2">{b.pesananSelesai}/{b.pesanan}</td>
                <td className="px-3 py-2">{rupiah(b.omzet)}</td>
                <td className="px-3 py-2">{rupiah(b.komisiSelesai)}<span className="block text-[10px] text-muted">saldo {rupiah(b.komisiSaldo)}</span></td>
                <td className="space-x-1.5 whitespace-nowrap px-3 py-2 text-right">
                  <a href={`/api/admin/backup-reseller?jenis=bot&id=${encodeURIComponent(b.botId)}&format=json`} className="rounded-lg border border-line px-2.5 py-1 text-xs font-bold text-ink">JSON</a>
                  <a href={`/api/admin/backup-reseller?jenis=bot&id=${encodeURIComponent(b.botId)}&format=csv`} className="rounded-lg border border-line px-2.5 py-1 text-xs font-bold text-ink">CSV</a>
                </td>
              </tr>
            ))}
            {data && data.items.length === 0 && <tr><td colSpan={8} className="px-3 py-8 text-center text-xs text-muted">Belum ada bot reseller.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
