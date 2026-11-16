// WebKit (iPhone 13) navigation stress: real flows with view transitions, each in a fresh browser so one
// crash doesn't hide the rest. (Safari/iOS get a CSS-only page entrance, no View Transitions — see motion.js.) Fails if a page crashes. Run seed.mjs first.
// usage: node tests/ui/webkit-nav.mjs [scenario-filter]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { devices, webkit } from "playwright-core";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.TEST_BASE || "http://127.0.0.1:3101";
const U = JSON.parse(fs.readFileSync(path.join(DIR, ".user.json"), "utf8"));
const filter = process.argv[2];
let fails = 0;

const tapCard = (i, settle = 800) => async (page) => {
  const card = page.locator("#entries article a").nth(i);
  await card.scrollIntoViewIfNeeded();
  await page.waitForTimeout(settle);
  await card.tap();
};
const SCENARIOS = {
  "hero-early": async (page) => { await page.getByRole("link", { name: "อ่านต่อ" }).tap(); },
  "hero-late": async (page) => { await page.waitForTimeout(2500); await page.getByRole("link", { name: "อ่านต่อ" }).tap(); },
  "card-0": tapCard(0),
  "card-4": tapCard(4),
  "card-then-back": async (page) => { await tapCard(1)(page); await page.waitForTimeout(900); await page.locator("button", { hasText: "← กลับ" }).tap(); },
  "mood-square": async (page) => {
    const sq = page.locator('#moods a[href^="/entries/"]:not([href*="new"])').first();
    await sq.scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    await sq.tap();
  },
  "dock-tour": async (page) => {
    for (const href of ["/boards", "/today", "/calendar", "/"]) {
      await page.locator(`nav[aria-label="เมนูหลัก"] a[href="${href}"]`).last().tap();
      await page.waitForTimeout(700);
    }
  },
  "scrolled-to-boards": async (page) => { await page.evaluate(() => scrollTo(0, 900)); await page.waitForTimeout(1500); await page.locator("nav[aria-label=\"เมนูหลัก\"] a[href=\"/boards\"]").last().tap(); },
  "hop-boards-today": async (page) => { await page.locator("nav[aria-label=\"เมนูหลัก\"] a[href=\"/boards\"]").last().tap(); await page.waitForTimeout(900); await page.locator("nav[aria-label=\"เมนูหลัก\"] a[href=\"/today\"]").last().tap(); },
  "write-and-back": async (page) => { await page.locator("header a[href='/entries/new']").tap(); await page.waitForTimeout(800); await page.goBack(); },
};

for (const [name, run] of Object.entries(SCENARIOS)) {
  if (filter && !name.includes(filter)) continue;
  const browser = await webkit.launch();
  const ctx = await browser.newContext({ ...devices["iPhone 13"], locale: "th-TH" });
  await ctx.request.post(`${BASE}/api/auth/login`, { data: { username: U.username, password: U.password } });
  const page = await ctx.newPage();
  let crashed = false;
  page.on("crash", () => { crashed = true; });
  let err = null;
  try {
    await page.goto(BASE + "/");
    await page.waitForTimeout(1200);
    await run(page);
    await page.waitForTimeout(1000);
  } catch (e) { err = e.message.split("\n")[0]; }
  const good = !crashed && !err;
  if (!good) fails++;
  console.log(`${good ? "PASS" : "FAIL"}  ${name}${crashed ? "  → page crashed" : err ? "  → " + err : "  → " + page.url().replace(BASE, "")}`);
  await browser.close().catch(() => {});
}
console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
