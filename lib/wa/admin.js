// Jembatan tipis ke pengecekan admin, supaya modul chat tidak mengimpor
// adminAuth langsung (dan mudah diganti saat diuji).
import { adminSah } from "@/lib/adminAuth";

export async function adminSahWa(req) {
  try {
    return await adminSah(req);
  } catch {
    return false;
  }
}
