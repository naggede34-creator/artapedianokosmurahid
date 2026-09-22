"use client";

// Pengatur antrean popup pembuka.
//
// Ada dua tahap:
//   1. intro   — animasi loading selesai, layar sudah bebas.
//   2. openers — sapaan maskot sudah ditutup, popup lain boleh menyusul.
//
// Tanpa ini semua popup muncul bersamaan: sapaan maskot tertimbun di belakang
// animasi loading, lalu InfoModal menimpa sapaan yang baru saja tampil.

function makeGate() {
  let done = false;
  const listeners = new Set();
  return {
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
}

const intro = makeGate();
const openers = makeGate();

export const isIntroDone = intro.isDone;
export const markIntroDone = intro.mark;
export const onIntroDone = intro.on;

// Dipanggil sapaan maskot saat ditutup — atau saat ia memutuskan tidak tampil.
export const markOpenersFree = openers.mark;
export const onOpenersFree = openers.on;
