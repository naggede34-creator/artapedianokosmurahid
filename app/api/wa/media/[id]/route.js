import { ambilMedia } from "@/lib/wa/inti";

export const dynamic = "force-dynamic";

// Gambar & catatan suara. Id-nya acak 128-bit (kapabilitas): hanya yang
// menerima pesannya yang tahu. Isinya tidak berubah, jadi boleh di-cache.
export async function GET(req, { params }) {
  const m = await ambilMedia((await params).id);
  if (!m) return new Response(null, { status: 404 });
  // Dokumen selalu diunduh (tidak dibuka di dalam situs); nama berkas dari ?n= dibersihkan.
  const dokumen = !/^(image|audio)\//.test(m.mime);
  const nama = (new URL(req.url).searchParams.get("n") || "dokumen").replace(/[^\w.\- ()]/g, "_").slice(0, 80) || "dokumen";
  return new Response(m.data, {
    headers: {
      ...(dokumen ? { "Content-Disposition": `attachment; filename="${nama}"`, "X-Content-Type-Options": "nosniff" } : {}),
      "Content-Type": m.mime,
      "Cache-Control": "private, max-age=31536000, immutable",
      "Content-Security-Policy": "default-src 'none'; sandbox"
    }
  });
}
