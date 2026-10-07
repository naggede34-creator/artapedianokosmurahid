"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/app/providers";

function fmtRp(n) { return `Rp${Number(n || 0).toLocaleString("id-ID")}`; }

const STATUS_MAP = {
  pending: { label: "Menunggu Review", color: "text-amber-bright bg-amber-soft border-amber/40" },
  approved: { label: "Disetujui ✓", color: "text-teal-bright bg-teal-soft border-teal/40" },
  rejected: { label: "Ditolak ✗", color: "text-rose bg-rose-soft/30 border-rose/30" }
};

function JobCard({ job, mySubmissions, onSubmit }) {
  const sub = mySubmissions.find((s) => s.jobId === job.id);
  const full = job.maxCompletions > 0 && job.completedCount >= job.maxCompletions;
  const pct = job.maxCompletions > 0 ? Math.round((job.completedCount / job.maxCompletions) * 100) : null;

  return (
    <div className={`relative rounded-3xl border-2 bg-surface p-5 transition-all hover:-translate-y-0.5 hover:shadow-xl ${sub?.status === "approved" ? "border-teal/50 bg-teal-soft/20" : full ? "border-line opacity-60" : "border-line hover:border-amber"}`}
      style={{ boxShadow: "4px 4px 0 0 rgba(0,0,0,0.08)" }}>

      {/* Reward badge */}
      <div className="absolute -top-3 right-4 rounded-full bg-gradient-to-r from-amber to-amber-bright px-3 py-1 text-xs font-black text-white shadow-md">
        +{fmtRp(job.reward)}
      </div>

      {job.imageUrl && (
        <img src={job.imageUrl} alt={job.title} className="w-full h-32 object-cover rounded-2xl mb-3 border border-line" />
      )}

      <div className="flex items-start gap-2 mb-1">
        <span className="text-xl shrink-0">💼</span>
        <p className="text-sm font-black text-ink leading-tight">{job.title}</p>
      </div>

      {job.description && (
        <p className="text-xs text-muted mb-3 leading-relaxed pl-7 whitespace-pre-line line-clamp-4">{job.description}</p>
      )}

      {pct !== null && (
        <div className="mb-3">
          <div className="flex justify-between text-[10px] text-muted mb-1">
            <span>Kuota</span>
            <span className="font-black">{job.completedCount}/{job.maxCompletions}</span>
          </div>
          <div className="h-2 rounded-full bg-surface2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-rose" : "bg-gradient-to-r from-amber to-amber-bright"}`}
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </div>
        </div>
      )}

      {sub ? (
        <div className={`rounded-2xl border px-3 py-2 text-xs font-bold text-center ${STATUS_MAP[sub.status]?.color}`}>
          {STATUS_MAP[sub.status]?.label}
          {sub.status === "rejected" && sub.rejectionReason && (
            <p className="text-[10px] font-normal mt-0.5 opacity-80">Alasan: {sub.rejectionReason}</p>
          )}
        </div>
      ) : full ? (
        <div className="rounded-2xl border border-line bg-surface2 px-3 py-2 text-xs font-bold text-muted text-center">
          Kuota Penuh
        </div>
      ) : (
        <button
          onClick={() => onSubmit(job)}
          className="w-full rounded-2xl bg-amber py-2.5 text-sm font-black text-white transition-all active:scale-95 hover:bg-amber-bright"
          style={{ boxShadow: "0 4px 0 0 rgba(180,100,0,0.4)" }}
        >
          Ambil Job →
        </button>
      )}
    </div>
  );
}

function SubmitModal({ job, onClose, onSuccess }) {
  const { token } = useUser();
  const [proof, setProof] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  async function submit() {
    if (job.proofRequired && !proof.trim()) { setErr("Bukti penyelesaian wajib diisi."); return; }
    setLoading(true); setErr("");
    try {
      const res = await fetch("/api/jobs/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, jobId: job.id, proof })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengirim.");
      setDone(true);
      onSuccess();
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-3xl bg-bg border-2 border-line overflow-hidden max-h-[88dvh] flex flex-col"
        style={{ boxShadow: "6px 6px 0 0 rgba(0,0,0,0.15)" }}>
        <div className="bg-gradient-to-r from-teal to-teal-bright p-5 text-white">
          <p className="text-xs font-bold opacity-80 mb-0.5">Pengajuan Job</p>
          <p className="text-lg font-black leading-tight">{job.title}</p>
          <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-sm font-black">
            🏆 Reward: +{`Rp${Number(job.reward).toLocaleString("id-ID")}`}
          </div>
        </div>

        <div className="p-5 overflow-y-auto">
          {done ? (
            <div className="text-center py-4">
              <div className="text-5xl mb-3">⏳</div>
              <p className="font-black text-ink mb-1">Pengajuan Terkirim!</p>
              <p className="text-sm text-muted mb-4">Admin akan mereview buktimu. Saldo masuk otomatis jika disetujui.</p>
              <button onClick={onClose} className="w-full py-3 rounded-2xl bg-gradient-to-r from-teal to-teal-bright text-sm font-black text-white">
                Tutup
              </button>
            </div>
          ) : (
            <>
              {job.description && (
                <div className="mb-4 rounded-2xl bg-surface2 border border-line p-3">
                  <p className="text-xs font-black text-ink mb-1.5">📋 Instruksi Job</p>
                  <p className="text-sm text-muted leading-relaxed whitespace-pre-line">{job.description}</p>
                </div>
              )}
              {job.proofRequired !== false && (
                <div className="mb-4">
                  <label className="block text-xs font-black text-ink mb-1.5">
                    {job.proofType === "image" ? "Link Gambar Bukti" : job.proofType === "url" ? "URL Bukti" : "Bukti Penyelesaian"}
                    <span className="text-rose ml-1">*</span>
                  </label>
                  <textarea
                    value={proof}
                    onChange={(e) => { setProof(e.target.value); setErr(""); }}
                    placeholder={
                      job.proofType === "image" ? "https://i.imgur.com/..." :
                      job.proofType === "url" ? "https://..." :
                      "Tuliskan bukti penyelesaian job di sini..."
                    }
                    rows={3}
                    className="w-full rounded-2xl border-2 border-line bg-surface px-4 py-3 text-sm text-ink outline-none focus:border-amber resize-none"
                  />
                </div>
              )}
              {err && <p className="text-xs text-rose font-bold mb-3 p-2.5 rounded-xl bg-rose-soft/30">{err}</p>}
              <div className="flex gap-2.5">
                <button onClick={onClose} className="flex-1 py-3 rounded-2xl border-2 border-line text-sm font-bold text-ink">
                  Batal
                </button>
                <button
                  onClick={submit}
                  disabled={loading}
                  className="flex-1 py-3 rounded-2xl bg-teal text-sm font-black text-white transition-all active:scale-95 disabled:opacity-50"
                  style={{ boxShadow: "0 4px 0 0 rgba(0,100,80,0.3)" }}
                >
                  {loading ? "Mengirim..." : "Kirim Bukti"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SaldoGratisPage() {
  const { token, ready } = useUser();
  const [jobs, setJobs] = useState([]);
  const [mySubmissions, setMySubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(null); // job object
  const [view, setView] = useState("jobs"); // "jobs" | "history"

  function loadJobs() {
    fetch("/api/jobs").then((r) => r.json()).then((d) => setJobs(Array.isArray(d.items) ? d.items : [])).finally(() => setLoading(false));
  }

  function loadMySubmissions() {
    if (!token) return;
    fetch(`/api/jobs/my-submissions?token=${token}`).then((r) => r.json()).then((d) => setMySubmissions(Array.isArray(d.items) ? d.items : []));
  }

  useEffect(() => { loadJobs(); }, []);
  useEffect(() => { if (token) loadMySubmissions(); }, [token]);

  function onSubmitSuccess() {
    loadMySubmissions();
    loadJobs();
  }

  const totalEarned = mySubmissions.filter((s) => s.status === "approved").reduce((sum, s) => sum + (s.reward || 0), 0);
  const pendingCount = mySubmissions.filter((s) => s.status === "pending").length;

  return (
    <main className="mx-auto max-w-content px-4 pb-28 pt-6 sm:px-5 sm:pt-10">
      {/* ── Header ── */}
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 rounded-full bg-teal-soft border-2 border-teal/40 px-3 py-1 mb-2">
          <span className="text-teal-bright text-xs font-black">💰 SALDO GRATIS</span>
        </div>
        <h1 className="font-display text-3xl font-black text-ink mb-1" style={{ textShadow: "2px 2px 0 rgba(0,0,0,0.08)" }}>
          Kerja, Dapat Saldo!
        </h1>
        <p className="text-sm text-muted">Selesaikan job dari admin, kirim bukti, saldo masuk otomatis.</p>
      </div>

      {/* ── Stats strip ── */}
      {ready && (
        <div className="grid grid-cols-3 gap-2.5 mb-5">
          {[
            { label: "Job Tersedia", val: jobs.length, icon: "📋" },
            { label: "Menunggu Review", val: pendingCount, icon: "⏳" },
            { label: "Total Didapat", val: `Rp${totalEarned.toLocaleString("id-ID")}`, icon: "🏆" }
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border-2 border-line bg-surface p-3 text-center"
              style={{ boxShadow: "3px 3px 0 0 rgba(0,0,0,0.06)" }}>
              <div className="text-2xl mb-0.5">{s.icon}</div>
              <p className="text-base font-black text-ink tabular-nums">{s.val}</p>
              <p className="text-[10px] text-muted mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── View toggle ── */}
      <div className="flex gap-2 mb-5">
        {[["jobs", "💼 Job Tersedia"], ["history", "📜 Riwayatku"]].map(([v, l]) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`flex-1 py-2.5 rounded-2xl text-sm font-black border-2 transition-all ${
              view === v ? "bg-ink text-white border-ink shadow-md" : "bg-surface text-ink border-line hover:border-teal"
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {view === "jobs" && (
        <>
          {loading ? (
            <div className="space-y-3">
              {[1,2,3].map((i) => <div key={i} className="h-40 animate-pulse rounded-3xl bg-surface2" />)}
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-6xl mb-3">😴</div>
              <p className="font-black text-ink mb-1">Belum ada job</p>
              <p className="text-sm text-muted">Admin belum menambahkan job. Cek lagi nanti!</p>
            </div>
          ) : (
            <div className="space-y-4 mt-2">
              {jobs.map((j) => (
                <JobCard key={j.id} job={j} mySubmissions={mySubmissions} onSubmit={setSubmitting} />
              ))}
            </div>
          )}
        </>
      )}

      {view === "history" && (
        <div className="space-y-3">
          {mySubmissions.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-6xl mb-3">📭</div>
              <p className="font-black text-ink mb-1">Belum ada riwayat</p>
              <p className="text-sm text-muted">Ambil job dan kirim bukti untuk mulai mendapatkan saldo gratis.</p>
            </div>
          ) : mySubmissions.map((s) => (
            <div key={s.id} className="rounded-3xl border-2 border-line bg-surface p-4"
              style={{ boxShadow: "3px 3px 0 0 rgba(0,0,0,0.06)" }}>
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <p className="text-sm font-black text-ink">{s.jobTitle}</p>
                <span className="text-sm font-black text-teal-bright shrink-0">+{`Rp${Number(s.reward).toLocaleString("id-ID")}`}</span>
              </div>
              <div className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${STATUS_MAP[s.status]?.color}`}>
                {STATUS_MAP[s.status]?.label}
              </div>
              {s.proof && <p className="mt-2 text-xs text-muted font-mono break-all line-clamp-2">Bukti: {s.proof}</p>}
              {s.status === "rejected" && s.rejectionReason && (
                <p className="mt-1 text-xs text-rose">Alasan: {s.rejectionReason}</p>
              )}
              <p className="text-[10px] text-muted mt-2">
                {new Date(s.submittedAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          ))}
        </div>
      )}

      {submitting && (
        <SubmitModal
          job={submitting}
          onClose={() => setSubmitting(null)}
          onSuccess={() => { onSubmitSuccess(); setSubmitting(null); }}
        />
      )}
    </main>
  );
}
