"use client";

import Link from "next/link";
import { useState } from "react";
import {
  INVOICE_MIN, INVOICE_MAX, BIAYA_QRIS, WD_MIN, BIAYA_WD
} from "@/lib/gatewayConfig";

const rp = (n) => `Rp${Number(n).toLocaleString("id-ID")}`;

function Blok({ judul, kode, bahasa = "" }) {
  const [disalin, setDisalin] = useState(false);
  return (
    <div className="mt-3 overflow-hidden rounded-2xl border-2 border-ink">
      <div className="flex items-center justify-between bg-surface2 px-3 py-2">
        <span className="text-[11px] font-black uppercase tracking-wide text-muted">{judul || bahasa}</span>
        <button
          onClick={() => { navigator.clipboard?.writeText(kode); setDisalin(true); setTimeout(() => setDisalin(false), 1500); }}
          className="text-[11px] font-bold text-amber-bright"
        >
          {disalin ? "✓ Disalin" : "Salin"}
        </button>
      </div>
      <pre className="overflow-x-auto bg-[#0d1117] p-3 text-[11px] leading-relaxed text-[#c9d1d9]"><code>{kode}</code></pre>
    </div>
  );
}

function Baris({ nama, tipe, wajib, ket }) {
  return (
    <tr className="border-b border-line last:border-0">
      <td className="py-2 pr-3 align-top"><code className="text-xs font-bold text-ink">{nama}</code></td>
      <td className="py-2 pr-3 align-top text-[11px] text-muted">{tipe}</td>
      <td className="py-2 pr-3 align-top">
        {wajib
          ? <span className="rounded-full bg-rose-soft px-1.5 py-0.5 text-[10px] font-black text-rose">WAJIB</span>
          : <span className="text-[10px] text-muted">opsional</span>}
      </td>
      <td className="py-2 align-top text-[11px] leading-relaxed text-muted">{ket}</td>
    </tr>
  );
}

export default function GatewayDocsPage() {
  return (
    <div className="gw-shell mx-auto max-w-content px-4 py-6 sm:px-5 sm:py-8">
      <Link href="/gateway" className="text-xs font-bold text-amber-bright">← Kembali ke dasbor</Link>

      <h1 className="font-display mt-3 text-2xl font-black tracking-tight text-ink sm:text-3xl">
        DOKUMENTASI API
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Sambungkan QRIS Gateway ke bot atau web kamu sendiri. Semua permintaan memakai HTTPS dan
        dikenali lewat header <code className="font-bold text-ink">X-API-Key</code>.
      </p>

      {/* Dasar */}
      <div className="card mt-5 p-5">
        <h2 className="font-display text-base font-black text-ink">Dasar</h2>
        <table className="mt-3 w-full text-left">
          <tbody>
            <Baris nama="Base URL" tipe="" ket={<code>/api/gw/v1</code>} />
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
      <div className="card mt-4 p-5">
        <h2 className="font-display text-base font-black text-ink">Batas &amp; biaya</h2>
        <table className="mt-3 w-full text-left">
          <tbody>
            <Baris nama="Nominal tagihan" tipe="" ket={`${rp(INVOICE_MIN)} sampai ${rp(INVOICE_MAX)}`} />
            <Baris nama="Biaya per tagihan" tipe="" ket={`${rp(BIAYA_QRIS)}, dipotong hanya kalau tagihannya DIBAYAR. Tagihan yang tidak dibayar tidak dikenai apa pun.`} />
            <Baris nama="Penarikan" tipe="" ket={`Minimal ${rp(WD_MIN)}, biaya ${rp(BIAYA_WD)} per penarikan.`} />
            <Baris nama="Konversi ke saldo Arta Pedia" tipe="" ket="Tanpa biaya." />
            <Baris nama="Batas permintaan" tipe="" ket="60 tagihan per menit per akun." />
          </tbody>
        </table>
      </div>

      {/* Buat tagihan */}
      <div className="card mt-4 p-5">
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-success px-2 py-0.5 text-[10px] font-black text-white">POST</span>
          <code className="text-sm font-bold text-ink">/api/gw/v1/invoice</code>
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

        <Blok judul="cURL" kode={`curl -X POST https://artapedia.id/api/gw/v1/invoice \\
  -H "X-API-Key: apk_KUNCI_KAMU" \\
  -H "Content-Type: application/json" \\
  -d '{"amount": 25000, "ref": "ORDER-123"}'`} />

        <Blok judul="Jawaban" kode={`{
  "success": true,
  "invoice_id": "INV-A1B2C3D4E5F6G7",
  "amount": 25000,
  "fee": ${BIAYA_QRIS},
  "net_amount": ${25000 - BIAYA_QRIS},
  "qr_string": "00020101021226...",
  "payment_url": "https://...",
  "status": "pending",
  "merchant_ref": "ORDER-123",
  "expired_at": "2026-09-24T10:30:00.000Z"
}`} />

        <p className="mt-3 text-[11px] leading-relaxed text-muted">
          <b>qr_string</b> adalah isi kode QRIS mentah. Ubah jadi gambar QR dengan pustaka QR apa pun di
          sisimu — jangan mengirim string ini ke layanan pembuat QR pihak ketiga, karena itu berarti
          membocorkan data pembayaran pembelimu ke pihak yang tidak perlu tahu.
        </p>
      </div>

      {/* Cek status */}
      <div className="card mt-4 p-5">
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-blue px-2 py-0.5 text-[10px] font-black text-white">GET</span>
          <code className="text-sm font-bold text-ink">/api/gw/v1/invoice/{"{invoice_id}"}</code>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          Cek status satu tagihan. Status yang mungkin: <code>pending</code>, <code>paid</code>,
          <code> expired</code>.
        </p>
        <Blok judul="cURL" kode={`curl https://artapedia.id/api/gw/v1/invoice/INV-A1B2C3D4E5F6G7 \\
  -H "X-API-Key: apk_KUNCI_KAMU"`} />
      </div>

      {/* Saldo */}
      <div className="card mt-4 p-5">
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-blue px-2 py-0.5 text-[10px] font-black text-white">GET</span>
          <code className="text-sm font-bold text-ink">/api/gw/v1/balance</code>
        </div>
        <Blok judul="Jawaban" kode={`{ "success": true, "balance": 1250000, "total_masuk": 4300000, "frozen": false }`} />
      </div>

      {/* Callback */}
      <div className="card mt-4 p-5">
        <h2 className="font-display text-base font-black text-ink">📡 Callback</h2>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          Saat tagihan dibayar, kami POST ke callback URL kamu dengan badan seperti di bawah.
        </p>
        <Blok judul="Yang kami kirim" kode={`{
  "invoice_id": "INV-A1B2C3D4E5F6G7",
  "status": "paid",
  "amount": 25000,
  "net_amount": ${25000 - BIAYA_QRIS},
  "merchant_ref": "ORDER-123"
}`} />
        <p className="mt-3 rounded-xl border-2 border-amber/40 bg-amber-soft px-3 py-2 text-[11px] leading-relaxed text-ink">
          ⚠️ <b>Jangan percaya isi callback begitu saja.</b> Alamat callback kamu terbuka di internet, dan
          siapa pun yang menebaknya bisa mengirim <code>{"{\"status\":\"paid\"}\""}</code> palsu ke sana.
          Selalu panggil balik <code>GET /api/gw/v1/invoice/{"{id}"}</code> untuk memastikan sebelum
          mengirim barang. Itu juga yang kami lakukan terhadap callback dari penyedia pembayaran kami.
        </p>
      </div>

      {/* Contoh kode */}
      <div className="card mt-4 p-5">
        <h2 className="font-display text-base font-black text-ink">Contoh lengkap</h2>

        <Blok bahasa="Node.js" judul="Node.js" kode={`const KEY = process.env.ARTAPEDIA_GW_KEY;

async function buatTagihan(nominal, ref) {
  const r = await fetch("https://artapedia.id/api/gw/v1/invoice", {
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
  const r = await fetch(\`https://artapedia.id/api/gw/v1/invoice/\${invoiceId}\`, {
    headers: { "X-API-Key": KEY }
  });
  const d = await r.json();
  return d.success && d.status === "paid";
}`} />

        <Blok bahasa="PHP" judul="PHP" kode={`<?php
$key = getenv('ARTAPEDIA_GW_KEY');

function buatTagihan($nominal, $ref) {
  global $key;
  $ch = curl_init('https://artapedia.id/api/gw/v1/invoice');
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
BASE = "https://artapedia.id/api/gw/v1"

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
      <div className="card mt-4 p-5">
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
  );
}
