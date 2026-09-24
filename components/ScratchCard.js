"use client";

import { useEffect, useRef, useState } from "react";

const RARITY_COLOR = {
  common:   { bg: "bg-surface2",       badge: "bg-muted/30 text-muted",         star: "⭐" },
  uncommon: { bg: "bg-teal/10",         badge: "bg-teal/20 text-teal-bright",    star: "⭐⭐" },
  rare:     { bg: "bg-amber/10",        badge: "bg-amber/20 text-amber-bright",  star: "⭐⭐⭐" },
  epic:     { bg: "bg-rose/10",         badge: "bg-rose/20 text-rose",           star: "⭐⭐⭐⭐" },
};

export default function ScratchCard({ token, onClose, onClaimed }) {
  const [phase, setPhase] = useState("idle"); // idle | scratching | revealed
  const [prize, setPrize] = useState(null);
  const [cardId, setCardId] = useState(null);
  const [error, setError] = useState("");
  const [particles, setParticles] = useState([]);
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);
  const revealed = useRef(0);

  useEffect(() => {
    fetch(`/api/scratch-card?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => { if (d.card) setCardId(d.card.id); });
  }, [token]);

  useEffect(() => {
    if (phase !== "scratching") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#8B7355";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Pattern
    ctx.fillStyle = "#7A6348";
    for (let x = 0; x < canvas.width; x += 20) {
      for (let y = 0; y < canvas.height; y += 20) {
        if ((x / 20 + y / 20) % 2 === 0) ctx.fillRect(x, y, 20, 20);
      }
    }
    ctx.fillStyle = "#F5E6C8";
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("🪙 GORES DI SINI 🪙", canvas.width / 2, canvas.height / 2);
  }, [phase]);

  function scratch(e) {
    if (phase !== "scratching") return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(x, y, 24, 0, Math.PI * 2);
    ctx.fill();

    // Check reveal %
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let transparent = 0;
    for (let i = 3; i < imageData.data.length; i += 4) {
      if (imageData.data[i] === 0) transparent++;
    }
    revealed.current = transparent / (canvas.width * canvas.height);
    if (revealed.current > 0.55) autoReveal();
  }

  async function autoReveal() {
    if (phase === "revealed") return;
    setPhase("revealing");
    try {
      const res = await fetch("/api/scratch-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action: "scratch", cardId }),
      });
      const d = await res.json();
      if (!d.ok) { setError(d.error || "Gagal."); return; }
      setPrize(d.prize);
      setPhase("revealed");
      if (d.prize.type !== "none") {
        setParticles(Array.from({ length: 22 }, (_, i) => ({ id: i, x: Math.random() * 100, delay: Math.random() * 0.6 })));
        onClaimed?.();
      }
    } catch { setError("Koneksi gagal."); }
  }

  if (!cardId) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <style>{`
        @keyframes fall { from { transform: translateY(-10px) rotate(0deg); opacity: 1; } to { transform: translateY(110vh) rotate(720deg); opacity: 0; } }
        @keyframes pop { 0% { transform: scale(0.4); opacity: 0; } 60% { transform: scale(1.12); } 100% { transform: scale(1); opacity: 1; } }
        @keyframes wiggle { 0%,100%{transform:rotate(-3deg)} 50%{transform:rotate(3deg)} }
      `}</style>

      {particles.map((p) => (
        <div key={p.id} className="pointer-events-none fixed top-0 text-2xl" style={{ left: `${p.x}%`, animation: `fall 1.8s ${p.delay}s ease-in forwards` }}>
          {["🎊","⭐","✨","🎉","💰"][p.id % 5]}
        </div>
      ))}

      <div className="w-full max-w-sm rounded-3xl bg-bg border border-line shadow-2xl lembar-bawah">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber/30 to-amber-bright/20 px-5 py-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber text-xl shadow-md shadow-amber/30">🎫</div>
          <div>
            <p className="text-sm font-extrabold text-amber-bright">Kartu Gores!</p>
            <p className="text-xs text-muted">Gores untuk ungkap hadiah rahasia</p>
          </div>
        </div>

        <div className="p-5">
          {phase === "idle" && (
            <div className="text-center py-4">
              <div className="text-6xl mb-4 animate-[wiggle_0.6s_ease-in-out_infinite]">🎟️</div>
              <p className="text-sm text-muted mb-5">Kamu punya kartu gores! Buka sekarang untuk ungkap hadiahmu.</p>
              <button onClick={() => setPhase("scratching")} className="w-full rounded-2xl bg-gradient-to-r from-amber to-amber-bright py-3 text-sm font-extrabold text-white press shadow-lg shadow-amber/30">
                ✨ Mulai Gores!
              </button>
            </div>
          )}

          {phase === "scratching" && (
            <div>
              <p className="text-xs text-muted text-center mb-3">Gores area di bawah untuk buka hadiahmu!</p>
              <div className="relative rounded-2xl overflow-hidden border-2 border-amber/40 select-none">
                <div className="flex items-center justify-center h-28 bg-amber/5">
                  <div className="text-center">
                    <div className="text-3xl mb-1">🎁</div>
                    <p className="text-xs text-amber-bright font-bold">Hadiah Tersembunyi</p>
                  </div>
                </div>
                <canvas
                  ref={canvasRef}
                  width={320}
                  height={112}
                  className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
                  onMouseDown={() => { isDrawing.current = true; }}
                  onMouseMove={(e) => { if (isDrawing.current) scratch(e); }}
                  onMouseUp={() => { isDrawing.current = false; }}
                  onMouseLeave={() => { isDrawing.current = false; }}
                  onTouchStart={() => { isDrawing.current = true; }}
                  onTouchMove={scratch}
                  onTouchEnd={() => { isDrawing.current = false; }}
                />
              </div>
              <p className="text-[10px] text-muted text-center mt-2">Atau:</p>
              <button onClick={autoReveal} className="mt-2 w-full rounded-xl border border-line py-2 text-xs text-muted press hover:text-ink hover:border-ink/30">Buka Langsung</button>
            </div>
          )}

          {phase === "revealing" && (
            <div className="flex flex-col items-center py-8 gap-3">
              <div className="h-8 w-8 rounded-full border-4 border-amber border-t-transparent animate-spin" />
              <p className="text-sm text-muted">Membuka hadiah…</p>
            </div>
          )}

          {phase === "revealed" && prize && (
            <div className={`rounded-2xl p-5 text-center ${RARITY_COLOR[prize.rarity]?.bg || "bg-surface2"} animate-[pop_0.5s_cubic-bezier(0.34,1.56,0.64,1)_both]`}>
              {prize.type === "none" ? (
                <>
                  <div className="text-5xl mb-3">😅</div>
                  <p className="text-base font-extrabold text-ink">Belum beruntung!</p>
                  <p className="text-xs text-muted mt-1">Deposit lagi untuk dapat kartu gores baru.</p>
                </>
              ) : (
                <>
                  <div className="text-5xl mb-3">{prize.type === "saldo" ? "💰" : "⭐"}</div>
                  <div className={`inline-flex px-3 py-1 rounded-full text-xs font-bold mb-2 ${RARITY_COLOR[prize.rarity]?.badge}`}>
                    {RARITY_COLOR[prize.rarity]?.star} {prize.rarity.toUpperCase()}
                  </div>
                  <p className="text-2xl font-extrabold text-ink">{prize.label}</p>
                  <p className="text-xs text-muted mt-1">{prize.type === "saldo" ? "Langsung masuk saldo kamu!" : "Poin ditambahkan ke akun kamu!"}</p>
                </>
              )}
            </div>
          )}

          {error && <p className="text-xs text-rose text-center mt-2">{error}</p>}

          {(phase === "revealed") && (
            <button onClick={onClose} className="mt-4 w-full rounded-2xl bg-ink py-3 text-sm font-bold text-bg press">
              Tutup
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
