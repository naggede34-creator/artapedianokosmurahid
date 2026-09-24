// Bot mana yang sedang melayani permintaan INI.
//
// Bot toko dulunya satu, tokennya dibaca langsung dari SHOP_BOT_TOKEN di
// setiap pemanggilan. Sekarang admin bisa menambah bot lain, dan alur botnya
// — 1.400 baris di lib/shopBotFlow.js — memanggil sendMessage/editMessage
// dari puluhan tempat tanpa pernah tahu bot mana yang memanggilnya.
//
// Meneruskan "bot" sebagai argumen ke seluruh alur berarti menyentuh hampir
// setiap baris di sana, dan satu tempat yang terlewat akan MENJAWAB DARI BOT
// YANG SALAH — pembeli bot B menerima balasan dari bot A yang tidak pernah ia
// mulai, jadi Telegram menolaknya dan pesannya hilang tanpa error.
//
// AsyncLocalStorage menempelkan botnya pada rantai async permintaan itu
// sendiri. Alur botnya tidak perlu diubah sama sekali, dan tidak ada tempat
// yang bisa "lupa" meneruskannya.
import { AsyncLocalStorage } from "node:async_hooks";

const storage = new AsyncLocalStorage();

/** Jalankan fn dengan bot ini sebagai bot yang aktif. */
export function jalankanDenganBot(bot, fn) {
  return storage.run(bot, fn);
}

/** Bot yang sedang aktif, atau null kalau dipanggil di luar konteks bot. */
export function botAktif() {
  return storage.getStore() || null;
}
