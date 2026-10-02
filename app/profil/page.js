"use client";

// Profil Akun: identitas, level, statistik, kode akun, tautan cepat, preferensi,
// dan keluar dari akun. Semua data diambil dari endpoint yang sudah ada.
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useUser } from "@/app/providers";
import ThemeToggle from "@/components/ThemeToggle";
import PushToggle from "@/components/PushToggle";
import KunciAkunPanel from "@/components/KunciAkunPanel";
import { Lencana } from "@/components/wa/kit";
import { PageHeader, rupiah } from "@/components/ui";

const AVATARS = ["😊", "😎", "🦅", "🦁", "🐯", "🦊", "🐺", "🦝", "🦄", "🐲", "👾", "🤖", "👑", "🔥", "⚡", "🌟", "💎", "🎯", "🏆", "🌈", "🎮", "🥷", "🧙", "🐼"];

const TINGKAT = {
  bronze: { warna: "from-amber-700 to-amber-500", label: "Bronze" },
  silver: { warna: "from-slate-400 to-slate-200", label: "Silver" },
  gold: { warna: "from-amber-bright to-amber", label: "Gold" }
};

function tanggalPanjang(v) {
  if (!v) return "-";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}
function lamaBergabung(v) {
  if (!v) return "";
  const hari = Math.floor((Date.now() - new Date(v).getTime()) / 86400000);
  if (Number.isNaN(hari) || hari < 0) return "";
  if (hari < 1) return "baru hari ini";
  if (hari < 30) return `${hari} hari`;
  if (hari < 365) return `${Math.floor(hari / 30)} bulan`;
  return `${Math.floor(hari / 365)} tahun ${Math.floor((hari % 365) / 30)} bulan`;
}
function unduhKode(nama, kode) {
  try {
    const isi = `ARTA PEDIA — KODE AKUN\n\nNama : ${nama || "-"}\nKode : ${kode}\n\nSimpan baik-baik. Kode ini dipakai untuk masuk lagi di website maupun bot Telegram.\nJangan dibagikan ke siapa pun.\n`;
    const url = URL.createObjectURL(new Blob([isi], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "kode-akun-artapedia.txt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch {}
}

function Kartu({ judul, ikon, children, className = "" }) {
  return (
    <section className={`card-shadow rounded-2xl border border-line bg-surface p-5 ${className}`}>
      <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-ink">
        <span aria-hidden="true">{ikon}</span> {judul}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Angka({ label, nilai, warna = "text-ink", ikon }) {
  return (
    <div className="hover-lift rounded-2xl border border-line bg-surface2/50 p-3.5">
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted"><span aria-hidden="true">{ikon}</span>{label}</p>
      <p className={`mt-1 font-display text-xl font-semibold tabular-nums ${warna}`}>{nilai}</p>
    </div>
  );
}

export default function ProfilPage() {
  const { token, ready, name, balance, joinedAt, updateName, keluar, refreshBalance } = useUser();
  const [avatar, setAvatar] = useState("😊");
  const [pilihAvatar, setPilihAvatar] = useState(false);
  const [namaInput, setNamaInput] = useState("");
  const [simpan, setSimpan] = useState(false);
  const [pesanNama, setPesanNama] = useState({ ok: true, teks: "" });
  const [lihatKode, setLihatKode] = useState(false);
  const [tersalin, setTersalin] = useState(false);
  const [loyal, setLoyal] = useState(null);
  const [stat, setStat] = useState(null);
  const [wa, setWa] = useState(null);
  const [muat, setMuat] = useState(true);
  const [dialogKeluar, setDialogKeluar] = useState(false);
  const [sudahSimpan, setSudahSimpan] = useState(false);

  useEffect(() => {
    if (!token) return;
    try { setAvatar(localStorage.getItem(`avatar-${token}`) || "😊"); } catch {}
  }, [token]);
  useEffect(() => { setNamaInput(name || ""); }, [name]);
  useEffect(() => { if (window.location.hash === "#keluar") setDialogKeluar(true); }, []);

  const muatData = useCallback(async () => {
    if (!token) return;
    setMuat(true);
    const q = encodeURIComponent(token);
    const ambil = (u) => fetch(u, { cache: "no-store" }).then((r) => r.json()).then((d) => (d?.error ? null : d)).catch(() => null);
    const [l, s, w] = await Promise.all([ambil(`/api/loyalty/info?token=${q}`), ambil(`/api/user/stats?token=${q}`), ambil(`/api/wa/profil?token=${q}`)]);
    setLoyal(l); setStat(s); setWa(w?.profil || null);
    setMuat(false);
  }, [token]);
  useEffect(() => { if (ready && token) { muatData(); refreshBalance?.(); } // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, token]);

  function pilih(e) {
    setAvatar(e);
    setPilihAvatar(false);
    try { localStorage.setItem(`avatar-${token}`, e); window.dispatchEvent(new Event("avatar-berubah")); } catch {}
  }

  async function simpanNama(e) {
    e.preventDefault();
    const n = namaInput.trim();
    if (n.length < 2) { setPesanNama({ ok: false, teks: "Nama minimal 2 huruf." }); return; }
    if (/https?:\/\/|www\.|<|>/i.test(n)) { setPesanNama({ ok: false, teks: "Nama tidak boleh berisi tautan." }); return; }
    setSimpan(true);
    try {
      await updateName(n);
      setPesanNama({ ok: true, teks: "Nama tersimpan." });
      muatData();
    } catch (err) {
      setPesanNama({ ok: false, teks: err.message || "Gagal menyimpan nama." });
    } finally {
      setSimpan(false);
      setTimeout(() => setPesanNama((p) => ({ ...p, teks: "" })), 3000);
    }
  }

  async function salin() {
    try { await navigator.clipboard.writeText(token); setTersalin(true); setTimeout(() => setTersalin(false), 1800); } catch {}
  }

  const tingkat = loyal?.badge?.key || "bronze";
  const dasar = loyal?.badgeThresholds ? Number(loyal.badgeThresholds[tingkat]) || 0 : 0;
  const persen = useMemo(() => {
    if (!loyal?.next) return 100;
    return Math.max(0, Math.min(100, (((loyal.totalSpent || 0) - dasar) / Math.max(1, loyal.next.target - dasar)) * 100));
  }, [loyal, dasar]);
  const fotoWa = wa?.fotoV ? `/api/wa/foto/${wa.pid}?v=${wa.fotoV}` : null;
  const tampilNama = name || "Pengguna Artapedia";

  if (!ready) return <div className="mx-auto max-w-content px-4 py-10 text-sm text-muted">Memuat profil…</div>;
  if (!token) {
    return (
      <div className="mx-auto max-w-content px-4 py-16 text-center">
        <p className="text-4xl">🔒</p>
        <p className="mt-3 font-bold text-ink">Masuk dulu untuk melihat profil akunmu.</p>
        <Link href="/" className="btn-3d mt-4 inline-block rounded-xl border-2 border-blue bg-blue-bright px-5 py-2.5 text-sm font-black text-white">Ke beranda</Link>
      </div>
    );
  }

  const tautan = [
    ["/dashboard", "🏠", "Dashboard"],
    ["/deposit", "💳", "Isi Saldo"],
    ["/riwayat", "🧾", "Riwayat"],
    ["/mutasi", "📒", "Mutasi Saldo"],
    ["/tarik", "💸", "Tarik Saldo"],
    ["/transfer", "🔁", "Transfer"],
    ["/loyalitas", "⭐", "Poin & Level"],
    ["/referral", "🎁", "Undang Teman"],
    ["/chat?profil=1", "💬", "Profil WEARTA CHAT"]
  ];

  return (
    <div className="mx-auto max-w-content px-4 py-6 sm:px-5 sm:py-10">
      <PageHeader icon="👤" title="Profil Akun" desc="Semua tentang akunmu: identitas, level, statistik, kode akun, dan pengaturan." />

      {/* ─── kartu utama ─── */}
      <div className="fade-up card-shadow relative mt-6 overflow-hidden rounded-3xl bg-ink px-5 py-6 sm:px-8 sm:py-8">
        <div className="pointer-events-none absolute -right-14 -top-20 h-64 w-64 rounded-full bg-amber/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-6 h-52 w-52 rounded-full bg-blue/25 blur-3xl" />
        <div className="relative flex flex-wrap items-center gap-4 sm:gap-6">
          <button
            type="button"
            onClick={() => setPilihAvatar((v) => !v)}
            className="press relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-white/80 bg-white/15 text-5xl shadow-3d"
            aria-label="Ganti avatar"
            aria-expanded={pilihAvatar}
          >
            {fotoWa ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={fotoWa} alt="" className="h-full w-full object-cover" />
            ) : (
              <span aria-hidden="true">{avatar}</span>
            )}
            <span className="absolute inset-x-0 bottom-0 bg-black/45 py-0.5 text-[10px] font-bold text-white">GANTI</span>
          </button>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 text-2xl font-extrabold tracking-tight text-white">
              <span className="truncate">{tampilNama}</span>
              {wa?.lencana ? <Lencana warna={wa.lencana} size={24} /> : null}
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-white/75">
              <span>📅 Bergabung {tanggalPanjang(joinedAt)}{lamaBergabung(joinedAt) ? ` · ${lamaBergabung(joinedAt)}` : ""}</span>
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br px-3 py-1 text-xs font-extrabold text-ink ${TINGKAT[tingkat].warna}`}>
                {loyal?.badge?.icon || "🥉"} Level {TINGKAT[tingkat].label}
              </span>
              {wa?.lencana ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white">🎖 Terverifikasi</span>
              ) : null}
            </div>
          </div>
          <div className="w-full rounded-2xl bg-white/10 px-4 py-3 text-white sm:w-auto sm:min-w-[190px]">
            <p className="text-[11px] font-bold uppercase tracking-wide text-white/70">Saldo</p>
            <p className="mt-0.5 font-display text-2xl font-semibold tabular-nums">{rupiah(balance)}</p>
            <Link href="/deposit" className="press mt-2 inline-block rounded-lg bg-amber px-3 py-1.5 text-xs font-extrabold text-white">+ Isi saldo</Link>
          </div>
        </div>

        {pilihAvatar && (
          <div className="relative mt-5 rounded-2xl bg-white/10 p-3">
            <p className="mb-2 text-xs font-bold text-white/80">Pilih avatar{fotoWa ? " (foto WEARTA CHAT tetap tampil di sini kalau ada)" : ""}</p>
            <div className="grid grid-cols-6 gap-2 sm:grid-cols-12">
              {AVATARS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => pilih(e)}
                  className={`flex h-11 items-center justify-center rounded-xl text-2xl transition-transform hover:scale-110 ${avatar === e ? "bg-amber ring-2 ring-white" : "bg-white/15"}`}
                  aria-label={`Avatar ${e}`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        )}

        {loyal?.next ? (
          <div className="relative mt-5">
            <div className="flex items-center justify-between text-xs font-semibold text-white/75">
              <span>Menuju {loyal.next.name} {loyal.next.icon}</span>
              <span>{rupiah(loyal.next.remaining)} lagi</span>
            </div>
            <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-white/15">
              <div className="h-full rounded-full bg-amber transition-all duration-500" style={{ width: `${persen}%` }} />
            </div>
          </div>
        ) : loyal ? (
          <p className="relative mt-5 text-xs font-bold text-amber-bright">🎉 Kamu sudah di level tertinggi!</p>
        ) : null}
      </div>

      {/* ─── statistik ─── */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Angka ikon="⭐" label="Poin" nilai={muat ? "…" : (loyal?.points || 0).toLocaleString("id-ID")} warna="text-amber-bright" />
        <Angka ikon="🛍" label="Total belanja" nilai={muat ? "…" : rupiah(loyal?.totalSpent || 0)} />
        <Angka ikon="💸" label="Cashback didapat" nilai={muat ? "…" : rupiah(loyal?.cashbackTotal || 0)} warna="text-teal-bright" />
        <Angka ikon="📲" label="Transaksi OTP" nilai={muat ? "…" : (stat?.totalTransaksi || 0).toLocaleString("id-ID")} />
        <Angka ikon="✅" label="OTP berhasil" nilai={muat ? "…" : (stat?.otpBerhasil || 0).toLocaleString("id-ID")} warna="text-success" />
        <Angka ikon="🏦" label="Deposit sukses" nilai={muat ? "…" : (stat?.depositSukses || 0).toLocaleString("id-ID")} />
        <Angka ikon="🎯" label="Tingkat sukses" nilai={muat || !stat?.totalTransaksi ? "—" : `${Math.round((stat.otpBerhasil / stat.totalTransaksi) * 100)}%`} />
        <Angka ikon="🎖" label="Lencana" nilai={muat ? "…" : wa?.lencana ? "Ada" : "Belum"} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {/* ─── identitas ─── */}
        <Kartu judul="Identitas" ikon="🪪">
          <form onSubmit={simpanNama}>
            <label htmlFor="pf-nama" className="text-xs font-bold text-muted">Nama tampilan</label>
            <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
              <input
                id="pf-nama"
                value={namaInput}
                onChange={(e) => setNamaInput(e.target.value)}
                maxLength={24}
                placeholder="Nama kamu"
                className="field min-w-0 flex-1"
                autoComplete="nickname"
              />
              <button disabled={simpan || namaInput.trim() === (name || "")} className="btn-3d rounded-xl border-2 border-blue bg-blue-bright px-5 py-2.5 text-sm font-black text-white disabled:opacity-40">
                {simpan ? "…" : "Simpan"}
              </button>
            </div>
            <p className={`mt-1.5 min-h-[16px] text-[11px] font-bold ${pesanNama.ok ? "text-teal-bright" : "text-rose"}`} role="status">{pesanNama.teks}</p>
            <p className="text-[11px] leading-relaxed text-muted">Nama ini tampil di sapaan Dashboard, leaderboard, dan WEARTA CHAT.</p>
          </form>
          <dl className="mt-4 divide-y divide-line rounded-xl border border-line text-sm">
            <div className="flex justify-between gap-3 px-3 py-2.5"><dt className="text-muted">Bergabung</dt><dd className="font-bold text-ink">{tanggalPanjang(joinedAt)}</dd></div>
            <div className="flex justify-between gap-3 px-3 py-2.5"><dt className="text-muted">Lama bergabung</dt><dd className="font-bold text-ink">{lamaBergabung(joinedAt) || "-"}</dd></div>
            <div className="flex justify-between gap-3 px-3 py-2.5"><dt className="text-muted">ID publik chat</dt><dd className="font-mono text-xs font-bold text-ink">{wa?.pid || "—"}</dd></div>
            <div className="flex justify-between gap-3 px-3 py-2.5"><dt className="text-muted">Bio WEARTA CHAT</dt><dd className="max-w-[60%] truncate text-right font-bold text-ink">{wa?.bio || "—"}</dd></div>
          </dl>
          <Link href="/chat?profil=1" className="btn-3d mt-3 flex items-center justify-center gap-2 rounded-xl border border-line bg-surface2 py-2.5 text-xs font-black text-ink hover:border-amber">
            💬 Ubah foto & bio di WEARTA CHAT
          </Link>
        </Kartu>

        {/* ─── kode akun ─── */}
        <Kartu judul="Kode akun" ikon="🔑">
          <p className="text-xs leading-relaxed text-muted">
            Kode akun adalah <b className="text-ink">satu-satunya kunci</b> ke saldo dan riwayatmu — dipakai untuk masuk di perangkat lain, di website, maupun di bot Telegram.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-xl border border-line bg-surface2 px-3 py-3 text-center font-mono text-sm font-bold text-ink" data-testid="kode-akun">
              {lihatKode ? token : "AP-••••-••••-••••"}
            </code>
            <button type="button" onClick={() => setLihatKode((v) => !v)} className="press rounded-xl border border-line px-3.5 py-3 text-sm font-bold" aria-label={lihatKode ? "Sembunyikan kode" : "Tampilkan kode"}>
              {lihatKode ? "🙈" : "👁"}
            </button>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button type="button" onClick={salin} className="btn-3d rounded-xl border-2 border-blue bg-blue-soft py-2.5 text-xs font-black text-blue-bright">
              {tersalin ? "✅ Tersalin" : "📋 Salin kode"}
            </button>
            <button type="button" onClick={() => unduhKode(name, token)} className="btn-3d rounded-xl border-2 border-line bg-surface py-2.5 text-xs font-black text-ink">
              💾 Unduh .txt
            </button>
          </div>
          <p className="mt-3 rounded-xl border border-rose/30 bg-rose-soft px-3 py-2 text-[11px] font-bold leading-relaxed text-rose">
            ⚠️ Jangan kirim kode ini ke siapa pun, termasuk yang mengaku admin. Siapa pun yang tahu kode ini bisa membuka akunmu dan membelanjakan saldonya.
          </p>
        </Kartu>
      </div>

      {/* ─── tautan cepat ─── */}
      <Kartu judul="Pintasan" ikon="🧭" className="mt-5">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {tautan.map(([href, ikon, label]) => (
            <Link key={href} href={href} className="hover-lift press flex items-center gap-2.5 rounded-xl border border-line bg-surface2/50 px-3 py-3 text-sm font-bold text-ink hover:border-amber/60">
              <span className="text-xl" aria-hidden="true">{ikon}</span>
              <span className="leading-tight">{label}</span>
            </Link>
          ))}
        </div>
      </Kartu>

      {/* ─── preferensi ─── */}
      <Kartu judul="Preferensi" ikon="🎛" className="mt-5">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2.5">
          <span className="text-sm font-bold text-ink">Mode gelap</span>
          <ThemeToggle />
        </div>
        <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2.5">
          <span className="text-sm font-bold text-ink">Tema warna & tampilan</span>
          <Link href="/tampilan" className="press rounded-lg border border-line px-3 py-1.5 text-xs font-black text-ink">Atur</Link>
        </div>
        <div className="mt-2 overflow-hidden rounded-xl border border-line">
          <PushToggle token={token} />
        </div>
      </Kartu>

      {/* ─── keamanan akun ─── */}
      <Kartu judul="Keamanan akun" ikon="🛡" className="mt-5">
        <KunciAkunPanel token={token} />
      </Kartu>

      {/* ─── keluar ─── */}
      <section id="keluar" className="mt-5 rounded-2xl border-2 border-rose/40 bg-rose-soft/60 p-5">
        <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-rose">🚪 Keluar dari akun</h2>
        <p className="mt-2 text-xs leading-relaxed text-ink/80">
          Kamu keluar dari perangkat ini saja — akun, saldo, dan riwayatmu <b>tidak dihapus</b>. Untuk masuk lagi kamu butuh <b>kode akun</b>, jadi pastikan sudah tersimpan.
        </p>
        <button type="button" onClick={() => { setSudahSimpan(false); setDialogKeluar(true); }} className="btn-3d mt-3 rounded-xl border-2 border-rose bg-surface px-5 py-2.5 text-sm font-black text-rose">
          Keluar dari akun ini
        </button>
      </section>

      {dialogKeluar && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center px-5" role="dialog" aria-modal="true" aria-label="Konfirmasi keluar">
          <button aria-label="Batal" className="absolute inset-0 animate-fade-in" style={{ background: "rgb(var(--c-ink) / 0.5)" }} onClick={() => setDialogKeluar(false)} />
          <div className="animate-scale-in relative w-full max-w-sm rounded-3xl border-2 border-ink/10 bg-surface p-6 shadow-lift">
            <p className="text-center text-4xl">🚪</p>
            <h3 className="mt-2 text-center text-lg font-black text-ink">Keluar dari akun?</h3>
            <p className="mt-2 text-center text-xs leading-relaxed text-muted">
              Simpan kode akunmu dulu. Tanpa kode ini kamu tidak bisa masuk lagi ke akun <b className="text-ink">{tampilNama}</b> dan saldonya.
            </p>
            <div className="mt-3 rounded-xl border-2 border-dashed border-amber/60 bg-amber-soft px-3 py-3 text-center">
              <p className="select-all break-all font-mono text-base font-black tracking-wide text-ink">{token}</p>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button type="button" onClick={salin} className="btn-3d rounded-xl border-2 border-blue bg-blue-soft py-2 text-xs font-black text-blue-bright">{tersalin ? "✅ Tersalin" : "📋 Salin"}</button>
              <button type="button" onClick={() => unduhKode(name, token)} className="btn-3d rounded-xl border-2 border-line bg-surface py-2 text-xs font-black text-ink">💾 Unduh</button>
            </div>
            <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-xs font-bold text-ink">
              <input type="checkbox" checked={sudahSimpan} onChange={(e) => setSudahSimpan(e.target.checked)} className="mt-0.5 h-4 w-4 accent-amber" />
              Saya sudah menyimpan kode akun ini.
            </label>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setDialogKeluar(false)} className="btn-3d rounded-xl border-2 border-line bg-surface py-3 text-sm font-black text-ink">Batal</button>
              <button type="button" disabled={!sudahSimpan} onClick={keluar} className="btn-3d rounded-xl border-2 border-rose bg-rose py-3 text-sm font-black text-white disabled:opacity-40" data-testid="konfirmasi-keluar">Ya, keluar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
