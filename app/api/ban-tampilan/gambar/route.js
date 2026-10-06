import { gambarBan } from "@/lib/tampilanBan";

// Tanpa `dynamic = "force-dynamic"`: di Next 15 itu menimpa Cache-Control buatan sendiri jadi "no-store". GET handler memang tidak di-cache bawaan.

// GET ?k=gambar|gambarLatar&v=<versi> — gambar tampilan ban (versi di URL → boleh di-cache lama).
export async function GET(req) {
  const k = new URL(req.url).searchParams.get("k");
  const g = await gambarBan(k).catch(() => null);
  if (!g) return new Response("Not found", { status: 404 });
  return new Response(g.buffer, { headers: { "Content-Type": g.tipe, "Cache-Control": "public, max-age=86400, immutable", "X-Content-Type-Options": "nosniff" } });
}
