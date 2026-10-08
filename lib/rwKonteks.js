// Menentukan "web reseller mana" yang sedang dibuka pengunjung:
//   1. subdomain  — nama.domaininduk.com (butuh domain wildcard), atau
//   2. cookie `rw` — diset oleh /r/nama untuk domain tanpa wildcard.
// Tidak ada pengalihan: pengunjung tetap di host yang dibukanya.
import { rwDomainInduk, webBerlaku } from "@/lib/webReseller";
import { SLUG_RE } from "@/lib/webResellerUi";

export const COOKIE_RW = "rw";

function slugDariHost(host, induk) {
  const h = String(host || "").toLowerCase().split(":")[0];
  if (!induk || !h.endsWith(`.${induk}`)) return null;
  const label = h.slice(0, -(induk.length + 1));
  return label && !label.includes(".") && SLUG_RE.test(label) ? label : null;
}

/** getHeader(nama) dan getCookie(nama) → dokumen reseller_web yang berlaku, atau null. Tidak pernah melempar. */
export async function rwDari(getHeader, getCookie) {
  try {
    const induk = await rwDomainInduk();
    const host = getHeader("x-forwarded-host") || getHeader("host");
    let slug = slugDariHost(host, induk);
    if (!slug) {
      const c = String(getCookie(COOKIE_RW) || "").toLowerCase();
      if (SLUG_RE.test(c)) slug = c;
    }
    return slug ? await webBerlaku(slug) : null;
  } catch {
    return null;
  }
}

/** Untuk rute API: rwDariReq(req). */
export const rwDariReq = (req) => rwDari((n) => req.headers.get(n), (n) => req.cookies.get(n)?.value);

/** Untuk komponen server (layout, manifest): memakai next/headers. */
export async function rwDariNext() {
  try {
    const { headers, cookies } = await import("next/headers");
    const h = await headers();
    const c = await cookies();
    return await rwDari((n) => h.get(n), (n) => c.get(n)?.value);
  } catch {
    return null;
  }
}
