// Auth admin sengaja sederhana: satu kode rahasia (lihat ADMIN_CODE di env,
// fallback "arta12123"), disimpan sebagai cookie httpOnly setelah login benar.
// Cukup untuk kebutuhan satu operator/pemilik toko, bukan multi-role admin.

export const ADMIN_COOKIE = "artapedia_admin";
export const ADMIN_COOKIE_VALUE = "granted";

export function getAdminCode() {
  return process.env.ADMIN_CODE || "arta12123";
}

// Dipakai di route handler (app/api/admin/**): return true/false.
export function isAdminRequest(req) {
  return req.cookies.get(ADMIN_COOKIE)?.value === ADMIN_COOKIE_VALUE;
}
