// Rich Message Telegram (Bot API 10.1+: sendRichMessage).
//
// Format masukan = JSON blok yang sama dengan tutorial "JSON → Rich Message":
//
//   [{"h1":"Judul"}, {"p":["Harga: ",{"b":"Rp 25.000"}]}, {"buttons":[[{...}]]}]
//
// Satu daftar blok dirender ke DUA bentuk:
//   html    → dikirim lewat sendRichMessage (tabel, heading, details, gambar…)
//   klasik  → teks HTML biasa untuk sendMessage
//
// KLASIK ITU BUKAN HIASAN. Rich message baru ada sejak Juni 2026 dan saya tidak
// bisa menguji ke server Telegram dari sini. Kalau sendRichMessage ditolak —
// klien lama, metode belum aktif di bot, atau markup yang tidak diterima —
// pesan tetap sampai dalam bentuk klasik. Pembeli yang tidak menerima OTP
// karena pesannya "terlalu modern" adalah kegagalan yang tidak bisa diterima.
//
// Semua teks dari luar di-escape; URL dibatasi skemanya. Isi pesan bot berisi
// nama, username, dan catatan yang diketik orang lain.

const SKEMA_AMAN = /^(https?:\/\/|tg:\/\/|mailto:|tel:|#)/i;

export function esc(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const escAttr = (v) => esc(v).replace(/"/g, "&quot;");

/** URL yang skemanya tidak dikenal dibuang (javascript:, data:, dll.). */
function urlAman(u) {
  const s = String(u ?? "").trim();
  return SKEMA_AMAN.test(s) ? s : "";
}

// ─────────────────────────── INLINE ───────────────────────────
// text = string | array | objek inline. Menghasilkan { html, klasik }.

const INLINE_TAG = {
  b: ["b", "b"],
  i: ["i", "i"],
  u: ["u", "u"],
  s: ["s", "s"],
  mark: ["mark", "b"], // klasik tidak punya highlight → tebal
  spoiler: ["tg-spoiler", "tg-spoiler"],
  code: ["code", "code"],
  sub: ["sub", null],
  sup: ["sup", null]
};

function inline(t) {
  if (t === null || t === undefined || t === false) return { html: "", klasik: "" };
  if (typeof t === "string" || typeof t === "number") {
    const e = esc(t);
    return { html: e, klasik: e };
  }
  if (Array.isArray(t)) {
    const bagian = t.map(inline);
    return { html: bagian.map((x) => x.html).join(""), klasik: bagian.map((x) => x.klasik).join("") };
  }
  if (typeof t !== "object") return { html: "", klasik: "" };

  if (t.br) return { html: "<br/>", klasik: "\n" };

  // Potongan HTML yang SUDAH aman dari pemanggil tepercaya (pembuat pesan kita
  // sendiri, yang meng-escape isinya). Jangan pernah diisi dari teks pengguna.
  if (typeof t.h === "string") return { html: t.h, klasik: t.h };

  for (const [kunci, [tagRich, tagKlasik]] of Object.entries(INLINE_TAG)) {
    if (kunci in t) {
      const d = inline(t[kunci]);
      return {
        html: `<${tagRich}>${d.html}</${tagRich}>`,
        klasik: tagKlasik ? `<${tagKlasik}>${d.klasik}</${tagKlasik}>` : d.klasik
      };
    }
  }
  if (t.a) {
    const url = urlAman(t.a.url);
    const d = inline(t.a.text ?? t.a.url);
    if (!url) return d;
    return { html: `<a href="${escAttr(url)}">${d.html}</a>`, klasik: url.startsWith("#") ? d.klasik : `<a href="${escAttr(url)}">${d.klasik}</a>` };
  }
  const em = t.emoji || t["tg-emoji"];
  if (em) {
    const id = String(em.id || "").replace(/\D/g, "");
    const ch = esc(em.char || "⭐");
    if (!id) return { html: ch, klasik: ch };
    const tag = `<tg-emoji emoji-id="${id}">${ch}</tg-emoji>`;
    return { html: tag, klasik: tag };
  }
  return { html: "", klasik: "" };
}

const potong = (v, n) => String(v ?? "").slice(0, n);

// ─────────────────────────── BLOK ───────────────────────────
// Tiap blok → { html, klasik, tombol?: [[...]] }

const GARIS_H = { 1: "━━━━━━━━━━━━━━━━━━━━", 2: "──────────────────", 3: "" };

function tabel({ headers = [], rows = [] }) {
  const kepala = headers.map((h) => inline(h));
  const isi = rows.map((r) => r.map((c) => inline(c)));

  const html =
    `<table bordered striped>` +
    (kepala.length ? `<tr>${kepala.map((h) => `<th>${h.html}</th>`).join("")}</tr>` : "") +
    isi.map((r) => `<tr>${r.map((c) => `<td>${c.html}</td>`).join("")}</tr>`).join("") +
    `</table>`;

  // Klasik: kolom rata dalam <pre>. Lebar dihitung dari teks POLOS, bukan dari
  // html — tag dan entity tidak boleh ikut memanjangkan kolom.
  const teksPolos = (v) => bersihkanTag(inline(v).klasik);
  const baris = [headers.map(teksPolos), ...rows.map((r) => r.map(teksPolos))];
  const lebar = [];
  for (const b of baris) b.forEach((c, i) => { lebar[i] = Math.max(lebar[i] || 0, [...c].length); });
  const format = (b) => b.map((c, i) => c + " ".repeat(Math.max(0, lebar[i] - [...c].length))).join(" │ ").trimEnd();
  const garis = lebar.map((w) => "─".repeat(w)).join("─┼─");
  const klasik =
    "<pre>" +
    esc(headers.length ? [format(baris[0]), garis, ...baris.slice(1).map(format)].join("\n") : baris.map(format).join("\n")) +
    "</pre>";
  return { html, klasik };
}

/** Membuang tag dan mengembalikan entity jadi teks polos (untuk mengukur lebar). */
function bersihkanTag(s) {
  return String(s)
    .replace(/<[^>]*>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function blokSatu(b) {
  if (!b || typeof b !== "object") return null;
  const kunci = Object.keys(b).find((k) => k !== "align");
  if (!kunci) return null;
  const v = b[kunci];

  // heading
  const h = /^h([1-6])$/.exec(kunci);
  if (h) {
    const n = Number(h[1]);
    const d = inline(v);
    const garis = GARIS_H[n];
    return {
      html: `<h${n}>${d.html}</h${n}>`,
      klasik: n <= 2 ? `<b>${d.klasik}</b>\n${garis}\n` : `<b>${d.klasik}</b>\n`
    };
  }

  switch (kunci) {
    case "p": {
      const d = Array.isArray(v) && v.every((x) => typeof x === "string") ? { html: v.map(esc).join("<br/>"), klasik: v.map(esc).join("\n") } : inline(v);
      return { html: `<p>${d.html}</p>`, klasik: `${d.klasik}\n` };
    }
    case "b": case "i": case "u": case "s": case "mark": case "spoiler": case "sub": case "sup": {
      const d = inline({ [kunci]: v });
      return { html: `<p>${d.html}</p>`, klasik: `${d.klasik}\n` };
    }
    case "code": {
      const d = inline({ code: v });
      return { html: `<p>${d.html}</p>`, klasik: `${d.klasik}\n` };
    }
    case "br":
      return { html: "<br/>", klasik: "\n" };
    case "hr":
    case "divider":
      return { html: "<hr/>", klasik: "──────────────────\n" };
    case "footer": {
      const d = inline(v);
      return { html: `<footer>${d.html}</footer>`, klasik: `<i>${d.klasik}</i>\n` };
    }
    case "a": {
      const d = inline({ a: v });
      return { html: `<p>${d.html}</p>`, klasik: `${d.klasik}\n` };
    }
    case "blockquote":
    case "aside": {
      const d = inline(v?.text ?? v);
      const cite = v?.cite ? inline(v.cite) : null;
      const tag = kunci === "aside" ? "aside" : "blockquote";
      return {
        html: `<${tag}>${d.html}${cite ? `<cite>${cite.html}</cite>` : ""}</${tag}>`,
        klasik: `<blockquote>${d.klasik}${cite ? `\n— ${cite.klasik}` : ""}</blockquote>\n`
      };
    }
    case "ul":
    case "ol": {
      const isi = (Array.isArray(v) ? v : []).map(inline);
      return {
        html: `<${kunci}>${isi.map((x) => `<li>${x.html}</li>`).join("")}</${kunci}>`,
        klasik: isi.map((x, i) => `${kunci === "ol" ? `${i + 1}.` : "•"} ${x.klasik}`).join("\n") + "\n"
      };
    }
    case "checkbox": {
      // html rich tidak punya tag kotak centang; simbolnya yang dipakai.
      const isi = (Array.isArray(v) ? v : []).map((x) => ({ ok: !!x?.checked, d: inline(x?.text) }));
      const baris = isi.map((x) => `${x.ok ? "☑" : "☐"} ${x.d.html}`);
      return {
        html: baris.map((r) => `<p>${r}</p>`).join(""),
        klasik: isi.map((x) => `${x.ok ? "☑" : "☐"} ${x.d.klasik}`).join("\n") + "\n"
      };
    }
    case "table":
      return tabel(v || {});
    case "pre": {
      const lang = String(v?.lang || "").replace(/[^\w+-]/g, "");
      const isi = esc(v?.text ?? v);
      return {
        html: `<pre><code${lang ? ` class="language-${lang}"` : ""}>${isi}</code></pre>`,
        klasik: `<pre>${isi}</pre>\n`
      };
    }
    case "math": {
      const isi = esc(v?.expression ?? v);
      return { html: `<tg-math-block>${isi}</tg-math-block>`, klasik: `<code>${isi}</code>\n` };
    }
    case "details": {
      const ringkas = inline(v?.summary);
      const isi = String(v?.content ?? "").split("\n").filter(Boolean).map(esc);
      return {
        html: `<details${v?.open ? " open" : ""}><summary>${ringkas.html}</summary>${isi.map((x) => `<p>${x}</p>`).join("")}</details>`,
        klasik: `<blockquote expandable><b>${ringkas.klasik}</b>\n${isi.join("\n")}</blockquote>\n`
      };
    }
    case "img": case "image": case "photo":
    case "figure": {
      const src = urlAman(v?.src);
      if (!src) return null;
      const cap = v?.caption ? inline(v.caption) : null;
      const kredit = v?.credit ? inline(v.credit) : null;
      const captionHtml = cap || kredit ? `<figcaption>${cap ? cap.html : ""}${kredit ? `<cite>${kredit.html}</cite>` : ""}</figcaption>` : "";
      return {
        html: `<figure><img src="${escAttr(src)}"/>${captionHtml}</figure>`,
        klasik: `🖼 <a href="${escAttr(src)}">${cap ? cap.klasik : "Gambar"}</a>\n`
      };
    }
    case "video": case "audio": {
      const src = urlAman(v?.src);
      if (!src) return null;
      const cap = v?.caption ? inline(v.caption) : null;
      return {
        html: `<figure><${kunci} src="${escAttr(src)}"></${kunci}>${cap ? `<figcaption>${cap.html}</figcaption>` : ""}</figure>`,
        klasik: `${kunci === "video" ? "🎬" : "🎧"} <a href="${escAttr(src)}">${cap ? cap.klasik : kunci === "video" ? "Video" : "Audio"}</a>\n`
      };
    }
    case "collage": case "slideshow": {
      const items = (v?.items || []).map(urlAman).filter(Boolean).slice(0, 10);
      if (!items.length) return null;
      const tag = kunci === "collage" ? "tg-collage" : "tg-slideshow";
      return {
        html: `<${tag}>${items.map((s) => `<img src="${escAttr(s)}"/>`).join("")}</${tag}>`,
        klasik: `🖼 ${items.length} gambar\n`
      };
    }
    case "map": {
      const lat = Number(v?.lat), lon = Number(v?.long);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
      const zoom = Math.min(24, Math.max(0, Math.round(Number(v?.zoom) || 14)));
      return {
        html: `<tg-map lat="${lat}" long="${lon}" zoom="${zoom}"/>`,
        klasik: `📍 <a href="https://maps.google.com/?q=${lat},${lon}">Lihat peta</a>\n`
      };
    }
    case "reference": {
      const nama = String(v?.name || "").replace(/[^\w-]/g, "");
      const d = inline(v?.text);
      return { html: `<p><a name="${nama}"></a>${d.html}</p>`, klasik: `${d.klasik}\n` };
    }
    case "emoji": case "tg-emoji": {
      const d = inline({ [kunci]: v });
      return { html: `<p>${d.html}</p>`, klasik: `${d.klasik}\n` };
    }
    case "raw": {
      const mentah = String(v ?? "").slice(0, 8000);
      // Klasik: paragraf jadi baris baru, tag lain yang tidak dikenal dibuang.
      const klasik = mentah
        .replace(/<\/(p|h[1-6]|div|li|tr)>/gi, "\n")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<(?!\/?(b|i|u|s|code|pre|a|tg-spoiler|tg-emoji)\b)[^>]*>/gi, "");
      return { html: mentah, klasik: klasik + "\n" };
    }
    case "buttons": {
      // Tombol dipisah dari isi: dikirim sebagai reply_markup, bukan blok.
      const baris = (Array.isArray(v) ? v : []).map(barisTombol).filter((r) => r.length);
      return baris.length ? { html: "", klasik: "", tombol: baris } : null;
    }
    default:
      return null;
  }
}

const STYLE_TOMBOL = new Set(["primary", "success", "danger"]);

/** Satu baris tombol dari DSL → baris inline_keyboard Telegram. */
function barisTombol(baris) {
  return (Array.isArray(baris) ? baris : [])
    .slice(0, 8)
    .map((t) => {
      const teks = potong(t?.text, 64);
      if (!teks) return null;
      const out = { text: teks };
      if (t.url) {
        const u = urlAman(t.url);
        if (!u || u.startsWith("#")) return null;
        out.url = u;
      } else if (t.copy_text) {
        out.copy_text = { text: potong(t.copy_text, 256) };
      } else if (t.callback_data) {
        out.callback_data = potong(t.callback_data, 64);
      } else return null;
      if (STYLE_TOMBOL.has(t.style)) out.style = t.style;
      return out;
    })
    .filter(Boolean);
}

// ─────────────────────────── PUBLIK ───────────────────────────

/**
 * Bungkus daftar blok jadi pesan rich.
 *
 * Objek yang dikembalikan boleh dipakai di mana pun sebuah STRING diharapkan:
 * toString() mengembalikan bentuk klasik. Jadi kode lama yang menggabungkan,
 * memotong, atau mengirimnya lewat sendMessage tetap jalan tanpa diubah.
 */
export function rich(blocks, { keyboard = null, klasik: klasikPaksa = null } = {}) {
  const daftar = (Array.isArray(blocks) ? blocks : [blocks]).map(blokSatu).filter(Boolean);
  const tombol = [...daftar.flatMap((d) => d.tombol || []), ...(keyboard || [])];
  const html = daftar.map((d) => d.html).join("");
  // klasikPaksa: pemanggil yang sudah punya bentuk klasiknya sendiri (mis. kartu
  // notifikasi lama) menyerahkannya di sini, supaya fallback PERSIS seperti
  // sebelum ada rich — bukan hasil terjemahan yang bisa sedikit berbeda.
  const klasik = klasikPaksa ?? daftar.map((d) => d.klasik).join("").replace(/\n{3,}/g, "\n\n").trim();
  return {
    __rich: true,
    html,
    klasik,
    tombol,
    toString() {
      return klasik;
    },
    // Panjang ikut bentuk klasik: pemanggil lama yang memeriksa .length atau
    // .slice() pada "teks" tidak boleh menemukan objek tanpa panjang.
    get length() {
      return klasik.length;
    }
  };
}

export const adalahRich = (x) => !!x && typeof x === "object" && x.__rich === true;

/** Teks klasik dari apa pun (string biasa maupun pesan rich). */
export const keKlasik = (x) => (adalahRich(x) ? x.klasik : String(x ?? ""));

// ─────────────────────────── PENGIRIMAN ───────────────────────────

// Pemutus sirkuit. Kalau sendRichMessage berkali-kali ditolak, mencobanya di
// setiap pesan hanya menambah satu perjalanan gagal ke Telegram sebelum
// tampil klasik. Jeda singkat lalu dicoba lagi (bisa jadi cuma gangguan).
const BATAS_GAGAL_BERUNTUN = 4;
const JEDA_MATI_MS = 10 * 60_000;
let gagalBeruntun = 0;
let matiSampai = 0;

export function statusRich() {
  return { gagalBeruntun, matiSampai, mati: Date.now() < matiSampai };
}
export function setelUlangRich() {
  gagalBeruntun = 0;
  matiSampai = 0;
}

function catatGagal(deskripsi) {
  // Metode memang belum dikenal server → langsung mati, tidak menunggu 4 kali.
  if (/method not found|unknown method|not implemented|not found/i.test(deskripsi || "")) {
    matiSampai = Date.now() + JEDA_MATI_MS;
    gagalBeruntun = 0;
    return;
  }
  gagalBeruntun += 1;
  if (gagalBeruntun >= BATAS_GAGAL_BERUNTUN) {
    matiSampai = Date.now() + JEDA_MATI_MS;
    gagalBeruntun = 0;
  }
}

/**
 * Mengirim pesan rich; kalau ditolak, kirim klasik.
 *
 * @param panggil  async (metode, badan) → respons Telegram { ok, ... } atau null
 * @param aktif    false = langsung klasik (saklar admin RICH_MESSAGE=0)
 * @returns respons Telegram dari yang berhasil terkirim
 */
export async function kirimRich(panggil, { chatId, pesan, keyboard, aktif = true, ekstra = {} }) {
  const papan = mergeKeyboard(pesan, keyboard);
  const klasik = () =>
    panggil("sendMessage", {
      chat_id: chatId,
      text: keKlasik(pesan),
      parse_mode: "HTML",
      disable_web_page_preview: true,
      ...ekstra,
      ...(papan.length ? { reply_markup: { inline_keyboard: papan } } : {})
    });

  if (!adalahRich(pesan) || !aktif || Date.now() < matiSampai || !pesan.html) return klasik();

  const r = await panggil("sendRichMessage", {
    chat_id: chatId,
    rich_message: { html: pesan.html },
    ...ekstra,
    ...(papan.length ? { reply_markup: { inline_keyboard: papan } } : {})
  });
  if (r?.ok) {
    gagalBeruntun = 0;
    return r;
  }
  // r === null = jaringan/waktu habis. Hasilnya TIDAK diketahui; spesifikasi
  // Telegram melarang mengulang begitu saja karena bisa terkirim dobel.
  // Karena itu hanya penolakan yang jelas (r berisi ok:false) yang dialihkan.
  if (r === null) return null;
  catatGagal(r?.description);
  return klasik();
}

/** Mengubah pesan yang sudah ada. Alasan fallback sama dengan kirimRich. */
export async function ubahRich(panggil, { chatId, messageId, pesan, keyboard, aktif = true }) {
  const papan = mergeKeyboard(pesan, keyboard);
  const klasik = () =>
    panggil("editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text: keKlasik(pesan),
      parse_mode: "HTML",
      disable_web_page_preview: true,
      ...(papan.length ? { reply_markup: { inline_keyboard: papan } } : {})
    });

  if (!adalahRich(pesan) || !aktif || Date.now() < matiSampai || !pesan.html) return klasik();

  const r = await panggil("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    rich_message: { html: pesan.html },
    ...(papan.length ? { reply_markup: { inline_keyboard: papan } } : {})
  });
  if (r?.ok) {
    gagalBeruntun = 0;
    return r;
  }
  if (r === null) return null;
  // "message is not modified" bukan kegagalan rich; jangan dihitung.
  if (/not modified/i.test(r?.description || "")) return r;
  catatGagal(r?.description);
  return klasik();
}

function mergeKeyboard(pesan, keyboard) {
  const dariPesan = adalahRich(pesan) ? pesan.tombol : [];
  return warnaiKeyboard([...dariPesan, ...(Array.isArray(keyboard) ? keyboard : [])]);
}

// ─────────────────────── WARNA TOMBOL OTOMATIS ───────────────────────
//
// Tombol berwarna (style primary/success/danger) membuat aksi utama langsung
// terlihat, seperti "Order via Bot" (biru) dan "Order via Website" (hijau) di
// channel. Daripada menandai ratusan tombol satu per satu, semua keyboard
// lewat sini: tombol yang SUDAH punya style tidak disentuh, sisanya diberi
// warna dari teksnya. Navigasi (← Menu, Kembali, halaman) sengaja polos supaya
// warna tetap berarti "ini aksi".
const NAVIGASI = /^(←|«|»|🏠|◀|▶)|\b(menu|kembali|sebelumnya|berikutnya|tutup|tunggu)\b/i;
const BAHAYA = /(❌|🗑|⛔|🚫)|\b(batalkan|batal|hapus|tolak|matikan|cabut|blokir)\b/i;
const SUKSES = /(✅|💳|💰|🛒|🎁|🏆)|\b(beli|order|pesan|deposit|isi saldo|bayar|top-?up|setuju|nyalakan|ajukan|tarik|klaim|ikut|ambil|aktifkan|sudah bayar)\b/i;
const UTAMA = /(🔄|🤖|🔑|✨|🚀|📱|🔔)|\b(cek|refresh|login|daftar|buat|mulai|lihat|buka|kirim|simpan|lanjut)\b/i;

function warnaiTombol(t) {
  if (!t || t.style) return t;
  const teks = String(t.text || "");
  if (NAVIGASI.test(teks)) return t;
  if (BAHAYA.test(teks)) return { ...t, style: "danger" };
  if (t.url && /\bbot\b/i.test(teks)) return { ...t, style: "primary" };
  if (t.url && /\b(web|website|situs)\b/i.test(teks)) return { ...t, style: "success" };
  if (SUKSES.test(teks)) return { ...t, style: "success" };
  if (UTAMA.test(teks) || t.url) return { ...t, style: "primary" };
  return t;
}

/** Memberi warna pada tombol yang belum punya style. Tidak mengubah masukan. */
export function warnaiKeyboard(keyboard) {
  if (!Array.isArray(keyboard)) return keyboard;
  return keyboard.map((baris) => (Array.isArray(baris) ? baris.map(warnaiTombol) : baris));
}

// ───────────────── PENAIK OTOMATIS: HTML KLASIK → RICH ─────────────────
//
// Hampir semua layar bot dibangun dari tiga helper dengan bentuk baku:
//
//   head():   "ikon  <b>JUDUL</b>\n(<i>sub</i>\n)────────────────────────────\n"
//   panel():  "<code>label ····· nilai\nlabel ····· nilai</code>\n"
//   foot():   "┄┄┄┄┄┄┄┄\n<i>penutup</i>"
//
// Daripada menulis ulang ratusan layar, bentuk-bentuk itu dikenali dan
// dinaikkan: judul jadi heading, panel jadi tabel, garis jadi pemisah,
// penutup jadi footer. Teks lain diteruskan apa adanya sebagai paragraf.
//
// Hanya menaikkan kalau ADA judul baku. Pesan pendek tanpa judul ("Ketik
// nomornya…") tetap dikirim biasa — mengubahnya tidak menambah apa pun.
//
// Yang diubah hanya susunannya; isi tidak disentuh. Teksnya sudah ter-escape
// oleh pembuatnya (esc()), jadi di sini diteruskan tanpa di-escape ulang.

const GARIS = /^[─━┄]{6,}$/;
const BARIS_LEPAS = /^(?:(\S+)\s+)?(.+?)\s*╸\s+(.*)$/u;
const labelLepas = (m) => `${m[1] ? m[1] + " " : ""}${m[2]}`;
const BARIS_JUDUL = /^(\S{1,8})\s{2}<b>(.+)<\/b>$/u;
const BARIS_SUB = /^<i>(.+)<\/i>$/;

function panelKeTabel(isi) {
  // isi = teks di dalam <code>…</code>; sudah ter-escape.
  const baris = isi.split("\n");
  const potongan = [];
  let tabel = [];
  const tutup = () => {
    if (tabel.length) potongan.push(`<table striped>${tabel.join("")}</table>`);
    tabel = [];
  };
  for (const b of baris) {
    if (!b.trim()) continue;
    if (GARIS.test(b.trim())) { tutup(); potongan.push("<hr/>"); continue; }
    const m = /^(.*?)\s+·{2,}\s+(.*)$/.exec(b) || /^(.*?)\s{2,}(\S.*)$/.exec(b);
    tabel.push(m ? `<tr><td>${m[1]}</td><td>${m[2]}</td></tr>` : `<tr><td colspan="2">${b}</td></tr>`);
  }
  tutup();
  return potongan.join("");
}

/**
 * Menaikkan teks klasik jadi pesan rich, atau mengembalikan null kalau tidak
 * ada yang layak dinaikkan (pemanggil lalu memakai teks aslinya).
 */
/**
 * Menyusun sisa teks klasik (sesudah judul) jadi potongan html rich:
 * <code> berbaris banyak → tabel, "ikon label ╸ nilai" beruntun → tabel,
 * garis → <hr/>, sisanya paragraf. Dipakai bersama oleh semua penaik.
 */
function susunBadan(sisa, html) {
  let paragraf = [];
  const alirkan = () => {
    if (paragraf.length) html.push(`<p>${paragraf.join("<br/>")}</p>`);
    paragraf = [];
  };

  // Blok <code> berbaris banyak yang berpola panel → tabel. <code> satu baris
  // (mis. nomor pesanan di tengah kalimat) dibiarkan sebagai kode inline.
  sisa = sisa.replace(/<code>([\s\S]*?)<\/code>/g, (semua, isi) => {
    const barisIsi = isi.split("\n").filter((x) => x.trim());
    const berpola = barisIsi.filter((x) => /\s·{2,}\s|\s{2,}\S/.test(x) || GARIS.test(x.trim())).length;
    if (barisIsi.length >= 2 && berpola >= Math.ceil(barisIsi.length / 2)) {
      return `\u0001${panelKeTabel(isi)}\u0002`;
    }
    return semua;
  });

  // Baris "ikon  label ╸ nilai" yang berurutan dikumpulkan jadi satu tabel.
  let lepas = [];
  const tutupLepas = () => {
    if (lepas.length) html.push(`<table striped>${lepas.join("")}</table>`);
    lepas = [];
  };
  for (const b of sisa.split("\n")) {
    const ml = BARIS_LEPAS.exec(b.trim());
    if (ml && !b.includes("\u0001") && !b.trim().startsWith("<")) {
      alirkan();
      lepas.push(`<tr><td>${labelLepas(ml)}</td><td>${ml[3]}</td></tr>`);
      continue;
    }
    tutupLepas();
    if (b.includes("\u0001")) {
      alirkan();
      // Bisa ada teks sebelum/sesudah penanda pada baris yang sama.
      const [depan, sisaB] = b.split("\u0001");
      const [isiTabel, belakang] = sisaB.split("\u0002");
      if (depan.trim()) html.push(`<p>${depan}</p>`);
      html.push(isiTabel);
      if (belakang && belakang.trim()) paragraf.push(belakang);
      continue;
    }
    const t = b.trim();
    if (!t) { alirkan(); continue; }
    if (GARIS.test(t)) { alirkan(); html.push("<hr/>"); continue; }
    paragraf.push(b);
  }
  tutupLepas();
  alirkan();

  // Penutup: <hr/> lalu satu paragraf miring paling akhir → footer.
  const n = html.length;
  if (n >= 2 && html[n - 2] === "<hr/>" && /^<p><i>[\s\S]*<\/i><\/p>$/.test(html[n - 1])) {
    const isi = /^<p>(<i>[\s\S]*<\/i>)<\/p>$/.exec(html[n - 1])[1];
    html.splice(n - 2, 2, `<footer>${isi.replace(/^<i>|<\/i>$/g, "")}</footer>`);
  }
}

function bungkusRich(html, teks) {
  const bersih = html.join("").replace(/<p><\/p>/g, "");
  if (!bersih) return null;
  return {
    __rich: true,
    html: bersih,
    klasik: teks, // yang asli, persis apa adanya — fallback tidak boleh berubah
    tombol: [],
    toString() { return teks; },
    get length() { return teks.length; }
  };
}

export function perkaya(teks) {
  if (typeof teks !== "string" || teks.length < 20 || teks.length > 30000) return null;
  const baris = teks.split("\n");
  // Harus ada judul baku di baris pertama, kalau tidak: bukan layar kita.
  if (!BARIS_JUDUL.test(baris[0])) return null;

  const html = [];
  const j = BARIS_JUDUL.exec(baris[0]);
  html.push(`<h2>${j[1]} ${j[2]}</h2>`);
  let i = 1;
  if (baris[i] && BARIS_SUB.test(baris[i])) {
    html.push(`<p>${baris[i]}</p>`);
    i++;
  }
  if (baris[i] && GARIS.test(baris[i].trim())) i++;

  susunBadan(baris.slice(i).join("\n"), html);
  return bungkusRich(html, teks);
}

// ───────────── PENAIK #3: PESAN STATUS PENDEK (✅ ❌ ⏳ 🚫 ⚠️) ─────────────
//
// "❌ Gagal membuat deposit." / "✅ Broadcast selesai.\n\nTerkirim ╸ 5" tidak
// punya judul baku. Baris pertamanya jadi callout, sisanya disusun seperti
// layar lain. Tidak dipakai untuk pertanyaan/petunjuk biasa tanpa emoji status.

const AWAL_STATUS = /^(✅|❌|⏳|🚫|⚠️|⚠|ℹ️|ℹ|💡|✖️|🔒|🔓|📌)\s*(.*)$/u;

export function perkayaStatus(teks) {
  if (typeof teks !== "string" || teks.length < 8 || teks.length > 4000) return null;
  const baris = teks.split("\n");
  const m = AWAL_STATUS.exec(baris[0]);
  if (!m || !m[2].trim()) return null;
  // Kalau sudah punya judul <b> di baris pertama, itu urusan penaik lain.
  if (BARIS_JUDUL.test(baris[0])) return null;

  const html = [`<blockquote>${baris[0]}</blockquote>`];
  susunBadan(baris.slice(1).join("\n"), html);
  return bungkusRich(html, teks);
}

// ─────────── PENAIK OTOMATIS #2: NOTIF ADMIN (POHON ├ └ ╸) ───────────
//
// Notif admin di lib/telegram.js semuanya berbentuk:
//
//   ✅ <b>JUDUL</b> 🎉
//   ━━━━━━━━━━━━━━━━━━━━━━━━
//   💳  <b>Metode</b>
//   ━━━━━━━━━━━━━━━━━━━━━━━━
//
//   📋 <b>BAGIAN</b>
//   ├ 🧾 Label  ╸ nilai
//   └ 🔖 Label  ╸ nilai
//
//   ━━━━━━━━━━━━━━━━━━━━━━━━
//   🚀 <i>penutup</i>
//   ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
//   🛒 <b>ajakan</b>
//   📢 Channel · 🤖 Bot · 🌐 Web
//
// Judul → h2, tiap BAGIAN → h3 + tabel, penutup → footer. Baris ajakan dan
// tautan di paling bawah dibuang: pesannya sudah membawa tombol yang sama.

const HDR_TEBAL = /^[━]{6,}$/;
const BARIS_POHON = /^[├└]\s+(.+?)\s*╸\s+(.*)$/u;
const BAGIAN = /^(\S+)\s+<b>([^<]+)<\/b>\s*$/u;
const TAUTAN_KAKI = /^📢 <a href=/;

export function perkayaAdmin(teks) {
  if (typeof teks !== "string" || teks.length < 30 || teks.length > 30000) return null;
  const baris = teks.split("\n");
  const judul = /^(\S+)\s+<b>(.+?)<\/b>(.*)$/u.exec(baris[0]);
  // Harus berpola: judul lalu garis tebal. Selain itu bukan notif kita.
  if (!judul || !HDR_TEBAL.test((baris[1] || "").trim())) return null;

  const html = [];
  let baris_tabel = [];
  let paragraf = [];
  const tutupTabel = () => {
    if (baris_tabel.length) html.push(`<table striped>${baris_tabel.join("")}</table>`);
    baris_tabel = [];
  };
  const tutupParagraf = () => {
    if (paragraf.length) html.push(`<p>${paragraf.join("<br/>")}</p>`);
    paragraf = [];
  };
  const tutup = () => { tutupTabel(); tutupParagraf(); };
  const sel = (label, nilai) => `<tr><td>${label}</td><td>${nilai}</td></tr>`;

  html.push(`<h2>${judul[1]} ${judul[2]}${judul[3] ? " " + judul[3].trim() : ""}</h2>`);

  let footer = null;
  // Garis tebal pertama (baris[1]) sudah dilewati; sisanya jadi pemisah.
  for (let i = 2; i < baris.length; i++) {
    const b = baris[i];
    const t = b.trim();
    if (!t) { tutup(); continue; }
    if (HDR_TEBAL.test(t)) { tutup(); if (html.length > 1) html.push("<hr/>"); continue; }
    if (/^[┄]{6,}$/.test(t)) { tutup(); continue; }
    if (TAUTAN_KAKI.test(t) || /^🛒 <b>/.test(t)) continue; // ajakan + tautan kaki

    const bag = BAGIAN.exec(t);
    if (bag && /^[├└]/.test((baris[i + 1] || "").trim())) {
      tutup();
      html.push(`<h3>${bag[1]} ${bag[2]}</h3>`);
      continue;
    }
    const pohon = BARIS_POHON.exec(t);
    if (pohon) { tutupParagraf(); baris_tabel.push(sel(pohon[1], pohon[2])); continue; }
    const lepas = BARIS_LEPAS.exec(t);
    if (lepas && !t.startsWith("<")) { tutupParagraf(); baris_tabel.push(sel(labelLepas(lepas), lepas[3])); continue; }

    // Baris pohon tanpa "╸" (catatan, status): penandanya dibuang, isinya
    // jadi paragraf — bukan penutup, karena masih bagian dari bagiannya.
    if (/^[├└]\s/.test(t)) { tutupTabel(); paragraf.push(t.replace(/^[├└]\s+/, "")); continue; }

    const miring = /^(\S+\s+)?<i>([\s\S]*)<\/i>$/u.exec(t);
    if (miring) { tutup(); footer = (miring[1] || "") + miring[2]; continue; }

    tutupTabel();
    paragraf.push(b);
  }
  tutup();
  if (footer) html.push(`<footer>${footer}</footer>`);

  // Pemisah di ujung (sebelum footer) tidak perlu.
  const bersih = html.join("").replace(/<hr\/>(<footer>)/, "$1").replace(/<hr\/>$/, "");
  if (bersih.length < 20) return null;
  return {
    __rich: true,
    html: bersih,
    klasik: teks, // teks asli persis
    tombol: [],
    toString() { return teks; },
    get length() { return teks.length; }
  };
}

/**
 * Titik masuk tunggal untuk teks string: coba semua penaik, pakai yang cocok.
 * null berarti kirim apa adanya.
 */
export function perkayaOtomatis(teks) {
  return perkaya(teks) || perkayaAdmin(teks) || perkayaStatus(teks);
}

// ─────────────── JSON DARI PENGGUNA (mis. /broadcast owner) ───────────────

/**
 * Mengenali teks yang isinya JSON blok rich (format tutorial), mis. yang
 * diketik owner di /broadcast. Mengembalikan { blok, dibuang } atau null kalau
 * bukan JSON blok sama sekali — pemanggil lalu memperlakukannya sebagai teks
 * biasa. Blok yang tidak dikenal dibuang dan dihitung, supaya bisa dilaporkan.
 */
export function richDariTeks(teks) {
  const t = String(teks ?? "").trim();
  if (!t || (t[0] !== "[" && t[0] !== "{") || t.length > 60_000) return null;
  let data;
  try {
    data = JSON.parse(t);
  } catch {
    return null;
  }
  const daftar = Array.isArray(data) ? data : [data];
  if (!daftar.length || daftar.length > 200) return null;
  const blok = daftar.filter((b) => b && typeof b === "object" && blokSatu(b) !== null);
  if (!blok.length) return null;
  return { blok, dibuang: daftar.length - blok.length };
}
