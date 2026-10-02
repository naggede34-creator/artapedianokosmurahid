"use client";

// Stor Gmail (freelance): generate email → buat akun PERSIS sesuai → setor ke room → upah masuk ke saldo Stor
// (dompet terpisah) → tarik ke e-wallet otomatis. Semua perhitungan upah & status ada di server (lib/setorGmail.js).
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useUser } from "@/app/providers";
import { PageHeader, Alert, Spinner, rupiah, fmtWIB, CopyButton } from "@/components/ui";

const STATUS_EMAIL = {
  digenerate: ["Belum disetor", "text-muted"],
  dikirim: ["Dikirim…", "text-amber-bright"],
  diterima: ["Diperiksa", "text-amber-bright"],
  "menunggu-admin": ["Menunggu persetujuan", "text-amber-bright"],
  mengkredit: ["Dibayarkan…", "text-amber-bright"],
  dibayar: ["Dibayar ✅", "text-success"],
  ditolak: ["Ditolak", "text-rose"]
};
const STATUS_WD = {
  sukses: ["✅ Berhasil", "text-success"], proses: ["⏳ Diproses", "text-amber-bright"], baru: ["⏳ Diproses", "text-amber-bright"],
  dikirim: ["⏳ Diproses", "text-amber-bright"], "tidak-pasti": ["⏳ Memastikan…", "text-amber-bright"], gagal: ["❌ Gagal (saldo kembali)", "text-rose"]
};
const WD_AKTIF = ["proses", "baru", "dikirim", "tidak-pasti"];

async function api(url, opsi) {
  const r = await fetch(url, { cache: "no-store", ...opsi });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `Gagal (${r.status})`);
  return d;
}
const post = (url, body) => api(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export default function SetorGmailPage() {
  const { token, ready } = useUser();
  const [info, setInfo] = useState(null);
  const [galat, setGalat] = useState("");
  const [tab, setTab] = useState("setor");
  const poll = useRef(null);
  const [cs, setCs] = useState("teatlas");
  useEffect(() => { fetch("/api/settings/public").then((r) => r.json()).then((d) => { if (d?.csUsername) setCs(String(d.csUsername).replace(/^@/, "")); }).catch(() => {}); }, []);

  const muat = useCallback(async () => {
    if (!token) return;
    try { setInfo(await api(`/api/setor-gmail?token=${encodeURIComponent(token)}`)); setGalat(""); } catch (e) { setGalat(e.message); }
  }, [token]);
  useEffect(() => { muat(); }, [muat]);
  // Selama ada setoran yang masih diperiksa, segarkan tiap 15 dtk (server membaca status dari penyedia).
  useEffect(() => {
    clearInterval(poll.current);
    if (info?.ringkas?.diproses > 0) poll.current = setInterval(muat, 15000);
    return () => clearInterval(poll.current);
  }, [info, muat]);

  if (!ready) return <div className="mx-auto max-w-content px-4 py-10"><Spinner /></div>;
  if (!token) return <div className="mx-auto max-w-content px-4 py-10"><Alert>Masuk dulu untuk memakai Stor Gmail.</Alert></div>;

  return (
    <div className="mx-auto max-w-content px-4 py-6 sm:px-5 sm:py-10" data-testid="halaman-setor-gmail">
      <PageHeader title="Stor Gmail" icon={<span className="text-xl">📧</span>} desc="Buat akun Gmail sesuai daftar, setor, dan dapat upah. Saldo Stor terpisah dari saldo lain." />
      {galat && <div className="mt-4"><Alert>{galat}</Alert></div>}
      {!info && !galat && <div className="mt-8 flex justify-center"><Spinner className="h-6 w-6" /></div>}
      {info && (
        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            <div className="manga-card p-5" data-testid="setor-saldo">
              <p className="text-xs font-bold uppercase tracking-wide text-muted">Saldo Stor (terpisah dari saldo nokos & poin game)</p>
              <b className="text-3xl tabular-nums text-ink" data-testid="setor-saldo-angka">{rupiah(info.saldo)}</b>
              <p className="mt-1 text-[11px] text-muted">Total upah diterima {rupiah(info.totalMasuk)} · sudah ditarik {rupiah(info.totalTarik)}</p>
            </div>

            <Estimasi />
            {!info.setuju ? <Syarat info={info} token={token} onSetuju={muat} /> : (
              <>
                {!info.buka && <Alert tone="amber"><span data-testid="setor-tutup">🔒 {info.alasanTutup}</span></Alert>}
                <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-xl bg-surface2 p-1" role="tablist">
                  {[["setor", "📤 Setor"], ["riwayat", `📋 Riwayat (${info.riwayat.length})`], ["tarik", "💸 Tarik"], ["syarat", "📜 Syarat"]].map(([id, lb]) => (
                    <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} data-testid={`setor-tab-${id}`} className={`tab whitespace-nowrap ${tab === id ? "tab-active" : ""}`}>{lb}</button>
                  ))}
                </div>
                {tab === "setor" && <Setor info={info} token={token} onUbah={muat} />}
                {tab === "riwayat" && <Riwayat info={info} />}
                {tab === "tarik" && <Tarik token={token} onUbah={muat} />}
                {tab === "syarat" && <DaftarSyarat info={info} />}
              </>
            )}
          </div>

          <aside className="space-y-4">
            <div className="panel-3d p-4">
              <p className="text-sm font-extrabold text-ink">Ringkasan</p>
              <dl className="mt-2 grid grid-cols-2 gap-2 text-center text-xs" data-testid="setor-ringkas">
                {[["Belum disetor", info.ringkas.belumDisetor], ["Diproses", info.ringkas.diproses], ["Dibayar", info.ringkas.dibayar], ["Ditolak", info.ringkas.ditolak]].map(([k, v]) => (
                  <div key={k} className="rounded-xl bg-surface2 px-2 py-2"><dd className="text-xl font-black tabular-nums text-ink">{v}</dd><dt className="text-[11px] text-muted">{k}</dt></div>
                ))}
              </dl>
            </div>
            <div className="panel-3d p-4">
              <p className="text-sm font-extrabold text-ink">Butuh nomor untuk daftar Gmail?</p>
              <p className="mt-1 text-xs text-muted">Beli nomor OTP Google langsung dari menu Nokos.</p>
              <Link href="/otp?q=google" className="btn-primary mt-3 block text-center" style={{ backgroundColor: "rgb(var(--c-blue))" }} data-testid="setor-ke-nokos">📱 Beli Nokos Google</Link>
            </div>
            <div className="panel-3d p-4">
              <p className="text-sm font-extrabold text-ink">Kontak</p>
              <p className="mt-1 text-xs text-muted">Ada kendala setoran atau upah? Hubungi admin.</p>
              <a href={`https://t.me/${cs}`} target="_blank" rel="noopener noreferrer" className="btn-ghost mt-3 block text-center" data-testid="setor-kontak">💬 Chat admin @{cs}</a>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

function Estimasi() {
  return (
    <div className="grid gap-2 sm:grid-cols-2" data-testid="setor-estimasi">
      <div className="rounded-2xl border border-line bg-surface p-3.5">
        <p className="flex items-center gap-2 text-sm font-black text-ink"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-soft text-lg" aria-hidden="true">⏳</span>Estimasi ACC 1–3 Hari</p>
        <p className="mt-1.5 text-xs leading-relaxed text-muted">Akun diproses setelah room ditutup.</p>
      </div>
      <div className="rounded-2xl border border-line bg-surface p-3.5">
        <p className="flex items-center gap-2 text-sm font-black text-ink"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-success-soft text-lg" aria-hidden="true">⚡</span>Payout 1–3 Menit</p>
        <p className="mt-1.5 text-xs leading-relaxed text-muted">Setelah email sudah di-ACC admin.</p>
      </div>
      <p className="text-[11px] text-muted sm:col-span-2">* Tergantung server dan admin.</p>
    </div>
  );
}

function DaftarSyarat({ info }) {
  return (
    <div className="manga-card p-5" data-testid="setor-syarat">
      <p className="text-sm font-extrabold text-ink">Syarat & Ketentuan Stor Gmail <span className="text-[11px] font-medium text-muted">(versi {info.syaratVersi})</span></p>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-xs leading-relaxed text-ink">{info.syarat.map((s, i) => <li key={i}>{s}</li>)}</ol>
    </div>
  );
}

function Syarat({ info, token, onSetuju }) {
  const [centang, setCentang] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const [err, setErr] = useState("");
  async function setuju() {
    setSibuk(true); setErr("");
    try { await post("/api/setor-gmail", { token, aksi: "setuju" }); await onSetuju(); } catch (e) { setErr(e.message); } finally { setSibuk(false); }
  }
  return (
    <div className="space-y-3" data-testid="setor-gerbang-syarat">
      <DaftarSyarat info={info} />
      <label className="flex items-start gap-2 text-sm text-ink"><input type="checkbox" checked={centang} onChange={(e) => setCentang(e.target.checked)} className="mt-1" data-testid="setor-centang" /> Saya sudah membaca dan menyetujui Syarat & Ketentuan di atas.</label>
      {err && <Alert>{err}</Alert>}
      <button disabled={!centang || sibuk} onClick={setuju} className="btn-primary w-full" data-testid="setor-setuju">{sibuk ? <Spinner /> : null} Saya setuju — mulai</button>
    </div>
  );
}

function Setor({ info, token, onUbah }) {
  const [jumlah, setJumlah] = useState(5);
  const [daftar, setDaftar] = useState([]); // [{email,password}]
  const [roomId, setRoomId] = useState("");
  const [teks, setTeks] = useState("");
  const [sibuk, setSibuk] = useState("");
  const [pesan, setPesan] = useState(null);
  const roomBuka = info.rooms.filter((r) => r.buka);
  useEffect(() => { if (!roomId && roomBuka[0]) setRoomId(roomBuka[0].id); }, [roomBuka, roomId]);
  const room = info.rooms.find((r) => r.id === roomId);

  async function generate() {
    setSibuk("gen"); setPesan(null);
    try {
      const d = await post("/api/setor-gmail", { token, aksi: "generate", jumlah });
      setDaftar((x) => [...x, ...d.emails]);
      setTeks((t) => [t.trim(), ...d.emails.map((e) => e.email)].filter(Boolean).join("\n"));
      setPesan({ ok: true, teks: `${d.emails.length} email dibuat. Buat akun Gmail PERSIS dengan email & sandi di bawah, lalu setor.` });
      onUbah();
    } catch (e) { setPesan({ ok: false, teks: e.message }); } finally { setSibuk(""); }
  }
  async function muatBelum() {
    setSibuk("belum"); setPesan(null);
    try {
      const d = await post("/api/setor-gmail", { token, aksi: "belum" });
      setDaftar(d.emails);
      setTeks(d.emails.map((e) => e.email).join("\n"));
      setPesan(d.emails.length ? { ok: true, teks: `${d.emails.length} email belum disetor dimuat.` } : { ok: true, teks: "Tidak ada email yang belum disetor." });
    } catch (e) { setPesan({ ok: false, teks: e.message }); } finally { setSibuk(""); }
  }
  async function setor() {
    setSibuk("setor"); setPesan(null);
    try {
      const d = await post("/api/setor-gmail", { token, aksi: "setor", roomId, teks });
      setPesan({ ok: true, teks: `${d.diproses} email dikirim${d.room ? ` ke ${d.room}` : ""}${d.upah ? ` (upah ${rupiah(d.upah)}/email jika diterima)` : ""}.${d.tertolak?.length ? ` ${d.tertolak.length} email dilewati (bukan hasil generate-mu / sudah disetor).` : ""}${d.tidakPasti ? " Penyedia lambat menjawab — statusnya dicek otomatis." : ""} Upah masuk setelah akun diterima.` });
      setDaftar((x) => x.filter((e) => !teks.toLowerCase().includes(e.email))); setTeks("");
      onUbah();
    } catch (e) { setPesan({ ok: false, teks: e.message }); } finally { setSibuk(""); }
  }

  return (
    <div className="manga-card space-y-5 p-5" data-testid="setor-form">
      <ol className="grid gap-2 text-xs sm:grid-cols-3">
        {["1. Generate email", "2. Buat akun Gmail PERSIS sesuai (email + sandi)", "3. Setor ke room & dapat upah"].map((s) => <li key={s} className="rounded-xl bg-surface2 px-3 py-2 font-bold text-ink">{s}</li>)}
      </ol>

      <div>
        <p className="label">1. Generate email</p>
        <div className="flex flex-wrap items-center gap-2">
          <input type="number" min={1} max={info.maks.generate} value={jumlah} onChange={(e) => setJumlah(Math.max(1, Math.min(info.maks.generate, Number(e.target.value) || 1)))} className="field w-24" aria-label="Jumlah email" data-testid="setor-jumlah" />
          <button disabled={!info.buka || sibuk === "gen"} onClick={generate} className="btn-primary" data-testid="setor-generate">{sibuk === "gen" ? <Spinner /> : null} Generate {jumlah} email</button>
          <button disabled={sibuk === "belum"} onClick={muatBelum} className="btn-ghost" data-testid="setor-muat-belum">Muat yang belum disetor ({info.ringkas.belumDisetor})</button>
        </div>
        <p className="mt-1 text-[11px] text-muted">Maks {info.maks.generate} email sekali generate. Sandi hanya tampil di sini — simpan sebelum menutup halaman (bisa dimuat ulang lewat “Muat yang belum disetor”).</p>
      </div>

      {daftar.length > 0 && (
        <div data-testid="setor-daftar-generate">
          <div className="flex items-center justify-between"><p className="label">2. Buat akun PERSIS seperti ini</p><CopyButton value={daftar.map((e) => `${e.email}|${e.password}`).join("\n")} label="Salin semua" /></div>
          <ul className="divide-y divide-line rounded-xl border border-line text-xs">
            {daftar.map((e) => (
              <li key={e.email} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2" data-testid="setor-baris-email">
                <span className="font-mono text-ink">{e.email}</span>
                <span className="flex items-center gap-1"><span className="font-mono text-muted">{e.password || "(sandi tidak tampil)"}</span><CopyButton value={e.password} label="Sandi" /></span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <p className="label">3. Setor ke room <span className="ml-1 normal-case font-semibold text-muted" data-testid="setor-room-hitung">{info.jumlahRoom ? `· ${info.jumlahRoom.buka} buka · ${info.jumlahRoom.tutup} tutup` : ""}</span></p>
        {info.rooms.length === 0 ? <p className="text-xs text-muted">Belum ada room.</p> : (
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Room">
            {info.rooms.map((r) => (
              <button key={r.id} type="button" role="radio" aria-checked={roomId === r.id} disabled={!r.buka} onClick={() => setRoomId(r.id)} data-testid="setor-room"
                className={`rounded-xl border px-3 py-2 text-left text-xs ${roomId === r.id ? "border-amber bg-amber-soft" : "border-line"} ${!r.buka ? "opacity-50" : ""}`}>
                <span className="flex items-center justify-between gap-2"><b className="block truncate text-ink">{r.nama}</b><span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black ${r.buka ? "bg-success-soft text-success" : "bg-rose-soft text-rose"}`} data-testid="setor-room-status">{r.buka ? "BUKA" : "TUTUP"}</span></span>
                {r.buka ? <span className="text-success">Upah {rupiah(r.upah)} / email</span> : <span className="text-rose">🔒 {r.alasanTutup}{r.terakhirBuka ? ` · terakhir buka ${new Date(r.terakhirBuka).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })}` : ""}</span>}
              </button>
            ))}
          </div>
        )}
        <textarea value={teks} onChange={(e) => setTeks(e.target.value)} rows={5} placeholder={"Tempel email yang sudah kamu buat (satu per baris)\ncontoh@gmail.com"} className="field mt-3 w-full font-mono text-xs" aria-label="Daftar email" data-testid="setor-teks" />
        {pesan && <div className="mt-2"><Alert tone={pesan.ok ? "green" : "red"}><span data-testid="setor-pesan">{pesan.teks}</span></Alert></div>}
        <button disabled={!info.buka || !room?.buka || !teks.trim() || sibuk === "setor"} onClick={setor} className="btn-primary mt-3 w-full" data-testid="setor-kirim">{sibuk === "setor" ? <Spinner /> : null} Setor sekarang</button>
        <p className="mt-2 text-center text-[11px] text-muted">Hanya email hasil generate-mu yang diterima. Upah masuk ke saldo Stor setelah akun diperiksa dan diterima.</p>
      </div>
    </div>
  );
}

function Riwayat({ info }) {
  return (
    <div className="manga-card p-5" data-testid="setor-riwayat">
      {info.riwayat.length === 0 ? <p className="text-xs text-muted">Belum ada email.</p> : (
        <ul className="divide-y divide-line text-xs">
          {info.riwayat.map((x) => {
            const [label, warna] = STATUS_EMAIL[x.status] || [x.status, "text-muted"];
            return (
              <li key={x.email} className="flex items-start justify-between gap-2 py-2.5" data-testid="setor-riwayat-baris">
                <span className="min-w-0"><b className="font-mono text-ink">{x.email}</b><span className="block text-[10px] text-muted">{x.room ? `${x.room} · ` : ""}{x.upah ? `${rupiah(x.upah)} · ` : ""}{fmtWIB(x.diperbarui)}</span>{x.alasan && <span className="block text-[11px] text-rose">{x.alasan}</span>}</span>
                <span className={`shrink-0 font-bold ${warna}`}>{label}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Tarik({ token, onUbah }) {
  const [info, setInfo] = useState(null);
  const [wallet, setWallet] = useState("DANA");
  const [nomor, setNomor] = useState("");
  const [nama, setNama] = useState("");
  const [nominal, setNominal] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState(null);
  const poll = useRef(null);
  const muat = useCallback(async () => {
    try { const d = await api(`/api/setor-gmail/tarik?token=${encodeURIComponent(token)}`); setInfo(d); setWallet((w) => (d.dompet?.includes(w) ? w : d.dompet?.[0] || w)); } catch {}
  }, [token]);
  useEffect(() => { muat(); }, [muat]);
  useEffect(() => {
    clearInterval(poll.current);
    if (info?.riwayat?.some((x) => WD_AKTIF.includes(x.status))) poll.current = setInterval(() => { muat(); onUbah(); }, 6000);
    return () => clearInterval(poll.current);
  }, [info, muat, onUbah]);
  const n = Math.floor(Number(nominal) || 0);
  const fee = info?.feeRp || 0;
  async function ajukan(e) {
    e.preventDefault();
    if (sibuk) return;
    setSibuk(true); setPesan(null);
    try {
      const d = await post("/api/setor-gmail/tarik", { token, wallet, nomor, nama, nominal: n });
      const s = d.wd?.status;
      setPesan(s === "sukses" ? { ok: true, teks: `Berhasil! ${rupiah(n)} sudah dikirim ke ${wallet} ${nomor}.` } : s === "gagal" ? { ok: false, teks: `Penarikan gagal${d.wd?.pesan ? ` (${d.wd.pesan})` : ""}. Saldo Stor sudah dikembalikan.` } : { ok: true, teks: `Penarikan ${rupiah(n)} sedang diproses. Status berubah otomatis.` });
      setNominal(""); muat(); onUbah();
    } catch (err) { setPesan({ ok: false, teks: err.message }); } finally { setSibuk(false); }
  }
  return (
    <div className="manga-card p-5" data-testid="setor-tarik">
      {info && !info.aktif ? <Alert tone="amber">Penarikan saldo Stor sedang dinonaktifkan atau belum tersedia.</Alert> : (
        <form onSubmit={ajukan} className="space-y-3">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="E-wallet tujuan">
            {(info?.dompet || ["DANA", "GoPay", "ShopeePay"]).map((w) => <button key={w} type="button" role="radio" aria-checked={wallet === w} onClick={() => setWallet(w)} className={`rounded-xl border px-3 py-1.5 text-xs font-bold ${wallet === w ? "border-amber bg-amber-soft text-amber-bright" : "border-line text-ink"}`}>{w}</button>)}
          </div>
          <input value={nomor} onChange={(e) => setNomor(e.target.value.replace(/[^\d+\s-]/g, "").slice(0, 20))} inputMode="tel" placeholder="Nomor e-wallet (mis. 081234567890)" className="field w-full" aria-label="Nomor e-wallet" data-testid="setor-wd-nomor" />
          <input value={nama} onChange={(e) => setNama(e.target.value.slice(0, 60))} placeholder="Nama pemilik e-wallet (opsional)" className="field w-full" aria-label="Nama pemilik e-wallet" />
          <div className="field-3d flex items-center px-4"><span className="text-lg font-extrabold text-amber-bright">Rp</span>
            <input inputMode="numeric" value={nominal} onChange={(e) => setNominal(e.target.value.replace(/\D/g, ""))} placeholder={String(info?.minRp || 10000)} className="w-full bg-transparent px-2 py-3 text-2xl font-extrabold tabular-nums text-ink outline-none" aria-label="Nominal diterima" data-testid="setor-wd-nominal" />
            <button type="button" onClick={() => setNominal(String(Math.max(0, Math.min(info?.maksRp || 0, (info?.saldo || 0) - fee))))} className="rounded-lg border border-line px-2 py-1 text-[11px] font-black text-ink">Maks</button>
          </div>
          <div className="panel-3d divide-y divide-line px-4 text-sm">
            <div className="flex justify-between py-2"><span className="text-muted">Kamu terima</span><b className="text-success">{n ? rupiah(n) : "—"}</b></div>
            <div className="flex justify-between py-2"><span className="text-muted">Biaya admin</span><b>{info ? rupiah(fee) : "—"}</b></div>
            <div className="flex justify-between py-2"><span className="text-muted">Saldo Stor dipotong</span><b data-testid="setor-wd-total">{n ? rupiah(n + fee) : "—"}</b></div>
          </div>
          {pesan && <Alert tone={pesan.ok ? "green" : "red"}><span data-testid="setor-wd-pesan">{pesan.teks}</span></Alert>}
          <button type="submit" disabled={sibuk || !info?.aktif || n < (info?.minRp || 10000) || !nomor} className="btn-primary w-full" data-testid="setor-wd-kirim">{sibuk ? <Spinner /> : null}{sibuk ? "Memproses…" : "Tarik sekarang"}</button>
          <p className="text-center text-[11px] text-muted">Minimal {info ? rupiah(info.minRp) : "Rp10.000"} · biaya {info ? rupiah(fee) : "—"} · maks {info?.maksHari ?? 5}× per hari (sisa {info?.sisaHariIni ?? "…"}×). Otomatis via e-wallet.</p>
        </form>
      )}
      <p className="mt-5 text-sm font-extrabold text-ink">Riwayat penarikan</p>
      {!info?.riwayat?.length ? <p className="mt-2 text-xs text-muted">Belum ada penarikan.</p> : (
        <ul className="mt-2 divide-y divide-line text-xs" data-testid="setor-wd-riwayat">
          {info.riwayat.map((x) => { const [label, warna] = STATUS_WD[x.status] || [x.status, "text-muted"]; return (
            <li key={x.id} className="flex items-start justify-between gap-2 py-2.5"><span><b className="text-ink">{rupiah(x.nominal)}</b> ke {x.wallet} {x.nomor}<span className="block text-[10px] text-muted">{x.id} · {fmtWIB(x.dibuat)}</span>{x.pesan && <span className="block text-[11px] text-muted">{x.pesan}</span>}</span><span className={`shrink-0 font-bold ${warna}`}>{label}</span></li>
          ); })}
        </ul>
      )}
    </div>
  );
}
