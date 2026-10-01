import { NextResponse } from "next/server";
import { askCsAi } from "@/lib/neoxr";
import { rateLimit } from "@/lib/rateLimit";
import { PENGETAHUAN } from "@/lib/wa/asisten";
import { RINGKAS_MENU, sarankanTautan, jawabCadangan } from "@/lib/navigasiAi";

export const dynamic = "force-dynamic";

const PROMPT_SISTEM = `${PENGETAHUAN}

Fitur terbaru: Event musiman otomatis (tanggal kembar, gajian, Ramadan, Lebaran, Natal, 17 Agustus) dengan diskon & cashback; Season Arena Pendekar (peringkat musim, turnamen mingguan, hadiah ke Saldo Game); Klan/tim (grup chat, misi mingguan, papan peringkat); 7 gaya tampilan (Komik 3D bawaan, Liquid, Glass, Neon, Clay, Bersih, Retro) dan skin kostum maskot (dibeli pakai poin toko); kartu kemenangan yang bisa dibagikan.

Namamu "WEARTA AI". Kamu juga bertugas MENGARAHKAN ke menu yang tepat. Daftar menu situs (sebut nama menunya di jawaban, tautan tombolnya ditampilkan otomatis):
${RINGKAS_MENU}

Aturan: Jawab Bahasa Indonesia, ramah, singkat (maks ±5 kalimat). JANGAN meminta atau menerima kode akun, OTP, kata sandi, atau data sensitif. Jangan mengarang kebijakan/harga; bila tak yakin, arahkan ke menu terkait atau Customer Service. Untuk cek data akun spesifik (saldo/pesanan tertentu) kamu tidak punya akses: arahkan ke Riwayat/Mutasi atau CS.`;

function ipDari(req) {
  return (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || req.headers.get("x-real-ip") || "ip";
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const message = String(body.message || "").trim();
    const halaman = String(body.halaman || "").slice(0, 80);
    const history = Array.isArray(body.history) ? body.history.slice(-6) : [];

    if (!message) return NextResponse.json({ error: "Pesan tidak boleh kosong." }, { status: 400 });
    if (message.length > 800) return NextResponse.json({ error: "Pesan terlalu panjang, coba persingkat." }, { status: 400 });
    if (!rateLimit(`cs:${ipDari(req)}`, 20, 60_000)) return NextResponse.json({ error: "Terlalu cepat. Tunggu sebentar ya." }, { status: 429 });

    const tautan = sarankanTautan(message, 3);
    const transcript = history
      .filter((h) => h && typeof h.content === "string")
      .map((h) => `${h.role === "user" ? "User" : "WEARTA AI"}: ${String(h.content).slice(0, 600)}`)
      .join("\n");
    const prompt = `${PROMPT_SISTEM}\n\n${halaman ? `(Pengguna sedang membuka halaman ${halaman})\n` : ""}${transcript ? transcript + "\n" : ""}User: ${message}\nWEARTA AI:`;

    let reply;
    try {
      reply = String(await askCsAi(prompt) || "").replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim().slice(0, 1200);
    } catch (err) {
      console.error("[cs] model AI gagal:", err?.response?.data || err.message || err);
    }
    // Model sibuk/kosong → jawaban cadangan dari panduan bawaan, tetap membantu & tetap ada tautan menu.
    const dariAi = !!reply;
    if (!reply) reply = jawabCadangan(message);
    return NextResponse.json({ reply, tautan, dariAi });
  } catch (err) {
    console.error("[cs] error:", err?.message || err);
    return NextResponse.json({ error: "WEARTA AI sedang sibuk, coba lagi sebentar lagi." }, { status: 502 });
  }
}
