"use client";

import { useState } from "react";
import Link from "next/link";

const BASE = typeof window !== "undefined" ? window.location.origin : "https://artapedianokosmurahid.vercel.app";

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
    <div className="relative group rounded-xl border border-line bg-surface2 overflow-hidden mt-3">
      <div className="flex items-center justify-between px-4 py-2 border-b border-line bg-surface3">
        <span className="text-xs font-mono text-muted uppercase tracking-widest">{lang}</span>
        <button
          onClick={copy}
          className="text-xs text-muted hover:text-ink transition-colors px-2 py-0.5 rounded border border-line hover:border-amber/40"
        >
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-sm font-mono text-ink leading-relaxed whitespace-pre">{code}</pre>
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
    <div className="card rounded-2xl border-2 border-line overflow-hidden mt-6">
      {/* header */}
      <div className="flex flex-wrap items-start gap-3 p-5 border-b border-line bg-surface2">
        <Method m={method} />
        <code className="font-mono text-sm text-ink bg-surface3 px-3 py-1 rounded-lg border border-line">{path}</code>
        {auth && <Badge color="teal">Auth required</Badge>}
        <div className="w-full mt-1">
          <p className="font-semibold text-ink">{title}</p>
          {description && <p className="text-sm text-muted mt-0.5">{description}</p>}
        </div>
      </div>

      <div className="p-5 space-y-5">
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

  const nav = [
    { id: "intro", label: "Intro" },
    { id: "auth", label: "Authentication" },
    { id: "errors", label: "Error codes" },
    { id: "ep-me", label: "GET /v1/me" },
    { id: "ep-servers", label: "GET /v1/servers" },
    { id: "ep-services", label: "GET /v1/services" },
    { id: "ep-countries", label: "GET /v1/countries" },
    { id: "ep-orders", label: "GET /v1/orders" },
    { id: "ep-order-status", label: "GET /v1/orders/status" },
    { id: "ep-order-create", label: "POST /v1/order" },
    { id: "try", label: "Try it out" }
  ];

  return (
    <div className="min-h-screen bg-bg">
      {/* hero */}
      <div className="border-b border-line bg-surface2">
        <div className="max-w-content mx-auto px-4 py-12 md:py-16">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">⚡</span>
            <Badge color="amber">v1</Badge>
            <Badge color="teal">REST · JSON</Badge>
          </div>
          <h1 className="font-display text-display-md text-ink mb-3">Developer API</h1>
          <p className="text-muted max-w-xl text-lg">
            Akses layanan Artapedia secara programatik — beli nomor OTP, cek saldo, lacak pesanan — langsung dari kode kamu.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <a href="#auth" className="btn bg-amber text-white px-5 py-2.5 rounded-xl font-semibold text-sm">
              Mulai →
            </a>
            <Link href="/apikey" className="btn bg-surface border border-line text-ink px-5 py-2.5 rounded-xl font-semibold text-sm">
              Dapatkan API Key
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-content mx-auto px-4 py-10 flex gap-8">
        {/* sidebar */}
        <aside className="hidden lg:block w-52 flex-shrink-0">
          <div className="sticky top-24">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted mb-3 px-3">Navigasi</p>
            <nav className="space-y-0.5">
              {nav.map((n) => (
                <a
                  key={n.id}
                  href={`#${n.id}`}
                  className="block px-3 py-1.5 text-sm text-muted hover:text-ink hover:bg-surface2 rounded-lg transition-colors"
                >
                  {n.label}
                </a>
              ))}
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
            <CodeBlock lang="text" code={`Base URL: https://artapedianokosmurahid.vercel.app/api/v1`} />
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
  https://artapedianokosmurahid.vercel.app/api/v1/me`} />
              </div>
              <div>
                <p className="text-xs text-muted mb-1">2. Query parameter <code className="font-mono text-amber">?api_key=</code></p>
                <CodeBlock lang="bash" code={`curl "https://artapedianokosmurahid.vercel.app/api/v1/me?api_key=YOUR_API_KEY"`} />
              </div>
            </div>
            <div className="mt-5 p-4 rounded-xl bg-rose/5 border border-rose/20">
              <p className="text-sm font-semibold text-rose mb-1">⚠️ Jaga kerahasiaan API key</p>
              <p className="text-xs text-muted">Jangan expose API key di frontend publik atau repository. Jika bocor, segera regenerate di Dashboard.</p>
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
                ["500", "rose", "Server Error", "Kesalahan internal, coba lagi nanti"]
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
  https://artapedianokosmurahid.vercel.app/api/v1/me`}
              jsCode={`const res = await fetch("https://artapedianokosmurahid.vercel.app/api/v1/me", {
  headers: { "Authorization": "Bearer YOUR_API_KEY" }
});
const data = await res.json();
console.log(data.balance); // e.g. 50000`}
              pythonCode={`import requests

r = requests.get(
    "https://artapedianokosmurahid.vercel.app/api/v1/me",
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
              Artapedia menyambung ke beberapa provider sekaligus. Tiap provider disebut <b>server</b>, punya daftar
              aplikasi, negara, dan harga sendiri. Semua endpoint katalog &amp; order menerima parameter{" "}
              <code className="font-mono text-xs bg-surface2 px-1.5 py-0.5 rounded border border-line">server</code>.
              Kalau tidak dikirim, nilainya otomatis <code className="font-mono text-xs">rumahotp</code>.
            </p>

            <div className="rounded-xl border border-line overflow-hidden mb-4">
              {[
                ["rumahotp", "Server Nokos Murah", "Harga paling hemat, cakupan aplikasi & negara terluas."],
                ["warungnokos_s1", "Server Plus", "Jalur utama WarungNokos (H2H), stok melimpah & rate sukses tertinggi."],
                ["warungnokos_s2", "Server Express", "Server2 WarungNokos, dipakai saat stok server utama kosong."],
                ["dibanana", "OTP Fast Murah", "OTP masuk cepat & murah. Negara: ID, MY, SG, US, UK."]
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
  https://artapedianokosmurahid.vercel.app/api/v1/servers`}
              jsCode={`const res = await fetch("https://artapedianokosmurahid.vercel.app/api/v1/servers", {
  headers: { "Authorization": "Bearer YOUR_API_KEY" }
});
const { items } = await res.json();
// pilih server termurah/tercepat sesuai kebutuhan kamu
const server = items[0].server;`}
              pythonCode={`import requests

r = requests.get(
    "https://artapedianokosmurahid.vercel.app/api/v1/servers",
    headers={"Authorization": "Bearer YOUR_API_KEY"}
)
for s in r.json()["items"]:
    print(s["server"], "-", s["name"])`}
            />
            <CodeBlock lang="json" code={`// 200 OK
{
  "items": [
    { "server": "rumahotp",    "name": "Server Nokos Murah", "badge": "Murah",    "provider": "RumahOTP" },
    { "server": "warungnokos_s1", "name": "Server Plus",        "badge": "Utama",    "provider": "WarungNokos" },
    { "server": "warungnokos_s2", "name": "Server Express",     "badge": "Global",   "provider": "WarungNokos S2" },
    { "server": "dibanana",    "name": "OTP Fast Murah",     "badge": "Fast",     "provider": "dibanana" }
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
                  <Param name="server" type="string">Kode server dari /v1/servers. Default: rumahotp.</Param>
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
  "https://artapedianokosmurahid.vercel.app/api/v1/services?server=dibanana"`}
              jsCode={`const res = await fetch(
  "https://artapedianokosmurahid.vercel.app/api/v1/services?server=dibanana",
  { headers: { "Authorization": "Bearer YOUR_API_KEY" } }
);
const { items } = await res.json();
// items: [{ service_code, service_name, server }, ...]`}
              pythonCode={`import requests

r = requests.get(
    "https://artapedianokosmurahid.vercel.app/api/v1/services",
    params={"server": "warungnokos_s1"},
    headers={"Authorization": "Bearer YOUR_API_KEY"}
)
for svc in r.json()["items"]:
    print(svc["service_code"], svc["service_name"])`}
            />
            <CodeBlock lang="json" code={`// 200 OK
{
  "server": "dibanana",
  "items": [
    { "service_code": "wa", "service_name": "WhatsApp", "service_img": null, "server": "dibanana" },
    { "service_code": "tg", "service_name": "Telegram", "service_img": null, "server": "dibanana" }
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
                  <Param name="server" type="string">Kode server. Default: rumahotp.</Param>
                </>
              }
              response={
                <>
                  <ResponseField name="items[].number_id" type="string">Dipakai sebagai numberId saat order (server rumahotp)</ResponseField>
                  <ResponseField name="items[].name" type="string">Nama negara</ResponseField>
                  <ResponseField name="items[].pricelist[].provider_id" type="string">Dipakai sebagai providerId saat order</ResponseField>
                  <ResponseField name="items[].pricelist[].sell_price" type="number">Harga jual final (sudah termasuk markup)</ResponseField>
                  <ResponseField name="items[].pricelist[].stock" type="number">Sisa stok, null kalau provider tidak melaporkannya</ResponseField>
                  <ResponseField name="items[].pricelist[].country_id" type="string">Dipakai sebagai countryId untuk server WarungNokos &amp; dibanana</ResponseField>
                  <ResponseField name="items[].pricelist[].providerIndex" type="number">Dipakai sebagai providerIndex untuk server dibanana</ResponseField>
                </>
              }
              curl={`curl -H "Authorization: Bearer YOUR_API_KEY" \\
  "https://artapedianokosmurahid.vercel.app/api/v1/countries?server=dibanana&service_id=wa"`}
              jsCode={`const res = await fetch(
  "https://artapedianokosmurahid.vercel.app/api/v1/countries?server=dibanana&service_id=wa",
  { headers: { "Authorization": "Bearer YOUR_API_KEY" } }
);
const { items } = await res.json();

// ambil paket termurah yang masih ada stok
const offers = items.flatMap(c => c.pricelist).filter(p => p.stock !== 0);
offers.sort((a, b) => a.sell_price - b.sell_price);
console.log("termurah:", offers[0].sell_price);`}
              pythonCode={`import requests

r = requests.get(
    "https://artapedianokosmurahid.vercel.app/api/v1/countries",
    params={"server": "warungnokos_s1", "service_id": "13"},
    headers={"Authorization": "Bearer YOUR_API_KEY"}
)
for c in r.json()["items"]:
    for p in c["pricelist"]:
        print(c["name"], p["sell_price"], p["stock"])`}
            />
            <CodeBlock lang="json" code={`// 200 OK — server "dibanana"
{
  "server": "dibanana",
  "items": [
    {
      "number_id": "bn:id",
      "name": "Indonesia",
      "flag": "\u{1F1EE}\u{1F1E9}",
      "pricelist": [
        {
          "provider_id": "bn:id:0",
          "provider_name": "Paket Termurah",
          "price": 900,
          "sell_price": 1100,
          "stock": 245,
          "country_id": "id",
          "providerIndex": 0,
          "server": "dibanana"
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
                  <ResponseField name="items[].status" type="string">pending | success | expired | cancelled</ResponseField>
                  <ResponseField name="items[].otpCode" type="string|null">Kode OTP (null jika belum/direfund)</ResponseField>
                  <ResponseField name="items[].refunded" type="boolean">Apakah sudah direfund</ResponseField>
                  <ResponseField name="items[].createdAt" type="string">ISO timestamp pembuatan</ResponseField>
                </>
              }
              curl={`curl -H "Authorization: Bearer YOUR_API_KEY" \\
  "https://artapedianokosmurahid.vercel.app/api/v1/orders?limit=10&page=1"`}
              jsCode={`const res = await fetch(
  "https://artapedianokosmurahid.vercel.app/api/v1/orders?limit=10",
  { headers: { "Authorization": "Bearer YOUR_API_KEY" } }
);
const { items } = await res.json();
items.forEach(o => console.log(o.orderId, o.status, o.otpCode));`}
              pythonCode={`import requests

r = requests.get(
    "https://artapedianokosmurahid.vercel.app/api/v1/orders",
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
                  <ResponseField name="status" type="string">pending | success | expired | cancelled</ResponseField>
                  <ResponseField name="otpCode" type="string|null">Kode OTP (null jika belum tersedia)</ResponseField>
                  <ResponseField name="otpMsg" type="string|null">Pesan SMS lengkap</ResponseField>
                  <ResponseField name="phoneNumber" type="string">Nomor telepon</ResponseField>
                  <ResponseField name="price" type="number">Harga dalam Rupiah</ResponseField>
                  <ResponseField name="refunded" type="boolean">Apakah sudah direfund</ResponseField>
                </>
              }
              curl={`curl -H "Authorization: Bearer YOUR_API_KEY" \\
  "https://artapedianokosmurahid.vercel.app/api/v1/orders/status?order_id=123456"`}
              jsCode={`// Poll setiap 5 detik sampai status = 'success'
async function waitForOtp(orderId, apiKey) {
  while (true) {
    const r = await fetch(
      \`https://artapedianokosmurahid.vercel.app/api/v1/orders/status?order_id=\${orderId}\`,
      { headers: { Authorization: \`Bearer \${apiKey}\` } }
    );
    const data = await r.json();
    if (data.status === "success") return data.otpCode;
    if (data.status === "expired") throw new Error("Order expired");
    await new Promise(res => setTimeout(res, 5000));
  }
}`}
              pythonCode={`import requests, time

def wait_for_otp(order_id, api_key):
    while True:
        r = requests.get(
            "https://artapedianokosmurahid.vercel.app/api/v1/orders/status",
            params={"order_id": order_id},
            headers={"Authorization": f"Bearer {api_key}"}
        )
        data = r.json()
        if data["status"] == "success":
            return data["otpCode"]
        if data["status"] == "expired":
            raise Exception("Order expired")
        time.sleep(5)`}
            />
            <CodeBlock lang="json" code={`// 200 OK (OTP sudah diterima)
{
  "orderId": "123456",
  "status": "success",
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
              </ol>
            </div>

            <div className="rounded-xl border border-line overflow-hidden mb-4">
              <div className="px-4 py-2.5 border-b border-line bg-surface2">
                <p className="text-sm font-semibold text-ink">Parameter wajib per server</p>
              </div>
              {[
                ["rumahotp", "serviceId, numberId, providerId", "operatorId"],
                ["warungnokos_s1 / warungnokos_s2", "serviceId, countryId, providerId", "operatorId (default: any)"],
                ["dibanana", "serviceId, countryId, providerIndex", "—"]
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
                  <Param name="server" type="string">Kode server dari /v1/servers. Default: rumahotp.</Param>
                  <Param name="serviceId" type="string" required>Kode layanan (service_code dari /v1/services)</Param>
                  <Param name="numberId" type="string">Wajib untuk server rumahotp — number_id dari /v1/countries</Param>
                  <Param name="providerId" type="string">Wajib untuk server rumahotp — provider_id dari /v1/countries</Param>
                  <Param name="countryId" type="string">Wajib untuk warungnokos_s2/s2 &amp; dibanana — country_id dari /v1/countries</Param>
                  <Param name="providerIndex" type="number">Wajib untuk dibanana — providerIndex dari /v1/countries (0 = termurah)</Param>
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
              curl={`curl -X POST https://artapedianokosmurahid.vercel.app/api/v1/order \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "server": "dibanana",
    "serviceId": "wa",
    "countryId": "id",
    "providerIndex": 0,
    "serviceName": "WhatsApp",
    "countryName": "Indonesia"
  }'

# Server rumahotp memakai numberId + providerId:
# -d '{"server":"rumahotp","serviceId":"1","numberId":"62","providerId":"5"}'
# Server WarungNokos memakai countryId:
# -d '{"server":"warungnokos_s1","serviceId":"wa","countryId":"6"}'`}
              jsCode={`const res = await fetch("https://artapedianokosmurahid.vercel.app/api/v1/order", {
  method: "POST",
  headers: {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    server: "dibanana",        // dari /v1/servers
    serviceId: "wa",           // service_code dari /v1/services
    countryId: "id",           // country_id dari /v1/countries
    providerIndex: 0,          // khusus dibanana, 0 = paket termurah
    serviceName: "WhatsApp",
    countryName: "Indonesia"
  })
});
const { orderId, phoneNumber, price, server } = await res.json();
console.log(\`Got \${phoneNumber} dari \${server}, order \${orderId}, Rp\${price}\`);`}
              pythonCode={`import requests

r = requests.post(
    "https://artapedianokosmurahid.vercel.app/api/v1/order",
    headers={
        "Authorization": "Bearer YOUR_API_KEY",
        "Content-Type": "application/json"
    },
    json={
        "server": "warungnokos_s1",   # dari /v1/servers
        "serviceId": "wa",         # service_code dari /v1/services
        "countryId": "6",          # country_id dari /v1/countries
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
  "server": "dibanana",
  "phoneNumber": "+62812xxxxxxx",
  "price": 3500,
  "expiredAt": 1717235400000,
  "createdAt": "2024-06-01T12:00:00.000Z",
  "balance": 46500
}`} />
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
              <li>Butuh bantuan? Buka tiket di halaman <Link href="/dashboard" className="text-amber underline">Dashboard → Support</Link>.</li>
            </ul>
          </div>

        </main>
      </div>
    </div>
  );
}
