"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useUser } from "@/app/providers";
import { BOT_URL } from "@/lib/links";

export const dynamic = "force-dynamic";

const KOSONG = { botToken: "", ownerTelegramId: "", botUsername: "", ownerUsername: "", markupPersen: "10" };

export default function ResellerPage() {
  const { token } = useUser();
  const [items, setItems] = useState([]);
  const [maks, setMaks] = useState(3);
  const [markupMaks, setMarkupMaks] = useState(100);
  const [tarikMin, setTarikMin] = useState(15000);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState(KOSONG);
  const [buka, setBuka] = useState(false);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [salah, setSalah] = useState([]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/reseller?token=${encodeURIComponent(token)}`);
      const d = await res.json();
      if (res.ok) {
        setItems(d.items || []);
        setMaks(d.maks || 3);
        setMarkupMaks(d.markupMaks || 100);
        setTarikMin(d.tarikMin || 15000);
      }
    } catch {}
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function kirim(payload, label) {
    setBusy(label); setMsg(""); setSalah([]);
    try {
      const res = await fetch("/api/reseller", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, ...payload })
      });
      const d = await res.json();
      if (!res.ok) {
        setSalah(d.salah?.length ? d.salah : [d.error || "Gagal."]);
        return false;
      }
      setMsg(d.pesan || "Berhasil.");
      load();
      return true;
    } catch {
      setSalah(["Jaringan bermasalah, coba lagi."]);
      return false;
    } finally {
      setBusy("");
      setTimeout(() => setMsg(""), 7000);
    }
  }

  async function buatBot(e) {
    e.preventDefault();
    const ok = await kirim({ aksi: "buat", ...form }, "buat");
    if (ok) { setForm(KOSONG); setBuka(false); }
  }

  const rp = (n) => `Rp${Number(n || 0).toLocaleString("id-ID")}`;

  return (
    <div className="mx-auto max-w-content px-4 py-6 sm:px-5 sm:py-10">
      <div className="panggung-3d rounded-3xl border-2 border-ink/10 bg-surface p-5 shadow-lift sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="judul-timbul font-display text-2xl font-black tracking-tight text-ink sm:text-3xl">
              🤖 BOT RESELLER
            </h1>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted">
              Bikin bot Telegram jualan nokos milikmu sendiri. Pembelimu order di botmu, kamu
              dapat komisi dari markup yang kamu tentukan.
            </p>
          </div>
          <Link href="/dashboard" className="btn-ghost shrink-0 px-4 py-2.5 text-sm">← Beranda</Link>
        </div>

        <div className="mt-5 grid gap-2.5 sm:grid-cols-3">
          {[
            { ikon: "⚡", judul: "Jalan otomatis", isi: "Stok, harga, dan refund ikut sistem Arta Pedia. Kamu tidak perlu jaga apa pun." },
            { ikon: "💰", judul: "Komisi dari markup", isi: `Atur sendiri 0–${markupMaks}%. Selisihnya jadi komisimu.` },
            { ikon: "🏦", judul: "Tarik ke e-wallet", isi: `Minimal ${rp(tarikMin)}, ke DANA/OVO/GoPay/ShopeePay/LinkAja.` }
          ].map((k) => (
            <div key={k.judul} className="balok-3d rounded-2xl border-2 border-ink/10 bg-surface2/50 p-3.5">
              <p className="text-lg">{k.ikon}</p>
              <p className="mt-1 text-sm font-black text-ink">{k.judul}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted">{k.isi}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Daftar bot */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-black text-ink">
          Bot kamu {items.length > 0 && <span className="text-muted">({items.length}/{maks})</span>}
        </h2>
        {items.length < maks && (
          <button
            onClick={() => setBuka((v) => !v)}
            className="btn-3d rounded-xl border-2 border-blue bg-blue-soft px-4 py-2.5 text-sm font-black text-blue-bright"
          >
            {buka ? "Tutup form" : "➕ Buat Bot Baru"}
          </button>
        )}
      </div>

      {/* Form buat bot */}
      {buka && (
        <form onSubmit={buatBot} className="mt-3 rounded-2xl border-2 border-ink/10 bg-surface p-5 shadow-soft">
          <p className="text-xs font-black uppercase tracking-wide text-muted">Data bot baru</p>

          <div className="mt-3 rounded-xl border border-amber/30 bg-amber-soft px-3 py-2.5">
            <p className="text-[11px] font-bold leading-relaxed text-amber-bright">
              Belum punya bot? Chat <b>@BotFather</b> di Telegram → kirim <code>/newbot</code> → ikuti
              langkahnya → dia kasih token. Tempel tokennya di bawah.
            </p>
          </div>

          <Isian
            label="Token bot"
            hint="Dari @BotFather. Bentuknya 1234567890:AAH..."
            type="password"
            value={form.botToken}
            onChange={(v) => setForm((f) => ({ ...f, botToken: v }))}
            mono
          />
          <Isian
            label="Username bot"
            hint="Tanpa @. Contoh: tokosaya_bot"
            value={form.botUsername}
            onChange={(v) => setForm((f) => ({ ...f, botUsername: v }))}
          />
          <Isian
            label="ID Telegram kamu (owner)"
            hint="Angka. Chat @userinfobot untuk melihatnya. Notif bot dikirim ke sini."
            value={form.ownerTelegramId}
            onChange={(v) => setForm((f) => ({ ...f, ownerTelegramId: v }))}
            mono
          />
          <Isian
            label="Username Telegram kamu"
            hint="Tanpa @. Dipakai sebagai tombol CS di botmu."
            value={form.ownerUsername}
            onChange={(v) => setForm((f) => ({ ...f, ownerUsername: v }))}
          />
          <Isian
            label={`Markup (0–${markupMaks}%)`}
            hint="Ditambahkan di atas harga Arta Pedia. Selisihnya jadi komisimu."
            type="number"
            value={form.markupPersen}
            onChange={(v) => setForm((f) => ({ ...f, markupPersen: v }))}
          />

          <p className="mt-3 rounded-xl border border-rose/30 bg-rose-soft px-3 py-2.5 text-[11px] font-bold leading-relaxed text-rose">
            ⚠️ Token bot itu kunci penuh botmu. Jangan pernah ditempel di grup atau dikirim ke
            siapa pun. Di halaman ini pun tokennya tidak pernah ditampilkan lagi setelah disimpan.
          </p>

          <button
            type="submit"
            disabled={busy === "buat"}
            className="btn-3d mt-4 w-full rounded-xl border-2 border-blue bg-blue-bright py-3 text-sm font-black text-white disabled:opacity-50"
          >
            {busy === "buat" ? "Memeriksa token ke Telegram…" : "🚀 Buat Bot Sekarang"}
          </button>

          {salah.length > 0 && (
            <ul className="mt-3 space-y-1">
              {salah.map((s) => (
                <li key={s} className="text-xs font-bold leading-relaxed text-rose">• {s}</li>
              ))}
            </ul>
          )}
        </form>
      )}

      {msg && <p className="mt-3 rounded-xl border border-success/30 bg-success-soft px-3 py-2.5 text-sm font-bold text-success">{msg}</p>}

      {loading ? (
        <p className="mt-5 text-sm text-muted">Memuat…</p>
      ) : items.length === 0 ? (
        <div className="mt-3 rounded-2xl border-2 border-dashed border-line p-8 text-center">
          <p className="text-3xl">🤖</p>
          <p className="mt-2 text-sm font-bold text-ink">Belum ada bot</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Tekan <b>Buat Bot Baru</b> di atas. Prosesnya sekitar satu menit.
          </p>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {items.map((b) => (
            <KartuBot key={b.botId} bot={b} busy={busy} kirim={kirim} markupMaks={markupMaks} tarikMin={tarikMin} rp={rp} />
          ))}
        </div>
      )}

      <div className="mt-6 rounded-2xl border-2 border-ink/10 bg-surface2/40 p-4">
        <p className="text-xs font-black text-ink">Isi bot kamu nanti</p>
        <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
          {[
            ["🛒", "Beli Nokos", "Semua server dan negara yang aktif di Arta Pedia"],
            ["💳", "Isi Saldo", "QRIS otomatis, saldo masuk sendiri"],
            ["👤", "Info Saldo", "Saldo dan kode akun pembeli"],
            ["📊", "Status Server", "Server mana yang sedang jalan"],
            ["🌐", "Buy di Web", "Tautan ke web Arta Pedia"],
            ["🛠", "Menu Admin Reseller", "Khusus kamu: atur markup, lihat komisi, tarik saldo"]
          ].map(([i, j, k]) => (
            <p key={j} className="text-[11px] leading-relaxed text-muted">
              <span className="mr-1">{i}</span><b className="text-ink">{j}</b> — {k}
            </p>
          ))}
        </div>
        <a
          href={BOT_URL}
          target="_blank"
          rel="noreferrer"
          className="btn-3d mt-3 inline-flex rounded-xl border border-line bg-surface px-4 py-2 text-xs font-bold text-ink"
        >
          Lihat contohnya di bot resmi ↗
        </a>
      </div>
    </div>
  );
}

function Isian({ label, hint, value, onChange, type = "text", mono = false }) {
  return (
    <div className="mt-3">
      <label className="block text-xs font-black text-ink">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        spellCheck={false}
        className={`field mt-1.5 w-full py-2.5 ${mono ? "font-mono text-sm" : "text-sm"}`}
      />
      <p className="mt-1 text-[11px] leading-relaxed text-muted">{hint}</p>
    </div>
  );
}

function KartuBot({ bot, busy, kirim, markupMaks, tarikMin, rp }) {
  const [markup, setMarkup] = useState(String(bot.markupPersen));

  return (
    <div className="balok-3d rounded-2xl border-2 border-ink/10 bg-surface p-4 shadow-soft">
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={`https://t.me/${bot.username}`}
          target="_blank"
          rel="noreferrer"
          className="text-sm font-black text-ink underline decoration-dotted"
        >
          @{bot.username}
        </a>
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-black text-white ${bot.aktif ? "bg-success" : "bg-rose"}`}>
          {bot.aktif ? "ON" : "OFF"}
        </span>
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-black text-white ${bot.webhookOk ? "bg-success" : "bg-amber"}`}>
          {bot.webhookOk ? "SIAP" : "WEBHOOK BELUM"}
        </span>
      </div>

      {!bot.webhookOk && bot.webhookPesan && (
        <p className="mt-2 rounded-lg border border-amber/30 bg-amber-soft px-2.5 py-1.5 text-[11px] font-semibold leading-relaxed text-amber-bright">
          {bot.webhookPesan}
        </p>
      )}

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
        <dt className="text-muted">Komisi terkumpul</dt>
        <dd className="font-black text-ink">{rp(bot.komisi)}</dd>
        <dt className="text-muted">Pembeli</dt>
        <dd className="font-bold text-ink">{bot.jumlahPembeli}</dd>
        <dt className="text-muted">Owner Telegram</dt>
        <dd className="font-bold text-ink">@{bot.ownerUsername || "-"}</dd>
        <dt className="text-muted">Token</dt>
        <dd className="font-mono text-ink">{bot.tokenSamar}</dd>
      </dl>

      {bot.komisi > 0 && bot.komisi < tarikMin && (
        <p className="mt-2 text-[11px] leading-relaxed text-muted">
          Penarikan mulai {rp(tarikMin)}. Kurang {rp(tarikMin - bot.komisi)} lagi.
        </p>
      )}

      <div className="mt-3 flex items-end gap-2">
        <div className="flex-1">
          <label className="block text-[11px] font-black text-ink">Markup (%)</label>
          <input
            type="number"
            min={0}
            max={markupMaks}
            value={markup}
            onChange={(e) => setMarkup(e.target.value)}
            className="field mt-1 w-full py-2 text-sm"
          />
        </div>
        <button
          onClick={() => kirim({ aksi: "markup", botId: bot.botId, markupPersen: markup }, "markup" + bot.botId)}
          disabled={busy !== "" || String(bot.markupPersen) === markup}
          className="btn-3d rounded-xl border border-line bg-surface px-4 py-2 text-xs font-bold text-ink disabled:opacity-40"
        >
          Simpan
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {bot.dimatikanAdmin && (
          <p className="w-full rounded-xl border border-rose/30 bg-rose-soft px-3 py-2 text-xs font-bold text-rose">
            ⛔ Bot ini dimatikan oleh admin, jadi tidak bisa dinyalakan atau dihapus. Komisimu tetap aman —
            hubungi admin kalau merasa ini keliru.
          </p>
        )}
        <button
          onClick={() => kirim({ aksi: bot.aktif ? "nonaktif" : "aktif", botId: bot.botId }, "aktif" + bot.botId)}
          disabled={busy !== "" || (bot.dimatikanAdmin && !bot.aktif)}
          className={`btn-3d flex-1 rounded-xl py-2 text-xs font-black text-white disabled:opacity-50 ${bot.aktif ? "bg-rose" : "bg-success"}`}
        >
          {bot.aktif ? "⏸ Matikan" : "▶ Nyalakan"}
        </button>
        <button
          onClick={() => {
            if (confirm(`Hapus bot @${bot.username}?\n\nBotnya berhenti menjawab pembeli dan tokennya dihapus dari daftar.`)) {
              kirim({ aksi: "hapus", botId: bot.botId }, "hapus" + bot.botId);
            }
          }}
          disabled={busy !== "" || bot.dimatikanAdmin}
          className="btn-3d rounded-xl border border-rose/40 bg-rose-soft px-4 py-2 text-xs font-black text-rose disabled:opacity-50"
        >
          🗑 Hapus
        </button>
      </div>
    </div>
  );
}
