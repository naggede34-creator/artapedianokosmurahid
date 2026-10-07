// Satu-satunya jalan untuk mengundi DAN mengabarkan hasilnya.
//
// Dulu pengumuman pemenang hanya ada di tombol "Undi" manual di rute admin.
// Undian otomatis dari cron memilih pemenang dan memasukkan hadiahnya, tapi
// tidak mengirim kabar apa pun — pemenangnya tidak pernah tahu dirinya menang,
// dan hadiah yang masuk tanpa keterangan terbaca seperti saldo yang muncul
// entah dari mana. Dengan satu fungsi bersama, jalur mana pun yang mengundi
// pasti ikut mengabari.
import { undiPemenang, undiYangJatuhTempo } from "@/lib/giveaway";
import { umumkan } from "@/lib/notifyHub";
import { giveawayMenangNotif } from "@/lib/giveawayNotif";
import { notifyBotUser } from "@/lib/shopBot";
import { kirimPush } from "@/lib/webPush";
import { rich } from "@/lib/rich";

const hadiahTeks = (ev) => `Rp${Number(ev.nilaiHadiah).toLocaleString("id-ID")}`;

/** Mengabarkan hasil undian: channel/admin, lalu tiap pemenang di chat botnya. */
export async function umumkanHasilUndi(event, pemenang) {
  if (!event) return;
  const teks = giveawayMenangNotif({ event, pemenang });
  await umumkan({ jenis: "giveaway_menang", admin: teks, publik: teks });

  // Satu pemenang yang gagal dikabari tidak boleh menghentikan yang lain.
  for (const p of (pemenang || []).filter((x) => !x.gagal)) {
    try {
      await notifyBotUser(
        p.token,
        rich([
          { h2: "🎉 SELAMAT, KAMU MENANG!" },
          { h1: `🏆 ${hadiahTeks(event)}` },
          { table: { rows: [["🎁 Giveaway", event.judul]] } },
          { hr: true },
          { footer: "Sudah masuk ke akunmu. Cek sekarang!" },
          { buttons: [[{ text: "🛒 Beli Nokos", callback_data: "buy", style: "primary" }]] }
        ])
      );
    } catch (err) {
      console.error("[giveaway] DM pemenang gagal:", err?.message || err);
    }
    // Pemenang yang hanya memakai web juga harus tahu. kirimPush tidak pernah melempar.
    await kirimPush(p.token, {
      judul: "Selamat, kamu menang! 🎉",
      isi: `${event.judul} — hadiah ${hadiahTeks(event)} sudah masuk ke akunmu.`,
      url: "/giveaway",
      tag: `gw-${event.giveawayId || event.judul}`
    });
  }
}

/** Undi manual satu event lalu kabari. */
export async function undiDanUmumkan(giveawayId) {
  const r = await undiPemenang(giveawayId);
  if (r.berubah) await umumkanHasilUndi(r.event, r.pemenang);
  return r;
}

/**
 * Undi semua event yang waktunya habis, lalu kabari.
 *
 * Aman dipanggil dari mana saja dan sesering apa pun: pengundiannya diklaim
 * secara atomik, jadi dua pemanggil bersamaan tidak bisa mengundi event yang
 * sama dua kali, dan pengumumannya hanya dikirim oleh yang menang klaim.
 */
export async function undiJatuhTempoDanUmumkan() {
  let hasil = [];
  try {
    hasil = await undiYangJatuhTempo();
    for (const h of hasil) await umumkanHasilUndi(h.event, h.pemenang);
  } catch (err) {
    console.error("[giveaway] undi jatuh tempo gagal:", err?.message || err);
  }
  return hasil;
}
