"use client";

// Pengatur antrean popup pembuka.
//
// Ada tiga tahap, dan urutannya penting:
//   1. intro   — animasi loading selesai, layar sudah bebas.
//   2. comic   — komik pembuka sudah selesai dibaca atau dilewati.
//   3. openers — sapaan maskot sudah ditutup, popup lain boleh menyusul.
//
// Tanpa ini semua popup muncul bersamaan: sapaan maskot tertimbun di belakang
// animasi loading, lalu InfoModal menimpa sapaan yang baru saja tampil.

/**
 * @param batasMs  Kalau tidak ada yang menandai gerbang ini dalam sekian mili-
 *                 detik, ia menandai dirinya sendiri.
 *
 * Gunanya bukan mempercepat apa pun, tapi memastikan antrean tidak pernah
 * macet permanen. Satu komponen yang gagal dimuat, atau satu jalur keluar yang
 * lupa menandai gerbangnya, akan membuat SEMUA popup sesudahnya tidak pernah
 * muncul — dan kegagalan seperti itu tidak menimbulkan error apa pun, jadi
 * tidak ada yang tahu sampai ada yang mengeluh.
 */
function makeGate(batasMs = 0) {
  let done = false;
  const listeners = new Set();
  const gerbang = {
    isDone: () => done,
    mark() {
      if (done) return;
      done = true;
      for (const fn of listeners) {
        try {
          fn();
        } catch {
          // Satu pendengar yang error tidak boleh menahan yang lain.
        }
      }
      listeners.clear();
    },
    on(cb) {
      if (done) {
        cb();
        return () => {};
      }
      listeners.add(cb);
      return () => listeners.delete(cb);
    }
  };

  if (batasMs > 0 && typeof window !== "undefined") {
    setTimeout(() => gerbang.mark(), batasMs);
  }
  return gerbang;
}

// Gerbang komik TIDAK diberi batas waktu: panel terakhirnya memang menunggu
// ditekan, dan itu disengaja. Membuka gerbangnya sendiri di tengah jalan akan
// memunculkan sapaan maskot di atas komik yang masih terbuka.
const intro = makeGate(30_000);
const comic = makeGate();
// Sapaan maskot menutup sendiri sesudah kalimatnya habis, tapi batas ini tetap
// dipasang untuk keadaan yang tidak terduga — misalnya komponennya gagal
// dimuat sama sekali. Dihitung dari halaman dibuka, jadi longgar: komik yang
// dibaca perlahan tidak boleh ikut memicunya.
const openers = makeGate(90_000);

export const isIntroDone = intro.isDone;
export const markIntroDone = intro.mark;
export const onIntroDone = intro.on;

// Dipanggil komik pembuka saat selesai, dilewati, ATAU saat ia memutuskan
// tidak tampil sama sekali. Yang terakhir itu wajib: kalau komiknya diam saja
// tanpa menandai apa pun, sapaan maskot yang menunggunya tidak akan pernah
// muncul lagi seumur sesi itu.
export const isComicDone = comic.isDone;
export const markComicDone = comic.mark;
export const onComicDone = comic.on;

// Dipanggil sapaan maskot saat ditutup — atau saat ia memutuskan tidak tampil.
export const markOpenersFree = openers.mark;
export const onOpenersFree = openers.on;
