// Ikon platform sosmed sederhana: inisial di atas warna khas platform.
// Sengaja tidak memakai logo resmi (hak merek milik masing-masing platform).
const COLORS = {
  instagram: ["#E1306C", "#fff"],
  tiktok: ["#111111", "#fff"],
  youtube: ["#E62117", "#fff"],
  facebook: ["#1877F2", "#fff"],
  telegram: ["#229ED9", "#fff"],
  twitter: ["#0F1419", "#fff"],
  x: ["#0F1419", "#fff"],
  spotify: ["#1DB954", "#0b1d12"],
  shopee: ["#EE4D2D", "#fff"],
  threads: ["#101010", "#fff"],
  twitch: ["#9146FF", "#fff"],
  discord: ["#5865F2", "#fff"],
  whatsapp: ["#25D366", "#06301a"],
  linkedin: ["#0A66C2", "#fff"],
  soundcloud: ["#FF5500", "#fff"],
  google: ["#4285F4", "#fff"],
  website: ["#475569", "#fff"]
};

export function platformColor(name = "") {
  const key = String(name).toLowerCase().split(/[\s/]+/)[0];
  return COLORS[key] || ["#1D5BFF", "#fff"];
}

export function platformIcon(name = "", size = 36) {
  const [bg, fg] = platformColor(name);
  const initial = String(name || "?").trim().charAt(0).toUpperCase();
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-xl font-extrabold"
      style={{ width: size, height: size, background: bg, color: fg, fontSize: size * 0.42 }}
    >
      {initial}
    </span>
  );
}
