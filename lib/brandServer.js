import { getSettings } from "@/lib/settings";
import { brandDariSettings, rakitBrand } from "@/lib/brand";
import { ringkasLogo } from "@/lib/logo";

/** Merek yang sedang aktif (dari dasbor admin). Tidak pernah melempar galat. */
export async function ambilBrand() {
  try {
    return brandDariSettings(await getSettings(), await ringkasLogo());
  } catch {
    return rakitBrand({});
  }
}
