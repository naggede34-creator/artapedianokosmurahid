// Enkripsi rahasia konfigurasi (AES-256-GCM). Dipisah dari lib/config.js supaya
// lib/db.js bisa memakainya tanpa impor melingkar (config → db → config).
//
// Kuncinya diturunkan dari MONGODB_URI di ENVIRONMENT (alamat database
// "bootstrap"), yang tidak pernah disimpan di database. Dump database yang
// bocor tidak membawa kuncinya.
import crypto from "node:crypto";

function kunci() {
  return crypto.createHash("sha256").update(`artapedia-konfig:${process.env.MONGODB_URI || ""}`).digest();
}

export function sandi(teks) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", kunci(), iv);
  const isi = Buffer.concat([c.update(String(teks), "utf8"), c.final()]);
  return "enc:v1:" + Buffer.concat([iv, c.getAuthTag(), isi]).toString("base64");
}

/** null kalau tidak terbaca (kunci berganti / data rusak) — bukan melempar. */
export function bukaSandi(nilai) {
  if (typeof nilai !== "string" || !nilai.startsWith("enc:v1:")) return nilai;
  try {
    const b = Buffer.from(nilai.slice(7), "base64");
    const d = crypto.createDecipheriv("aes-256-gcm", kunci(), b.subarray(0, 12));
    d.setAuthTag(b.subarray(12, 28));
    return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}
