// Notifikasi ke channel/grup Telegram — format ultra-detail, menarik, dan rapi.
// Semua teks dinamis WAJIB di-escape (parse_mode HTML): karakter < & > bisa bikin
// pesan ditolak Telegram diam-diam.

export function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function maskToken(token = "") {
  if (!token) return "—";
  if (token.length <= 8) return token;
  return `${token.slice(0, 4)}••••${token.slice(-4)}`;
}

function fmtWIB(d) {
  if (!d) return "—";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }) + " WIB";
}

function durationText(fromDate, toDate = new Date()) {
  const ms = new Date(toDate).getTime() - new Date(fromDate).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} detik`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}j ${m % 60}m`;
}

function maskTarget(target = "") {
  const t = String(target || "").trim();
  if (!t) return "—";
  try {
    const u = new URL(t);
    const path = u.pathname.replace(/\/+$/, "");
    const shown = path.length > 5 ? `${path.slice(0, 5)}…` : path;
    return `${u.hostname}${shown}`;
  } catch {
    return t.length > 4 ? `${t.slice(0, 3)}…` : "••••";
  }
}

function nowWIB() {
  return new Date().toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }) + " WIB";
}

function rupiah(n) {
  return `Rp${Number(n || 0).toLocaleString("id-ID")}`;
}

// Balance bar: visual indicator of deposit count (max 10 blocks)
function depositBar(count = 0) {
  const filled = Math.min(10, Number(count) || 0);
  return "▓".repeat(filled) + "░".repeat(10 - filled);
}

// Provider badges
const PROVIDER_LABEL = { simuru: "QRIS Simuru", pakasir: "QRIS Pakasir", rumahotp: "QRIS RumahOTP", virtusim: "QRIS VirtuSIM" };
function providerLabel(p) { return PROVIDER_LABEL[p] || p || "—"; }

const HDR = "━━━━━━━━━━━━━━━━━━━━━━━━";
const HDR_THIN = "┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄";

function channelFooter() {
  const chan1 = process.env.TELEGRAM_CHANNEL_1 || "https://t.me/kkaelnokosmurah";
  const chan2 = process.env.TELEGRAM_CHANNEL_2 || "https://t.me/diskusiduniotp";
  return (
    `\n${HDR_THIN}\n` +
    `📢 <a href="${chan1}">Channel Info &amp; Promo</a>  ·  ` +
    `💬 <a href="${chan2}">Diskusi Dunia OTP</a>`
  );
}

// ────────────────────────────── DEPOSIT ──────────────────────────────

export function depositPendingNotif({ orderId, providerRef, provider, amount, fee, total, expiredAt, token, name }) {
  const prov = providerLabel(provider);
  const hasRef = providerRef && providerRef !== orderId;
  const hasFee = fee && Number(fee) > 0;
  const hasTotal = total && Number(total) !== Number(amount);
  const totalPay = hasTotal ? total : amount;

  return (
    `🟡 <b>DEPOSIT — MENUNGGU PEMBAYARAN</b>\n` +
    `${HDR}\n` +
    `💳  <b>${esc(prov)}</b>\n` +
    `${HDR}\n\n` +

    `📋 <b>INFO TRANSAKSI</b>\n` +
    `├ 🧾 Order ID  ╸ <code>${esc(orderId)}</code>\n` +
    (hasRef ? `└ 🔖 Ref Prov  ╸ <code>${esc(providerRef)}</code>\n` : `└ 🔖 Ref Prov  ╸ —\n`) +
    `\n` +

    `💸 <b>RINCIAN PEMBAYARAN</b>\n` +
    `├ 📦 Nominal   ╸ <b>${rupiah(amount)}</b>\n` +
    (hasFee ? `├ 🧮 Biaya     ╸ ${rupiah(fee)}\n` : ``) +
    `└ 💵 Total     ╸ <b>${rupiah(totalPay)}</b>\n` +
    `\n` +

    `👤 <b>AKUN USER</b>\n` +
    `├ 🔑 Token     ╸ <code>${maskToken(token)}</code>\n` +
    `└ 📛 Nama      ╸ ${esc(name || "—")}\n` +
    `\n` +

    `⏰ <b>WAKTU</b>\n` +
    `├ 🕒 Dibuat    ╸ ${nowWIB()}\n` +
    `└ ⏳ Exp       ╸ <b>${fmtWIB(expiredAt)}</b>\n` +

    `${HDR}\n` +
    `⚡ <i>Menunggu user scan &amp; bayar QRIS…</i>` +
    channelFooter()
  );
}

export function depositSuccessNotif({
  orderId, providerRef, provider, amount, fee, total,
  token, name, balanceBefore, balance,
  cashback = 0, referralBonus = 0, createdAt, depositCount
}) {
  const paidIn = createdAt ? durationText(createdAt) : null;
  const hasFee = fee && Number(fee) > 0;
  const hasTotal = total && Number(total) !== Number(amount);
  const hasRef = providerRef && providerRef !== orderId;
  const hasCashback = cashback > 0;
  const hasRef2 = referralBonus > 0;
  const cnt = Number(depositCount) || 0;

  return (
    `✅ <b>DEPOSIT BERHASIL MASUK!</b> 🎉\n` +
    `${HDR}\n` +
    `💳  <b>${esc(providerLabel(provider))}</b>\n` +
    `${HDR}\n\n` +

    `📋 <b>TRANSAKSI</b>\n` +
    `├ 🧾 Order ID  ╸ <code>${esc(orderId)}</code>\n` +
    (hasRef ? `└ 🔖 Ref Prov  ╸ <code>${esc(providerRef)}</code>\n` : ``) +
    `\n` +

    `💸 <b>RINCIAN DANA</b>\n` +
    `├ 📦 Nominal   ╸ <b>${rupiah(amount)}</b>\n` +
    (hasFee ? `├ 🧮 Biaya     ╸ ${rupiah(fee)}\n` : ``) +
    (hasTotal ? `├ 💵 Dibayar   ╸ ${rupiah(total)}\n` : ``) +
    (hasCashback ? `├ 🎁 Cashback  ╸ <b>+${rupiah(cashback)}</b>\n` : ``) +
    (hasRef2 ? `└ 🤝 Ref Bonus ╸ <b>+${rupiah(referralBonus)}</b> → pengundang\n` : ``) +
    `\n` +

    `🏦 <b>SALDO USER</b>\n` +
    (balanceBefore !== undefined && balanceBefore !== null
      ? `├ 📊 Sebelum   ╸ ${rupiah(balanceBefore)}\n` : ``) +
    `├ ✨ Masuk     ╸ <b>+${rupiah(amount)}${hasCashback ? ` (+${rupiah(cashback)} cb)` : ""}</b>\n` +
    `└ 💰 Saldo     ╸ <b>${rupiah(balance)}</b>\n` +
    `\n` +

    `👤 <b>AKUN USER</b>\n` +
    `├ 🔑 Token     ╸ <code>${maskToken(token)}</code>\n` +
    (name ? `└ 📛 Nama      ╸ ${esc(name)}\n` : ``) +
    `\n` +

    (cnt > 0
      ? `📈 <b>MILESTONE</b>\n` +
        `├ 🏆 Deposit   ╸ #${cnt.toLocaleString("id-ID")}\n` +
        `└ 📊 Progress  ╸ ${depositBar(cnt)}\n\n`
      : ``) +

    `⏱️ Proses  ╸ ${paidIn ? `<b>${paidIn}</b>` : "—"}   🕒 ${nowWIB()}\n` +
    `${HDR}\n` +
    `🚀 <i>Saldo sudah otomatis masuk ke akun user!</i>` +
    channelFooter()
  );
}

export function depositCanceledNotif({ orderId, provider, amount, token, name, reason }) {
  const isExpired = reason === "expired";
  return (
    `${isExpired ? "⏰" : "❌"} <b>DEPOSIT ${isExpired ? "KEDALUWARSA" : "DIBATALKAN"}</b>\n` +
    `${HDR}\n` +
    `💳  <b>${esc(providerLabel(provider))}</b>\n` +
    `${HDR}\n\n` +

    `📋 <b>TRANSAKSI</b>\n` +
    `├ 🧾 Order ID  ╸ <code>${esc(orderId)}</code>\n` +
    `└ 💰 Nominal   ╸ ${rupiah(amount)}\n` +
    `\n` +

    `👤 <b>AKUN USER</b>\n` +
    `├ 🔑 Token     ╸ <code>${maskToken(token)}</code>\n` +
    `└ 📛 Nama      ╸ ${esc(name || "—")}\n` +
    `\n` +

    `📝 <b>ALASAN</b>\n` +
    `└ ${esc(isExpired ? "QRIS tidak dibayar hingga waktu habis." : (reason || "Dibatalkan oleh user/admin."))}\n` +
    `\n` +

    `🕒 ${nowWIB()}\n` +
    `${HDR}\n` +
    `💡 <i>User bisa membuat deposit baru kapan saja.</i>` +
    channelFooter()
  );
}

// ────────────────────────────── OTP ──────────────────────────────

export function otpPurchaseNotif({ orderId, serviceName, countryName, phoneNumber, price, token, name, operator, balance }) {
  return (
    `📱 <b>NOMOR OTP TERJUAL!</b> 💥\n` +
    `${HDR}\n\n` +

    `📦 <b>DETAIL LAYANAN</b>\n` +
    `├ 🏷️ Layanan   ╸ <b>${esc(serviceName || "—")}</b>\n` +
    `├ 🌍 Negara    ╸ ${esc(countryName || "—")}\n` +
    (operator ? `├ 📶 Operator  ╸ ${esc(operator)}\n` : ``) +
    `└ ☎️ Nomor     ╸ <code>${esc(phoneNumber || "—")}</code>\n` +
    `\n` +

    `💵 <b>HARGA</b>\n` +
    `└ 💰 Charge    ╸ <b>${rupiah(price)}</b>\n` +
    `\n` +

    `👤 <b>PEMBELI</b>\n` +
    `├ 🔑 Token     ╸ <code>${maskToken(token)}</code>\n` +
    (name ? `├ 📛 Nama      ╸ ${esc(name)}\n` : ``) +
    (balance !== undefined && balance !== null
      ? `└ 🏦 Sisa Saldo╸ ${rupiah(balance)}\n`
      : ``) +
    `\n` +

    `🧾 Order  ╸ <code>${esc(orderId)}</code>   🕒 ${nowWIB()}\n` +
    `${HDR}\n` +
    `⏳ <i>Menunggu kode OTP masuk ke nomor…</i>` +
    channelFooter()
  );
}

export function otpReceivedNotif({ orderId, serviceName, countryName, phoneNumber, otpCode, token, createdAt }) {
  const waited = createdAt ? durationText(createdAt) : null;
  return (
    `🔓 <b>KODE OTP DITERIMA!</b> ✅\n` +
    `${HDR}\n\n` +

    `📦 <b>DETAIL LAYANAN</b>\n` +
    `├ 🏷️ Layanan   ╸ <b>${esc(serviceName || "—")}</b>\n` +
    `├ 🌍 Negara    ╸ ${esc(countryName || "—")}\n` +
    `└ ☎️ Nomor     ╸ <code>${esc(phoneNumber || "—")}</code>\n` +
    `\n` +

    `🔑 <b>KODE OTP</b>\n` +
    `└ 🎯 Kode      ╸ <b><code>${esc(otpCode)}</code></b>\n` +
    `\n` +

    `⏱️ <b>PERFORMA</b>\n` +
    `└ ⚡ Tunggu    ╸ ${waited ? `<b>${waited}</b>` : "—"}\n` +
    `\n` +

    `🔑 Token  ╸ <code>${maskToken(token)}</code>   🕒 ${nowWIB()}\n` +
    `🧾 Order  ╸ <code>${esc(orderId)}</code>\n` +
    `${HDR}\n` +
    `💡 <i>Kode OTP sudah tersedia di akun user.</i>` +
    channelFooter()
  );
}

// ────────────────────────────── SMM ──────────────────────────────

export function smmOrderNotif({ id, providerOrderId, platform, kind, serviceTitle, target, quantity, pricePer1k, charge, token, name, balance, speedLabel }) {
  return (
    `🚀 <b>ORDER SUNTIK SOSMED MASUK!</b> 📲\n` +
    `${HDR}\n\n` +

    `📲 <b>PLATFORM &amp; LAYANAN</b>\n` +
    `├ 🌐 Platform  ╸ <b>${esc(platform || "—")}</b>${kind ? ` · ${esc(kind)}` : ""}\n` +
    `├ 🛠️ Layanan   ╸ ${esc(serviceTitle || "—")}\n` +
    `└ 🎯 Target    ╸ <code>${esc(maskTarget(target))}</code>\n` +
    `\n` +

    `📊 <b>RINCIAN ORDER</b>\n` +
    `├ 🔢 Jumlah    ╸ <b>${Number(quantity || 0).toLocaleString("id-ID")}</b>\n` +
    `├ 🏷️ /1.000    ╸ ${rupiah(pricePer1k)}\n` +
    (speedLabel ? `├ ⚡ Estimasi  ╸ ${esc(speedLabel)}\n` : ``) +
    `└ 💵 Total     ╸ <b>${rupiah(charge)}</b>\n` +
    `\n` +

    `👤 <b>PEMESAN</b>\n` +
    `├ 🔑 Token     ╸ <code>${maskToken(token)}</code>\n` +
    (name ? `├ 📛 Nama      ╸ ${esc(name)}\n` : ``) +
    (balance !== undefined && balance !== null
      ? `└ 🏦 Sisa Saldo╸ ${rupiah(balance)}\n`
      : ``) +
    `\n` +

    `🧾 Order  ╸ <code>${esc(id)}</code>${providerOrderId ? `  🔖 Simuru #${esc(providerOrderId)}` : ""}\n` +
    `🕒 ${nowWIB()}\n` +
    `${HDR}\n` +
    `⏳ <i>Order sedang diproses oleh provider Simuru…</i>` +
    channelFooter()
  );
}

const SMM_STATUS_BANNER = {
  completed: "✅ <b>SUNTIK SOSMED SELESAI!</b> 🎯",
  partial:   "🟠 <b>SUNTIK SOSMED SEBAGIAN SELESAI</b> ⚠️",
  canceled:  "↩️ <b>SUNTIK SOSMED DIBATALKAN</b>",
  refunded:  "💸 <b>SUNTIK SOSMED — REFUND DIPROSES</b>",
  error:     "❌ <b>SUNTIK SOSMED GAGAL!</b> ⚠️"
};

export function smmStatusNotif({ id, platform, serviceTitle, target, quantity, status, startCount, remains, refundAmount, token, createdAt }) {
  const took = createdAt ? durationText(createdAt) : null;
  const delivered = (startCount !== null && startCount !== undefined && remains !== null && remains !== undefined)
    ? Number(quantity || 0) - Number(remains)
    : null;
  const pct = (delivered !== null && quantity > 0) ? Math.round((delivered / quantity) * 100) : null;
  const bar = pct !== null
    ? "▓".repeat(Math.round(pct / 10)) + "░".repeat(10 - Math.round(pct / 10)) + ` ${pct}%`
    : null;

  return (
    `${SMM_STATUS_BANNER[status] || `ℹ️ <b>STATUS SUNTIK: ${esc(String(status).toUpperCase())}</b>`}\n` +
    `${HDR}\n\n` +

    `📲 <b>DETAIL</b>\n` +
    `├ 🌐 Platform  ╸ ${esc(platform || "—")}\n` +
    `├ 🛠️ Layanan   ╸ ${esc(serviceTitle || "—")}\n` +
    `└ 🎯 Target    ╸ <code>${esc(maskTarget(target))}</code>\n` +
    `\n` +

    `📊 <b>PROGRES PENGIRIMAN</b>\n` +
    `├ 🔢 Dipesan   ╸ ${Number(quantity || 0).toLocaleString("id-ID")}\n` +
    (startCount !== null && startCount !== undefined
      ? `├ 📊 Awal      ╸ ${Number(startCount).toLocaleString("id-ID")}\n`
      : ``) +
    (delivered !== null
      ? `├ ✅ Terkirim  ╸ <b>${delivered.toLocaleString("id-ID")}</b>\n`
      : ``) +
    (remains !== null && remains !== undefined
      ? `├ ⏳ Sisa      ╸ ${Number(remains).toLocaleString("id-ID")}\n`
      : ``) +
    (bar ? `└ 📈 Bar       ╸ ${bar}\n` : ``) +
    `\n` +

    (refundAmount > 0
      ? `💸 <b>REFUND</b>\n└ 💰 Jumlah    ╸ <b>${rupiah(refundAmount)}</b>\n\n`
      : ``) +

    `🔑 Token  ╸ <code>${maskToken(token)}</code>   🧾 <code>${esc(id)}</code>\n` +
    `⏱️ Durasi ╸ ${took ? `<b>${took}</b>` : "—"}   🕒 ${nowWIB()}\n` +
    `${HDR}\n` +
    `${status === "completed" ? "🎉 <i>Pengiriman selesai 100%!</i>" : status === "refunded" || status === "canceled" ? "💡 <i>Saldo user sudah dikembalikan.</i>" : "⚡ <i>Status terupdate otomatis dari Simuru.</i>"}` +
    channelFooter()
  );
}

// ────────────────────────────── ALERTS ──────────────────────────────

export function providerAlertNotif({ provider, action, message }) {
  return (
    `🚨 <b>⚠️ PERINGATAN PROVIDER!</b> 🚨\n` +
    `${HDR}\n\n` +

    `🔌 <b>PROVIDER</b>  ╸  <b>${esc(provider)}</b>\n` +
    `🧩 <b>AKSI</b>      ╸  ${esc(action)}\n` +
    `\n` +

    `📝 <b>PESAN ERROR</b>\n` +
    `└ <code>${esc(message)}</code>\n` +
    `\n` +

    `🕒 ${nowWIB()}\n` +
    `${HDR}\n` +
    `⚡ <i>Segera cek saldo &amp; API key provider di dashboard mereka!</i>`
  );
}

// ────────────────────────────── TRANSFER ──────────────────────────────

export function transferNotif({ fromToken, toToken, amount, fromBalance }) {
  return (
    `🔁 <b>TRANSFER SALDO ANTAR USER</b>\n` +
    `${HDR}\n\n` +

    `💸 <b>DETAIL TRANSFER</b>\n` +
    `├ 📤 Dari      ╸ <code>${maskToken(fromToken)}</code>\n` +
    `├ 📥 Ke        ╸ <code>${maskToken(toToken)}</code>\n` +
    `└ 💰 Nominal   ╸ <b>${rupiah(amount)}</b>\n` +
    `\n` +

    (fromBalance !== undefined
      ? `🏦 <b>SALDO PENGIRIM</b>\n└ 💳 Sisa      ╸ ${rupiah(fromBalance)}\n\n`
      : ``) +

    `🕒 ${nowWIB()}\n` +
    `${HDR}\n` +
    `✅ <i>Transfer berhasil diproses secara instan.</i>` +
    channelFooter()
  );
}

// ────────────────────────────── USER ──────────────────────────────

export function newUserNotif({ token, referredBy, userCount }) {
  const isRef = Boolean(referredBy);
  return (
    `🎉🎊 <b>PENGGUNA BARU BERGABUNG!</b> 🎊🎉\n` +
    `${HDR}\n\n` +

    `🆔 <b>IDENTITAS AKUN</b>\n` +
    `├ 🔑 Token     ╸ <code>${maskToken(token)}</code>\n` +
    `└ 📅 Daftar    ╸ <b>${nowWIB()}</b>\n` +
    `\n` +

    `📈 <b>STATISTIK</b>\n` +
    (userCount
      ? `├ 🏆 Member ke ╸ <b>#${Number(userCount).toLocaleString("id-ID")}</b>\n`
      : ``) +
    `└ 🔗 Referral  ╸ ${isRef ? `<b>✅ YA</b> — dari <code>${maskToken(referredBy)}</code>` : "❌ Organik"}\n` +
    `\n` +

    `${HDR}\n` +
    `🚀 <i>User baru siap bertransaksi di Artapedia!</i>` +
    channelFooter()
  );
}

// ────────────────────────────── PRODUK ──────────────────────────────

export function productCreatedNotif({ name, price, category, stock, deliveryType, description }) {
  const stockText = stock === -1 || stock === undefined ? "♾️ Unlimited" : `${Number(stock).toLocaleString("id-ID")} unit`;
  const delivLabel = deliveryType === "text" ? "📝 Teks/Kode" : deliveryType === "file" ? "📎 File" : esc(deliveryType || "—");
  return (
    `🛍️✨ <b>PRODUK BARU DITAMBAHKAN!</b> ✨🛍️\n` +
    `${HDR}\n\n` +

    `📦 <b>DETAIL PRODUK</b>\n` +
    `├ 🏷️ Nama      ╸ <b>${esc(name)}</b>\n` +
    `├ 🗂️ Kategori  ╸ ${esc(category || "Umum")}\n` +
    `├ 💰 Harga     ╸ <b>${rupiah(price)}</b>\n` +
    `├ 📦 Stok      ╸ <b>${stockText}</b>\n` +
    `└ 🚚 Kirim     ╸ ${delivLabel}\n` +
    `\n` +

    (description
      ? `📝 <b>DESKRIPSI</b>\n└ <i>${esc(String(description).slice(0, 200))}${description.length > 200 ? "…" : ""}</i>\n\n`
      : ``) +

    `🕒 ${nowWIB()}\n` +
    `${HDR}\n` +
    `🛒 <i>Produk baru siap dibeli oleh user!</i>` +
    channelFooter()
  );
}

export function productBoughtNotif({ productName, price, category, deliveryType, token, name, balance, ref }) {
  const delivLabel = deliveryType === "text" ? "📝 Teks/Kode" : deliveryType === "file" ? "📎 File" : esc(deliveryType || "—");
  return (
    `🛒💥 <b>PRODUK TERJUAL!</b> 💥🛒\n` +
    `${HDR}\n\n` +

    `📦 <b>DETAIL PEMBELIAN</b>\n` +
    `├ 🏷️ Produk    ╸ <b>${esc(productName)}</b>\n` +
    `├ 🗂️ Kategori  ╸ ${esc(category || "—")}\n` +
    `├ 🚚 Kirim     ╸ ${delivLabel}\n` +
    `└ 💵 Harga     ╸ <b>${rupiah(price)}</b>\n` +
    `\n` +

    `👤 <b>PEMBELI</b>\n` +
    `├ 🔑 Token     ╸ <code>${maskToken(token)}</code>\n` +
    (name ? `├ 📛 Nama      ╸ ${esc(name)}\n` : ``) +
    `└ 🏦 Saldo     ╸ <b>${rupiah(balance)}</b>\n` +
    `\n` +

    `🧾 Ref    ╸ <code>${esc(ref)}</code>   🕒 ${nowWIB()}\n` +
    `${HDR}\n` +
    `💸 <i>Produk langsung terkirim otomatis ke pembeli.</i>` +
    channelFooter()
  );
}

// ────────────────────────────── JOB ──────────────────────────────

export function jobCreatedNotif({ title, reward, category, maxCompletions, proofType, description }) {
  const quota = maxCompletions > 0 ? `${Number(maxCompletions).toLocaleString("id-ID")} orang` : "♾️ Tidak terbatas";
  const proofLabel = proofType === "url" ? "🔗 URL/Link" : proofType === "image" ? "🖼️ Screenshot" : "📝 Teks";
  return (
    `💼🔥 <b>JOB BARU TERSEDIA!</b> 🔥💼\n` +
    `${HDR}\n\n` +

    `📋 <b>DETAIL JOB</b>\n` +
    `├ 📌 Judul     ╸ <b>${esc(title)}</b>\n` +
    `├ 🗂️ Kategori  ╸ ${esc(category || "Umum")}\n` +
    `├ 🎁 Reward    ╸ <b>${rupiah(reward)}</b>\n` +
    `├ 👥 Kuota     ╸ <b>${quota}</b>\n` +
    `└ 📎 Bukti     ╸ ${proofLabel}\n` +
    `\n` +

    (description
      ? `📝 <b>DESKRIPSI</b>\n└ <i>${esc(String(description).slice(0, 200))}${description.length > 200 ? "…" : ""}</i>\n\n`
      : ``) +

    `🕒 ${nowWIB()}\n` +
    `${HDR}\n` +
    `🙋 <i>User bisa langsung ambil job ini sekarang!</i>` +
    channelFooter()
  );
}

export function jobApprovedNotif({ jobTitle, reward, token, name, balance, completedCount, maxCompletions, submittedAt }) {
  const waited = submittedAt ? durationText(submittedAt) : null;
  const slotLeft = maxCompletions > 0 ? maxCompletions - completedCount : null;
  return (
    `✅🎉 <b>JOB SELESAI &amp; DISETUJUI!</b> 🎉✅\n` +
    `${HDR}\n\n` +

    `💼 <b>DETAIL JOB</b>\n` +
    `├ 📌 Judul     ╸ <b>${esc(jobTitle)}</b>\n` +
    `├ 🎁 Reward    ╸ <b>${rupiah(reward)}</b>\n` +
    `└ 📊 Selesai   ╸ <b>#${Number(completedCount).toLocaleString("id-ID")}</b>${slotLeft !== null ? ` · sisa <b>${slotLeft}</b> slot` : ""}\n` +
    `\n` +

    `👤 <b>PESERTA</b>\n` +
    `├ 🔑 Token     ╸ <code>${maskToken(token)}</code>\n` +
    (name ? `├ 📛 Nama      ╸ ${esc(name)}\n` : ``) +
    `└ 🏦 Saldo     ╸ <b>${rupiah(balance)}</b> (+${rupiah(reward)})\n` +
    `\n` +

    `⏱️ Review  ╸ ${waited ? `<b>${waited}</b>` : "—"}   🕒 ${nowWIB()}\n` +
    `${HDR}\n` +
    `💸 <i>Reward sudah masuk ke saldo user secara otomatis!</i>` +
    channelFooter()
  );
}

// ────────────────────────────── REFUND ──────────────────────────────

export function otpAutoRefundNotif({ orderId, serviceName, countryName, price, token, reason }) {
  return (
    `↩️ <b>REFUND OTP OTOMATIS</b> 💸\n` +
    `${HDR}\n\n` +

    `📦 <b>DETAIL PESANAN</b>\n` +
    `├ 🏷️ Layanan   ╸ <b>${esc(serviceName || "—")}</b>\n` +
    `├ 🌍 Negara    ╸ ${esc(countryName || "—")}\n` +
    `└ 🧾 Order     ╸ <code>${esc(orderId)}</code>\n` +
    `\n` +

    `💰 <b>PENGEMBALIAN DANA</b>\n` +
    `└ ✅ Dikembalikan ╸ <b>${rupiah(price)}</b>\n` +
    `\n` +

    `👤 Akun  ╸ <code>${maskToken(token)}</code>\n` +
    `📝 Alasan╸ ${esc(reason || "Nomor tidak menerima kode OTP dalam batas waktu.")}\n` +
    `🕒 ${nowWIB()}\n` +
    `${HDR}\n` +
    `💡 <i>Saldo user sudah dikembalikan secara otomatis.</i>` +
    channelFooter()
  );
}

// ────────────────────────────── VOUCHER ──────────────────────────────

export function voucherCreatedNotif({ code, amount, maxUses }) {
  return (
    `🎟️✨ <b>VOUCHER BARU DIBUAT!</b> ✨🎟️\n` +
    `${HDR}\n\n` +

    `🎫 <b>DETAIL VOUCHER</b>\n` +
    `├ 🔑 Kode      ╸ <b><code>${esc(code)}</code></b>\n` +
    `├ 💰 Nominal   ╸ <b>${rupiah(amount)}</b>\n` +
    `└ 👥 Kuota     ╸ <b>${maxUses}×</b> klaim\n` +
    `\n` +

    `🕒 ${nowWIB()}\n` +
    `${HDR}\n` +
    `🎁 <i>Voucher siap dibagikan ke user!</i>` +
    channelFooter()
  );
}

export function voucherRedeemedNotif({ code, amount, token, remainingUses }) {
  return (
    `✅🎟️ <b>VOUCHER BERHASIL DIKLAIM!</b>\n` +
    `${HDR}\n\n` +

    `🎫 <b>DETAIL KLAIM</b>\n` +
    `├ 🔑 Kode      ╸ <code>${esc(code)}</code>\n` +
    `├ 💰 Nominal   ╸ <b>${rupiah(amount)}</b>\n` +
    `├ 👤 Akun      ╸ <code>${maskToken(token)}</code>\n` +
    `└ 🎫 Sisa Kuota╸ <b>${remainingUses}×</b> lagi\n` +
    `\n` +

    `🕒 ${nowWIB()}\n` +
    `${HDR}\n` +
    `💸 <i>Saldo voucher langsung masuk ke akun user.</i>` +
    channelFooter()
  );
}

// ────────────────────────────── POIN ──────────────────────────────

export function pointsRedeemedNotif({ token, points, rupiah: rp, newBalance, remainingPoints }) {
  return (
    `⭐ <b>POIN DITUKARKAN!</b> 💰\n` +
    `${HDR}\n\n` +

    `🔄 <b>KONVERSI POIN</b>\n` +
    `├ ⭐ Ditukar    ╸ <b>${Number(points).toLocaleString("id-ID")} poin</b>\n` +
    `├ 💵 Jadi Saldo ╸ <b>${rupiah(rp)}</b>\n` +
    `└ ⭐ Sisa Poin  ╸ ${Number(remainingPoints).toLocaleString("id-ID")} poin\n` +
    `\n` +

    `🏦 <b>SALDO BARU</b>\n` +
    `└ 💰 Saldo      ╸ <b>${rupiah(newBalance)}</b>\n` +
    `\n` +

    `👤 Akun  ╸ <code>${maskToken(token)}</code>   🕒 ${nowWIB()}\n` +
    `${HDR}\n` +
    `✨ <i>Poin berhasil dikonversi menjadi saldo!</i>` +
    channelFooter()
  );
}

// ────────────────────────────── ADMIN ──────────────────────────────

export function adminBalanceAdjustNotif({ token, amount, action, newBalance, note }) {
  const isAdd = action === "add";
  return (
    `${isAdd ? "🟢" : "🔴"} <b>SALDO ${isAdd ? "DITAMBAH" : "DIKURANGI"} ADMIN</b>\n` +
    `${HDR}\n\n` +

    `⚙️ <b>DETAIL PENYESUAIAN</b>\n` +
    `├ 👤 Akun      ╸ <code>${maskToken(token)}</code>\n` +
    `├ ${isAdd ? "➕" : "➖"} Nominal   ╸ <b>${rupiah(amount)}</b>\n` +
    `└ 🏦 Saldo Baru╸ <b>${rupiah(newBalance)}</b>\n` +
    `\n` +

    (note
      ? `📝 <b>CATATAN ADMIN</b>\n└ <i>${esc(note)}</i>\n\n`
      : ``) +

    `🕒 ${nowWIB()}\n` +
    `${HDR}\n` +
    `⚙️ <i>Perubahan dilakukan manual via dashboard admin.</i>` +
    channelFooter()
  );
}

export function markupUpdateNotif({ oldPercent, newPercent }) {
  const diff = Number(newPercent) - Number(oldPercent);
  const arrow = diff > 0 ? "📈 NAIK" : diff < 0 ? "📉 TURUN" : "↔️ SAMA";
  return (
    `⚙️ <b>MARKUP HARGA OTP DIUBAH!</b>\n` +
    `${HDR}\n\n` +

    `📊 <b>PERUBAHAN MARKUP</b>\n` +
    `├ 📉 Sebelum   ╸ <b>${oldPercent}%</b>\n` +
    `├ 📈 Sekarang  ╸ <b>${newPercent}%</b>\n` +
    `└ 🔄 Perubahan ╸ <b>${diff > 0 ? "+" : ""}${diff.toFixed(1)}%</b> (${arrow})\n` +
    `\n` +

    `🕒 ${nowWIB()}\n` +
    `${HDR}\n` +
    `💡 <i>Harga jual nomor OTP otomatis menyesuaikan.</i>` +
    channelFooter()
  );
}

export function maintenanceToggleNotif({ maintenance }) {
  return (
    `${maintenance ? "🛠️🔒" : "✅🔓"} <b>MAINTENANCE ${maintenance ? "AKTIF" : "NONAKTIF"}</b>\n` +
    `${HDR}\n\n` +

    `🔧 <b>STATUS WEBSITE</b>\n` +
    `└ ${maintenance
      ? "🔴 <b>OFFLINE</b> — Website ditutup sementara dari user.\n\n💡 User akan melihat halaman maintenance."
      : "🟢 <b>ONLINE</b> — Website sudah bisa diakses normal kembali!\n\n🎉 User dapat bertransaksi seperti biasa."
    }\n` +
    `\n` +

    `🕒 ${nowWIB()}\n` +
    `${HDR}\n` +
    `⚙️ <i>Status diubah via dashboard admin.</i>` +
    channelFooter()
  );
}

export function broadcastCreatedNotif({ message }) {
  return (
    `📣 <b>BROADCAST BARU DIKIRIM!</b> 📢\n` +
    `${HDR}\n\n` +

    `💬 <b>ISI PESAN</b>\n` +
    `${esc(message)}\n` +
    `\n` +

    `🕒 ${nowWIB()}\n` +
    `${HDR}\n` +
    `📲 <i>Pesan muncul sebagai banner di semua halaman.</i>` +
    channelFooter()
  );
}

export function announcementCreatedNotif({ title, category }) {
  return (
    `📝✨ <b>PENGUMUMAN BARU DITERBITKAN!</b> ✨📝\n` +
    `${HDR}\n\n` +

    `📌 <b>DETAIL PENGUMUMAN</b>\n` +
    `├ 📋 Judul     ╸ <b>${esc(title)}</b>\n` +
    `└ 🗂️ Kategori  ╸ ${esc(category)}\n` +
    `\n` +

    `🕒 ${nowWIB()}\n` +
    `${HDR}\n` +
    `👀 <i>Pengumuman tersedia di Pusat Informasi.</i>` +
    channelFooter()
  );
}

// ────────────────────────────── SEND HELPERS ──────────────────────────────

const WEB_ORDER_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://artapedianokosmurahid.vercel.app/";

// Fire-and-forget: tidak throw ke pemanggil — kegagalan notif tidak boleh
// menggagalkan transaksi deposit/pembelian.
export async function sendTelegramNotif(text) {
  let botToken = process.env.TELEGRAM_BOT_TOKEN;
  let chatId = process.env.TELEGRAM_CHAT_ID;
  try {
    const { getSettings } = await import("@/lib/settings");
    const s = await getSettings();
    if (s.telegramBotToken) botToken = s.telegramBotToken;
    if (s.telegramChatId) chatId = s.telegramChatId;
  } catch {}
  if (!botToken || !chatId) return;

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: [[{ text: "🛒 Order Nokos di Web", url: WEB_ORDER_URL }]]
        }
      })
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error("Gagal kirim notif Telegram:", res.status, errBody);
    }
  } catch (err) {
    console.error("Gagal kirim notif Telegram:", err?.message || err);
  }
}

export async function sendTelegramChannelNotif(text) {
  let botToken = process.env.TELEGRAM_BOT_TOKEN;
  let channelId = process.env.TELEGRAM_CHANNEL_ID;
  try {
    const { getSettings } = await import("@/lib/settings");
    const s = await getSettings();
    if (s.telegramBotToken) botToken = s.telegramBotToken;
    if (s.telegramChannelId) channelId = s.telegramChannelId;
  } catch {}
  if (!botToken || !channelId) return;

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: channelId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: [[{ text: "🛒 Order Nokos di Web", url: WEB_ORDER_URL }]]
        }
      })
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error("Gagal kirim notif channel Telegram:", res.status, errBody);
    }
  } catch (err) {
    console.error("Gagal kirim notif channel Telegram:", err?.message || err);
  }
}


export async function sendTelegramPhoto(pngBuffer, caption) {
  let botToken = process.env.TELEGRAM_BOT_TOKEN;
  let chatId = process.env.TELEGRAM_CHAT_ID;
  try {
    const { getSettings } = await import("@/lib/settings");
    const s = await getSettings();
    if (s.telegramBotToken) botToken = s.telegramBotToken;
    if (s.telegramChatId) chatId = s.telegramChatId;
  } catch {}
  if (!botToken || !chatId || !pngBuffer) return;

  try {
    const form = new FormData();
    form.append("chat_id", chatId);
    form.append("photo", new Blob([pngBuffer], { type: "image/png" }), "struk.png");
    if (caption) {
      form.append("caption", caption);
      form.append("parse_mode", "HTML");
    }
    form.append(
      "reply_markup",
      JSON.stringify({ inline_keyboard: [[{ text: "🛒 Order Nokos di Web", url: WEB_ORDER_URL }]] })
    );

    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
      method: "POST",
      body: form
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error("Gagal kirim foto struk Telegram:", res.status, errBody);
    }
  } catch (err) {
    console.error("Gagal kirim foto struk Telegram:", err?.message || err);
  }
}
