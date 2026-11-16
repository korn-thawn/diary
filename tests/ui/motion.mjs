// Motion check: records videos of the main transitions (Chrome desktop + WebKit iPhone), grabs frames
// mid-transition, measures long tasks during them, and checks reduced-motion. Run seed.mjs first.
// usage: node tests/ui/motion.mjs   → tests/ui/out/motion-*.png and tests/ui/out/video/*.webm
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, devices, webkit } from "playwright-core";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(DIR, "out");
const BASE = process.env.TEST_BASE || "http://127.0.0.1:3101";
const U = JSON.parse(fs.readFileSync(path.join(DIR, ".user.json"), "utf8"));
let fails = 0;
const ok = (c, m, x) => { console.log(`${c ? "PASS" : "FAIL"}  ${m}${x !== undefined ? "  → " + JSON.stringify(x) : ""}`); if (!c) fails++; };

async function run(name, engine, opts, launch = {}) {
  const browser = await engine.launch({ headless: true, ...launch });
  const ctx = await browser.newContext({ ...opts, locale: "th-TH", timezoneId: "Asia/Bangkok", recordVideo: { dir: path.join(OUT, "video", name), size: { width: opts.viewport.width, height: opts.viewport.height } } });
  await ctx.request.post(`${BASE}/api/auth/login`, { data: { username: U.username, password: U.password } });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    window.__long = [];
    try { new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__long.push(Math.round(e.duration)))).observe({ type: "longtask", buffered: true }); } catch { /* not supported */ }
  });
  const shot = (n) => page.screenshot({ path: path.join(OUT, `motion-${name}-${n}.png`) });

  // home intro (first visit in this session)
  await page.goto(BASE + "/");
  await page.waitForTimeout(250);
  await shot("intro-250ms");
  await page.waitForTimeout(1500);
  await shot("intro-done");
  await page.evaluate(() => { window.__long = []; });

  // card → entry (film cut + time morph)
  const card = page.locator("#entries article a").first();
  await card.scrollIntoViewIfNeeded();
  await page.waitForTimeout(700);
  await card.click();
  await page.waitForTimeout(90);
  await shot("to-entry-90ms");
  await page.waitForTimeout(220);
  await shot("to-entry-310ms");
  await page.waitForTimeout(600);
  // back
  await page.locator("button", { hasText: "← กลับ" }).click();
  await page.waitForTimeout(120);
  await shot("back-120ms");
  await page.waitForTimeout(900);
  const long = await page.evaluate(() => window.__long);
  ok(long.every((d) => d < 120), `${name}: no long tasks ≥120ms during transitions`, long);

  // dialog open / close
  await page.goto(`${BASE}/boards/${U.boardId}?card=${U.cardId}`);
  await page.waitForTimeout(120);
  await shot("dialog-open-120ms");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(80);
  await shot("dialog-close-80ms");
  await page.waitForTimeout(500);
  await ctx.close();
  await browser.close();
}

await run("desk", chromium, { viewport: { width: 1280, height: 800 } }, { channel: "chrome" });
await run("phone", webkit, { ...devices["iPhone 13"], viewport: devices["iPhone 13"].viewport });

// reduced motion: nothing hidden, no intro animation running
{
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });
  await ctx.request.post(`${BASE}/api/auth/login`, { data: { username: U.username, password: U.password } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/");
  await page.waitForTimeout(150);
  const r = await page.evaluate(() => ({
    hidden: [...document.querySelectorAll("[data-reveal] > *, .intro-rise, .intro-time")].filter((el) => Number(getComputedStyle(el).opacity) < 0.99).length,
    intro: !!document.querySelector("[data-intro]"),
  }));
  ok(r.hidden === 0 && !r.intro, "reduced motion: everything visible at once, no intro", r);
  await browser.close();
}
console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
