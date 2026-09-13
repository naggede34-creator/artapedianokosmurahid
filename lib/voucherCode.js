// Generator kode voucher pendek yang gampang diketik/dibagikan, mis: ARTA-7F2K9Q
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // tanpa 0/O/1/I biar tidak ambigu

export function generateVoucherCode(prefix = "ARTA") {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `${prefix}-${code}`;
}
