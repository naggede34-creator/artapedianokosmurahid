"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/app/providers";
import { useRouter } from "next/navigation";

function fmt(n) {
  return "Rp " + Number(n || 0).toLocaleString("id-ID");
}

function fmtDate(d) {
  if (!d) return "-";
  return new Date(d).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" });
}

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); }); }}
      style={{ background: copied ? "#22c55e" : "#6366f1", color: "#fff", border: "none", borderRadius: 8, padding: "4px 12px", cursor: "pointer", fontSize: 13, transition: "background .2s" }}
    >
      {copied ? "✓ Disalin" : "Salin"}
    </button>
  );
}

export default function ResellerDashboard() {
  const { token, ready } = useUser();
  const router = useRouter();

  const [reseller, setReseller] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  // form state
  const [webName, setWebName] = useState("");
  const [markup, setMarkup] = useState(0);
  const [logo, setLogo] = useState("");
  const [description, setDescription] = useState("");
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (!ready) return;
    if (!token) { router.replace("/"); return; }
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, token]);

  async function loadData() {
    setLoading(true);
    try {
      const [rRes, sRes] = await Promise.all([
        fetch(`/api/reseller/my?token=${token}`),
        fetch(`/api/reseller/stats?token=${token}`),
      ]);
      const rData = await rRes.json();
      const sData = await sRes.json();

      if (!rData.reseller) { router.replace("/reseller"); return; }

      setReseller(rData.reseller);
      setStats(sData);
      setWebName(rData.reseller.webName || "");
      setMarkup(rData.reseller.markup || 0);
      setLogo(rData.reseller.logo || "");
      setDescription(rData.reseller.description || "");
      setActive(rData.reseller.active !== false);
    } catch {}
    setLoading(false);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch("/api/reseller/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, webName, markup, logo, description, active }),
      });
      const d = await res.json();
      if (d.ok) { setMsg("✓ Pengaturan disimpan!"); loadData(); }
      else setMsg(d.error || "Gagal simpan.");
    } catch { setMsg("Gagal simpan."); }
    setSaving(false);
  }

  if (!ready || loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f0f1a" }}>
      <div style={{ color: "#a5b4fc", fontSize: 16 }}>Memuat dashboard...</div>
    </div>
  );

  const storeUrl = typeof window !== "undefined" ? `${window.location.origin}/store/${reseller?.slug}` : `/store/${reseller?.slug}`;

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 100%)", color: "#e2e8f0", fontFamily: "system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(90deg, #6366f1, #8b5cf6)", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#fff" }}>🏪 Dashboard Reseller</div>
          <div style={{ fontSize: 13, color: "#c7d2fe", marginTop: 2 }}>{reseller?.webName}</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ background: active ? "#22c55e22" : "#ef444422", color: active ? "#86efac" : "#fca5a5", border: `1px solid ${active ? "#22c55e55" : "#ef444455"}`, borderRadius: 20, padding: "3px 14px", fontSize: 13 }}>
            {active ? "● Aktif" : "○ Nonaktif"}
          </span>
          <a href="/reseller" style={{ background: "#ffffff22", color: "#e0e7ff", border: "none", borderRadius: 8, padding: "6px 14px", textDecoration: "none", fontSize: 13 }}>← Kembali</a>
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px" }}>
        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 24 }}>
          {[
            { label: "Total Transaksi", value: stats?.totalOrders ?? 0, icon: "📦", color: "#6366f1" },
            { label: "Total Komisi", value: fmt(stats?.totalCommission), icon: "💰", color: "#f59e0b" },
            { label: "Markup", value: `${reseller?.markup ?? 0}%`, icon: "📈", color: "#10b981" },
            { label: "Status Toko", value: active ? "Aktif" : "Nonaktif", icon: "🏪", color: active ? "#22c55e" : "#ef4444" },
          ].map((s) => (
            <div key={s.label} style={{ background: "#1e1e35", borderRadius: 14, padding: "18px 20px", border: `1px solid ${s.color}33` }}>
              <div style={{ fontSize: 24 }}>{s.icon}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color, marginTop: 6 }}>{s.value}</div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Store URL */}
        <div style={{ background: "#1e1e35", borderRadius: 14, padding: "18px 20px", marginBottom: 24, border: "1px solid #6366f133" }}>
          <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 8 }}>🔗 URL Toko Kamu</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <code style={{ flex: 1, background: "#0f0f1a", padding: "8px 14px", borderRadius: 8, color: "#a5b4fc", fontSize: 14, wordBreak: "break-all" }}>{storeUrl}</code>
            <CopyBtn text={storeUrl} />
            <a href={`/store/${reseller?.slug}`} target="_blank" rel="noreferrer" style={{ background: "#6366f1", color: "#fff", borderRadius: 8, padding: "6px 14px", textDecoration: "none", fontSize: 13 }}>Buka ↗</a>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
          {/* Settings */}
          <div style={{ background: "#1e1e35", borderRadius: 14, padding: "22px", border: "1px solid #6366f133" }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 18, color: "#a5b4fc" }}>⚙️ Pengaturan Toko</div>
            <form onSubmit={handleSave}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, color: "#94a3b8", display: "block", marginBottom: 5 }}>Nama Web</label>
                <input
                  value={webName}
                  onChange={e => setWebName(e.target.value)}
                  maxLength={50}
                  placeholder="Nama toko kamu"
                  style={{ width: "100%", background: "#0f0f1a", border: "1px solid #6366f133", borderRadius: 8, padding: "9px 12px", color: "#e2e8f0", fontSize: 14, boxSizing: "border-box" }}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, color: "#94a3b8", display: "block", marginBottom: 5 }}>
                  Markup: <strong style={{ color: "#f59e0b" }}>{markup}%</strong>
                </label>
                <input
                  type="range" min={0} max={50} value={markup}
                  onChange={e => setMarkup(Number(e.target.value))}
                  style={{ width: "100%", accentColor: "#6366f1" }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#64748b" }}>
                  <span>0%</span><span>25%</span><span>50%</span>
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, color: "#94a3b8", display: "block", marginBottom: 5 }}>URL Logo (opsional)</label>
                <input
                  value={logo}
                  onChange={e => setLogo(e.target.value)}
                  placeholder="https://..."
                  style={{ width: "100%", background: "#0f0f1a", border: "1px solid #6366f133", borderRadius: 8, padding: "9px 12px", color: "#e2e8f0", fontSize: 14, boxSizing: "border-box" }}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, color: "#94a3b8", display: "block", marginBottom: 5 }}>Deskripsi Toko</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  maxLength={300}
                  rows={3}
                  placeholder="Tulis sedikit tentang tokomu..."
                  style={{ width: "100%", background: "#0f0f1a", border: "1px solid #6366f133", borderRadius: 8, padding: "9px 12px", color: "#e2e8f0", fontSize: 14, resize: "vertical", boxSizing: "border-box" }}
                />
              </div>

              <div style={{ marginBottom: 18, display: "flex", alignItems: "center", gap: 10 }}>
                <label style={{ position: "relative", display: "inline-block", width: 44, height: 24, cursor: "pointer" }}>
                  <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} style={{ opacity: 0, width: 0, height: 0 }} />
                  <span style={{
                    position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: active ? "#6366f1" : "#334155", borderRadius: 12, transition: ".2s"
                  }}></span>
                  <span style={{
                    position: "absolute", top: 3, left: active ? 23 : 3, width: 18, height: 18, background: "#fff", borderRadius: "50%", transition: ".2s"
                  }}></span>
                </label>
                <span style={{ fontSize: 13, color: "#94a3b8" }}>Toko {active ? "aktif (publik)" : "nonaktif (tersembunyi)"}</span>
              </div>

              {msg && <div style={{ fontSize: 13, color: msg.startsWith("✓") ? "#86efac" : "#fca5a5", marginBottom: 12 }}>{msg}</div>}
              <button type="submit" disabled={saving} style={{ width: "100%", background: saving ? "#4338ca88" : "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", border: "none", borderRadius: 10, padding: "11px", fontSize: 15, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer" }}>
                {saving ? "Menyimpan..." : "💾 Simpan Pengaturan"}
              </button>
            </form>
          </div>

          {/* Info panel */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: "#1e1e35", borderRadius: 14, padding: "20px", border: "1px solid #f59e0b33" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#fbbf24", marginBottom: 12 }}>💡 Cara Kerja Komisi</div>
              <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.7 }}>
                Setiap transaksi pelanggan di tokomu, kamu dapat komisi sebesar <strong style={{ color: "#f59e0b" }}>{reseller?.markup ?? 0}%</strong> dari harga dasar.<br /><br />
                Contoh: Jika harga OTP Rp 2.000 dan markup {reseller?.markup ?? 0}%, pelangganmu bayar <strong style={{ color: "#a5b4fc" }}>Rp {Math.round(2000 * (1 + (reseller?.markup ?? 0) / 100)).toLocaleString("id-ID")}</strong>, komisimu <strong style={{ color: "#f59e0b" }}>Rp {Math.round(2000 * (reseller?.markup ?? 0) / 100).toLocaleString("id-ID")}</strong>.
              </div>
            </div>

            <div style={{ background: "#1e1e35", borderRadius: 14, padding: "20px", border: "1px solid #22c55e33" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#86efac", marginBottom: 12 }}>📊 Info Toko</div>
              <div style={{ fontSize: 13, color: "#94a3b8" }}>
                <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: 8, borderBottom: "1px solid #1e293b", marginBottom: 8 }}>
                  <span>Slug / URL</span><span style={{ color: "#a5b4fc" }}>{reseller?.slug}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: 8, borderBottom: "1px solid #1e293b", marginBottom: 8 }}>
                  <span>Bergabung</span><span style={{ color: "#a5b4fc" }}>{fmtDate(reseller?.createdAt)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Total Pelanggan Bertransaksi</span><span style={{ color: "#a5b4fc" }}>{stats?.totalOrders ?? 0}x</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Transaction History */}
        <div style={{ background: "#1e1e35", borderRadius: 14, padding: "22px", border: "1px solid #6366f133" }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 18, color: "#a5b4fc" }}>📋 Riwayat Transaksi (50 terakhir)</div>
          {!stats?.orders?.length ? (
            <div style={{ textAlign: "center", color: "#475569", padding: "32px 0", fontSize: 14 }}>Belum ada transaksi dari pelangganmu.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #334155" }}>
                    {["Waktu", "Layanan", "Detail", "Charge", "Komisi", "Pembeli"].map(h => (
                      <th key={h} style={{ padding: "8px 10px", textAlign: "left", color: "#64748b", fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stats.orders.map((o) => (
                    <tr key={o.id} style={{ borderBottom: "1px solid #1e293b" }}>
                      <td style={{ padding: "8px 10px", color: "#64748b" }}>{fmtDate(o.createdAt)}</td>
                      <td style={{ padding: "8px 10px", color: "#e2e8f0" }}>{o.type}</td>
                      <td style={{ padding: "8px 10px", color: "#94a3b8", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.detail}</td>
                      <td style={{ padding: "8px 10px", color: "#e2e8f0" }}>{fmt(o.charge)}</td>
                      <td style={{ padding: "8px 10px", color: "#86efac", fontWeight: 600 }}>{fmt(o.commission)}</td>
                      <td style={{ padding: "8px 10px", color: "#64748b", fontFamily: "monospace" }}>{o.buyerToken}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
