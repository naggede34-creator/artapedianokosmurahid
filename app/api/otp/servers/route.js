import { NextResponse } from "next/server";
import { rumahOtpConfigured } from "@/lib/rumahotp";
import { warungNokosConfigured } from "@/lib/warungnokos";
import { dibananaConfigured } from "@/lib/dibanana";
import { getSettings, serverDisplay } from "@/lib/settings";
import { OTP_SERVERS } from "@/lib/otpServers";

export const dynamic = "force-dynamic";

// Apakah kredensial providernya sudah terisi. Server tanpa kredensial tidak
// pernah bisa dipakai walaupun admin menyalakannya.
function providerReady(key) {
  if (key === "rumahotp") return rumahOtpConfigured();
  if (key === "dibanana") return dibananaConfigured();
  if (key.startsWith("warungnokos")) return warungNokosConfigured();
  return false;
}

// Daftar server beserta nama, label, dan keterangan yang diatur admin, plus
// status ketersediaannya. Halaman beli nokos memakai ini sebagai sumber utama
// supaya perubahan dari dashboard admin langsung terlihat tanpa deploy ulang.
export async function GET() {
  let settings = null;
  try {
    settings = await getSettings();
  } catch (err) {
    console.error("[otp/servers]", err?.message || err);
  }

  // Server yang dimatikan admin TIDAK ikut dikirim sama sekali — bukan dikirim
  // lalu disembunyikan di sisi peramban.
  //
  // Dua alasan. Pertama, yang disembunyikan dengan CSS tetap ada di respons
  // API dan tetap terbaca siapa pun yang membuka tab jaringan; daftar server
  // yang sengaja dimatikan bukan hal yang perlu diumumkan. Kedua, tombol
  // nonaktif berbaris di antara yang aktif membuat halaman terbaca seperti
  // toko yang setengah mati — padahal yang dijual memang cuma sisanya.
  //
  // Penyaringan di sini TIDAK menggantikan penolakan di rute order: siapa pun
  // bisa memanggil rute itu langsung dengan kunci server apa pun, dan yang
  // menahannya di sana, bukan daftar ini.
  const available = {};
  const items = [];
  for (const s of OTP_SERVERS) {
    const d = settings
      ? serverDisplay(settings, s.key)
      : { key: s.key, name: s.name, badge: s.badge, desc: s.desc, provider: s.provider, enabled: true, offlineMsg: "" };
    const siap = providerReady(s.key) && d.enabled;
    if (!siap) continue;
    available[s.key] = true;
    items.push({
      key: s.key,
      name: d.name,
      badge: d.badge,
      desc: d.desc,
      provider: d.provider || s.provider,
      available: true,
      offlineMsg: ""
    });
  }

  // Semua server dimatikan: halaman beli nokos perlu tahu bedanya antara
  // "daftarnya belum termuat" dan "memang tidak ada yang bisa dipakai".
  return NextResponse.json({ available, items, kosong: items.length === 0 });
}
