"use client";

import Link from "next/link";
import "@/components/docs.css";
import { useEffect, useState } from "react";
import {
  INVOICE_MIN, INVOICE_MAX, BIAYA_QRIS, WD_MIN, BIAYA_WD
} from "@/lib/gatewayConfig";
import { SITE_URL as FALLBACK_BASE } from "@/lib/links";

const rp = (n) => `Rp${Number(n).toLocaleString("id-ID")}`;

function Blok({ judul, kode, bahasa = "" }) {
  const [disalin, setDisalin] = useState(false);
  return (
    <div className="dx-kode">
      <div className="dx-kode-bar">
        <span className="dot" style={{ background: "#ff5f56" }} /><span className="dot" style={{ background: "#ffbd2e" }} /><span className="dot" style={{ background: "#27c93f" }} />
        <span className="judul">{judul || bahasa}</span>
        <button onClick={() => { navigator.clipboard?.writeText(kode); setDisalin(true); setTimeout(() => setDisalin(false), 1500); }}>
          {disalin ? "✓ Tersalin" : "Salin"}
        </button>
      </div>
      <pre><code>{kode}</code></pre>
    </div>
  );
}

const TOC = [
  ["dasar", "Dasar"], ["batas", "Batas & biaya"], ["buat", "Buat tagihan"], ["cek", "Cek status"],
  ["saldo", "Saldo"], ["callback", "Callback"], ["contoh", "Contoh"], ["error", "Kode error"]
];

function Baris({ nama, tipe, wajib, ket }) {
  return (
    <tr className="border-b border-line last:border-0">
      <td className="py-2 pr-3 align-top"><code className="text-xs font-bold text-ink">{nama}</code></td>
      <td className="py-2 pr-3 align-top text-[11px] text-muted">{tipe}</td>
      <td className="py-2 pr-3 align-top">
        {wajib
          ? <span className="rounded-full bg-rose-soft px-1.5 py-0.5 text-[10px] font-black text-rose">WAJIB</span>
          : tipe ? <span className="text-[10px] text-muted">opsional</span> : null}
      </td>
      <td className="py-2 align-top text-[11px] leading-relaxed text-muted">{ket}</td>
    </tr>
  );
}

export default function GatewayDocsPage() {
  // Base URL diatur admin (Pengaturan Umum → Alamat API → QRIS Gateway).
  // Ditulis dari server dan bukan dari window.location: dokumentasi ini dibaca
  // untuk DISALIN ke server merchant, dan alamat yang ikut tempat halamannya
  // dibuka akan menghasilkan contoh yang menunjuk ke localhost.
  const [B, setB] = useState(FALLBACK_BASE);
  const [aktif, setAktif] = useState("dasar");
  useEffect(() => {
    const els = TOC.map(([id]) => document.getElementById(id)).filter(Boolean);
    if (!els.length || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((e) => { const t = e.filter((x) => x.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]; if (t) setAktif(t.target.id); }, { rootMargin: "-110px 0px -65% 0px" });
    els.forEach((x) => io.observe(x));
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    fetch("/api/settings/public", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (d?.docs?.gateway) setB(d.docs.gateway); })
      .catch(() => {});
  }, []);

  return (
    <div className="gw-shell">
      <div className="dx-hero gw">
        <div className="mx-auto max-w-content px-4 py-10 sm:px-5 md:py-14">
          <Link href="/gateway" className="text-xs font-bold text-white/85">← Kembali ke dasbor</Link>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="dx-pill">🏦 QRIS Gateway</span>
            <span className="dx-pill">REST · JSON</span>
            <span className="dx-pill">Via AustinPay</span>
          </div>
          <h1 className="font-display mt-3 text-3xl font-black tracking-tight sm:text-4xl">Terima pembayaran QRIS di tokomu sendiri</h1>
          <p className="mt-2 max-w-xl text-base text-white/85">
            Buat tagihan lewat API, pembeli bayar pakai QRIS apa pun, saldo masuk otomatis dan kamu dikabari lewat callback.
          </p>
          <div className="dx-url mt-5">
            <code>{B}/api/gw/v1</code>
            <button onClick={() => navigator.clipboard?.writeText(`${B}/api/gw/v1`).catch(() => {})}>Salin</button>
          </div>
          <div className="dx-langkah mt-5">
            <div><i>1</i><b>Ambil API key</b>Di dasbor gateway → tab API.</div>
            <div><i>2</i><b>Buat tagihan</b>POST /invoice, tampilkan QR ke pembeli.</div>
            <div><i>3</i><b>Terima callback</b>Saldo masuk, tarik ke e-wallet otomatis.</div>
          </div>
        </div>
      </div>
      <nav className="dx-chips" aria-label="Daftar isi">
        {TOC.map(([id, label]) => <a key={id} href={`#${id}`} data-aktif={aktif === id}>{label}</a>)}
      </nav>
      <div className="mx-auto max-w-content px-4 pb-8 sm:px-5">
      {/* Dasar */}
      <div id="dasar" className="card mt-5 scroll-mt-28 p-5">
        <h2 className="font-display text-base font-black text-ink">Dasar</h2>
        <table className="mt-3 w-full text-left">
          <tbody>
            <Baris nama="Base URL" tipe="" ket={<code>{B}/api/gw/v1</code>} />
            <Baris nama="Autentikasi" tipe="header" wajib ket={<>Header <code>X-API-Key: apk_xxx</code> di SETIAP permintaan.</>} />
            <Baris nama="Format" tipe="JSON" ket="Permintaan dan jawaban sama-sama JSON." />
          </tbody>
        </table>
        <p className="mt-3 rounded-xl border-2 border-rose/40 bg-rose-soft px-3 py-2 text-[11px] leading-relaxed text-ink">
          🔒 API key hanya boleh dipakai dari <b>server</b> kamu. Menaruhnya di JavaScript peramban atau di
          aplikasi Android berarti siapa pun bisa membacanya dan membuat tagihan atas namamu.
        </p>
      </div>

      {/* Batas & biaya */}
      <div id="batas" className="card mt-4 scroll-mt-28 p-5">
        <h2 className="font-display text-base font-black text-ink">Batas &amp; biaya</h2>
        <table className="mt-3 w-full text-left">
          <tbody>
            <Baris nama="Nominal tagihan" tipe="" ket={`${rp(INVOICE_MIN)} sampai ${rp(INVOICE_MAX)}`} />
            <Baris nama="Biaya per tagihan" tipe="" ket={`${rp(BIAYA_QRIS)}, dipotong hanya kalau tagihannya DIBAYAR. Tagihan yang tidak dibayar tidak dikenai apa pun.`} />
            <Baris nama="Penarikan" tipe="" ket={`Otomatis lewat AustinPay. Minimal ${rp(WD_MIN)} yang ditarik; biaya ${rp(BIAYA_WD)} dipotong dari nominal itu (tarik ${rp(WD_MIN)} → saldo terpotong ${rp(WD_MIN)}, e-wallet menerima ${rp(WD_MIN - BIAYA_WD)}).`} />
            <Baris nama="Konversi ke saldo Arta Pedia" tipe="" ket="Tanpa biaya." />
            <Baris nama="Batas permintaan" tipe="" ket="60 tagihan per menit per akun." />
          </tbody>
        </table>
      </div>

      {/* Buat tagihan */}
      <div id="buat" className="card mt-4 scroll-mt-28 p-5">
        <div className="flex items-center gap-2">
          <span className="dx-metode" style={{ "--dx-warna": "rgb(var(--c-orange))" }}>POST</span>
          <code className="dx-path">/api/gw/v1/invoice</code>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted">Buat tagihan QRIS baru.</p>

        <h3 className="mt-4 text-xs font-black uppercase tracking-wide text-muted">Parameter</h3>
        <table className="mt-2 w-full text-left">
          <tbody>
            <Baris nama="amount" tipe="number" wajib ket={`Nominal yang harus dibayar pembeli, ${rp(INVOICE_MIN)}–${rp(INVOICE_MAX)}.`} />
            <Baris nama="ref" tipe="string" ket="Nomor pesanan di sistem kamu, maksimal 120 huruf. Ikut dikembalikan di callback." />
            <Baris nama="callback_url" tipe="string" ket="Kalau diisi, menimpa callback URL bawaan untuk tagihan ini saja." />
          </tbody>
        </table>

        <Blok judul="cURL" kode={`curl -X POST ${B}/api/gw/v1/invoice \\
  -H "X-API-Key: apk_KUNCI_KAMU" \\
  -H "Content-Type: application/json" \\
  -d '{"amount": 25000, "ref": "ORDER-123"}'`} />

        <Blok judul="Jawaban" kode={`{
  "success": true,
  "invoice_id": "INV-A1B2C3D4E5F6G7",
  "amount": 25000,
  "fee": ${BIAYA_QRIS},
  "net_amount": ${25000 - BIAYA_QRIS},
  "pay_amount": 25137,
  "qr_string": "00020101021226...",
  "qr_image": "data:image/png;base64,...",
  "payment_url": null,
  "status": "pending",
  "merchant_ref": "ORDER-123",
  "expired_at": "2026-09-24T10:30:00.000Z"
}`} />

        <p className="mt-3 text-[11px] leading-relaxed text-muted">
          <b>pay_amount</b> adalah nominal yang HARUS dibayar pembeli: nominal tagihan ditambah kode unik dan
          biaya penyedia (QRIS FAST). Tampilkan angka ini ke pembeli — nominal yang tidak pas tidak terdeteksi.
          Saldomu bertambah sebesar <b>net_amount</b>. <b>qr_image</b> adalah gambar QR siap tampil
          (boleh kosong).
        </p>
        <p className="mt-2 text-[11px] leading-relaxed text-muted">
          <b>qr_string</b> adalah isi kode QRIS mentah. Ubah jadi gambar QR dengan pustaka QR apa pun di
          sisimu — jangan mengirim string ini ke layanan pembuat QR pihak ketiga, karena itu berarti
          membocorkan data pembayaran pembelimu ke pihak yang tidak perlu tahu.
        </p>
      </div>

      {/* Cek status */}
      <div id="cek" className="card mt-4 scroll-mt-28 p-5">
        <div className="flex items-center gap-2">
          <span className="dx-metode" style={{ "--dx-warna": "rgb(var(--c-success))" }}>GET</span>
          <code className="dx-path">/api/gw/v1/invoice/{"{invoice_id}"}</code>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          Cek status satu tagihan. Status yang mungkin: <code>pending</code>, <code>paid</code>,
          <code> expired</code>.
        </p>
        <Blok judul="cURL" kode={`curl ${B}/api/gw/v1/invoice/INV-A1B2C3D4E5F6G7 \\
  -H "X-API-Key: apk_KUNCI_KAMU"`} />
      </div>

      {/* Saldo */}
      <div id="saldo" className="card mt-4 scroll-mt-28 p-5">
        <div className="flex items-center gap-2">
          <span className="dx-metode" style={{ "--dx-warna": "rgb(var(--c-success))" }}>GET</span>
          <code className="dx-path">/api/gw/v1/balance</code>
        </div>
        <Blok judul="Jawaban" kode={`{ "success": true, "balance": 1250000, "total_masuk": 4300000, "frozen": false }`} />
      </div>

      {/* Callback */}
      <div id="callback" className="card mt-4 scroll-mt-28 p-5">
        <h2 className="font-display text-base font-black text-ink">📡 Callback</h2>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          Saat tagihan dibayar, kami POST JSON ke callback URL kamu (bawaan dari dasbor, atau
          <code> callback_url</code> per tagihan). Syaratnya: <b>https</b>, domain publik (bukan IP / localhost),
          port 443 atau 8443, tanpa redirect. Balas status <b>2xx</b> kalau sudah kamu terima.
        </p>
        <Blok judul="Yang kami kirim" kode={`POST /callback-kamu
Content-Type: application/json
X-Artapedia-Event: invoice.paid
X-Artapedia-Signature: <hex HMAC-SHA256 dari badan mentah, kunci = API key kamu>

{
  "invoice_id": "INV-A1B2C3D4E5F6G7",
  "status": "paid",
  "amount": 25000,
  "pay_amount": 25137,
  "net_amount": ${25000 - BIAYA_QRIS},
  "merchant_ref": "ORDER-123",
  "paid_at": "2026-09-24T10:25:00.000Z"
}`} />
        <p className="mt-3 text-[11px] leading-relaxed text-muted">
          Kalau balasanmu bukan 2xx atau server-mu tak terjangkau, kami mengulang: 1, 5, 15 menit, 1 jam,
          lalu 6 jam kemudian (total 6 percobaan). Callback bisa datang lebih dari sekali untuk tagihan yang sama —
          proses berdasarkan <code>invoice_id</code> dan abaikan yang sudah kamu tandai lunas.
        </p>
        <Blok judul="Verifikasi tanda tangan (Node.js)" kode={`import crypto from "node:crypto";

// pakai badan MENTAH (sebelum di-parse JSON)
const hitung = crypto.createHmac("sha256", process.env.ARTAPEDIA_GW_KEY).update(rawBody).digest("hex");
const sah = crypto.timingSafeEqual(Buffer.from(hitung), Buffer.from(req.headers["x-artapedia-signature"] || ""));`} />
        <p className="mt-3 rounded-xl border-2 border-amber/40 bg-amber-soft px-3 py-2 text-[11px] leading-relaxed text-ink">
          ⚠️ Tetap <b>konfirmasi</b> dengan <code>GET /api/gw/v1/invoice/{"{id}"}</code> sebelum mengirim barang
          kalau tanda tangannya tidak kamu periksa. Jangan pernah mempercayai callback yang tidak bertanda tangan sah.
        </p>
      </div>

      {/* Contoh kode */}
      <div id="contoh" className="card mt-4 scroll-mt-28 p-5">
        <h2 className="font-display text-base font-black text-ink">Contoh lengkap</h2>

        <Blok bahasa="Node.js" judul="Node.js" kode={`const KEY = process.env.ARTAPEDIA_GW_KEY;

async function buatTagihan(nominal, ref) {
  const r = await fetch("${B}/api/gw/v1/invoice", {
    method: "POST",
    headers: { "X-API-Key": KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ amount: nominal, ref })
  });
  const d = await r.json();
  if (!d.success) throw new Error(d.error);
  return d;
}

// Sebelum mengirim barang, pastikan dulu ke sumbernya.
async function sudahDibayar(invoiceId) {
  const r = await fetch(\`${B}/api/gw/v1/invoice/\${invoiceId}\`, {
    headers: { "X-API-Key": KEY }
  });
  const d = await r.json();
  return d.success && d.status === "paid";
}`} />

        <Blok bahasa="PHP" judul="PHP" kode={`<?php
$key = getenv('ARTAPEDIA_GW_KEY');

function buatTagihan($nominal, $ref) {
  global $key;
  $ch = curl_init('${B}/api/gw/v1/invoice');
  curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => ["X-API-Key: $key", 'Content-Type: application/json'],
    CURLOPT_POSTFIELDS => json_encode(['amount' => $nominal, 'ref' => $ref]),
  ]);
  $res = json_decode(curl_exec($ch), true);
  curl_close($ch);
  if (empty($res['success'])) throw new Exception($res['error'] ?? 'Gagal');
  return $res;
}`} />

        <Blok bahasa="Python" judul="Python" kode={`import os, requests

KEY = os.environ["ARTAPEDIA_GW_KEY"]
BASE = "${B}/api/gw/v1"

def buat_tagihan(nominal, ref=""):
    r = requests.post(f"{BASE}/invoice",
                      headers={"X-API-Key": KEY},
                      json={"amount": nominal, "ref": ref}, timeout=20)
    d = r.json()
    if not d.get("success"):
        raise RuntimeError(d.get("error", "Gagal"))
    return d

def sudah_dibayar(invoice_id):
    r = requests.get(f"{BASE}/invoice/{invoice_id}",
                     headers={"X-API-Key": KEY}, timeout=20)
    d = r.json()
    return d.get("success") and d.get("status") == "paid"`} />
      </div>

      {/* Error */}
      <div id="error" className="card mt-4 scroll-mt-28 p-5">
        <h2 className="font-display text-base font-black text-ink">Kode error</h2>
        <table className="mt-3 w-full text-left">
          <tbody>
            <Baris nama="401" tipe="" ket="API key tidak valid atau tidak dikirim." />
            <Baris nama="400" tipe="" ket="Nominal di luar batas, atau parameter kurang." />
            <Baris nama="403" tipe="" ket="Akun gateway sedang dibekukan atau nonaktif." />
            <Baris nama="404" tipe="" ket="Tagihan tidak ditemukan, atau bukan milik akun ini." />
            <Baris nama="429" tipe="" ket="Melewati batas permintaan. Tunggu sebentar." />
            <Baris nama="502/503" tipe="" ket="Penyedia pembayaran sedang bermasalah. Coba lagi." />
          </tbody>
        </table>
        <p className="mt-3 text-[11px] leading-relaxed text-muted">
          Semua jawaban gagal berbentuk <code>{"{ \"success\": false, \"error\": \"...\" }\""}</code>, jadi
          sistemmu cukup memeriksa satu bentuk saja.
        </p>
      </div>

      <Link href="/gateway" className="btn-primary press mt-5 block text-center">← Kembali ke Dasbor Gateway</Link>
      </div>
    </div>
  );
}
