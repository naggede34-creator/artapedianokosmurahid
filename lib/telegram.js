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

// Nomor yang sudah dibeli tetap milik pembeli sampai masa aktifnya habis, dan
// siapa pun yang tahu nomornya bisa memakainya untuk verifikasi lain. Karena
// itu nomor disamarkan di SEMUA notifikasi — chat admin maupun channel —
// bukan hanya di salinan publiknya. Nomor utuhnya tetap ada di halaman pesanan
// pembeli dan di chat botnya, yang memang cuma dia yang bisa membuka.
function maskPhone(phone = "") {
  const t = String(phone || "").replace(/\D/g, "");
  if (!t) return "—";
  if (t.length <= 7) return `${t.slice(0, 2)}••••`;
  return `${t.slice(0, 4)}••••${t.slice(-3)}`;
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
const PROVIDER_LABEL = { warungnokos: "QRIS WarungNokos", pakasir: "QRIS Pakasir", rumahotp: "QRIS RumahOTP" };
function providerLabel(p) { return PROVIDER_LABEL[p] || p || "—"; }

const HDR = "━━━━━━━━━━━━━━━━━━━━━━━━";
const HDR_THIN = "┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄";

function channelFooter() {
  const chan1 = process.env.TELEGRAM_CHANNEL_1 || "https://t.me/kkaelnokosmurah";
  return `\n${HDR_THIN}\n📢 <a href="${chan1}">Channel Info &amp; Promo</a>`;
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
    `└ ☎️ Nomor     ╸ <code>${maskPhone(phoneNumber)}</code>\n` +
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
    `└ ☎️ Nomor     ╸ <code>${maskPhone(phoneNumber)}</code>\n` +
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

export function transferNotif({ fromToken, toToken, amount, fee = 0, fromBalance }) {
  return (
    `🔁 <b>TRANSFER SALDO ANTAR USER</b>\n` +
    `${HDR}\n\n` +

    `💸 <b>DETAIL TRANSFER</b>\n` +
    `├ 📤 Dari      ╸ <code>${maskToken(fromToken)}</code>\n` +
    `├ 📥 Ke        ╸ <code>${maskToken(toToken)}</code>\n` +
    `${fee > 0 ? `├ 💰 Nominal   ╸ <b>${rupiah(amount)}</b>\n` : `└ 💰 Nominal   ╸ <b>${rupiah(amount)}</b>\n`}` +
    (fee > 0 ? `└ 🧾 Biaya adm ╸ <b>${rupiah(fee)}</b>\n` : ``) +
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

// ────────────────────────────── STOK & HARGA ──────────────────────────────

// Nama layanan yang enak dibaca; kode mentah dipakai kalau tidak dikenal.
const SERVICE_LABELS = {
  wa: "WhatsApp",
  whatsapp: "WhatsApp",
  tg: "Telegram",
  telegram: "Telegram",
  gojek: "Gojek",
  shopee: "Shopee",
  dana: "DANA",
  grab: "Grab",
  ovo: "OVO",
  tokopedia: "Tokopedia",
  ig: "Instagram",
  fb: "Facebook",
  tiktok: "TikTok"
};

function serviceLabel(code) {
  const key = String(code || "").toLowerCase();
  return SERVICE_LABELS[key] || String(code || "-").toUpperCase();
}

function stockBadge(stock) {
  if (stock === null || stock === undefined) return "tersedia";
  const n = Number(stock);
  if (!Number.isFinite(n) || n <= 0) return "habis";
  if (n < 10) return `${n} (menipis)`;
  return String(n);
}

// groups: [{ service, rows: [{ server, price, stock }] }] — rows sudah urut termurah.
export function stockReportNotif(groups, { serverName = (k) => k } = {}) {
  if (!Array.isArray(groups) || groups.length === 0) {
    return (
      `\u{1F4E6} <b>INFO STOK &amp; HARGA NOKOS</b>\n` +
      `${HDR}\n\n` +
      `\u26A0\uFE0F Stok belum bisa diambil dari provider saat ini. Coba cek lagi beberapa saat lagi.\n\n` +
      `\u{1F552} ${nowWIB()}\n` +
      `${HDR}` +
      channelFooter()
    );
  }

  const body = groups
    .map((g) => {
      const head = `\u{1F4F1} <b>${esc(serviceLabel(g.service))}</b>\n`;
      const lines = g.rows.map((r, i) => {
        const last = i === g.rows.length - 1;
        const tag = r.price === g.rows[0].price ? " \u{1F525}" : "";
        return (
          `${last ? "\u2514" : "\u251C"} ${esc(serverName(r.server))} \u2578 <b>${rupiah(r.price)}</b>` +
          ` \u00B7 stok ${esc(stockBadge(r.stock))}${tag}\n`
        );
      });
      return head + lines.join("");
    })
    .join("\n");

  return (
    `\u{1F4E6} <b>INFO STOK &amp; HARGA NOKOS</b>\n` +
    `${HDR}\n\n` +
    body +
    `\n\u{1F525} = harga termurah di layanan itu\n` +
    `\u{1F4CD} Harga untuk nomor <b>Indonesia</b>, sudah harga jual final.\n\n` +
    `\u{1F552} ${nowWIB()}\n` +
    `${HDR}\n` +
    `\u26A1 <i>Stok bergerak cepat — buruan order sebelum habis!</i>` +
    channelFooter()
  );
}

// ────────────────────────────── SEND HELPERS ──────────────────────────────

// ═══════════════════════════ VERSI PUBLIK ═══════════════════════════
//
// Dipakai untuk salinan yang dikirim ke CHANNEL, yang ada membernya.
// Versi lengkapnya tetap dikirim ke chat admin tanpa perubahan.
//
// Yang dihilangkan di sini bukan basa-basi: notif "kode OTP diterima" versi
// admin memuat nomor lengkap DAN kode OTP asli. Kalau itu tampil di channel,
// siapa pun yang gabung bisa membacanya beberapa detik setelah kodenya masuk,
// lalu memakainya untuk mengambil alih verifikasi yang baru saja dibayar
// pembelinya. Gunanya notif ini di channel adalah menunjukkan toko hidup dan
// pesanannya berhasil — dan itu tetap tersampaikan tanpa kodenya.

export function depositSuccessPublicNotif({ provider, amount, token, createdAt, depositCount }) {
  const paidIn = createdAt ? durationText(createdAt) : null;
  const cnt = Number(depositCount) || 0;
  return (
    `✅  <b>DEPOSIT BERHASIL</b>\n` +
    `${HDR}\n\n` +
    `💳  Metode    ╸ <b>${esc(providerLabel(provider))}</b>\n` +
    `💰  Nominal   ╸ <b>${rupiah(amount)}</b>\n` +
    `⚡  Diproses  ╸ ${paidIn ? `<b>${paidIn}</b>` : "otomatis"}\n` +
    `👤  Pembeli   ╸ <code>${maskToken(token)}</code>\n` +
    (cnt > 0 ? `🏆  Deposit   ╸ transaksi ke-${cnt.toLocaleString("id-ID")}\n` : ``) +
    `\n${HDR_THIN}\n` +
    `🕒 ${nowWIB()}\n` +
    `<i>Saldo masuk otomatis, tanpa konfirmasi admin.</i>` +
    channelFooter()
  );
}

export function otpReceivedPublicNotif({ serviceName, countryName, phoneNumber, token, createdAt }) {
  const waited = createdAt ? durationText(createdAt) : null;
  return (
    `🔓  <b>KODE OTP MASUK</b>\n` +
    `${HDR}\n\n` +
    `🏷️  Layanan   ╸ <b>${esc(serviceName || "—")}</b>\n` +
    `🌍  Negara    ╸ ${esc(countryName || "—")}\n` +
    `☎️  Nomor     ╸ <code>${maskPhone(phoneNumber)}</code>\n` +
    `⚡  Menunggu  ╸ ${waited ? `<b>${waited}</b>` : "—"}\n` +
    `👤  Pembeli   ╸ <code>${maskToken(token)}</code>\n` +
    `\n${HDR_THIN}\n` +
    `🔑  Kode      ╸ <b>dikirim langsung ke pembeli</b>\n` +
    `🕒 ${nowWIB()}` +
    channelFooter()
  );
}

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

// Menyimpan id pesan yang sedang dipin di channel, supaya yang lama bisa
// dilepas saat ada yang baru. Ditulis langsung ke koleksi settings, bukan
// lewat updateSettings — itu punya daftar izin untuk nilai yang diatur admin,
// sedangkan ini catatan internal.
async function bacaPinTerakhir() {
  try {
    const { settingsCol } = await import("@/lib/db");
    const col = await settingsCol();
    const doc = await col.findOne({ _id: "config" }, { projection: { channelPinnedMsgId: 1 } });
    return doc?.channelPinnedMsgId || null;
  } catch {
    return null;
  }
}

async function simpanPinTerakhir(messageId) {
  try {
    const { settingsCol } = await import("@/lib/db");
    const col = await settingsCol();
    await col.updateOne({ _id: "config" }, { $set: { channelPinnedMsgId: messageId } }, { upsert: true });
  } catch (err) {
    console.error("Gagal menyimpan id pin channel:", err?.message || err);
  }
}

async function tgChannel(botToken, method, body) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12000)
    });
    const data = await res.json().catch(() => null);
    if (!data?.ok) console.error(`Telegram ${method} gagal:`, data?.description || res.status);
    return data;
  } catch (err) {
    console.error(`Telegram ${method} error:`, err?.message || err);
    return null;
  }
}

/**
 * @param {string} text
 * @param {{pin?: boolean}} opsi
 *   pin: pasang pesan ini sebagai pin channel, dan LEPAS pin sebelumnya.
 *        Sengaja satu pin saja: kalau setiap deposit dan setiap OTP ikut
 *        dipin tanpa melepas yang lama, dalam sehari daftar pin channel
 *        berisi puluhan pesan dan tidak ada gunanya lagi sebagai sorotan.
 */
export async function sendTelegramChannelNotif(text, { pin = false } = {}) {
  let botToken = process.env.TELEGRAM_BOT_TOKEN;
  let channelId = process.env.TELEGRAM_CHANNEL_ID;
  try {
    const { getSettings } = await import("@/lib/settings");
    const s = await getSettings();
    if (s.telegramBotToken) botToken = s.telegramBotToken;
    if (s.telegramChannelId) channelId = s.telegramChannelId;
  } catch {}
  if (!botToken || !channelId) return null;

  const kirim = await tgChannel(botToken, "sendMessage", {
    chat_id: channelId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: [[{ text: "🛒 Order Nokos di Web", url: WEB_ORDER_URL }]]
    }
  });

  const messageId = kirim?.result?.message_id || null;
  if (!pin || !messageId) return messageId;

  // Dipin tanpa membunyikan notifikasi: pesannya sendiri sudah membunyikan
  // notifikasi saat dikirim, jadi membunyikannya lagi untuk pin berarti dua
  // getaran per transaksi ke semua member.
  const hasilPin = await tgChannel(botToken, "pinChatMessage", {
    chat_id: channelId,
    message_id: messageId,
    disable_notification: true
  });

  // Pin lama baru dilepas SESUDAH yang baru terpasang. Kalau dibalik dan
  // pemasangannya gagal, channel jadi tidak punya pin sama sekali.
  if (hasilPin?.ok) {
    const lama = await bacaPinTerakhir();
    if (lama && lama !== messageId) {
      await tgChannel(botToken, "unpinChatMessage", { chat_id: channelId, message_id: lama });
    }
    await simpanPinTerakhir(messageId);
  }

  return messageId;
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
