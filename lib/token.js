import crypto from "crypto";

// Kode akun unik untuk user tanpa sistem login/password.
// Formatnya sengaja dibuat mudah dibaca & disalin: AP-XXXX-XXXX-XXXX
export function generateUserToken() {
  const part = () => crypto.randomBytes(2).toString("hex").toUpperCase();
  return `AP-${part()}-${part()}-${part()}`;
}
