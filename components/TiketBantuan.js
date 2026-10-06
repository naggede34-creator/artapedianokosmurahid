"use client";

import { useState } from "react";
import { useUser } from "@/app/providers";

const LABEL = { open: "Terbuka", answered: "Dijawab", closed: "Ditutup" };
const WARNA = {
  open: "text-amber-bright bg-amber-soft border-amber/30",
  answered: "text-teal-bright bg-teal-soft border-teal/30",
  closed: "text-muted bg-surface2 border-line"
};

// Tiket bantuan: buat tiket, baca balasan admin, balas.
export default function TiketBantuan() {
  const { token } = useUser();
  const [tickets, setTickets] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ subject: "", message: "" });
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState("");
  const [open, setOpen] = useState(null);
  const [reply, setReply] = useState("");
  const [replying, setReplying] = useState(false);
  const [showForm, setShowForm] = useState(false);

  async function muat() {
    if (!token || loading) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/support/tickets?token=${encodeURIComponent(token)}`);
      const d = await r.json();
      setTickets(Array.isArray(d.items) ? d.items : []);
      setLoaded(true);
    } catch {} finally { setLoading(false); }
  }

  async function kirim(e) {
    e.preventDefault();
    if (!token || sending) return;
    setSending(true);
    setMsg("");
    try {
      const r = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, subject: form.subject, message: form.message })
      });
      const d = await r.json();
      if (d.ok) {
        setMsg("Tiket berhasil dibuat! Admin akan merespons segera.");
        setForm({ subject: "", message: "" });
        setShowForm(false);
        muat();
      } else setMsg(d.error || "Gagal membuat tiket.");
    } catch { setMsg("Terjadi kesalahan. Coba lagi."); } finally { setSending(false); }
  }

  async function balas(ticketId) {
    if (!token || !reply.trim() || replying) return;
    setReplying(true);
    try {
      const r = await fetch("/api/support/tickets/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, ticketId, message: reply })
      });
      const d = await r.json();
      if (d.ok) { setReply(""); muat(); }
    } catch {} finally { setReplying(false); }
  }

  return (
    <div className="card p-5" data-testid="tiket-bantuan">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-ink">🎫 Tiket Bantuan</h2>
          <p className="mt-0.5 text-xs text-muted">Nomor bermasalah atau ada pertanyaan? Tulis di sini.</p>
        </div>
        <button onClick={() => { setShowForm((v) => !v); if (!loaded) muat(); }} className="btn-3d rounded-xl bg-amber px-3.5 py-2 text-xs font-black text-white">
          + Buat Tiket
        </button>
      </div>

      {msg && <p className={`mb-3 text-xs font-semibold ${msg.includes("berhasil") ? "text-teal-bright" : "text-rose"}`}>{msg}</p>}

      {showForm && (
        <form onSubmit={kirim} className="mb-4 space-y-3 rounded-2xl border border-line bg-surface2 p-4">
          <input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} placeholder="Judul masalah" required maxLength={200}
            className="w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-sm text-ink outline-none focus:border-amber" />
          <textarea value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} placeholder="Jelaskan masalahmu (sertakan nomor pesanan bila ada)…" rows={4} required maxLength={2000}
            className="w-full resize-none rounded-xl border border-line bg-surface px-4 py-2.5 text-sm text-ink outline-none focus:border-amber" />
          <div className="flex gap-2">
            <button type="submit" disabled={sending} className="btn-3d flex-1 rounded-xl bg-amber py-2.5 text-sm font-black text-white disabled:opacity-50">{sending ? "Mengirim…" : "Kirim Tiket"}</button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-xl border border-line px-4 py-2.5 text-sm font-bold text-ink hover:bg-surface2">Batal</button>
          </div>
        </form>
      )}

      {!loaded ? (
        <button onClick={muat} disabled={loading} className="w-full rounded-xl border border-line py-3 text-sm text-muted transition-colors hover:border-amber/50 hover:text-ink">
          {loading ? "Memuat tiket…" : "📋 Lihat tiket saya"}
        </button>
      ) : tickets.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted">Belum ada tiket.</p>
      ) : (
        <div className="space-y-2.5">
          {tickets.map((t) => {
            const buka = open === t.ticketId;
            return (
              <div key={t.ticketId} className="overflow-hidden rounded-2xl border border-line">
                <button onClick={() => setOpen(buka ? null : t.ticketId)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${WARNA[t.status] || WARNA.closed}`}>{LABEL[t.status] || t.status}</span>
                      <span className="truncate text-sm font-semibold text-ink">{t.subject}</span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted">{t.messageCount} pesan · {new Date(t.updatedAt).toLocaleDateString("id-ID")}</p>
                  </div>
                  <span className="shrink-0 text-muted" aria-hidden="true">{buka ? "▲" : "▼"}</span>
                </button>
                {buka && (
                  <div className="space-y-3 border-t border-line bg-surface2 p-4">
                    <div className="max-h-64 space-y-2 overflow-y-auto">
                      {(t.messages || []).map((m, i) => (
                        <div key={i} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs ${m.from === "user" ? "rounded-br-sm bg-amber text-white" : "rounded-bl-sm border border-line bg-surface text-ink"}`}>
                            <p className="leading-relaxed">{m.text}</p>
                            <p className={`mt-1 text-[10px] ${m.from === "user" ? "text-white/70" : "text-muted"}`}>
                              {m.from === "user" ? "Kamu" : "Admin"} · {new Date(m.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                    {t.status !== "closed" && (
                      <div className="flex gap-2">
                        <input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Tulis balasan…" maxLength={2000}
                          className="flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-xs text-ink outline-none focus:border-amber"
                          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); balas(t.ticketId); } }} />
                        <button onClick={() => balas(t.ticketId)} disabled={replying || !reply.trim()} className="btn-3d rounded-xl bg-amber px-4 py-2 text-xs font-black text-white disabled:opacity-50">Kirim</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
