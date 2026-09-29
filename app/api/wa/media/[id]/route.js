import { ambilMedia } from "@/lib/wa/inti";

export const dynamic = "force-dynamic";

// Gambar & catatan suara. Id-nya acak 128-bit (kapabilitas): hanya yang
// menerima pesannya yang tahu. Isinya tidak berubah, jadi boleh di-cache.
export async function GET(req, { params }) {
  const m = await ambilMedia(params.id);
  if (!m) return new Response(null, { status: 404 });
  return new Response(m.data, {
    headers: {
      "Content-Type": m.mime,
      "Cache-Control": "private, max-age=31536000, immutable",
      "Content-Security-Policy": "default-src 'none'; sandbox"
    }
  });
}
