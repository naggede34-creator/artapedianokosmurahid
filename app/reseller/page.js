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

/* ── Comic Aria Hero ─────────────────────────────────────────────── */
function AriaComicHero() {
  return (
    <div style={{ position: "relative", width: "100%", maxWidth: 860, margin: "0 auto", padding: "20px 16px 0" }}>
      {/* Halftone BG */}
      <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle, rgba(37,211,102,.13) 1.5px, transparent 1.5px)", backgroundSize: "18px 18px", borderRadius: 24, pointerEvents: "none" }} />

      <div style={{ display: "flex", gap: 0, alignItems: "flex-end", position: "relative", zIndex: 1, flexWrap: "wrap", justifyContent: "center" }}>

        {/* Panel kiri kecil — speech bubble Aria ngobrol */}
        <div style={{ transform: "perspective(600px) rotateY(12deg) rotateX(-3deg)", transformOrigin: "right center", flex: "0 0 auto", width: "min(220px,42vw)", zIndex: 2, marginRight: -18, marginBottom: 20 }}>
          <div style={{ background: "#fff", border: "3.5px solid #111", borderRadius: "16px 16px 4px 16px", padding: "14px 16px", boxShadow: "5px 5px 0 #111", position: "relative" }}>
            <div style={{ position: "absolute", bottom: -16, right: 20, width: 0, height: 0, borderLeft: "10px solid transparent", borderRight: "0 solid transparent", borderTop: "16px solid #111" }} />
            <div style={{ position: "absolute", bottom: -12, right: 21, width: 0, height: 0, borderLeft: "8px solid transparent", borderRight: "0 solid transparent", borderTop: "13px solid white" }} />
            <p style={{ margin: 0, fontSize: 13, color: "#111", fontWeight: 700, lineHeight: 1.4, fontFamily: "system-ui,sans-serif" }}>
              Hei! Mau punya toko OTP sendiri? 🌟
            </p>
          </div>
          {/* Mini panel di bawah */}
          <div style={{ marginTop: 12, background: "linear-gradient(135deg,#1a1a2e,#16213e)", border: "3px solid #111", borderRadius: 12, padding: "10px 12px", boxShadow: "4px 4px 0 #111" }}>
            <div style={{ fontSize: 11, color: "#fbbf24", fontWeight: 800, letterSpacing: ".5px", textTransform: "uppercase", marginBottom: 4 }}>💰 Komisi Tiap Order</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#25D366", letterSpacing: -1 }}>+Markup%</div>
            <div style={{ fontSize: 10.5, color: "rgba(255,255,255,.45)", marginTop: 2 }}>Langsung ke saldo kamu</div>
          </div>
        </div>

        {/* Panel utama — Aria */}
        <div style={{ flex: "0 0 auto", width: "min(300px,70vw)", zIndex: 4, position: "relative" }}>
          {/* Sunburst behind */}
          <div style={{ position: "absolute", top: "10%", left: "50%", transform: "translateX(-50%)", width: 260, height: 260, background: "conic-gradient(from 0deg, rgba(37,211,102,.18) 0deg, transparent 20deg, rgba(37,211,102,.18) 40deg, transparent 60deg, rgba(37,211,102,.18) 80deg, transparent 100deg, rgba(37,211,102,.18) 120deg, transparent 140deg, rgba(37,211,102,.18) 160deg, transparent 180deg, rgba(37,211,102,.18) 200deg, transparent 220deg, rgba(37,211,102,.18) 240deg, transparent 260deg, rgba(37,211,102,.18) 280deg, transparent 300deg, rgba(37,211,102,.18) 320deg, transparent 340deg, rgba(37,211,102,.18) 360deg)", borderRadius: "50%", zIndex: 0, pointerEvents: "none" }} />

          <div style={{ position: "relative", zIndex: 1, border: "4px solid #111", borderRadius: "20px 20px 8px 8px", overflow: "hidden", boxShadow: "8px 8px 0 #111, 0 0 0 2px #25D366" }}>
            {/* Top bar komik */}
            <div style={{ background: "#25D366", padding: "6px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "3px solid #111" }}>
              <span style={{ fontSize: 10, fontWeight: 900, color: "#111", textTransform: "uppercase", letterSpacing: 1 }}>✦ Artapedia Reseller ✦</span>
              <div style={{ display: "flex", gap: 4 }}>
                {["#ff5f57","#febc2e","#28c840"].map(c => <div key={c} style={{ width: 8, height: 8, borderRadius: "50%", background: c, border: "1px solid rgba(0,0,0,.3)" }} />)}
              </div>
            </div>
            {/* Karakter Aria */}
            <div style={{ background: "linear-gradient(180deg,#e8f5e9 0%,#c8e6c9 40%,#a5d6a7 100%)", position: "relative", minHeight: 280, display: "flex", alignItems: "flex-end", justifyContent: "center", overflow: "hidden" }}>
              {/* Speed lines */}
              <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: .12 }} viewBox="0 0 300 280" preserveAspectRatio="none">
                {Array.from({ length: 16 }).map((_, i) => (
                  <line key={i} x1="150" y1="140" x2={i * 20} y2="0" stroke="#111" strokeWidth="1.5" />
                ))}
                {Array.from({ length: 16 }).map((_, i) => (
                  <line key={`b${i}`} x1="150" y1="140" x2={i * 20} y2="280" stroke="#111" strokeWidth="1.5" />
                ))}
              </svg>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/chars/char-angel.jpg" alt="Aria" style={{ height: 270, width: "auto", objectFit: "cover", objectPosition: "top", position: "relative", zIndex: 1, display: "block" }} onError={e => { e.currentTarget.style.display = "none"; }} />
              {/* Nama badge */}
              <div style={{ position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)", background: "#111", color: "#25D366", borderRadius: 99, padding: "4px 16px", fontSize: 13, fontWeight: 900, letterSpacing: 1, border: "2px solid #25D366", zIndex: 2, whiteSpace: "nowrap" }}>
                ★ ARIA ★
              </div>
            </div>
            {/* Bottom caption */}
            <div style={{ background: "#111", padding: "8px 14px", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: "#25D366", letterSpacing: .5 }}>AMBASSADOR RESELLER</span>
              <span style={{ marginLeft: "auto", fontSize: 18 }}>🌸</span>
            </div>
          </div>

          {/* Action starburst */}
          <div style={{ position: "absolute", top: -16, right: -16, width: 64, height: 64, background: "#fbbf24", border: "3px solid #111", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "3px 3px 0 #111", zIndex: 5, transform: "rotate(12deg)" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 9, fontWeight: 900, color: "#111", lineHeight: 1.1, textTransform: "uppercase" }}>Cuma</div>
              <div style={{ fontSize: 14, fontWeight: 900, color: "#111", lineHeight: 1 }}>10K</div>
              <div style={{ fontSize: 8, fontWeight: 900, color: "#111", lineHeight: 1.1 }}>sekali!</div>
            </div>
          </div>
        </div>

        {/* Panel kanan — stats */}
        <div style={{ transform: "perspective(600px) rotateY(-12deg) rotateX(-3deg)", transformOrigin: "left center", flex: "0 0 auto", width: "min(220px,42vw)", zIndex: 2, marginLeft: -18, marginBottom: 20 }}>
          <div style={{ background: "linear-gradient(135deg,#0d1117,#161b22)", border: "3.5px solid #111", borderRadius: "16px 16px 16px 4px", padding: "14px", boxShadow: "-5px 5px 0 #111" }}>
            <div style={{ fontSize: 11, color: "#25D366", fontWeight: 800, textTransform: "uppercase", letterSpacing: .8, marginBottom: 10 }}>📊 Keuntungan</div>
            {[
              { label: "Bayar sekali", val: "Rp10.000", color: "#fbbf24" },
              { label: "Biaya bulanan", val: "GRATIS", color: "#25D366" },
              { label: "Bagi hasil", val: "100%", color: "#a78bfa" },
              { label: "Batas order", val: "∞", color: "#f87171" },
            ].map(s => (
              <div key={s.label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, paddingBottom: 8, borderBottom: "1px solid rgba(255,255,255,.06)" }}>
                <span style={{ fontSize: 11.5, color: "rgba(255,255,255,.55)" }}>{s.label}</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: s.color }}>{s.val}</span>
              </div>
            ))}
          </div>

          {/* Thought bubble */}
          <div style={{ marginTop: 10, background: "#fff", border: "3px solid #111", borderRadius: "4px 16px 16px 16px", padding: "10px 14px", boxShadow: "-4px 4px 0 #111", position: "relative" }}>
            <div style={{ position: "absolute", top: -10, left: 14, display: "flex", gap: 3 }}>
              {[6, 4, 3].map((s, i) => <div key={i} style={{ width: s, height: s, borderRadius: "50%", background: "#111" }} />)}
            </div>
            <p style={{ margin: 0, fontSize: 12.5, color: "#111", fontWeight: 700, lineHeight: 1.4 }}>
              Mulai bisnis nokos sekarang! 💪
            </p>
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
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,.75)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 420, background: "#0d1117", borderRadius: 20, overflow: "hidden", border: "1px solid rgba(255,255,255,.08)", boxShadow: "0 24px 64px rgba(0,0,0,.7)" }}>
        <div style={{ height: 4, background: "linear-gradient(90deg,#128C7E,#25D366,#fbbf24)" }} />
        <div style={{ padding: "24px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg,#128C7E,#25D366)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🏪</div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 800, color: "white" }}>Aktifkan Web Reseller</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,.4)", marginTop: 1 }}>Saldo kamu: <b style={{ color: balance >= 10000 ? "#25D366" : "#f87171" }}>Rp{balance.toLocaleString("id-ID")}</b></div>
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11.5, color: "rgba(255,255,255,.4)", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".7px" }}>Nama Web Toko</div>
            <input type="text" value={webName} onChange={e => { setWebName(e.target.value); setErr(""); }}
              placeholder="contoh: Toko OTP Budi" maxLength={50}
              style={{ width: "100%", background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, padding: "11px 14px", color: "rgba(255,255,255,.88)", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
            {slug && (
              <div style={{ fontSize: 11.5, color: "rgba(255,255,255,.3)", marginTop: 5 }}>
                🔗 URL toko kamu: <span style={{ color: "#25D366", fontWeight: 600 }}>/store/{slug}</span>
              </div>
            )}
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11.5, color: "rgba(255,255,255,.4)", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".7px" }}>Markup Harga</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <input type="range" min={0} max={50} value={markup} onChange={e => setMarkup(Number(e.target.value))}
                style={{ flex: 1, accentColor: "#25D366" }} />
              <div style={{ background: "rgba(37,211,102,.15)", border: "1px solid rgba(37,211,102,.3)", borderRadius: 8, padding: "6px 14px", fontSize: 16, fontWeight: 800, color: "#25D366", minWidth: 56, textAlign: "center" }}>+{markup}%</div>
            </div>
            <div style={{ fontSize: 11.5, color: "rgba(255,255,255,.3)", marginTop: 4 }}>Keuntungan kamu per transaksi pelanggan</div>
          </div>

          {err && <div style={{ background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.3)", borderRadius: 8, padding: "8px 12px", fontSize: 12.5, color: "#f87171", marginBottom: 14 }}>⚠ {err}</div>}

          <div style={{ background: "rgba(251,191,36,.07)", border: "1px solid rgba(251,191,36,.2)", borderRadius: 10, padding: "10px 14px", marginBottom: 18 }}>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,.7)", lineHeight: 1.5 }}>
              💳 Biaya aktivasi <b style={{ color: "#fbbf24" }}>Rp10.000</b> akan dipotong dari saldo. Pembayaran tidak dapat dikembalikan.
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onClose} style={{ flex: 1, padding: "12px", borderRadius: 10, background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.08)", color: "rgba(255,255,255,.6)", fontSize: 14, cursor: "pointer" }}>Batal</button>
            <button onClick={submit} disabled={loading || balance < 10000 || !slug}
              style={{ flex: 2, padding: "12px", borderRadius: 10, background: loading || balance < 10000 || !slug ? "rgba(37,211,102,.3)" : "linear-gradient(135deg,#128C7E,#25D366)", border: "none", color: "white", fontSize: 14, fontWeight: 700, cursor: loading || balance < 10000 || !slug ? "not-allowed" : "pointer", transition: "all .2s" }}>
              {loading ? "Memproses…" : "🚀 Aktifkan — Rp10.000"}
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
  const { token, ready } = useUser();
  const [balance, setBalance] = useState(0);
  const [reseller, setReseller] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [successSlug, setSuccessSlug] = useState(null);
  const [openTnc, setOpenTnc] = useState(false);

  useEffect(() => {
    if (!ready || !token) return;
    fetch(`/api/user/stats?token=${token}`).then(r => r.json()).then(d => setBalance(d.balance || 0)).catch(() => {});
    fetch(`/api/reseller/my?token=${token}`).then(r => r.json()).then(d => { if (d.reseller) setReseller(d.reseller); }).catch(() => {});
  }, [ready, token]);

  function handleSuccess(data) {
    setSuccessSlug(data.slug);
    setShowModal(false);
    setReseller(data);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0a0d12", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" }}>

      {showModal && token && (
        <RegisterModal token={token} balance={balance} onClose={() => setShowModal(false)} onSuccess={handleSuccess} />
      )}

      {/* Success banner */}
      {successSlug && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, background: "linear-gradient(135deg,#128C7E,#25D366)", padding: "14px 20px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 4px 20px rgba(37,211,102,.4)" }}>
          <span style={{ fontSize: 20 }}>🎉</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "white" }}>Web reseller berhasil diaktifkan!</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,.8)" }}>Toko kamu: <b>/store/{successSlug}</b></div>
          </div>
          <button onClick={() => router.push(`/store/${successSlug}`)} style={{ background: "rgba(255,255,255,.2)", border: "none", borderRadius: 8, padding: "7px 14px", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Lihat Toko →</button>
          <button onClick={() => router.push("/reseller/dashboard")} style={{ background: "rgba(255,255,255,.2)", border: "none", borderRadius: 8, padding: "7px 14px", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Dashboard</button>
        </div>
      )}

      {/* ── HERO ── */}
      <div style={{ background: "linear-gradient(180deg,#0d1f12,#0a0d12)", paddingBottom: 40, borderBottom: "1px solid rgba(37,211,102,.1)" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px 0" }}>
          {/* Nav crumb */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
            <button onClick={() => router.back()} style={{ background: "rgba(255,255,255,.06)", border: "none", borderRadius: 8, padding: "6px 12px", color: "rgba(255,255,255,.5)", fontSize: 12.5, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              ← Kembali
            </button>
            <span style={{ color: "rgba(255,255,255,.2)", fontSize: 12 }}>/</span>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,.4)" }}>Program Reseller</span>
          </div>

          <div style={{ textAlign: "center", marginBottom: 10 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(37,211,102,.1)", border: "1px solid rgba(37,211,102,.25)", borderRadius: 99, padding: "5px 14px", marginBottom: 12 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#25D366", display: "inline-block", animation: "pulse 1.5s infinite" }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: "#25D366", letterSpacing: .5 }}>Program Reseller Aktif</span>
            </div>
            <h1 style={{ fontSize: "clamp(26px,5vw,44px)", fontWeight: 900, color: "white", margin: "0 0 8px", letterSpacing: "-1px", lineHeight: 1.15 }}>
              Punya Toko OTP<br /><span style={{ color: "#25D366" }}>Sendiri</span> Mulai 10 Ribu
            </h1>
            <p style={{ fontSize: 15, color: "rgba(255,255,255,.5)", margin: "0 auto", maxWidth: 480, lineHeight: 1.6 }}>
              Jadi reseller Artapedia, dapat web toko branded, markup bebas, dan komisi otomatis setiap order pelangganmu.
            </p>
          </div>

          <AriaComicHero />

          {/* CTA */}
          <div style={{ textAlign: "center", marginTop: 32 }}>
            {reseller ? (
              <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                <button onClick={() => router.push(`/store/${reseller.slug}`)}
                  style={{ padding: "14px 28px", borderRadius: 14, background: "rgba(37,211,102,.15)", border: "1.5px solid rgba(37,211,102,.4)", color: "#25D366", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
                  🌐 Lihat Toko Saya
                </button>
                <button onClick={() => router.push("/reseller/dashboard")}
                  style={{ padding: "14px 28px", borderRadius: 14, background: "linear-gradient(135deg,#128C7E,#25D366)", border: "none", color: "white", fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: "0 6px 24px rgba(37,211,102,.4)" }}>
                  📊 Dashboard Reseller →
                </button>
              </div>
            ) : (
              <button onClick={() => token ? setShowModal(true) : router.push("/")}
                style={{ padding: "16px 40px", borderRadius: 16, background: "linear-gradient(135deg,#128C7E,#25D366)", border: "none", color: "white", fontSize: 16, fontWeight: 800, cursor: "pointer", boxShadow: "0 8px 32px rgba(37,211,102,.45)", letterSpacing: .3, transition: "transform .15s" }}
                onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px) scale(1.02)"}
                onMouseLeave={e => e.currentTarget.style.transform = "translateY(0) scale(1)"}>
                🚀 Buat Web Nokos Saya — Rp10.000
              </button>
            )}
            {!token && <p style={{ fontSize: 12, color: "rgba(255,255,255,.3)", marginTop: 8 }}>Login dulu dengan kode akun AP-XXXX kamu</p>}
          </div>
        </div>
      </div>

      {/* ── BENEFITS ── */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "56px 16px 0" }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#25D366", textTransform: "uppercase", letterSpacing: 2, marginBottom: 8 }}>Kenapa Jadi Reseller?</div>
          <h2 style={{ fontSize: "clamp(22px,4vw,34px)", fontWeight: 900, color: "white", margin: 0 }}>8 Keuntungan Jadi Reseller Artapedia</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14 }}>
          {BENEFITS.map((b, i) => (
            <div key={i} style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 16, padding: "18px 16px", transition: "all .2s", cursor: "default" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(37,211,102,.06)"; e.currentTarget.style.borderColor = "rgba(37,211,102,.2)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,.04)"; e.currentTarget.style.borderColor = "rgba(255,255,255,.07)"; }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>{b.icon}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "white", marginBottom: 6 }}>{b.title}</div>
              <div style={{ fontSize: 12.5, color: "rgba(255,255,255,.45)", lineHeight: 1.55 }}>{b.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── HOW IT WORKS ── */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "56px 16px 0" }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#fbbf24", textTransform: "uppercase", letterSpacing: 2, marginBottom: 8 }}>Cara Kerja</div>
          <h2 style={{ fontSize: "clamp(22px,4vw,34px)", fontWeight: 900, color: "white", margin: 0 }}>3 Langkah Mulai Bisnis</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 20 }}>
          {[
            { step: "01", icon: "💳", title: "Beli Paket", desc: "Klik tombol 'Buat Web Nokos', bayar Rp10.000 dari saldo Artapedia kamu." },
            { step: "02", icon: "⚙️", title: "Set Toko", desc: "Isi nama web, URL slug, dan markup harga. Dashboard langsung aktif." },
            { step: "03", icon: "💰", title: "Terima Komisi", desc: "Share link tokomu. Setiap pelanggan order, komisi langsung masuk saldo." },
          ].map(s => (
            <div key={s.step} style={{ background: "linear-gradient(135deg,rgba(37,211,102,.06),rgba(18,140,126,.04))", border: "1px solid rgba(37,211,102,.12)", borderRadius: 18, padding: "24px 20px", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 16, right: 16, fontSize: 40, fontWeight: 900, color: "rgba(37,211,102,.07)", lineHeight: 1, letterSpacing: -2, userSelect: "none" }}>{s.step}</div>
              <div style={{ fontSize: 34, marginBottom: 12 }}>{s.icon}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "white", marginBottom: 8 }}>{s.title}</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,.5)", lineHeight: 1.6 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── PRICING ── */}
      <div style={{ maxWidth: 500, margin: "56px auto 0", padding: "0 16px" }}>
        <div style={{ background: "linear-gradient(135deg,rgba(37,211,102,.08),rgba(18,140,126,.06))", border: "2px solid rgba(37,211,102,.3)", borderRadius: 24, padding: "30px 24px", textAlign: "center", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: "linear-gradient(90deg,#128C7E,#25D366,#fbbf24)" }} />
          <div style={{ fontSize: 13, fontWeight: 700, color: "#25D366", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6 }}>Harga Spesial</div>
          <div style={{ fontSize: 48, fontWeight: 900, color: "white", lineHeight: 1, marginBottom: 4 }}>Rp10.000</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,.4)", marginBottom: 20 }}>Bayar sekali, aktif selamanya • Tidak ada biaya bulanan</div>
          {[
            "✅ Web toko branded dengan URL unik",
            "✅ Dashboard reseller lengkap",
            "✅ Markup bebas 0–50%",
            "✅ Komisi otomatis setiap order",
            "✅ Semua layanan OTP & SMM",
            "✅ Notifikasi Telegram real-time",
          ].map(f => <div key={f} style={{ fontSize: 13, color: "rgba(255,255,255,.7)", textAlign: "left", padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,.05)" }}>{f}</div>)}
          <button onClick={() => token ? setShowModal(true) : router.push("/")}
            style={{ marginTop: 22, width: "100%", padding: "14px", borderRadius: 12, background: "linear-gradient(135deg,#128C7E,#25D366)", border: "none", color: "white", fontSize: 15, fontWeight: 800, cursor: "pointer", boxShadow: "0 6px 24px rgba(37,211,102,.4)" }}>
            🚀 Buat Web Nokos Sekarang
          </button>
          {reseller && <p style={{ fontSize: 12, color: "#25D366", marginTop: 8 }}>✓ Kamu sudah punya web reseller: /store/{reseller.slug}</p>}
        </div>
      </div>

      {/* ── SYARAT & KETENTUAN ── */}
      <div style={{ maxWidth: 680, margin: "56px auto 0", padding: "0 16px" }}>
        <button onClick={() => setOpenTnc(v => !v)}
          style={{ width: "100%", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 14, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", color: "white" }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>📋 Syarat & Ketentuan Reseller</span>
          <span style={{ fontSize: 18, transform: openTnc ? "rotate(180deg)" : "none", transition: "transform .2s" }}>⌄</span>
        </button>
        {openTnc && (
          <div style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)", borderTop: "none", borderRadius: "0 0 14px 14px", padding: "16px 18px" }}>
            {TNC.map((t, i) => (
              <div key={i} style={{ display: "flex", gap: 10, marginBottom: 10, fontSize: 13, color: "rgba(255,255,255,.55)", lineHeight: 1.55 }}>
                <span style={{ color: "#25D366", fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span>
                <span>{t}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ height: 64 }} />

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(.75)} }
      `}</style>
    </div>
  );
}
