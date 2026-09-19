"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/app/providers";

const BENEFITS = [
  { icon: "🌐", title: "Web Toko Sendiri", desc: "Punya URL toko nokos unik dengan nama brand kamu sendiri, bisa dibagikan ke siapapun." },
  { icon: "📈", title: "Markup Bebas", desc: "Set harga jual sendiri — markup sekecil 1% atau sebesar 50%, semua keuntungan milikmu." },
  { icon: "💰", title: "Komisi Otomatis", desc: "Setiap transaksi di tokomu, komisi markup langsung masuk ke saldo Artapedia-mu." },
  { icon: "📊", title: "Dashboard Lengkap", desc: "Pantau total order, omzet, dan riwayat transaksi pelangganmu kapan saja." },
  { icon: "🔔", title: "Notif Real-time", desc: "Setiap ada order masuk di tokomu, notifikasi langsung ke channel Telegram kami." },
  { icon: "⚡", title: "Layanan Penuh", desc: "Semua layanan OTP & suntik sosmed Artapedia tersedia di tokomu secara otomatis." },
  { icon: "🎨", title: "Branding Custom", desc: "Upload logo, atur nama toko, deskripsi — tampilan profesional tanpa coding." },
  { icon: "🛡️", title: "Support Prioritas", desc: "Reseller mendapat jalur support prioritas & update fitur lebih awal dari member biasa." },
];

const TNC = [
  "Biaya aktivasi web reseller adalah Rp10.000 (sekali bayar, potong dari saldo Artapedia).",
  "Saldo minimal harus mencukupi Rp10.000 sebelum mendaftar.",
  "Slug/URL web tidak dapat diubah setelah dibuat.",
  "Reseller bertanggung jawab atas promosi tokonya sendiri.",
  "Artapedia menjamin semua order yang masuk melalui toko reseller diproses dengan kualitas yang sama.",
  "Markup dihitung dari harga modal Artapedia. Tidak ada batas minimum atau maksimum markup.",
  "Komisi dibayar instan ke saldo Artapedia setiap kali pelanggan bertransaksi.",
  "Artapedia berhak menonaktifkan akun reseller yang terbukti melakukan penipuan.",
  "Tidak ada biaya bulanan — bayar sekali, aktif selamanya.",
  "Program reseller dapat dihentikan sewaktu-waktu dengan pemberitahuan 7 hari sebelumnya.",
];

function slugify(str) {
  return String(str || "").toLowerCase().replace(/[^a-z0-9\-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 30);
}

/* ── Comic 3D Hero (tanpa foto karakter) ─────────────────────────── */
function ComicHero({ reseller, onBuy, router }) {
  return (
    <div style={{ position: "relative", width: "100%", maxWidth: 900, margin: "0 auto", padding: "8px 16px 0" }}>
      {/* Halftone BG */}
      <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle, rgba(37,211,102,.1) 1.5px, transparent 1.5px)", backgroundSize: "20px 20px", borderRadius: 24, pointerEvents: "none" }} />

      <div style={{ display: "flex", gap: 12, alignItems: "stretch", position: "relative", zIndex: 1, flexWrap: "wrap", justifyContent: "center" }}>

        {/* ── Panel kiri ── */}
        <div style={{ transform: "perspective(700px) rotateY(14deg) rotateX(-2deg)", transformOrigin: "right center", flex: "0 0 auto", width: "min(210px,44vw)", zIndex: 2, marginRight: -20, display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Stat card 1 */}
          <div style={{ background: "linear-gradient(135deg,#0d1f12,#162a1d)", border: "3px solid #111", borderRadius: 14, padding: "14px 14px", boxShadow: "5px 5px 0 #111" }}>
            <div style={{ fontSize: 10, color: "#25D366", fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>💳 Biaya Aktivasi</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#fff", lineHeight: 1, marginBottom: 2 }}>Rp10K</div>
            <div style={{ fontSize: 10.5, color: "rgba(255,255,255,.35)" }}>Sekali bayar • selamanya</div>
          </div>
          {/* Stat card 2 */}
          <div style={{ background: "linear-gradient(135deg,#1a0d2e,#1e1040)", border: "3px solid #111", borderRadius: 14, padding: "14px 14px", boxShadow: "5px 5px 0 #111" }}>
            <div style={{ fontSize: 10, color: "#a78bfa", fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>📈 Markup Kamu</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#fff", lineHeight: 1, marginBottom: 2 }}>0 – 50%</div>
            <div style={{ fontSize: 10.5, color: "rgba(255,255,255,.35)" }}>Bebas atur harga jual</div>
          </div>
          {/* Speech bubble */}
          <div style={{ background: "#fff", border: "3px solid #111", borderRadius: "14px 14px 4px 14px", padding: "10px 12px", boxShadow: "4px 4px 0 #111", position: "relative" }}>
            <div style={{ position: "absolute", bottom: -14, right: 16, width: 0, height: 0, borderLeft: "9px solid transparent", borderTop: "14px solid #111" }} />
            <div style={{ position: "absolute", bottom: -10, right: 17, width: 0, height: 0, borderLeft: "7px solid transparent", borderTop: "11px solid white" }} />
            <p style={{ margin: 0, fontSize: 12, color: "#111", fontWeight: 700, lineHeight: 1.4 }}>Bisnis nokos tanpa modal besar! 🚀</p>
          </div>
        </div>

        {/* ── Panel tengah utama ── */}
        <div style={{ flex: "0 0 auto", width: "min(320px,80vw)", zIndex: 4, position: "relative" }}>
          {/* Sunburst */}
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 300, height: 300, background: "conic-gradient(from 0deg,rgba(37,211,102,.12) 0deg,transparent 18deg,rgba(37,211,102,.12) 36deg,transparent 54deg,rgba(37,211,102,.12) 72deg,transparent 90deg,rgba(37,211,102,.12) 108deg,transparent 126deg,rgba(37,211,102,.12) 144deg,transparent 162deg,rgba(37,211,102,.12) 180deg,transparent 198deg,rgba(37,211,102,.12) 216deg,transparent 234deg,rgba(37,211,102,.12) 252deg,transparent 270deg,rgba(37,211,102,.12) 288deg,transparent 306deg,rgba(37,211,102,.12) 324deg,transparent 342deg,rgba(37,211,102,.12) 360deg)", borderRadius: "50%", pointerEvents: "none", opacity: .7 }} />

          <div style={{ position: "relative", zIndex: 1, border: "4px solid #111", borderRadius: 20, overflow: "hidden", boxShadow: "8px 8px 0 #111, 0 0 0 2px #25D366" }}>
            {/* Top bar */}
            <div style={{ background: "#25D366", padding: "8px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "3px solid #111" }}>
              <span style={{ fontSize: 10, fontWeight: 900, color: "#111", textTransform: "uppercase", letterSpacing: 1 }}>✦ Artapedia Reseller ✦</span>
              <div style={{ display: "flex", gap: 4 }}>
                {["#ff5f57","#febc2e","#28c840"].map(c => <div key={c} style={{ width: 8, height: 8, borderRadius: "50%", background: c, border: "1px solid rgba(0,0,0,.3)" }} />)}
              </div>
            </div>

            {/* Main body — dashboard style */}
            <div style={{ background: "linear-gradient(180deg,#0d1f12,#111827)", padding: "22px 18px", position: "relative", minHeight: 240 }}>
              {/* SVG speed lines */}
              <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: .07, pointerEvents: "none" }} viewBox="0 0 320 240" preserveAspectRatio="none">
                {Array.from({ length: 20 }).map((_, i) => (
                  <line key={i} x1="160" y1="120" x2={i * 17} y2="0" stroke="#25D366" strokeWidth="1.2" />
                ))}
                {Array.from({ length: 20 }).map((_, i) => (
                  <line key={`b${i}`} x1="160" y1="120" x2={i * 17} y2="240" stroke="#25D366" strokeWidth="1.2" />
                ))}
              </svg>

              {/* Content */}
              <div style={{ position: "relative", zIndex: 1, textAlign: "center" }}>
                <div style={{ fontSize: 48, marginBottom: 6 }}>🏪</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: "#fff", marginBottom: 4, letterSpacing: -.5 }}>Web Nokos Kamu</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,.4)", marginBottom: 18 }}>Branded store milikmu sendiri</div>

                {/* Mini stats */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 18 }}>
                  {[
                    { label: "Biaya bulanan", val: "Rp0", color: "#25D366" },
                    { label: "Bagi hasil", val: "100%", color: "#a78bfa" },
                    { label: "Batas order", val: "∞", color: "#fbbf24" },
                    { label: "Layanan", val: "Semua", color: "#f87171" },
                  ].map(s => (
                    <div key={s.label} style={{ background: "rgba(255,255,255,.06)", borderRadius: 10, padding: "8px 10px", border: "1px solid rgba(255,255,255,.06)" }}>
                      <div style={{ fontSize: 15, fontWeight: 900, color: s.color }}>{s.val}</div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,.35)", marginTop: 1 }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {reseller ? (
                  <button onClick={() => router.push("/reseller/dashboard")}
                    style={{ width: "100%", padding: "11px", background: "linear-gradient(135deg,#128C7E,#25D366)", border: "none", borderRadius: 10, color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
                    📊 Buka Dashboard →
                  </button>
                ) : (
                  <button onClick={onBuy}
                    style={{ width: "100%", padding: "11px", background: "linear-gradient(135deg,#128C7E,#25D366)", border: "none", borderRadius: 10, color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
                    🚀 Aktifkan — Rp10.000
                  </button>
                )}
              </div>
            </div>

            {/* Bottom bar */}
            <div style={{ background: "#111", padding: "7px 14px", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#25D366", display: "inline-block", animation: "blink 1.4s infinite" }} />
              <span style={{ fontSize: 11, fontWeight: 800, color: "#25D366", letterSpacing: .5 }}>PROGRAM AKTIF</span>
              <span style={{ marginLeft: "auto", fontSize: 11, color: "rgba(255,255,255,.3)" }}>artapedia.web.id</span>
            </div>
          </div>

          {/* Price starburst */}
          <div style={{ position: "absolute", top: -14, right: -14, width: 60, height: 60, background: "#fbbf24", border: "3px solid #111", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "3px 3px 0 #111", zIndex: 5, transform: "rotate(12deg)", cursor: "pointer" }} onClick={onBuy}>
            <div style={{ textAlign: "center", transform: "rotate(-12deg)" }}>
              <div style={{ fontSize: 8, fontWeight: 900, color: "#111", lineHeight: 1.1, textTransform: "uppercase" }}>Cuma</div>
              <div style={{ fontSize: 14, fontWeight: 900, color: "#111", lineHeight: 1 }}>10K</div>
              <div style={{ fontSize: 7, fontWeight: 900, color: "#111", lineHeight: 1.1 }}>sekali!</div>
            </div>
          </div>
        </div>

        {/* ── Panel kanan ── */}
        <div style={{ transform: "perspective(700px) rotateY(-14deg) rotateX(-2deg)", transformOrigin: "left center", flex: "0 0 auto", width: "min(210px,44vw)", zIndex: 2, marginLeft: -20, display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Komisi card */}
          <div style={{ background: "linear-gradient(135deg,#1a1000,#2d1d00)", border: "3px solid #111", borderRadius: 14, padding: "14px 14px", boxShadow: "-5px 5px 0 #111" }}>
            <div style={{ fontSize: 10, color: "#fbbf24", fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>💰 Komisi Per Order</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#fff", lineHeight: 1, marginBottom: 2 }}>+Markup</div>
            <div style={{ fontSize: 10.5, color: "rgba(255,255,255,.35)" }}>Langsung ke saldo kamu</div>
          </div>
          {/* Cara kerja card */}
          <div style={{ background: "linear-gradient(135deg,#0d1117,#161b22)", border: "3px solid #111", borderRadius: 14, padding: "14px 14px", boxShadow: "-5px 5px 0 #111" }}>
            <div style={{ fontSize: 10, color: "#60a5fa", fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>🗺️ Cara Kerja</div>
            {[
              { n: "1", t: "Beli paket 10K" },
              { n: "2", t: "Set nama & markup" },
              { n: "3", t: "Share link toko" },
            ].map(s => (
              <div key={s.n} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#25D366", border: "2px solid #111", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 900, color: "#111", flexShrink: 0 }}>{s.n}</div>
                <span style={{ fontSize: 11.5, color: "rgba(255,255,255,.65)", fontWeight: 600 }}>{s.t}</span>
              </div>
            ))}
          </div>
          {/* Thought bubble */}
          <div style={{ background: "#fff", border: "3px solid #111", borderRadius: "4px 14px 14px 14px", padding: "10px 12px", boxShadow: "-4px 4px 0 #111", position: "relative" }}>
            <div style={{ position: "absolute", top: -10, left: 14, display: "flex", gap: 3 }}>
              {[6, 4, 3].map((s, i) => <div key={i} style={{ width: s, height: s, borderRadius: "50%", background: "#111" }} />)}
            </div>
            <p style={{ margin: 0, fontSize: 12, color: "#111", fontWeight: 700, lineHeight: 1.4 }}>Komisi ngalir tiap hari! 💪</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Register Modal ───────────────────────────────────────────────── */
function RegisterModal({ token, balance, onClose, onSuccess }) {
  const [webName, setWebName] = useState("");
  const [markup, setMarkup] = useState(10);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const slug = slugify(webName);

  async function submit() {
    if (!webName.trim() || webName.trim().length < 3) { setErr("Nama web minimal 3 karakter."); return; }
    if (balance < 10000) { setErr("Saldo tidak cukup. Deposit dulu minimal Rp10.000."); return; }
    setLoading(true);
    setErr("");
    try {
      const r = await fetch("/api/reseller/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, webName: webName.trim(), markup })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Gagal mendaftar.");
      onSuccess(d);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,.8)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 440, background: "#0d1117", borderRadius: 22, overflow: "hidden", border: "1px solid rgba(255,255,255,.08)", boxShadow: "0 32px 80px rgba(0,0,0,.7), 0 0 0 1.5px #25D36644" }}>
        {/* Comic top bar */}
        <div style={{ background: "linear-gradient(90deg,#128C7E,#25D366,#fbbf24)", height: 5 }} />
        <div style={{ background: "#111", padding: "6px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
          <span style={{ fontSize: 10, fontWeight: 900, color: "#25D366", textTransform: "uppercase", letterSpacing: 1 }}>✦ Aktivasi Web Reseller ✦</span>
          <div style={{ display: "flex", gap: 4 }}>
            {["#ff5f57","#febc2e","#28c840"].map(c => <div key={c} style={{ width: 8, height: 8, borderRadius: "50%", background: c }} />)}
          </div>
        </div>
        <div style={{ padding: "22px 22px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22 }}>
            <div style={{ width: 46, height: 46, borderRadius: 14, background: "linear-gradient(135deg,#0d1f12,#25D366)", border: "2px solid #25D36655", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, boxShadow: "0 4px 12px rgba(37,211,102,.3)" }}>🏪</div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 800, color: "white" }}>Buat Web Nokos</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,.4)", marginTop: 1 }}>Saldo kamu: <b style={{ color: balance >= 10000 ? "#25D366" : "#f87171" }}>Rp{balance.toLocaleString("id-ID")}</b></div>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,.35)", marginBottom: 6, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".8px" }}>Nama Web Toko</div>
            <input type="text" value={webName} onChange={e => { setWebName(e.target.value); setErr(""); }}
              placeholder="contoh: Toko Nokos Budi" maxLength={50}
              style={{ width: "100%", background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, padding: "11px 14px", color: "rgba(255,255,255,.9)", fontSize: 14, outline: "none", boxSizing: "border-box", transition: "border .2s" }}
              onFocus={e => e.currentTarget.style.borderColor = "rgba(37,211,102,.5)"}
              onBlur={e => e.currentTarget.style.borderColor = "rgba(255,255,255,.1)"} />
            {slug && (
              <div style={{ fontSize: 11, color: "rgba(255,255,255,.25)", marginTop: 5 }}>
                🔗 URL toko: <span style={{ color: "#25D366", fontWeight: 700 }}>/store/{slug}</span>
              </div>
            )}
          </div>

          <div style={{ marginBottom: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,.35)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".8px" }}>Markup Harga</div>
              <div style={{ background: "rgba(37,211,102,.15)", border: "1px solid rgba(37,211,102,.35)", borderRadius: 8, padding: "4px 14px", fontSize: 16, fontWeight: 900, color: "#25D366" }}>+{markup}%</div>
            </div>
            <input type="range" min={0} max={50} value={markup} onChange={e => setMarkup(Number(e.target.value))}
              style={{ width: "100%", accentColor: "#25D366", height: 6 }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "rgba(255,255,255,.2)", marginTop: 3 }}>
              <span>0% (gratis)</span><span>25%</span><span>50% (max)</span>
            </div>
          </div>

          {err && (
            <div style={{ background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.3)", borderRadius: 10, padding: "9px 14px", fontSize: 13, color: "#f87171", marginBottom: 16, display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span style={{ flexShrink: 0 }}>⚠</span> {err}
            </div>
          )}

          <div style={{ background: "rgba(251,191,36,.06)", border: "1px solid rgba(251,191,36,.18)", borderRadius: 12, padding: "10px 14px", marginBottom: 20 }}>
            <div style={{ fontSize: 12.5, color: "rgba(255,255,255,.65)", lineHeight: 1.6 }}>
              💳 Biaya aktivasi <b style={{ color: "#fbbf24" }}>Rp10.000</b> dipotong dari saldo kamu. Tidak dapat dikembalikan.
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onClose} style={{ flex: 1, padding: "12px", borderRadius: 12, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.08)", color: "rgba(255,255,255,.55)", fontSize: 14, cursor: "pointer" }}>Batal</button>
            <button onClick={submit} disabled={loading || balance < 10000 || !slug}
              style={{ flex: 2, padding: "12px", borderRadius: 12, background: loading || balance < 10000 || !slug ? "rgba(37,211,102,.25)" : "linear-gradient(135deg,#128C7E,#25D366)", border: "none", color: loading || balance < 10000 || !slug ? "rgba(255,255,255,.35)" : "white", fontSize: 14, fontWeight: 800, cursor: loading || balance < 10000 || !slug ? "not-allowed" : "pointer", transition: "all .2s", boxShadow: loading || balance < 10000 || !slug ? "none" : "0 4px 16px rgba(37,211,102,.35)" }}>
              {loading ? "Memproses…" : balance < 10000 ? "Saldo tidak cukup" : "🚀 Aktifkan — Rp10.000"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ────────────────────────────────────────────────────── */
export default function ResellerPage() {
  const router = useRouter();
  const { token, balance: userBalance, ready } = useUser();
  const [balance, setBalance] = useState(0);
  const [reseller, setReseller] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [successSlug, setSuccessSlug] = useState(null);
  const [openTnc, setOpenTnc] = useState(false);

  useEffect(() => {
    if (!ready || !token) return;
    setBalance(Number(userBalance || 0));
    fetch(`/api/reseller/my?token=${token}`)
      .then(r => r.json())
      .then(d => { if (d.reseller) setReseller(d.reseller); })
      .catch(() => {});
  }, [ready, token, userBalance]);

  function handleSuccess(data) {
    setSuccessSlug(data.slug);
    setShowModal(false);
    setReseller(data);
  }

  function handleBuyClick() {
    if (!token) { router.push("/"); return; }
    setShowModal(true);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0a0d12", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" }}>

      {showModal && token && (
        <RegisterModal token={token} balance={balance} onClose={() => setShowModal(false)} onSuccess={handleSuccess} />
      )}

      {/* Success banner */}
      {successSlug && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, background: "linear-gradient(135deg,#128C7E,#25D366)", padding: "14px 20px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 4px 20px rgba(37,211,102,.4)", flexWrap: "wrap" }}>
          <span style={{ fontSize: 20 }}>🎉</span>
          <div style={{ flex: 1, minWidth: 160 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "white" }}>Web reseller berhasil diaktifkan!</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,.8)" }}>Toko kamu: <b>/store/{successSlug}</b></div>
          </div>
          <button onClick={() => router.push(`/store/${successSlug}`)} style={{ background: "rgba(255,255,255,.2)", border: "none", borderRadius: 8, padding: "7px 14px", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Lihat Toko →</button>
          <button onClick={() => router.push("/reseller/dashboard")} style={{ background: "rgba(0,0,0,.2)", border: "none", borderRadius: 8, padding: "7px 14px", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Dashboard →</button>
          <button onClick={() => setSuccessSlug(null)} style={{ background: "none", border: "none", color: "rgba(255,255,255,.6)", fontSize: 20, cursor: "pointer", padding: "0 4px" }}>×</button>
        </div>
      )}

      {/* ── HERO ── */}
      <div style={{ background: "linear-gradient(180deg,#0d1f12 0%,#0a0d12 100%)", paddingBottom: 40, borderBottom: "1px solid rgba(37,211,102,.08)" }}>
        <div style={{ maxWidth: 960, margin: "0 auto", padding: "20px 16px 0" }}>

          {/* Breadcrumb */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 28 }}>
            <button onClick={() => router.back()} style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 8, padding: "6px 12px", color: "rgba(255,255,255,.45)", fontSize: 12, cursor: "pointer" }}>← Kembali</button>
            <span style={{ color: "rgba(255,255,255,.15)" }}>/</span>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,.35)" }}>Program Reseller</span>
          </div>

          {/* Headline */}
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "rgba(37,211,102,.08)", border: "1px solid rgba(37,211,102,.2)", borderRadius: 99, padding: "5px 16px", marginBottom: 14 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#25D366", display: "inline-block", animation: "blink 1.4s infinite" }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: "#25D366", letterSpacing: .5 }}>Program Reseller Aktif</span>
            </div>
            <h1 style={{ fontSize: "clamp(26px,5vw,46px)", fontWeight: 900, color: "white", margin: "0 0 10px", letterSpacing: "-1.5px", lineHeight: 1.1 }}>
              Punya Toko Nokos<br /><span style={{ color: "#25D366" }}>Sendiri</span> Mulai 10 Ribu
            </h1>
            <p style={{ fontSize: 15, color: "rgba(255,255,255,.45)", margin: "0 auto", maxWidth: 460, lineHeight: 1.65 }}>
              Jadi reseller Artapedia — dapat web toko branded, markup bebas, dan komisi otomatis setiap order pelanggan.
            </p>
          </div>

          {/* Comic 3D Hero panels */}
          <ComicHero reseller={reseller} onBuy={handleBuyClick} router={router} />

          {/* CTA bawah */}
          <div style={{ textAlign: "center", marginTop: 36 }}>
            {reseller ? (
              <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                <button onClick={() => router.push(`/store/${reseller.slug}`)}
                  style={{ padding: "13px 26px", borderRadius: 14, background: "rgba(37,211,102,.1)", border: "1.5px solid rgba(37,211,102,.35)", color: "#25D366", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                  🌐 Lihat Toko Saya
                </button>
                <button onClick={() => router.push("/reseller/dashboard")}
                  style={{ padding: "13px 26px", borderRadius: 14, background: "linear-gradient(135deg,#128C7E,#25D366)", border: "none", color: "white", fontSize: 14, fontWeight: 800, cursor: "pointer", boxShadow: "0 6px 24px rgba(37,211,102,.4)" }}>
                  📊 Dashboard Reseller →
                </button>
              </div>
            ) : (
              <button onClick={handleBuyClick}
                style={{ padding: "15px 44px", borderRadius: 16, background: "linear-gradient(135deg,#128C7E,#25D366)", border: "none", color: "white", fontSize: 16, fontWeight: 900, cursor: "pointer", boxShadow: "0 8px 32px rgba(37,211,102,.45)", letterSpacing: .3, transition: "transform .15s,box-shadow .15s" }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 12px 40px rgba(37,211,102,.5)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 8px 32px rgba(37,211,102,.45)"; }}>
                🚀 Buat Web Nokos Saya — Rp10.000
              </button>
            )}
            {!token && <p style={{ fontSize: 12, color: "rgba(255,255,255,.25)", marginTop: 8 }}>Login dulu dengan kode akun AP-XXXX kamu</p>}
          </div>
        </div>
      </div>

      {/* ── BENEFITS ── */}
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "60px 16px 0" }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#25D366", textTransform: "uppercase", letterSpacing: 2.5, marginBottom: 10 }}>Kenapa Jadi Reseller?</div>
          <h2 style={{ fontSize: "clamp(22px,4vw,36px)", fontWeight: 900, color: "white", margin: 0 }}>8 Keuntungan Jadi Reseller Artapedia</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14 }}>
          {BENEFITS.map((b, i) => (
            <div key={i}
              style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 16, padding: "20px 16px", transition: "all .2s", cursor: "default", position: "relative", overflow: "hidden" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(37,211,102,.06)"; e.currentTarget.style.borderColor = "rgba(37,211,102,.2)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,.03)"; e.currentTarget.style.borderColor = "rgba(255,255,255,.06)"; e.currentTarget.style.transform = "translateY(0)"; }}>
              <div style={{ position: "absolute", top: -8, right: -8, fontSize: 52, opacity: .06, userSelect: "none", lineHeight: 1 }}>{b.icon}</div>
              <div style={{ fontSize: 28, marginBottom: 10 }}>{b.icon}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "white", marginBottom: 6 }}>{b.title}</div>
              <div style={{ fontSize: 12.5, color: "rgba(255,255,255,.4)", lineHeight: 1.6 }}>{b.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── HOW IT WORKS ── */}
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "60px 16px 0" }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#fbbf24", textTransform: "uppercase", letterSpacing: 2.5, marginBottom: 10 }}>Cara Kerja</div>
          <h2 style={{ fontSize: "clamp(22px,4vw,36px)", fontWeight: 900, color: "white", margin: 0 }}>3 Langkah Mulai Bisnis</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 20 }}>
          {[
            { step: "01", icon: "💳", title: "Beli Paket", desc: "Klik 'Buat Web Nokos', bayar Rp10.000 dari saldo Artapedia kamu. Langsung aktif." },
            { step: "02", icon: "⚙️", title: "Set Toko", desc: "Isi nama web, URL slug, dan markup harga. Dashboard dan toko langsung hidup." },
            { step: "03", icon: "💰", title: "Terima Komisi", desc: "Share link tokomu ke pelanggan. Setiap order, komisi langsung masuk saldo." },
          ].map(s => (
            <div key={s.step} style={{ background: "linear-gradient(135deg,rgba(37,211,102,.05),rgba(18,140,126,.03))", border: "1px solid rgba(37,211,102,.1)", borderRadius: 18, padding: "26px 22px", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 14, right: 18, fontSize: 44, fontWeight: 900, color: "rgba(37,211,102,.06)", lineHeight: 1, letterSpacing: -2, userSelect: "none" }}>{s.step}</div>
              <div style={{ fontSize: 36, marginBottom: 14 }}>{s.icon}</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: "white", marginBottom: 8 }}>{s.title}</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,.45)", lineHeight: 1.65 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── PRICING ── */}
      <div style={{ maxWidth: 480, margin: "60px auto 0", padding: "0 16px" }}>
        <div style={{ background: "linear-gradient(135deg,rgba(37,211,102,.06),rgba(18,140,126,.04))", border: "2px solid rgba(37,211,102,.25)", borderRadius: 24, padding: "30px 26px", textAlign: "center", position: "relative", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,.4)" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: "linear-gradient(90deg,#128C7E,#25D366,#fbbf24)" }} />
          <div style={{ fontSize: 12, fontWeight: 800, color: "#25D366", textTransform: "uppercase", letterSpacing: 2, marginBottom: 8 }}>Harga Spesial</div>
          <div style={{ fontSize: 52, fontWeight: 900, color: "white", lineHeight: 1, marginBottom: 4 }}>Rp10.000</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,.35)", marginBottom: 24 }}>Bayar sekali • aktif selamanya • tidak ada biaya bulanan</div>
          <div style={{ textAlign: "left", marginBottom: 24 }}>
            {[
              "✅ Web toko branded dengan URL unik",
              "✅ Dashboard reseller lengkap",
              "✅ Markup bebas 0 – 50%",
              "✅ Komisi otomatis setiap order",
              "✅ Semua layanan OTP & SMM",
              "✅ Notifikasi Telegram real-time",
              "✅ Tidak ada biaya tambahan",
            ].map(f => (
              <div key={f} style={{ fontSize: 13, color: "rgba(255,255,255,.65)", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,.04)", display: "flex", alignItems: "center", gap: 8 }}>{f}</div>
            ))}
          </div>
          {reseller ? (
            <div style={{ background: "rgba(37,211,102,.1)", border: "1px solid rgba(37,211,102,.3)", borderRadius: 12, padding: "12px", marginBottom: 14 }}>
              <div style={{ fontSize: 13, color: "#25D366", fontWeight: 700 }}>✓ Kamu sudah punya web reseller</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,.4)", marginTop: 3 }}>/store/{reseller.slug}</div>
            </div>
          ) : null}
          <button onClick={handleBuyClick}
            style={{ width: "100%", padding: "14px", borderRadius: 14, background: reseller ? "rgba(37,211,102,.15)" : "linear-gradient(135deg,#128C7E,#25D366)", border: reseller ? "1px solid rgba(37,211,102,.3)" : "none", color: reseller ? "#25D366" : "white", fontSize: 15, fontWeight: 800, cursor: "pointer", boxShadow: reseller ? "none" : "0 6px 24px rgba(37,211,102,.4)" }}>
            {reseller ? "🏪 Buka Dashboard Reseller" : "🚀 Buat Web Nokos Sekarang"}
          </button>
        </div>
      </div>

      {/* ── SYARAT & KETENTUAN ── */}
      <div style={{ maxWidth: 700, margin: "56px auto 0", padding: "0 16px" }}>
        <button onClick={() => setOpenTnc(v => !v)}
          style={{ width: "100%", background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)", borderRadius: openTnc ? "14px 14px 0 0" : 14, padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", color: "white", transition: "all .15s" }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>📋 Syarat & Ketentuan Reseller</span>
          <span style={{ fontSize: 20, transform: openTnc ? "rotate(180deg)" : "none", transition: "transform .25s", color: "rgba(255,255,255,.4)" }}>⌄</span>
        </button>
        {openTnc && (
          <div style={{ background: "rgba(255,255,255,.02)", border: "1px solid rgba(255,255,255,.06)", borderTop: "none", borderRadius: "0 0 14px 14px", padding: "16px 20px" }}>
            {TNC.map((t, i) => (
              <div key={i} style={{ display: "flex", gap: 12, marginBottom: 10, fontSize: 13, color: "rgba(255,255,255,.5)", lineHeight: 1.6 }}>
                <span style={{ color: "#25D366", fontWeight: 800, flexShrink: 0, fontSize: 12, paddingTop: 2 }}>{i + 1}.</span>
                <span>{t}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ height: 80 }} />

      <style>{`
        @keyframes blink { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(.7)} }
      `}</style>
    </div>
  );
}
