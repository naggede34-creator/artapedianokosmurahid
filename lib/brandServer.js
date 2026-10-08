import { getSettings } from "@/lib/settings";
import { brandDariSettings, rakitBrand } from "@/lib/brand";

/** Merek yang sedang aktif (dari dasbor admin). Tidak pernah melempar galat. */
export async function ambilBrand() {
  try {
    return brandDariSettings(await getSettings());
  } catch {
    return rakitBrand({});
  }
}
