"use client";

import { useBrand } from "@/app/providers";

import { useEffect, useState } from "react";
import Link from "next/link";
import "@/components/docs.css";

const FALLBACK_BASE = "https://artapedianokosmurahid.vercel.app";

/* ───────── small helpers ───────── */
function Badge({ children, color = "amber" }) {
  const map = {
    amber: "bg-amber/10 text-amber border border-amber/30",
    teal: "bg-teal/10 text-teal-bright border border-teal/30",
    rose: "bg-rose/10 text-rose border border-rose/30",
    success: "bg-success/10 text-success border border-success/30",
    muted: "bg-surface2 text-muted border border-line"
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold ${map[color] || map.muted}`}>
      {children}
    </span>
  );
}

function Method({ m }) {
  const map = { GET: "success", POST: "amber", DELETE: "rose", PATCH: "teal" };
  return <Badge color={map[m] || "muted"}>{m}</Badge>;
}

function CodeBlock({ code, lang = "bash" }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  return (
    <div className="dx-kode">
      <div className="dx-kode-bar">
        <span className="dot" style={{ background: "#ff5f56" }} /><span className="dot" style={{ background: "#ffbd2e" }} /><span className="dot" style={{ background: "#27c93f" }} />
        <span className="judul">{lang}</span>
        <button onClick={copy}>{copied ? "✓ Tersalin" : "Salin"}</button>
      </div>
      <pre>{code}</pre>
    </div>
  );
}

function Param({ name, type, required, children }) {
  return (
    <div className="flex gap-3 py-2.5 border-b border-line last:border-0">
      <div className="w-40 flex-shrink-0">
        <span className="font-mono text-sm text-amber">{name}</span>
        {required && <span className="ml-1 text-xs text-rose">*</span>}
      </div>
      <div className="flex-shrink-0 w-20">
        <span className="text-xs font-mono text-muted">{type}</span>
      </div>
      <div className="text-sm text-muted">{children}</div>
    </div>
  );
}

function ResponseField({ name, type, children }) {
  return (
    <div className="flex gap-3 py-2 border-b border-line last:border-0">
      <span className="w-40 flex-shrink-0 font-mono text-sm text-teal-bright">{name}</span>
      <span className="w-20 flex-shrink-0 text-xs font-mono text-muted">{type}</span>
      <span className="text-sm text-muted">{children}</span>
    </div>
  );
}

function Section({ id, children }) {
  return (
    <section id={id} className="scroll-mt-24 mb-16">
      {children}
    </section>
  );
}

function EndpointCard({ method, path, title, description, auth = true, params, response, curl, jsCode, pythonCode }) {
  const [tab, setTab] = useState("curl");
  const snippets = { curl: curl, javascript: jsCode, python: pythonCode };
  const activeTabs = Object.entries(snippets).filter(([, v]) => v);

  return (
    <div className="dx-ep" data-m={method}>
      {/* header */}
      <div className="dx-ep-kepala">
        <div className="flex flex-wrap items-center gap-3">
          <span className="dx-metode">{method}</span>
          <code className="dx-path">{path}</code>
          {auth && <Badge color="teal">🔑 Perlu API key</Badge>}
        </div>
        <p className="mt-2 font-bold text-ink">{title}</p>
        {description && <p className="text-sm text-muted mt-0.5">{description}</p>}
      </div>

      <div className="dx-ep-isi space-y-5">
        {/* params */}
        {params && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted mb-2">Parameters</p>
            <div className="rounded-xl border border-line overflow-hidden bg-surface">
              {params}
            </div>
          </div>
        )}

        {/* response */}
        {response && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted mb-2">Response fields</p>
            <div className="rounded-xl border border-line overflow-hidden bg-surface px-4">
              {response}
            </div>
          </div>
        )}

        {/* code tabs */}
        {activeTabs.length > 0 && (
          <div>
            <div className="flex gap-1 border-b border-line">
              {activeTabs.map(([k]) => (
                <button
                  key={k}
                  onClick={() => setTab(k)}
                  className={`px-4 py-2 text-xs font-mono capitalize rounded-t-lg transition-colors ${
                    tab === k
                      ? "bg-amber/10 text-amber border-x border-t border-amber/30 -mb-px"
                      : "text-muted hover:text-ink"
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>
            <CodeBlock code={snippets[tab] || ""} lang={tab} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────── main page ───────── */
export default function ApiDocsPage() {
  const brand = useBrand();
  // Base URL diatur admin (Pengaturan Umum → Alamat API). Dibaca dari server,
  // bukan window.location: dokumentasi ini dibaca untuk DISALIN ke server
  // developer, dan alamat yang ikut tempat halaman dibuka akan menghasilkan
  // contoh yang menunjuk ke localhost.
  const [B, setB] = useState(FALLBACK_BASE);
  useEffect(() => {
    fetch("/api/settings/public", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (d?.docs?.api) setB(d.docs.api); })
      .catch(() => {});
  }, []);

  const [apiKey, setApiKey] = useState("");
  const [tryResult, setTryResult] = useState(null);
  const [tryLoading, setTryLoading] = useState(false);

  async function tryMe() {
    if (!apiKey.trim()) return;
    setTryLoading(true);
    setTryResult(null);
    try {
      const r = await fetch("/api/v1/me", { headers: { Authorization: `Bearer ${apiKey.trim()}` } });
      const data = await r.json();
      setTryResult({ status: r.status, data });
    } catch (e) {
      setTryResult({ status: 0, data: { error: e.message } });
    }
    setTryLoading(false);
  }

  const [aktif, setAktif] = useState("intro");
  const nav = [
    { grup: "Mulai" },
    { id: "intro", label: "Intro" },
    { id: "apikey", label: "API Key" },
    { id: "auth", label: "Authentication" },
    { id: "ratelimit", label: "Rate limit" },
    { id: "errors", label: "Error codes" },
    { grup: "Nokos" },
    { id: "ep-me", label: "GET /v1/me" },
    { id: "ep-servers", label: "GET /v1/servers" },
    { id: "ep-services", label: "GET /v1/services" },
    { id: "ep-countries", label: "GET /v1/countries" },
    { id: "ep-orders", label: "GET /v1/orders" },
    { id: "ep-order-status", label: "GET /v1/orders/status" },
    { id: "ep-order-create", label: "POST /v1/order" },
    { id: "ep-order-cancel", label: "POST /v1/orders/cancel" },
    { grup: "Deposit" },
    { id: "deposit", label: "Deposit otomatis" },
    { id: "ep-dep-methods", label: "GET /v1/deposit/methods" },
    { id: "ep-dep-create", label: "POST /v1/deposit" },
    { id: "ep-dep-status", label: "GET /v1/deposit" },
    { id: "ep-dep-cancel", label: "POST /v1/deposit/cancel" },
    { grup: "Coba" },
    { id: "try", label: "Try it out" }
  ];

  // Menyorot bagian yang sedang dibaca di daftar isi.
  useEffect(() => {
    const ids = nav.filter((n) => n.id).map((n) => n.id);
    const els = ids.map((id) => document.getElementById(id)).filter(Boolean);
    if (!els.length || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entri) => { const t = entri.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]; if (t) setAktif(t.target.id); },
      { rootMargin: "-90px 0px -65% 0px" }
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-bg">
      {/* hero */}
      <div className="dx-hero">
        <div className="max-w-content mx-auto px-4 py-12 md:py-16">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="dx-pill">⚡ Developer API v1</span>
            <span className="dx-pill">REST · JSON</span>
            <span className="dx-pill">Server WarungNokos</span>
          </div>
          <h1 className="font-display text-display-md mb-3">Beli nomor OTP dari kode kamu sendiri</h1>
          <p className="max-w-xl text-lg text-white/85">
            Cek saldo, pilih layanan, pesan nomor, dan ambil kode OTP — semuanya lewat satu API sederhana.
          </p>
          <div className="dx-url mt-5">
            <code>{B}/api/v1</code>
            <button onClick={() => navigator.clipboard?.writeText(`${B}/api/v1`).catch(() => {})}>Salin</button>
          </div>
          <div className="dx-langkah mt-5">
            <div><i>1</i><b>Ambil API key</b>Buat di halaman API Key.</div>
            <div><i>2</i><b>Pilih layanan</b>/v1/servers → /v1/services → /v1/countries.</div>
            <div><i>3</i><b>Pesan nomor</b>POST /v1/order, lalu pantau /v1/orders/status.</div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="#auth" className="rounded-xl bg-white px-5 py-2.5 text-sm font-black text-[#0b1d48]">Mulai →</a>
            <Link href="/apikey" className="rounded-xl border border-white/50 px-5 py-2.5 text-sm font-black text-white">Dapatkan API Key</Link>
          </div>
        </div>
      </div>

      {/* navigasi ringkas untuk layar kecil */}
      <nav className="dx-chips lg:hidden" aria-label="Navigasi dokumentasi">
        {nav.filter((n) => !n.grup).map((n) => (
          <a key={n.id} href={`#${n.id}`} data-aktif={aktif === n.id}>{n.label}</a>
        ))}
      </nav>

      <div className="max-w-content mx-auto px-4 py-10 flex gap-8">
        {/* sidebar */}
        <aside className="hidden lg:block w-56 flex-shrink-0">
          <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-1">
            <nav className="dx-toc" aria-label="Daftar isi">
              {nav.map((n) => n.grup
                ? <p key={n.grup} className="grup">{n.grup}</p>
                : <a key={n.id} href={`#${n.id}`} data-aktif={aktif === n.id}>{n.label}</a>)}
            </nav>
          </div>
        </aside>

        {/* content */}
        <main className="flex-1 min-w-0">

          {/* INTRO */}
          <Section id="intro">
            <h2 className="text-display-sm font-display text-ink mb-4">Pengenalan</h2>
            <p className="text-muted mb-3">
              Semua endpoint berada di bawah base URL berikut. Semua response menggunakan format <code className="font-mono text-xs bg-surface2 px-1.5 py-0.5 rounded border border-line">application/json</code>.
            </p>
            <CodeBlock lang="text" code={`Base URL: ${B}/api/v1`} />
            <p className="text-xs text-muted mt-2">
              Semua contoh di halaman ini otomatis memakai alamat di atas — kamu tinggal salin. Kalau alamat ini berubah, contoh di sini ikut berubah.
            </p>
            <div className="grid sm:grid-cols-3 gap-4 mt-6">
              {[
                { icon: "🔑", title: "API Key auth", desc: "Autentikasi via header Bearer atau query param" },
                { icon: "📦", title: "JSON body", desc: "Request body dan response selalu JSON" },
                { icon: "🌐", title: "REST", desc: "Endpoint stateless standar REST" }
              ].map((f) => (
                <div key={f.title} className="card rounded-xl p-4 border border-line">
                  <div className="text-2xl mb-2">{f.icon}</div>
                  <p className="font-semibold text-ink text-sm">{f.title}</p>
                  <p className="text-xs text-muted mt-1">{f.desc}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* API KEY */}
          <Section id="apikey">
            <h2 className="text-display-sm font-display text-ink mb-4">API Key {brand.nama}</h2>
            <p className="text-muted mb-4">
              API key adalah kunci pribadimu untuk memakai API — satu akun satu key (32 karakter heksadesimal). Semua yang dilakukan lewat key
              (saldo terpotong, pesanan, deposit) tercatat atas akunmu, jadi perlakukan seperti kata sandi.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="card rounded-xl p-4 border border-line">
                <p className="font-semibold text-ink text-sm mb-2">🔑 Cara mendapatkan key</p>
                <ol className="text-xs text-muted list-decimal list-inside space-y-1">
                  <li>Masuk ke akunmu di web {brand.nama}.</li>
                  <li>Buka halaman <Link href="/apikey" className="text-amber underline">API Key</Link> (menu Dashboard → API Key).</li>
                  <li>Tekan <b>Buat / Buat ulang API key</b>, lalu salin — key utuh hanya tampil saat dibuat.</li>
                </ol>
              </div>
              <div className="card rounded-xl p-4 border border-line">
                <p className="font-semibold text-ink text-sm mb-2">🛡️ Aturan keamanan key</p>
                <ul className="text-xs text-muted list-disc list-inside space-y-1">
                  <li>Kirim lewat header <code className="font-mono text-amber">Authorization: Bearer</code>, jangan lewat URL.</li>
                  <li>Jangan taruh di aplikasi frontend publik atau repository.</li>
                  <li>Bocor? Buat ulang key — key lama langsung mati.</li>
                  <li>Akun yang dibekukan (anti-curang) tidak bisa memakai API.</li>
                </ul>
              </div>
            </div>
          </Section>

          {/* AUTH */}
          <Section id="auth">
            <h2 className="text-display-sm font-display text-ink mb-4">Authentication</h2>
            <p className="text-muted mb-4">
              Semua endpoint v1 memerlukan API key. API key berupa string 32 karakter hex yang bisa kamu generate atau regenerate di halaman{" "}
              <Link href="/dashboard" className="text-amber underline">Dashboard</Link> → bagian <strong>API Key</strong>.
            </p>
            <p className="text-sm font-semibold text-ink mb-2">Cara mengirim API key:</p>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted mb-1">1. Header <code className="font-mono text-amber">Authorization: Bearer</code> (direkomendasikan)</p>
                <CodeBlock lang="bash" code={`curl -H "Authorization: Bearer YOUR_API_KEY" \\
  ${B}/api/v1/me`} />
              </div>
              <div>
                <p className="text-xs text-muted mb-1">2. Query parameter <code className="font-mono text-amber">?api_key=</code></p>
                <CodeBlock lang="bash" code={`curl "${B}/api/v1/me?api_key=YOUR_API_KEY"`} />
              </div>
            </div>
            <div className="mt-5 p-4 rounded-xl bg-rose/5 border border-rose/20">
              <p className="text-sm font-semibold text-rose mb-1">⚠️ Jaga kerahasiaan API key</p>
              <p className="text-xs text-muted">Jangan expose API key di frontend publik atau repository. Jika bocor, segera regenerate di Dashboard.</p>
            </div>
          </Section>

          {/* RATE LIMIT */}
          <Section id="ratelimit">
            <h2 className="text-display-sm font-display text-ink mb-4">Rate Limit API Key</h2>
            <p className="text-muted mb-4">
              Setiap API key dibatasi per <b>60 detik</b> (jendela bergulir). Batas dihitung <b>per key</b>, bukan per IP, dan melindungi akunmu
              serta server dari permintaan berlebihan.
            </p>
            <div className="rounded-xl border border-line overflow-hidden">
              {[
                ["60 / menit", "Semua endpoint v1 (baca): me, servers, services, countries, orders, deposit status & methods"],
                ["20 / menit", "POST /v1/order — membuat pesanan OTP (ikut hitungan 60/menit di atas)"],
                ["6 / menit", "POST /v1/deposit — membuat QRIS deposit (ikut hitungan 60/menit di atas)"],
                ["20 / menit", "POST /v1/orders/cancel dan POST /v1/deposit/cancel — pembatalan (ikut hitungan 60/menit di atas)"]
              ].map(([batas, ket]) => (
                <div key={batas} className="flex items-start gap-4 px-4 py-3 border-b border-line last:border-0">
                  <Badge color="amber">{batas}</Badge>
                  <p className="text-sm text-muted">{ket}</p>
                </div>
              ))}
            </div>
            <p className="text-sm font-semibold text-ink mt-5 mb-2">Header di setiap respons</p>
            <div className="rounded-xl border border-line overflow-hidden bg-surface px-4">
              <ResponseField name="X-RateLimit-Limit" type="number">Jatah permintaan pada jendela ini</ResponseField>
              <ResponseField name="X-RateLimit-Remaining" type="number">Sisa jatah sebelum terkena batas</ResponseField>
              <ResponseField name="X-RateLimit-Reset" type="number">Waktu jendela di-reset (detik Unix)</ResponseField>
              <ResponseField name="Retry-After" type="number">Hanya pada 429: berapa detik harus menunggu</ResponseField>
            </div>
            <CodeBlock lang="json" code={`// HTTP 429 — melewati batas
{
  "error": "Rate limit exceeded: maks 60 request per menit untuk API key ini. Coba lagi dalam 23 detik.",
  "retryAfter": 23
}`} />
            <div className="mt-4 p-4 rounded-xl bg-amber/5 border border-amber/20">
              <p className="text-xs text-muted">💡 Untuk menunggu OTP, polling <code className="font-mono text-amber">/v1/orders/status</code> tiap 3–5 detik (bukan tiap detik) agar jatah cukup. Saat menerima 429, tunggu sesuai <code className="font-mono">Retry-After</code> lalu coba lagi.</p>
            </div>
          </Section>

          {/* ERRORS */}
          <Section id="errors">
            <h2 className="text-display-sm font-display text-ink mb-4">Error Codes</h2>
            <p className="text-muted mb-4">Saat terjadi error, response akan memiliki field <code className="font-mono text-xs bg-surface2 px-1 rounded">error</code> berisi pesan deskriptif.</p>
            <div className="rounded-xl border border-line overflow-hidden">
              {[
                ["400", "rose", "Bad Request", "Parameter kurang atau tidak valid"],
                ["401", "rose", "Unauthorized", "API key tidak ada, salah format, atau tidak ditemukan"],
                ["403", "rose", "Forbidden", "Akun ditangguhkan"],
                ["404", "rose", "Not Found", "Resource (pesanan dll) tidak ditemukan"],
                ["409", "rose", "Conflict", "Aksi bentrok dengan keadaan terkini — mis. batal order tapi OTP baru saja masuk, atau batal deposit tapi sudah dibayar"],
                ["429", "rose", "Too Many Requests", "Melewati rate limit API key — lihat header Retry-After"],
                ["500", "rose", "Server Error", "Kesalahan internal, coba lagi nanti"],
                ["503", "rose", "Service Unavailable", "Server nokos sedang dimatikan admin, atau status pesanan belum bisa dicek ke provider — coba lagi sebentar"]
              ].map(([code, color, label, desc]) => (
                <div key={code} className="flex items-start gap-4 px-4 py-3 border-b border-line last:border-0">
                  <Badge color={color}>{code}</Badge>
                  <div>
                    <p className="text-sm font-semibold text-ink">{label}</p>
                    <p className="text-xs text-muted">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <CodeBlock lang="json" code={`// Contoh response error
{
  "error": "API key not found or revoked."
}`} />
          </Section>

          {/* GET /v1/me */}
          <Section id="ep-me">
            <h2 className="text-display-sm font-display text-ink mb-2">Akun</h2>
            <EndpointCard
              method="GET"
              path="/api/v1/me"
              title="Informasi akun"
              description="Mengembalikan nama, saldo, dan tanggal bergabung untuk API key yang diberikan."
              response={
                <>
                  <ResponseField name="name" type="string|null">Nama display akun</ResponseField>
                  <ResponseField name="balance" type="number">Saldo saat ini dalam Rupiah</ResponseField>
                  <ResponseField name="joinedAt" type="string|null">ISO timestamp saat akun dibuat</ResponseField>
                </>
              }
              curl={`curl -H "Authorization: Bearer YOUR_API_KEY" \\
  ${B}/api/v1/me`}
              jsCode={`const res = await fetch("${B}/api/v1/me", {
  headers: { "Authorization": "Bearer YOUR_API_KEY" }
});
const data = await res.json();
console.log(data.balance); // e.g. 50000`}
              pythonCode={`import requests

r = requests.get(
    "${B}/api/v1/me",
    headers={"Authorization": "Bearer YOUR_API_KEY"}
)
print(r.json())`}
            />
            <CodeBlock lang="json" code={`// 200 OK
{
  "name": "John Doe",
  "balance": 50000,
  "joinedAt": "2024-01-15T08:30:00.000Z"
}`} />
          </Section>

          {/* GET /v1/servers */}
          <Section id="ep-servers">
            <h2 className="text-display-sm font-display text-ink mb-2">Server Nokos</h2>
            <p className="text-muted mb-4">
              Layanan nokos {brand.nama} berjalan di atas <b>WarungNokos</b> dengan dua jalur, disebut <b>server</b>. Tiap server punya
              daftar aplikasi, negara, dan harga sendiri. Semua endpoint katalog &amp; order menerima parameter{" "}
              <code className="font-mono text-xs bg-surface2 px-1.5 py-0.5 rounded border border-line">server</code>.
              Kalau tidak dikirim, nilainya otomatis <code className="font-mono text-xs">warungnokos_s1</code> (Server Plus).
            </p>

            <div className="rounded-xl border border-line overflow-hidden mb-4">
              {[
                ["warungnokos_s1", "Server Plus", "Jalur utama WarungNokos (H2H), stok melimpah & rate sukses tertinggi."],
                ["warungnokos_s2", "Server Express", "Jalur kedua WarungNokos (API v3). Kode layanannya berupa nama huruf kecil, mis. whatsapp; stok tidak ditampilkan angkanya."]
              ].map(([id, name, desc]) => (
                <div key={id} className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4 px-4 py-3 border-b border-line last:border-0">
                  <code className="font-mono text-sm text-amber w-36 flex-shrink-0">{id}</code>
                  <div>
                    <p className="text-sm font-semibold text-ink">{name}</p>
                    <p className="text-sm text-muted">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 rounded-xl bg-amber/5 border border-amber/20 mb-4">
              <p className="text-sm text-muted">
                <b className="text-ink">Perhatian:</b> admin bisa mematikan salah satu server kapan saja. Server yang mati
                tidak muncul di <code className="font-mono text-amber">/v1/servers</code> dan request ke server itu
                dibalas <code className="font-mono">503</code>. Selalu ambil daftar server dulu, jangan hardcode.
              </p>
            </div>

            <EndpointCard
              method="GET"
              path="/api/v1/servers"
              title="Daftar server aktif"
              description="Mengembalikan server nokos yang sedang aktif beserta nama dan deskripsinya."
              response={
                <>
                  <ResponseField name="items[].server" type="string">Nilai untuk parameter server</ResponseField>
                  <ResponseField name="items[].name" type="string">Nama server seperti di web</ResponseField>
                  <ResponseField name="items[].provider" type="string">Provider di balik server</ResponseField>
                  <ResponseField name="items[].description" type="string">Penjelasan singkat</ResponseField>
                </>
              }
              curl={`curl -H "Authorization: Bearer YOUR_API_KEY" \\
  ${B}/api/v1/servers`}
              jsCode={`const res = await fetch("${B}/api/v1/servers", {
  headers: { "Authorization": "Bearer YOUR_API_KEY" }
});
const { items } = await res.json();
// pilih server termurah/tercepat sesuai kebutuhan kamu
const server = items[0].server;`}
              pythonCode={`import requests

r = requests.get(
    "${B}/api/v1/servers",
    headers={"Authorization": "Bearer YOUR_API_KEY"}
)
for s in r.json()["items"]:
    print(s["server"], "-", s["name"])`}
            />
            <CodeBlock lang="json" code={`// 200 OK
{
  "items": [
    { "server": "warungnokos_s1", "name": "Server Plus",    "badge": "Utama", "provider": "WarungNokos" },
    { "server": "warungnokos_s2", "name": "Server Express", "badge": "Cepat", "provider": "WarungNokos S2" }
  ]
}`} />
          </Section>

          {/* GET /v1/services */}
          <Section id="ep-services">
            <h2 className="text-display-sm font-display text-ink mb-2">Layanan OTP</h2>
            <EndpointCard
              method="GET"
              path="/api/v1/services"
              title="Daftar layanan OTP per server"
              description="Mengembalikan aplikasi yang tersedia di satu server (WhatsApp, Telegram, Shopee, dll). Tiap server punya daftar yang berbeda."
              params={
                <>
                  <Param name="server" type="string">Kode server dari /v1/servers. Default: warungnokos_s1.</Param>
                </>
              }
              response={
                <>
                  <ResponseField name="server" type="string">Server yang dipakai untuk request ini</ResponseField>
                  <ResponseField name="items[].service_code" type="string">Kode layanan — dipakai sebagai serviceId saat order</ResponseField>
                  <ResponseField name="items[].service_name" type="string">Nama aplikasi</ResponseField>
                </>
              }
              curl={`curl -H "Authorization: Bearer YOUR_API_KEY" \\
  "${B}/api/v1/services?server=warungnokos_s1"`}
              jsCode={`const res = await fetch(
  "${B}/api/v1/services?server=warungnokos_s1",
  { headers: { "Authorization": "Bearer YOUR_API_KEY" } }
);
const { items } = await res.json();
// items: [{ service_code, service_name, server }, ...]`}
              pythonCode={`import requests

r = requests.get(
    "${B}/api/v1/services",
    params={"server": "warungnokos_s1"},
    headers={"Authorization": "Bearer YOUR_API_KEY"}
)
for svc in r.json()["items"]:
    print(svc["service_code"], svc["service_name"])`}
            />
            <CodeBlock lang="json" code={`// 200 OK
{
  "server": "warungnokos_s1",
  "items": [
    { "service_code": "wa", "service_name": "WhatsApp", "service_img": null, "server": "warungnokos_s1" },
    { "service_code": "tg", "service_name": "Telegram", "service_img": null, "server": "warungnokos_s1" }
  ]
}`} />
          </Section>

          {/* GET /v1/countries */}
          <Section id="ep-countries">
            <h2 className="text-display-sm font-display text-ink mb-2">Negara &amp; Harga</h2>
            <p className="text-muted mb-4">
              Endpoint ini yang memberi kamu <code className="font-mono text-xs">numberId</code>,{" "}
              <code className="font-mono text-xs">providerId</code>, dan harga jual final.
              Nilai <code className="font-mono text-xs">sell_price</code> sudah termasuk markup — itulah nominal yang
              dipotong dari saldo. <code className="font-mono text-xs">price</code> adalah harga modal, jangan dipakai
              untuk menghitung tagihan.
            </p>
            <EndpointCard
              method="GET"
              path="/api/v1/countries"
              title="Daftar negara, stok, dan harga"
              description="Mengembalikan negara yang tersedia untuk satu layanan di satu server, lengkap dengan pricelist-nya."
              params={
                <>
                  <Param name="service_id" type="string" required>Kode layanan dari /v1/services</Param>
                  <Param name="server" type="string">Kode server. Default: warungnokos_s1.</Param>
                </>
              }
              response={
                <>
                  <ResponseField name="items[].number_id" type="string">Identitas negara di katalog (tidak dipakai saat order di server WarungNokos)</ResponseField>
                  <ResponseField name="items[].name" type="string">Nama negara</ResponseField>
                  <ResponseField name="items[].pricelist[].provider_id" type="string">Dipakai sebagai providerId saat order</ResponseField>
                  <ResponseField name="items[].pricelist[].sell_price" type="number">Harga jual final (sudah termasuk markup)</ResponseField>
                  <ResponseField name="items[].pricelist[].stock" type="number">Sisa stok, null kalau provider tidak melaporkannya</ResponseField>
                  <ResponseField name="items[].pricelist[].country_id" type="string">Dipakai sebagai countryId saat order</ResponseField>
                </>
              }
              curl={`curl -H "Authorization: Bearer YOUR_API_KEY" \\
  "${B}/api/v1/countries?server=warungnokos_s1&service_id=wa"`}
              jsCode={`const res = await fetch(
  "${B}/api/v1/countries?server=warungnokos_s1&service_id=wa",
  { headers: { "Authorization": "Bearer YOUR_API_KEY" } }
);
const { items } = await res.json();

// ambil paket termurah yang masih ada stok
const offers = items.flatMap(c => c.pricelist).filter(p => p.stock !== 0);
offers.sort((a, b) => a.sell_price - b.sell_price);
console.log("termurah:", offers[0].sell_price);`}
              pythonCode={`import requests

r = requests.get(
    "${B}/api/v1/countries",
    params={"server": "warungnokos_s1", "service_id": "13"},
    headers={"Authorization": "Bearer YOUR_API_KEY"}
)
for c in r.json()["items"]:
    for p in c["pricelist"]:
        print(c["name"], p["sell_price"], p["stock"])`}
            />
            <CodeBlock lang="json" code={`// 200 OK — server "warungnokos_s1"
{
  "server": "warungnokos_s1",
  "items": [
    {
      "number_id": "wn:6",
      "name": "Indonesia",
      "flag": "\u{1F1EE}\u{1F1E9}",
      "pricelist": [
        {
          "provider_id": "wn:6:1",
          "provider_name": "Server Plus",
          "price": 900,
          "sell_price": 1100,
          "stock": 245,
          "country_id": "6",
          "server": "warungnokos_s1"
        }
      ]
    }
  ]
}`} />
          </Section>

          {/* GET /v1/orders */}
          <Section id="ep-orders">
            <h2 className="text-display-sm font-display text-ink mb-2">Riwayat Pesanan</h2>
            <EndpointCard
              method="GET"
              path="/api/v1/orders"
              title="Daftar pesanan"
              description="Mengembalikan daftar pesanan OTP milik akun yang terautentikasi, diurutkan terbaru dulu."
              params={
                <>
                  <Param name="limit" type="number">Jumlah item per halaman. Default: 50, maks: 100.</Param>
                  <Param name="page" type="number">Nomor halaman. Default: 1.</Param>
                </>
              }
              response={
                <>
                  <ResponseField name="page" type="number">Halaman saat ini</ResponseField>
                  <ResponseField name="limit" type="number">Jumlah item diminta</ResponseField>
                  <ResponseField name="items" type="array">Array objek pesanan</ResponseField>
                  <ResponseField name="items[].orderId" type="string">ID pesanan unik</ResponseField>
                  <ResponseField name="items[].serviceName" type="string">Nama layanan (mis: WhatsApp)</ResponseField>
                  <ResponseField name="items[].phoneNumber" type="string">Nomor telepon yang dipesan</ResponseField>
                  <ResponseField name="items[].price" type="number">Harga dalam Rupiah</ResponseField>
                  <ResponseField name="items[].status" type="string">pending | done | expired | canceled</ResponseField>
                  <ResponseField name="items[].otpCode" type="string|null">Kode OTP (null jika belum/direfund)</ResponseField>
                  <ResponseField name="items[].refunded" type="boolean">Apakah sudah direfund</ResponseField>
                  <ResponseField name="items[].createdAt" type="string">ISO timestamp pembuatan</ResponseField>
                </>
              }
              curl={`curl -H "Authorization: Bearer YOUR_API_KEY" \\
  "${B}/api/v1/orders?limit=10&page=1"`}
              jsCode={`const res = await fetch(
  "${B}/api/v1/orders?limit=10",
  { headers: { "Authorization": "Bearer YOUR_API_KEY" } }
);
const { items } = await res.json();
items.forEach(o => console.log(o.orderId, o.status, o.otpCode));`}
              pythonCode={`import requests

r = requests.get(
    "${B}/api/v1/orders",
    params={"limit": 10, "page": 1},
    headers={"Authorization": "Bearer YOUR_API_KEY"}
)
for order in r.json()["items"]:
    print(order["orderId"], order["status"])`}
            />
          </Section>

          {/* GET /v1/orders/status */}
          <Section id="ep-order-status">
            <h2 className="text-display-sm font-display text-ink mb-2">Status Pesanan</h2>
            <EndpointCard
              method="GET"
              path="/api/v1/orders/status"
              title="Cek status pesanan"
              description="Cek status terbaru pesanan OTP spesifik, termasuk kode OTP jika sudah tersedia."
              params={
                <>
                  <Param name="order_id" type="string" required>ID pesanan yang ingin dicek</Param>
                </>
              }
              response={
                <>
                  <ResponseField name="orderId" type="string">ID pesanan</ResponseField>
                  <ResponseField name="status" type="string">pending | done | expired | canceled</ResponseField>
                  <ResponseField name="otpCode" type="string|null">Kode OTP (null jika belum tersedia)</ResponseField>
                  <ResponseField name="otpMsg" type="string|null">Pesan SMS lengkap</ResponseField>
                  <ResponseField name="phoneNumber" type="string">Nomor telepon</ResponseField>
                  <ResponseField name="price" type="number">Harga dalam Rupiah</ResponseField>
                  <ResponseField name="refunded" type="boolean">Apakah sudah direfund</ResponseField>
                </>
              }
              curl={`curl -H "Authorization: Bearer YOUR_API_KEY" \\
  "${B}/api/v1/orders/status?order_id=123456"`}
              jsCode={`// Poll setiap 5 detik sampai status = 'done' (OTP masuk)
async function waitForOtp(orderId, apiKey) {
  while (true) {
    const r = await fetch(
      \`${B}/api/v1/orders/status?order_id=\${orderId}\`,
      { headers: { Authorization: \`Bearer \${apiKey}\` } }
    );
    const data = await r.json();
    if (data.status === "done") return data.otpCode;
    if (data.status === "expired" || data.status === "canceled") throw new Error("Order " + data.status);
    await new Promise(res => setTimeout(res, 5000));
  }
}`}
              pythonCode={`import requests, time

def wait_for_otp(order_id, api_key):
    while True:
        r = requests.get(
            "${B}/api/v1/orders/status",
            params={"order_id": order_id},
            headers={"Authorization": f"Bearer {api_key}"}
        )
        data = r.json()
        if data["status"] == "done":
            return data["otpCode"]
        if data["status"] in ("expired", "canceled"):
            raise Exception("Order " + data["status"])
        time.sleep(5)`}
            />
            <CodeBlock lang="json" code={`// 200 OK (OTP sudah diterima)
{
  "orderId": "123456",
  "status": "done",
  "otpCode": "483921",
  "otpMsg": "Your WhatsApp code is 483921",
  "phoneNumber": "+62812xxxxxxx",
  "price": 3500,
  "refunded": false,
  "createdAt": "2024-06-01T12:00:00.000Z"
}`} />
          </Section>

          {/* POST /v1/order */}
          <Section id="ep-order-create">
            <h2 className="text-display-sm font-display text-ink mb-2">Buat Pesanan OTP</h2>
            <div className="p-4 rounded-xl bg-amber/5 border border-amber/20 mb-4">
              <p className="text-sm font-semibold text-amber mb-1">💡 Alur pembelian</p>
              <ol className="text-xs text-muted list-decimal list-inside space-y-1">
                <li>Ambil server aktif: <code className="font-mono text-amber">GET /v1/servers</code>.</li>
                <li>Ambil aplikasi: <code className="font-mono text-amber">GET /v1/services?server=…</code> → pakai <code className="font-mono">service_code</code> sebagai <code className="font-mono">serviceId</code>.</li>
                <li>Ambil negara &amp; harga: <code className="font-mono text-amber">GET /v1/countries?server=…&amp;service_id=…</code>.</li>
                <li>POST <code className="font-mono text-amber">/v1/order</code> dengan parameter sesuai server (tabel di bawah).</li>
                <li>Polling <code className="font-mono text-amber">GET /v1/orders/status?order_id=…</code> sampai OTP masuk.</li>
                <li>Tidak jadi / OTP tidak kunjung datang? <code className="font-mono text-amber">POST /v1/orders/cancel</code> — saldo kembali penuh (minimal 3 menit setelah beli).</li>
              </ol>
            </div>

            <div className="rounded-xl border border-line overflow-hidden mb-4">
              <div className="px-4 py-2.5 border-b border-line bg-surface2">
                <p className="text-sm font-semibold text-ink">Parameter wajib per server</p>
              </div>
              {[
                ["warungnokos_s1 / warungnokos_s2", "serviceId, countryId, providerId", "operatorId (default: any)"]
              ].map(([srv, req, opt]) => (
                <div key={srv} className="flex flex-col sm:flex-row gap-1 sm:gap-4 px-4 py-3 border-b border-line last:border-0">
                  <code className="font-mono text-sm text-amber w-52 flex-shrink-0">{srv}</code>
                  <div className="text-sm">
                    <p className="text-ink font-mono text-xs">{req}</p>
                    <p className="text-muted text-xs mt-0.5">opsional: {opt}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 rounded-xl bg-rose/5 border border-rose/20 mb-4">
              <p className="text-sm text-muted">
                <b className="text-ink">Harga selalu dihitung ulang di server.</b> Nominal yang dipotong adalah{" "}
                <code className="font-mono text-amber">sell_price</code> terbaru dari provider, bukan angka yang kamu kirim.
                Kalau nomor gagal didapat, saldo dikembalikan penuh secara otomatis.
              </p>
            </div>
            <EndpointCard
              method="POST"
              path="/api/v1/order"
              title="Buat pesanan nomor OTP"
              description="Memotong saldo dan memesan nomor OTP baru dari provider. Pastikan saldo mencukupi."
              params={
                <>
                  <Param name="server" type="string">Kode server dari /v1/servers. Default: warungnokos_s1.</Param>
                  <Param name="serviceId" type="string" required>Kode layanan (service_code dari /v1/services)</Param>
                  <Param name="countryId" type="string" required>country_id dari /v1/countries</Param>
                  <Param name="providerId" type="string" required>provider_id dari /v1/countries</Param>
                  <Param name="operatorId" type="string">ID operator (opsional). WarungNokos memakai &quot;any&quot; kalau kosong.</Param>
                  <Param name="operatorName" type="string">Nama operator (opsional, untuk pencatatan)</Param>
                  <Param name="serviceName" type="string">Nama layanan (opsional, untuk pencatatan)</Param>
                  <Param name="countryName" type="string">Nama negara (opsional, untuk pencatatan)</Param>
                </>
              }
              response={
                <>
                  <ResponseField name="orderId" type="string">ID pesanan unik — simpan untuk cek status</ResponseField>
                  <ResponseField name="server" type="string">Server yang melayani pesanan ini</ResponseField>
                  <ResponseField name="phoneNumber" type="string">Nomor telepon yang dipesan</ResponseField>
                  <ResponseField name="price" type="number">Harga yang dipotong dari saldo (Rupiah)</ResponseField>
                  <ResponseField name="expiredAt" type="number|null">Unix ms kedaluwarsa</ResponseField>
                  <ResponseField name="balance" type="number">Saldo tersisa setelah transaksi</ResponseField>
                </>
              }
              curl={`curl -X POST ${B}/api/v1/order \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "server": "warungnokos_s1",
    "serviceId": "wa",
    "countryId": "6",
    "providerId": "wn:6:1",
    "serviceName": "WhatsApp",
    "countryName": "Indonesia"
  }'
# server dan id-nya selalu diambil dari /v1/servers dan /v1/countries`}
              jsCode={`const res = await fetch("${B}/api/v1/order", {
  method: "POST",
  headers: {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    server: "warungnokos_s1",  // dari /v1/servers
    serviceId: "wa",           // service_code dari /v1/services
    countryId: "6",            // country_id dari /v1/countries
    providerId: "wn:6:1",      // provider_id dari /v1/countries
    serviceName: "WhatsApp",
    countryName: "Indonesia"
  })
});
const { orderId, phoneNumber, price, server } = await res.json();
console.log(\`Got \${phoneNumber} dari \${server}, order \${orderId}, Rp\${price}\`);`}
              pythonCode={`import requests

r = requests.post(
    "${B}/api/v1/order",
    headers={
        "Authorization": "Bearer YOUR_API_KEY",
        "Content-Type": "application/json"
    },
    json={
        "server": "warungnokos_s1",   # dari /v1/servers
        "serviceId": "wa",         # service_code dari /v1/services
        "countryId": "6",          # country_id dari /v1/countries
        "providerId": "wn:6:1",    # provider_id dari /v1/countries
        "serviceName": "WhatsApp",
        "countryName": "Indonesia"
    }
)
data = r.json()
print(f"Phone: {data['phoneNumber']}, Order: {data['orderId']}")`}
            />
            <CodeBlock lang="json" code={`// 200 OK
{
  "orderId": "789012",
  "server": "warungnokos_s1",
  "phoneNumber": "+62812xxxxxxx",
  "price": 3500,
  "expiredAt": 1717235400000,
  "createdAt": "2024-06-01T12:00:00.000Z",
  "balance": 46500
}`} />
          </Section>

          {/* POST /v1/orders/cancel */}
          <Section id="ep-order-cancel">
            <h2 className="text-display-sm font-display text-ink mb-2">Batal Order Nokos</h2>
            <p className="text-muted mb-4">
              Batalkan pesanan yang <b>belum menerima OTP</b> dan dapatkan saldo kembali. Jalurnya sama persis dengan tombol
              “Batalkan” di web dan bot Telegram, jadi refund tidak mungkin terhitung dua kali.
            </p>

            <div className="rounded-xl border border-line overflow-hidden mb-4">
              <div className="px-4 py-2.5 border-b border-line bg-surface2">
                <p className="text-sm font-semibold text-ink">Kapan pesanan boleh dibatalkan?</p>
              </div>
              {[
                ["✅ Boleh", "OTP belum masuk dan pesanan sudah berumur minimal 3 menit sejak dibeli."],
                ["⏳ Terlalu cepat", "Sebelum 3 menit dibalas 400 beserta retry_after (detik yang harus ditunggu). Ini aturan yang sama dengan di web."],
                ["🚫 Tidak boleh", "OTP sudah masuk — dibalas 400 (atau 409 kalau OTP baru saja masuk saat kamu menekan batal, otpCode ikut dikirim)."],
                ["🔁 Aman diulang", "Memanggil batal untuk pesanan yang sudah dibatalkan membalas 200 tanpa menambah saldo lagi."]
              ].map(([k, v]) => (
                <div key={k} className="flex flex-col sm:flex-row gap-1 sm:gap-4 px-4 py-3 border-b border-line last:border-0">
                  <span className="text-sm font-semibold text-ink w-36 flex-shrink-0">{k}</span>
                  <p className="text-sm text-muted">{v}</p>
                </div>
              ))}
            </div>

            <EndpointCard
              method="POST"
              path="/api/v1/orders/cancel"
              title="Batalkan pesanan nokos"
              description="Membatalkan pesanan di provider lalu mengembalikan saldo ke akunmu (termasuk biaya jaminan kalau ada). Batas: 20 permintaan/menit."
              params={
                <>
                  <Param name="order_id" type="string" required>ID pesanan dari POST /v1/order (field orderId). Penulisan orderId juga diterima.</Param>
                </>
              }
              response={
                <>
                  <ResponseField name="success" type="boolean">true kalau pesanan berhasil dibatalkan</ResponseField>
                  <ResponseField name="order_id" type="string">ID pesanan yang dibatalkan</ResponseField>
                  <ResponseField name="status" type="string">Selalu canceled</ResponseField>
                  <ResponseField name="refunded" type="boolean">true = saldo sudah dikembalikan</ResponseField>
                  <ResponseField name="balance" type="number">Saldo terbaru setelah refund (Rupiah)</ResponseField>
                  <ResponseField name="message" type="string">Keterangan singkat</ResponseField>
                </>
              }
              curl={`curl -X POST ${B}/api/v1/orders/cancel \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"order_id": "789012"}'`}
              jsCode={`const res = await fetch("${B}/api/v1/orders/cancel", {
  method: "POST",
  headers: {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ order_id: "789012" })
});
const data = await res.json();

if (res.ok) {
  console.log("Saldo sekarang:", data.balance);
} else if (res.status === 400 && data.retry_after) {
  // Belum 3 menit sejak dibeli — coba lagi setelah data.retry_after detik
  console.log("Tunggu", data.retry_after, "detik");
} else if (res.status === 409 && data.otpCode) {
  // OTP baru saja masuk, pesanan tidak jadi dibatalkan
  console.log("OTP:", data.otpCode);
} else {
  console.error(data.error);
}`}
              pythonCode={`import requests

r = requests.post(
    "${B}/api/v1/orders/cancel",
    headers={"Authorization": "Bearer YOUR_API_KEY"},
    json={"order_id": "789012"},
)
data = r.json()
if r.ok:
    print("Saldo sekarang:", data["balance"])
elif r.status_code == 400 and "retry_after" in data:
    print("Tunggu", data["retry_after"], "detik")
elif r.status_code == 409 and "otpCode" in data:
    print("OTP sudah masuk:", data["otpCode"])
else:
    print(data["error"])`}
            />
            <CodeBlock lang="json" code={`// 200 OK
{
  "success": true,
  "order_id": "789012",
  "status": "canceled",
  "refunded": true,
  "balance": 50000,
  "message": "Pesanan dibatalkan dan saldo dikembalikan."
}

// 400 — belum 3 menit sejak dibeli
{
  "error": "Pesanan baru bisa dibatalkan 3 menit setelah dibeli. Tunggu 94 detik lagi.",
  "retry_after": 94
}

// 409 — OTP baru saja masuk
{
  "error": "Kode OTP baru saja masuk, pesanan tidak bisa dibatalkan.",
  "otpCode": "483921",
  "status": "done"
}`} />
            <div className="mt-4 p-4 rounded-xl bg-amber/5 border border-amber/20">
              <p className="text-xs text-muted">
                💡 Tidak perlu membatalkan manual kalau OTP memang tidak datang sampai habis waktu: pesanan yang kedaluwarsa direfund otomatis.
                Pakai endpoint ini kalau kamu mau saldo kembali <b>lebih cepat</b> dari masa kedaluwarsa.
              </p>
            </div>
          </Section>

          {/* DEPOSIT OTOMATIS */}
          <Section id="deposit">
            <h2 className="text-display-sm font-display text-ink mb-2">Deposit Otomatis</h2>
            <p className="text-muted mb-4">
              Isi saldo akunmu lewat API: buat tagihan QRIS, bayar, dan <b>saldo masuk otomatis</b> begitu pembayaran terkonfirmasi — tanpa
              admin. Cocok untuk bot atau aplikasi yang mengisi saldo secara terjadwal.
            </p>
            <div className="p-4 rounded-xl bg-amber/5 border border-amber/20 mb-2">
              <p className="text-sm font-semibold text-amber mb-1">💡 Alur deposit otomatis</p>
              <ol className="text-xs text-muted list-decimal list-inside space-y-1">
                <li><code className="font-mono text-amber">GET /v1/deposit/methods</code> → pilih <code className="font-mono">provider</code> aktif dan lihat batas min/max.</li>
                <li><code className="font-mono text-amber">POST /v1/deposit</code> → dapat <code className="font-mono">qr_image</code> / <code className="font-mono">qr_string</code> (QRIS) dan <code className="font-mono">total_amount</code>.</li>
                <li>Bayar <b>persis</b> <code className="font-mono">total_amount</code> lewat aplikasi bank/e-wallet apa pun sebelum <code className="font-mono">expired_at</code>.</li>
                <li>Cek <code className="font-mono text-amber">GET /v1/deposit?order_id=…</code> tiap 5 detik sampai <code className="font-mono">status</code> = <code className="font-mono">completed</code> — saldo sudah bertambah saat itu juga.</li>
                <li>Tidak jadi bayar? <code className="font-mono text-amber">POST /v1/deposit/cancel</code> untuk menutup tagihan QRIS yang masih pending.</li>
              </ol>
              <p className="text-xs text-muted mt-2">Sistem juga memeriksa deposit yang menggantung secara berkala, jadi saldo tetap masuk walau kamu tidak sempat memanggil endpoint status.</p>
            </div>
            <p className="text-xs text-muted">Status: <code className="font-mono">pending</code> · <code className="font-mono">completed</code> · <code className="font-mono">expired</code> · <code className="font-mono">canceled</code> · <code className="font-mono">failed</code>. QRIS manual (dicek admin) tidak tersedia lewat API.</p>
          </Section>

          <Section id="ep-dep-methods">
            <EndpointCard
              method="GET"
              path="/api/v1/deposit/methods"
              title="Metode deposit otomatis"
              description="Daftar metode QRIS otomatis yang aktif beserta batas nominal."
              response={
                <>
                  <ResponseField name="min / max" type="number">Batas nominal deposit (Rupiah)</ResponseField>
                  <ResponseField name="methods[]" type="array">Tiap item: provider, name, speed</ResponseField>
                </>
              }
              curl={`curl -H "Authorization: Bearer YOUR_API_KEY" \\
  ${B}/api/v1/deposit/methods`}
            />
          </Section>

          <Section id="ep-dep-create">
            <EndpointCard
              method="POST"
              path="/api/v1/deposit"
              title="Buat deposit QRIS"
              description="Membuat tagihan QRIS otomatis. Batas: 6 permintaan/menit. Maksimal beberapa QRIS belum dibayar per akun."
              params={
                <>
                  <Param name="amount" type="integer" required>Nominal saldo yang ingin masuk (Rupiah, sesuai min/max).</Param>
                  <Param name="provider" type="string" required>Salah satu <code className="font-mono">provider</code> dari <code className="font-mono">/v1/deposit/methods</code>.</Param>
                </>
              }
              response={
                <>
                  <ResponseField name="order_id" type="string">ID deposit — dipakai untuk cek status</ResponseField>
                  <ResponseField name="total_amount" type="number">Yang harus dibayar (nominal + biaya admin bila ada)</ResponseField>
                  <ResponseField name="admin_fee" type="number">Biaya admin provider</ResponseField>
                  <ResponseField name="qr_image" type="string">Gambar QRIS (data URL / URL) untuk ditampilkan</ResponseField>
                  <ResponseField name="qr_string" type="string|null">Isi mentah QRIS bila disediakan provider</ResponseField>
                  <ResponseField name="expired_at" type="string">Batas waktu pembayaran</ResponseField>
                </>
              }
              curl={`curl -X POST ${B}/api/v1/deposit \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"amount": 20000, "provider": "pakasir"}'`}
              jsCode={`const res = await fetch("${B}/api/v1/deposit", {
  method: "POST",
  headers: { "Authorization": "Bearer YOUR_API_KEY", "Content-Type": "application/json" },
  body: JSON.stringify({ amount: 20000, provider: "pakasir" })
});
const dep = await res.json();
console.log(dep.order_id, dep.total_amount); // tampilkan dep.qr_image ke pembayar`}
              pythonCode={`import requests

r = requests.post(
    "${B}/api/v1/deposit",
    headers={"Authorization": "Bearer YOUR_API_KEY"},
    json={"amount": 20000, "provider": "pakasir"},
)
dep = r.json()
print(dep["order_id"], dep["total_amount"])`}
            />
          </Section>

          <Section id="ep-dep-status">
            <EndpointCard
              method="GET"
              path="/api/v1/deposit"
              title="Status deposit / riwayat"
              description="Dengan ?order_id=… memeriksa status ke provider dan langsung mengkreditkan saldo bila sudah dibayar. Tanpa parameter: 20 deposit terakhir."
              params={<Param name="order_id" type="string">ID deposit dari POST /v1/deposit (opsional).</Param>}
              response={
                <>
                  <ResponseField name="status" type="string">pending · completed · expired · canceled · failed</ResponseField>
                  <ResponseField name="credited" type="boolean">true = saldo sudah ditambahkan</ResponseField>
                  <ResponseField name="balance" type="number">Saldo terbaru setelah pengecekan</ResponseField>
                </>
              }
              curl={`curl -H "Authorization: Bearer YOUR_API_KEY" \\
  "${B}/api/v1/deposit?order_id=DP1727700000000123"`}
              jsCode={`// polling tiap 5 detik sampai selesai
let d;
do {
  await new Promise((r) => setTimeout(r, 5000));
  d = await (await fetch(url + "?order_id=" + orderId, { headers: { Authorization: "Bearer YOUR_API_KEY" } })).json();
} while (d.status === "pending");
console.log(d.status, d.balance);`}
            />
          </Section>

          <Section id="ep-dep-cancel">
            <h2 className="text-display-sm font-display text-ink mb-2">Batal Deposit</h2>
            <p className="text-muted mb-4">
              Tutup tagihan QRIS yang <b>belum dibayar</b>. Berguna kalau jumlahnya salah, penggunamu berubah pikiran, atau kamu mau
              membuat tagihan baru tanpa menumpuk yang lama (jumlah QRIS pending per akun dibatasi).
            </p>

            <div className="rounded-xl border border-line overflow-hidden mb-4">
              <div className="px-4 py-2.5 border-b border-line bg-surface2">
                <p className="text-sm font-semibold text-ink">Hasil tergantung status tagihan</p>
              </div>
              {[
                ["pending", "200 — tagihan ditutup, status menjadi canceled."],
                ["sudah dibayar", "409 — sistem mengecek ke penyedia dulu. Kalau ternyata sudah dibayar, saldo DIKREDITKAN dan tagihan tidak dibatalkan (status completed)."],
                ["completed", "400 — deposit sudah berhasil, tidak bisa dibatalkan."],
                ["expired / canceled / failed", "200 — sudah tidak aktif, tidak ada yang berubah (aman diulang)."]
              ].map(([k, v]) => (
                <div key={k} className="flex flex-col sm:flex-row gap-1 sm:gap-4 px-4 py-3 border-b border-line last:border-0">
                  <code className="font-mono text-sm text-amber w-52 flex-shrink-0">{k}</code>
                  <p className="text-sm text-muted">{v}</p>
                </div>
              ))}
            </div>

            <EndpointCard
              method="POST"
              path="/api/v1/deposit/cancel"
              title="Batalkan deposit QRIS"
              description="Membatalkan tagihan QRIS deposit yang masih pending. Batas: 20 permintaan/menit."
              params={
                <>
                  <Param name="order_id" type="string" required>ID deposit dari POST /v1/deposit (field order_id). Penulisan orderId juga diterima.</Param>
                </>
              }
              response={
                <>
                  <ResponseField name="success" type="boolean">true kalau permintaan diproses tanpa masalah</ResponseField>
                  <ResponseField name="order_id" type="string">ID deposit</ResponseField>
                  <ResponseField name="status" type="string">canceled — atau status terakhir kalau tagihan memang sudah tidak aktif</ResponseField>
                  <ResponseField name="message" type="string">Keterangan singkat (mis. tagihan sudah tidak aktif)</ResponseField>
                </>
              }
              curl={`curl -X POST ${B}/api/v1/deposit/cancel \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"order_id": "DP1727700000000123"}'`}
              jsCode={`const res = await fetch("${B}/api/v1/deposit/cancel", {
  method: "POST",
  headers: {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ order_id: "DP1727700000000123" })
});
const data = await res.json();

if (res.ok) {
  console.log("Status:", data.status); // canceled
} else if (res.status === 409) {
  // Ternyata sudah dibayar — saldo sudah masuk, jangan dibatalkan
  console.log("Sudah dibayar:", data.error);
} else {
  console.error(data.error);
}`}
              pythonCode={`import requests

r = requests.post(
    "${B}/api/v1/deposit/cancel",
    headers={"Authorization": "Bearer YOUR_API_KEY"},
    json={"order_id": "DP1727700000000123"},
)
data = r.json()
if r.ok:
    print("Status:", data["status"])
elif r.status_code == 409:
    print("Sudah dibayar, saldo sudah masuk:", data["error"])
else:
    print(data["error"])`}
            />
            <CodeBlock lang="json" code={`// 200 OK
{
  "success": true,
  "order_id": "DP1727700000000123",
  "status": "canceled",
  "message": "Deposit dibatalkan."
}

// 409 — ternyata sudah dibayar
{
  "error": "Pembayaran sudah diterima, saldo sudah masuk. Transaksi tidak dibatalkan.",
  "status": "completed"
}`} />
            <div className="mt-4 p-4 rounded-xl bg-rose/5 border border-rose/20">
              <p className="text-xs text-muted">
                ⚠️ <b className="text-ink">Jangan bayar QRIS yang sudah dibatalkan.</b> Kalau pembayaran tetap masuk setelah dibatalkan,
                sistem tetap mengkreditkan saldonya lewat pengecekan berkala — tapi lebih baik jangan mengandalkan itu.
              </p>
            </div>
          </Section>

          {/* TRY IT OUT */}
          <Section id="try">
            <h2 className="text-display-sm font-display text-ink mb-4">Coba Sekarang</h2>
            <div className="card rounded-2xl border-2 border-amber/30 bg-amber/5 p-6">
              <p className="text-sm font-semibold text-ink mb-4">
                Masukkan API key kamu dan klik <strong>Test</strong> untuk langsung mencoba endpoint <code className="font-mono text-amber">/v1/me</code>.
              </p>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Masukkan API key kamu (32 karakter)"
                  className="flex-1 min-w-0 px-4 py-2.5 rounded-xl border-2 border-line bg-surface text-ink font-mono text-sm focus:outline-none focus:border-amber/60 transition-colors"
                  maxLength={64}
                />
                <button
                  onClick={tryMe}
                  disabled={tryLoading || !apiKey.trim()}
                  className="px-5 py-2.5 bg-amber text-white font-semibold rounded-xl text-sm hover:bg-amber-bright transition-colors disabled:opacity-50 flex-shrink-0"
                >
                  {tryLoading ? "..." : "Test"}
                </button>
              </div>
              {tryResult && (
                <div className="mt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge color={tryResult.status >= 200 && tryResult.status < 300 ? "success" : "rose"}>
                      {tryResult.status || "ERR"}
                    </Badge>
                    <span className="text-xs text-muted">Response</span>
                  </div>
                  <CodeBlock lang="json" code={JSON.stringify(tryResult.data, null, 2)} />
                </div>
              )}
              <p className="text-xs text-muted mt-4">
                Belum punya API key?{" "}
                <Link href="/dashboard" className="text-amber underline">
                  Buka Dashboard → bagian API Key
                </Link>{" "}
                untuk generate.
              </p>
            </div>
          </Section>

          {/* rate limits note */}
          <div className="mt-4 p-5 rounded-xl border border-line bg-surface2">
            <p className="text-sm font-semibold text-ink mb-1">📌 Catatan</p>
            <ul className="text-sm text-muted space-y-1 list-disc ml-4">
              <li>Semua waktu dalam format ISO 8601 UTC.</li>
              <li>Saldo selalu dalam Rupiah (IDR) tanpa desimal.</li>
              <li>API key bersifat privat — 1 key per akun. Regenerate di Dashboard kapan saja.</li>
              <li>Batas laju per key: 60 request/menit (order 20/menit, batal 20/menit, buat deposit 6/menit) — lihat bagian Rate Limit.</li>
              <li>Butuh bantuan? Buka tiket di halaman <Link href="/dashboard" className="text-amber underline">Dashboard → Support</Link>.</li>
            </ul>
          </div>

        </main>
      </div>
    </div>
  );
}
