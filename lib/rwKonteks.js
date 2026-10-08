// Menentukan "web reseller mana" yang sedang dibuka pengunjung:
//   1. subdomain — nama.domaininduk.com (butuh domain wildcard). Tidak lengket: hanya host itu yang jadi web reseller.
//   2. header `x-rw` — dikirim peramban dari SESSIONSTORAGE tab itu saja (diisi oleh /r/nama). Per tab, jadi tab/jendela
//      lain yang membuka web utama TIDAK ikut berubah (dulu memakai cookie yang menempel ke seluruh domain).
// Tidak ada pengalihan: pengunjung tetap di host yang dibukanya.
import { rwDomainInduk, webBerlaku } from "@/lib/webReseller";
import { SLUG_RE } from "@/lib/webResellerUi";

export const KUNCI_RW = "artapedia_rw"; // kunci sessionStorage di peramban

function slugDariHost(host, induk) {
  const h = String(host || "").toLowerCase().split(":")[0];
  if (!induk || !h.endsWith(`.${induk}`)) return null;
  const label = h.slice(0, -(induk.length + 1));
  return label && !label.includes(".") && SLUG_RE.test(label) ? label : null;
}

/** getHeader(nama) → dokumen reseller_web yang berlaku, atau null. Tidak pernah melempar. */
export async function rwDari(getHeader) {
  try {
    const induk = await rwDomainInduk();
    let slug = slugDariHost(getHeader("x-forwarded-host") || getHeader("host"), induk);
    if (!slug) {
      const h = String(getHeader("x-rw") || "").toLowerCase();
      if (SLUG_RE.test(h)) slug = h;
    }
    return slug ? await webBerlaku(slug) : null;
  } catch {
    return null;
  }
}

/** Untuk rute API: rwDariReq(req). */
export const rwDariReq = (req) => rwDari((n) => req.headers.get(n));

/** Untuk komponen server (layout, manifest): memakai next/headers. */
export async function rwDariNext() {
  try {
    const { headers } = await import("next/headers");
    const h = await headers();
    return await rwDari((n) => h.get(n));
  } catch {
    return null;
  }
}
