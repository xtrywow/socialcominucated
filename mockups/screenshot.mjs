// Phone and desktop screenshots of each concept: node mockups/screenshot.mjs
// Set PLAYWRIGHT_MODULE to a global install path if playwright is not installed locally.
const pw = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const chromium = pw.chromium ?? pw.default.chromium;
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const outDir = join(dirname(fileURLToPath(import.meta.url)), "out");
const browser = await chromium.launch();
for (const slug of readdirSync(outDir)) {
  const url = pathToFileURL(join(outDir, slug, "index.html")).href;
  for (const [label, viewport] of [["phone", { width: 390, height: 844 }], ["desktop", { width: 1280, height: 800 }]]) {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
    await page.goto(url, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1600); // let the hero animation settle
    await page.screenshot({ path: join(outDir, slug, `${label}.png`) });
    await page.screenshot({ path: join(outDir, slug, `${label}-full.png`), fullPage: true });
    await page.close();
  }
  console.log(slug);
}
await browser.close();
