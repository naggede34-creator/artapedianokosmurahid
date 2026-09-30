// OCR bukti transfer memakai tesseract.js — berjalan di server sendiri, tanpa kunci API
// dan tanpa mengirim gambar ke pihak lain. Data bahasa Inggris (eng.traineddata.gz, cukup
// untuk angka & huruf Latin di struk pembayaran) ikut di repo supaya tidak mengunduh saat jalan.
//
// Satu pekerja dipakai berulang per proses dan dijalankan bergantian (antrean), karena
// tesseract memproses satu gambar sekali. Kegagalan APA PUN (modul, memori, waktu habis)
// dilempar ke pemanggil, yang harus menyerahkan bukti ke pengecekan admin — bukan menggagalkan deposit.
import path from "node:path";

const BATAS_WAKTU_MS = 25_000;
let pekerja = null;
let antrean = Promise.resolve();

async function ambilPekerja() {
  if (pekerja) return pekerja;
  const { createWorker } = await import("tesseract.js");
  pekerja = createWorker("eng", 1, {
    langPath: path.join(process.cwd(), "lib", "ocr", "data"),
    gzip: true,
    cacheMethod: "none",
    logger: () => {}
  });
  try { pekerja = await pekerja; } catch (err) { pekerja = null; throw err; }
  return pekerja;
}

function dataUrlKeBuffer(dataUrl) {
  const m = /^data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/=\s]+)$/i.exec(String(dataUrl || ""));
  if (!m) throw new Error("format gambar tidak didukung untuk OCR");
  return Buffer.from(m[2].replace(/\s+/g, ""), "base64");
}

/** Membaca teks dari gambar (data URL). Melempar galat bila gagal. */
export function bacaTeks(dataUrl) {
  const buf = dataUrlKeBuffer(dataUrl);
  const kerja = antrean.then(async () => {
    const w = await ambilPekerja();
    let timer;
    const habis = new Promise((_, tolak) => { timer = setTimeout(() => tolak(new Error("OCR terlalu lama")), BATAS_WAKTU_MS); });
    try {
      const { data } = await Promise.race([w.recognize(buf), habis]);
      return { teks: String(data.text || ""), keyakinan: Number(data.confidence) || 0 };
    } catch (err) {
      // Pekerja yang macet dibuang; permintaan berikutnya membuat yang baru.
      try { await w.terminate(); } catch {}
      pekerja = null;
      throw err;
    } finally {
      clearTimeout(timer);
    }
  });
  antrean = kerja.catch(() => {});
  return kerja;
}
