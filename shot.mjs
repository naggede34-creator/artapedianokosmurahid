import { chromium } from "playwright";
const [,, url, out, w, h] = process.argv;
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await b.newPage({ viewport: { width: Number(w)||1280, height: Number(h)||900 }, deviceScaleFactor: 2 });
await p.addInitScript(() => { try {
  sessionStorage.setItem("artapedia_loaded","1"); sessionStorage.setItem("artapedia_intro_seen","1");
  sessionStorage.setItem("artapedia_mascot_greeted","1");
  localStorage.setItem("artapedia_intro_done","1"); localStorage.setItem("artapedia_info_read","1");
  localStorage.setItem("artapedia_info_dismissed","1"); localStorage.setItem("artapedia_tour_done","1");
} catch {} });
await p.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
await p.waitForTimeout(2000);
// gulirkan seluruh halaman supaya reveal-nya terpicu, lalu kembali ke atas
const H = await p.evaluate(() => document.body.scrollHeight);
for (let y = 0; y < H; y += 600) { await p.evaluate((v) => window.scrollTo(0, v), y); await p.waitForTimeout(110); }
await p.evaluate(() => window.scrollTo(0, 0));
await p.waitForTimeout(900);
await p.screenshot({ path: out, fullPage: true });
await b.close();
console.log("saved", out);
