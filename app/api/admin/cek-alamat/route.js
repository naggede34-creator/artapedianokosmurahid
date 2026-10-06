// Tombol "Cek alamat" di Pengaturan Umum → Alamat API.
//
// Mengubah Base URL di dokumentasi tidak otomatis membuat alamat itu hidup:
// domainnya harus sudah diarahkan (DNS) ke deployment ini. Rute ini yang
// membuktikannya. Servernya sendiri menghubungi alamat itu TANPA API key dan
// memeriksa jawabannya:
//
//   api      → GET {base}/api/v1/me          harus 401 "API key required..."
//   gateway  → GET {base}/api/gw/v1/balance  harus 401 { success:false }
//
// 401 dengan bentuk jawaban itu hanya bisa datang dari web ini, jadi alamatnya
// pasti benar. Jawaban lain (404, HTML, redirect) dijelaskan apa artinya dan
// apa yang harus diperbaiki, bukan cuma "gagal".
import { NextResponse } from "next/server";
import { adminSah } from "@/lib/adminAuth";
import { normalkanBase } from "@/lib/webhookBase";

export const dynamic = "force-dynamic";

const UJI = {
  api: { path: "/api/v1/me", cocok: (j) => /api key/i.test(String(j?.error || "")) },
  gateway: { path: "/api/gw/v1/balance", cocok: (j) => j?.success === false && /api key/i.test(String(j?.error || "")) }
};

export async function POST(req) {
  if (!(await adminSah(req))) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const uji = UJI[body?.jenis];
  if (!uji) return NextResponse.json({ error: "Jenis alamat tidak dikenal." }, { status: 400 });

  const base = normalkanBase(body?.url);
  if (!base) {
    return NextResponse.json({
      ok: false,
      pesan:
        "Alamat tidak bisa dipakai. Tulis domainnya saja, diawali https://, contoh https://api.tokomu.com " +
        "(tanpa localhost, tanpa alamat IP, tanpa path di belakangnya)."
    });
  }

  const target = `${base}${uji.path}`;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 8000);
  try {
    // redirect:"manual": domain yang mengalihkan ke domain lain akan merusak
    // permintaan POST milik developer (browser/klien mengubahnya jadi GET).
    // Alihan harus ketahuan di sini, bukan setelah ada yang gagal integrasi.
    const r = await fetch(target, { method: "GET", cache: "no-store", redirect: "manual", signal: ac.signal, headers: { Accept: "application/json" } });

    if (r.status >= 300 && r.status < 400) {
      const tujuan = r.headers.get("location") || "(tidak disebut)";
      return NextResponse.json({
        ok: false,
        base,
        pesan:
          `Alamat ini mengalihkan (redirect) ke ${tujuan}. Developer yang memanggil POST akan gagal karena alihan mengubah POST menjadi GET. ` +
          `Pakai alamat tujuan alihan itu langsung, atau matikan alihan di pengaturan domain.`
      });
    }

    const teks = await r.text();
    let j = null;
    try { j = JSON.parse(teks); } catch {}

    if (r.status === 401 && uji.cocok(j)) {
      return NextResponse.json({
        ok: true,
        base,
        pesan: `Alamat bisa dipakai ✓ — ${base} terhubung ke web ini. Developer boleh memakainya sebagai Base URL.`
      });
    }
    if (r.status === 404 || !j) {
      return NextResponse.json({
        ok: false,
        base,
        pesan:
          `Alamat terjangkau (HTTP ${r.status}) tapi BUKAN web ini — jawabannya bukan dari API Arta Pedia. ` +
          `Biasanya domainnya belum ditambahkan di hosting (Vercel → Settings → Domains) atau DNS-nya masih mengarah ke tempat lain.`
      });
    }
    return NextResponse.json({
      ok: false,
      base,
      pesan: `Jawaban tidak terduga (HTTP ${r.status}). Pastikan alamat ini benar-benar domain web ini, lalu coba lagi.`
    });
  } catch (e) {
    const timeout = e?.name === "AbortError";
    return NextResponse.json({
      ok: false,
      base,
      pesan: timeout
        ? "Alamat tidak menjawab dalam 8 detik. Cek apakah domainnya aktif dan SSL-nya sudah terpasang."
        : "Alamat tidak bisa dihubungi. Biasanya domain salah ketik, DNS belum menyebar (tunggu beberapa menit), atau SSL belum aktif."
    });
  } finally {
    clearTimeout(timer);
  }
}
