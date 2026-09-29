import { ambilMedia } from "@/lib/wa/inti";

export const dynamic = "force-dynamic";

// Foto profil / grup. Diberi ?v=<versi>, jadi aman di-cache "selamanya":
// mengganti foto mengubah versinya dan URL-nya.
export async function GET(req, { params }) {
  const id = String(params.id || "");
  const kunci = id === "umum" ? "foto:umum" : id.startsWith("g_") ? `foto:${id.slice(2)}` : `foto:${id}`;
  let m = await ambilMedia(kunci);
  if (!m && id === "umum") {
    // Foto Grup Umum mengikuti pengaturan admin lama (data URL di chat_group_settings).
    const { getChatSettings } = await import("@/lib/chatSettings");
    const set = await getChatSettings();
    const mm = /^data:(image\/[\w+.-]+);base64,(.+)$/.exec(set.photo || "");
    if (mm) m = { mime: mm[1], data: Buffer.from(mm[2], "base64") };
  }
  if (!m) return new Response(null, { status: 404 });
  const berversi = new URL(req.url).searchParams.has("v");
  return new Response(m.data, {
    headers: {
      "Content-Type": m.mime,
      "Cache-Control": berversi ? "public, max-age=31536000, immutable" : "public, max-age=60",
      "Content-Security-Policy": "default-src 'none'; sandbox"
    }
  });
}
