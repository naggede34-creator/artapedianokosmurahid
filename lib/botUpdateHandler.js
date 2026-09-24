// Penanganan satu update Telegram dari bot toko.
//
// Dipisah dari rutenya supaya BOT PERTAMA (dari SHOP_BOT_TOKEN) dan BOT-BOT
// yang ditambahkan admin menjalankan kode yang sama persis, bukan dua salinan
// yang mirip. Dua salinan akan berbeda pelan-pelan, dan bot kedua akan mulai
// berperilaku lain tanpa ada yang menyadarinya sampai ada pembeli yang
// mengeluh.
//
// Bot mana yang menjawab ditentukan oleh konteks (lib/botContext.js), bukan
// oleh argumen — lihat alasannya di sana.
import {
  answerCallback,
  getSession,
  sendMessage,
  setSession,
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


/** Satu update Telegram. Pemanggilnya sudah menetapkan bot aktif di konteks. */
export async function tanganiUpdate(update) {
  if (update?.callback_query) return handleCallback(update.callback_query);
  if (update?.message) return handleMessage(update.message);
  return undefined;
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
