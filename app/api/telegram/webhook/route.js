import { NextResponse } from "next/server";
import { usersCol } from "@/lib/db";
import { sendMessage, isOwner, rupiah, HELP_TEXT } from "@/lib/telegramBot";
import { logBalance } from "@/lib/ledger";
import { esc } from "@/lib/telegram";
import { diagnoseRuangOtp, ruangOtpConfigured } from "@/lib/ruangotp";

// Set URL ini sebagai webhook bot di BotFather / API Telegram:
// https://domainkamu.vercel.app/api/telegram/webhook
// Lihat README.md bagian "Bot Telegram untuk Owner" untuk cara daftarnya.
export async function GET() {
  return NextResponse.json({ ok: true, info: "Endpoint webhook bot Telegram Artapedia." });
}

export async function POST(req) {
  try {
    // Kalau TELEGRAM_WEBHOOK_SECRET diisi, Telegram wajib mengirim header ini
    // supaya orang lain tidak bisa memanggil endpoint ini dari luar dan pura-pura jadi bot.
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (secret) {
      const header = req.headers.get("x-telegram-bot-api-secret-token");
      if (header !== secret) {
        return NextResponse.json({ ok: false }, { status: 401 });
      }
    }

    const update = await req.json().catch(() => ({}));
    const message = update.message || update.edited_message;
    if (!message || typeof message.text !== "string") {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id;
    const text = message.text.trim();

    if (!isOwner(chatId)) {
      // Diam-diam diabaikan (tidak dibalas) supaya bot tidak "bocor" ke orang selain owner.
      return NextResponse.json({ ok: true });
    }

    const [cmdRaw, ...args] = text.split(/\s+/);
    const cmd = cmdRaw.toLowerCase();
    const users = await usersCol();

    if (cmd === "/start" || cmd === "/help") {
      await sendMessage(chatId, HELP_TEXT);
    } else if (cmd === "/addsaldo") {
      await handleUbahSaldo(chatId, args, users, 1);
    } else if (cmd === "/kurangisaldo") {
      await handleUbahSaldo(chatId, args, users, -1);
    } else if (cmd === "/cekuser") {
      await handleCekUser(chatId, args, users);
    } else if (cmd === "/listuser") {
      await handleListUser(chatId, args, users);
    } else if (cmd === "/statistik") {
      await handleStatistik(chatId, users);
    } else if (cmd === "/statusruangotp") {
      if (!ruangOtpConfigured()) {
        await sendMessage(chatId, "RUANGOTP_USER_ID belum diisi di environment.");
      } else {
        try {
          const d = await diagnoseRuangOtp();
          const line = (id, label) => {
            const r = d[id] || {};
            if (r.ok) return `\u2705 ${label}: ${r.services} layanan`;
            return `\u274C ${label}: ${esc(r.error || "gagal")}${r.ipBlocked ? " (IP belum di-whitelist)" : ""}`;
          };
          await sendMessage(
            chatId,
            `\u{1F50C} <b>Status RuangOTP</b>\n` +
              `${line("ruangotp_s1", "Server Plus (S1)")}\n` +
              `${line("ruangotp_s2", "Server Express (S2)")}\n` +
              `Proxy IP statis: ${d.proxy ? "aktif" : "tidak dipakai"}`
          );
        } catch (e) {
          await sendMessage(chatId, `Gagal cek RuangOTP: ${esc(e.message)}`);
        }
      }
    } else {
      await sendMessage(chatId, "Perintah tidak dikenali. Ketik /help untuk lihat menu.");
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[telegram webhook]", err);
    // Tetap balas 200 supaya Telegram tidak retry berkali-kali walau ada error internal.
    return NextResponse.json({ ok: true });
  }
}

async function handleUbahSaldo(chatId, args, users, sign) {
  const [tokenRaw, nominalRaw] = args;
  const token = String(tokenRaw || "").trim().toUpperCase();
  const nominal = Math.floor(Number(nominalRaw));
  const contoh =
    sign > 0
      ? "Contoh: <code>/addsaldo AP-1234-ABCD-5678 10000</code>"
      : "Contoh: <code>/kurangisaldo AP-1234-ABCD-5678 10000</code>";

  if (!token || !nominal || nominal <= 0) {
    await sendMessage(chatId, `Format salah. ${contoh}`);
    return;
  }

  const existing = await users.findOne({ token });
  if (!existing) {
    await sendMessage(chatId, `Kode akun <code>${esc(token)}</code> tidak ditemukan.`);
    return;
  }

  if (sign < 0 && (existing.balance || 0) < nominal) {
    await sendMessage(
      chatId,
      `Saldo user hanya ${rupiah(existing.balance)}, tidak cukup untuk dikurangi ${rupiah(nominal)}.`
    );
    return;
  }

  const updated = await users.findOneAndUpdate(
    sign < 0 ? { token, balance: { $gte: nominal } } : { token },
    { $inc: { balance: sign * nominal } },
    { returnDocument: "after" }
  );
  if (!updated) {
    await sendMessage(chatId, "Saldo user berubah saat diproses, coba lagi.");
    return;
  }
  await logBalance({
    token,
    type: sign > 0 ? "admin_add" : "admin_sub",
    amount: sign * nominal,
    balanceAfter: updated.balance,
    title: sign > 0 ? "Penambahan oleh owner (bot)" : "Pengurangan oleh owner (bot)"
  });

  await sendMessage(
    chatId,
    `${sign > 0 ? "✅ Saldo ditambahkan" : "➖ Saldo dikurangi"}\n` +
      `Token: <code>${token}</code>\n` +
      `${sign > 0 ? "Tambahan" : "Pengurangan"}: ${rupiah(nominal)}\n` +
      `Saldo sekarang: ${rupiah(updated.balance)}`
  );
}

async function handleCekUser(chatId, args, users) {
  const token = String(args[0] || "").trim().toUpperCase();
  if (!token) {
    await sendMessage(chatId, "Format salah. Contoh: <code>/cekuser AP-1234-ABCD-5678</code>");
    return;
  }
  const user = await users.findOne({ token });
  if (!user) {
    await sendMessage(chatId, `Kode akun <code>${esc(token)}</code> tidak ditemukan.`);
    return;
  }
  const joined = user.createdAt ? new Date(user.createdAt).toLocaleString("id-ID") : "-";
  await sendMessage(
    chatId,
    `<b>Detail User</b>\n` +
      `Token: <code>${user.token}</code>\n` +
      (user.name ? `Nama: ${esc(user.name)}\n` : "") +
      `Saldo: ${rupiah(user.balance)}\n` +
      `Total deposit: ${rupiah(user.depositTotal || 0)} (${user.depositCount || 0}x)\n` +
      `Diundang oleh: ${user.referredBy ? `<code>${user.referredBy}</code>` : "-"}\n` +
      `Teman berhasil diundang: ${user.referralCount || 0}\n` +
      `Bonus referral didapat: ${rupiah(user.referralEarnings || 0)}\n` +
      `Bergabung: ${joined}`
  );
}

async function handleListUser(chatId, args, users) {
  const page = Math.max(1, Number(args[0]) || 1);
  const perPage = 10;
  const total = await users.countDocuments();
  const list = await users
    .find({})
    .sort({ createdAt: -1 })
    .skip((page - 1) * perPage)
    .limit(perPage)
    .toArray();

  if (!list.length) {
    await sendMessage(chatId, "Belum ada user, atau halaman kosong.");
    return;
  }

  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const lines = list.map(
    (u, i) => `${(page - 1) * perPage + i + 1}. <code>${u.token}</code> — ${rupiah(u.balance)}`
  );

  await sendMessage(
    chatId,
    `<b>Daftar User</b> (halaman ${page}/${totalPages}, total ${total})\n\n` +
      lines.join("\n") +
      (page < totalPages ? `\n\nHalaman berikutnya: <code>/listuser ${page + 1}</code>` : "")
  );
}

async function handleStatistik(chatId, users) {
  const [agg] = await users
    .aggregate([
      {
        $group: {
          _id: null,
          totalUser: { $sum: 1 },
          totalSaldo: { $sum: { $ifNull: ["$balance", 0] } },
          totalReferralEarnings: { $sum: { $ifNull: ["$referralEarnings", 0] } },
          totalReferralCount: { $sum: { $ifNull: ["$referralCount", 0] } }
        }
      }
    ])
    .toArray();

  await sendMessage(
    chatId,
    `<b>📊 Statistik Artapedia</b>\n\n` +
      `Total user: ${agg?.totalUser || 0}\n` +
      `Total saldo beredar: ${rupiah(agg?.totalSaldo || 0)}\n` +
      `Total teman berhasil diundang: ${agg?.totalReferralCount || 0}\n` +
      `Total bonus referral dibagikan: ${rupiah(agg?.totalReferralEarnings || 0)}`
  );
}
