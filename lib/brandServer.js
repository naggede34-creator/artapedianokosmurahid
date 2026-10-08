import { getSettings } from "@/lib/settings";
import { brandDariSettings, rakitBrand } from "@/lib/brand";
import { ringkasLogo } from "@/lib/logo";
import { brandUntukWeb } from "@/lib/brand";
import { rwDariNext, rwDariReq } from "@/lib/rwKonteks";

/** Merek yang sedang aktif (dari dasbor admin). Tidak pernah melempar galat. */
export async function ambilBrand() {
  try {
    return brandDariSettings(await getSettings(), await ringkasLogo());
  } catch {
    return rakitBrand({});
  }
}

/** Merek untuk permintaan web saat ini: nama web reseller bila yang dibuka web reseller. Hanya di dalam permintaan (layout, manifest). */
export async function ambilBrandReq() {
  const utama = await ambilBrand();
  const web = await rwDariNext();
  return web ? brandUntukWeb(utama, web) : utama;
}

/** Sama, untuk rute API yang punya objek permintaan. */
export async function ambilBrandDariReq(req) {
  const utama = await ambilBrand();
  const web = await rwDariReq(req);
  return web ? brandUntukWeb(utama, web) : utama;
}
