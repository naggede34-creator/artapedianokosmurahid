// Webhook BOT TOKO (pembeli). Bot owner yang lama tetap di
// app/api/telegram/webhook/route.js dan memakai token berbeda.
//
// Pasang webhook-nya lewat GET /api/bot/setup?secret=CRON_SECRET
import { NextResponse } from "next/server";
import {
  answerCallback,
  getSession,
  sendMessage,
  setSession,
  shopBotConfigured,
  webhookSecret,
  isShopBotOwner,
  esc
} from "@/lib/shopBot";
import {
  showHome,
  showWelcome,
  showServerStatus,
  showHowTo,
  filterServices,
  askLogin,
  doLogin,
  doRegister,
  showAccount,
  doLogout,
  showInfo,
  showServers,
  chooseServer,
  listServicesPage,
  askServiceQuery,
  chooseService,
  listCountriesPage,
  chooseCountry,
  confirmOrder,
  doOrder,
  checkStatus,
  askCancelOrder,
  doCancelOrder,
  showOrders,
  showDepositMethods,
  askDepositAmount,
  createDeposit,
  checkDeposit,
  cancelDeposit,
  confirmDepositManual,
  receiveDepositProof,
  showAdminPanel,
  askBroadcast,
  doBroadcast
} from "@/lib/shopBotFlow";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Telegram mengirim header ini kalau webhook dipasang dengan secret_token.
// Memakai webhookSecret() yang sama dengan pemasang webhook: kalau secretnya
// tidak sah, webhook dipasang TANPA secret, jadi di sini pun tidak boleh
// menuntutnya — kalau berbeda, semua update akan ditolak 401 dan menumpuk.
function verified(req) {
  const expected = webhookSecret();
  if (!expected) return true;
  return req.headers.get("x-telegram-bot-api-secret-token") === expected;
}

// Dibuka lewat browser (GET) hanya untuk memastikan alamatnya benar. Telegram
// selalu memakai POST, jadi di sini tidak ada pemrosesan apa pun.
export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "webhook bot toko",
    tokenTerpasang: shopBotConfigured(),
    catatan: "Alamat ini menerima update dari Telegram lewat POST. Untuk memasangnya, buka /api/bot/setup"
  });
}

export async function POST(req) {
  if (!shopBotConfigured()) return NextResponse.json({ ok: true });
  if (!verified(req)) return NextResponse.json({ ok: false }, { status: 401 });

  let update;
  try {
    update = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  try {
    if (update.callback_query) await handleCallback(update.callback_query);
    else if (update.message) await handleMessage(update.message);
  } catch (err) {
    console.error("[bot/webhook]", err?.message || err);
  }

  // Selalu 200: Telegram akan mengirim ulang update kalau dibalas error, dan
  // pengiriman ulang di jalur uang justru berbahaya.
  return NextResponse.json({ ok: true });
}

async function handleMessage(msg) {
  const chatId = msg.chat?.id;
  const text = (msg.text || "").trim();
  if (!chatId) return;

  // Foto bukti transfer untuk deposit manual. Diperiksa SEBELUM syarat teks di
  // bawah: pesan foto tidak punya msg.text, jadi kalau tidak ditangani di sini
  // ia akan dibuang diam-diam dan yang mengirim mengira botnya rusak.
  if (Array.isArray(msg.photo) && msg.photo.length) {
    const sesi = await getSession(chatId);
    if (sesi.step === "dep_proof") return receiveDepositProof(chatId, msg.photo);
    return sendMessage(chatId, "Fotonya belum dibutuhkan sekarang. Kalau mau kirim bukti transfer, buka depositnya dulu lalu tekan <b>Saya Sudah Bayar</b>.", [
      [{ text: "💰 Deposit", callback_data: "dep" }],
      [{ text: "← Menu", callback_data: "home" }]
    ]);
  }

  // Bukti transfer yang dikirim sebagai BERKAS, bukan foto. Telegram tidak
  // mengecilkannya, dan formatnya bisa apa saja — lebih baik diminta ulang
  // daripada disimpan sebagai sesuatu yang tidak bisa ditampilkan admin.
  if (msg.document) {
    const sesi = await getSession(chatId);
    if (sesi.step === "dep_proof") {
      return sendMessage(chatId, "Kirim buktinya sebagai <b>foto</b> ya, bukan berkas — supaya bisa langsung dilihat admin.");
    }
  }

  if (!text) return;

  // Perintah
  if (text.startsWith("/")) {
    const [cmd, ...rest] = text.split(/\s+/);
    const arg = rest.join(" ");

    if (cmd === "/start") {
      await setSession(chatId, { username: msg.from?.username || null });
      return showWelcome(chatId, msg.from);
    }
    if (cmd === "/menu") return showHome(chatId);
    if (cmd === "/saldo" || cmd === "/akun") {
      const r = await sendMessage(chatId, "Memuat akun…");
      return showAccount(chatId, r?.result?.message_id);
    }
    if (cmd === "/beli") {
      const r = await sendMessage(chatId, "Memuat server…");
      return showServers(chatId, r?.result?.message_id);
    }
    if (cmd === "/deposit") {
      const r = await sendMessage(chatId, "Memuat metode…");
      return showDepositMethods(chatId, r?.result?.message_id);
    }
    if (cmd === "/login") {
      const r = await sendMessage(chatId, "…");
      return askLogin(chatId, r?.result?.message_id);
    }
    if (cmd === "/cs") {
      const settings = await getSettings();
      const cs = (settings.csUsername || "teatlas").replace(/^@/, "");
      return sendMessage(chatId, `💬 Butuh bantuan? Hubungi CS kami:`, [
        [{ text: "💬 Chat Customer Service", url: `https://t.me/${cs}` }],
        [{ text: "← Menu", callback_data: "home" }]
      ]);
    }
    if (cmd === "/admin") {
      if (!isShopBotOwner(chatId)) return sendMessage(chatId, "Perintah ini khusus admin.");
      const r = await sendMessage(chatId, "…");
      return showAdminPanel(chatId, r?.result?.message_id);
    }
    if (cmd === "/broadcast") {
      if (!isShopBotOwner(chatId)) return sendMessage(chatId, "Perintah ini khusus admin.");
      if (!arg) return sendMessage(chatId, "Tulis pesannya: <code>/broadcast Halo semuanya</code>");
      return doBroadcast(chatId, arg);
    }
    return showHome(chatId, null, "Perintah tidak dikenali.");
  }

  // Lanjutan langkah yang sedang berjalan
  const session = await getSession(chatId);
  if (session.step === "login") return doLogin(chatId, text);

  if (session.step === "svq") {
    await setSession(chatId, { query: text, step: null, svPage: 0 });
    const r = await sendMessage(chatId, "🔍 Mencari…");
    return listServicesPage(chatId, r?.result?.message_id, 0);
  }

  if (session.step === "dep_amount") {
    const amount = Math.floor(Number(text.replace(/[^\d]/g, "")));
    const settings = await getSettings();
    const min = Math.max(1, settings.depositMin || 2000);
    const max = Math.max(1, settings.depositMax || 1000000);
    if (!Number.isFinite(amount) || amount < min || amount > max) {
      return sendMessage(
        chatId,
        `Nominal harus antara <b>${min.toLocaleString("id-ID")}</b> dan <b>${max.toLocaleString("id-ID")}</b>.\n\nKetik angkanya saja, mis. <code>25000</code>`
      );
    }
    return createDeposit(chatId, amount);
  }

  if (session.step === "broadcast") return doBroadcast(chatId, esc(text));

  // Kode akun yang dikirim tanpa menekan tombol Login
  if (/^AP-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/i.test(text)) return doLogin(chatId, text);

  return showHome(chatId, null, "Pilih menu di bawah ya 👇");
}

async function handleCallback(cb) {
  const chatId = cb.message?.chat?.id;
  const messageId = cb.message?.message_id;
  const data = cb.data || "";
  if (!chatId) return;

  await answerCallback(cb.id);

  const [key, a, b] = data.split(":");

  switch (key) {
    case "home":
      return showHome(chatId, messageId);
    case "login":
      return askLogin(chatId, messageId);
    case "reg":
      return doRegister(chatId, messageId, cb.from);
    case "acc":
      return showAccount(chatId, messageId);
    case "logout":
      return doLogout(chatId, messageId);
    case "info":
      return showInfo(chatId, messageId);
    case "srvstat":
      return showServerStatus(chatId, messageId);
    case "howto":
      return showHowTo(chatId, messageId);
    case "buy":
      return showServers(chatId, messageId);
    case "srv":
      return chooseServer(chatId, messageId, a);
    case "svp":
      return listServicesPage(chatId, messageId, Number(a) || 0);
    case "svq":
      return askServiceQuery(chatId, messageId);
    case "svf":
      // data ikut membawa kata kunci; kosong berarti hapus filter
      return filterServices(chatId, messageId, a || "");
    case "svc":
      return chooseService(chatId, messageId, Number(a));
    case "cop":
      return listCountriesPage(chatId, messageId, Number(a) || 0);
    case "cou":
      return chooseCountry(chatId, messageId, Number(a));
    case "prc":
      return confirmOrder(chatId, messageId, Number(a), Number(b));
    case "ord":
      return doOrder(chatId, messageId);
    case "st":
      return checkStatus(chatId, messageId, a);
    case "ocx":
      return askCancelOrder(chatId, messageId, a);
    case "ocy":
      return doCancelOrder(chatId, messageId, a);
    case "orders":
      return showOrders(chatId, messageId);
    case "dep":
      return showDepositMethods(chatId, messageId);
    case "dpm":
      return askDepositAmount(chatId, messageId, a);
    case "dpa":
      return createDeposit(chatId, Number(a), messageId);
    case "dst":
      return checkDeposit(chatId, messageId, a);
    case "dcx":
      return cancelDeposit(chatId, messageId, a);
    case "dok":
      return confirmDepositManual(chatId, messageId, a);
    case "adm":
      return showAdminPanel(chatId, messageId);
    case "adm_bc":
      return askBroadcast(chatId, messageId);
    default:
      return showHome(chatId, messageId);
  }
}
