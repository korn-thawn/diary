// Screenshot every page: Chrome at 1280 px and WebKit as an iPhone 13. Also fails on sideways scroll
// and page errors. Run seed.mjs first.  usage: node tests/ui/shoot.mjs [name-filter] [--desk|--phone]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, devices, webkit } from "playwright-core";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(DIR, "out");
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.TEST_BASE || "http://127.0.0.1:3101";
const args = process.argv.slice(2);
const filter = args.find((a) => !a.startsWith("--"));
const U = JSON.parse(fs.readFileSync(path.join(DIR, ".user.json"), "utf8"));

const PAGES = [
  ["home", "/", { full: true }],
  ["entries", "/entries"],
  ["entry-edit", `/entries/${U.entryId}`, { full: true }],
  ["entry-new", "/entries/new"],
  ["today", `/today?date=${U.today}`],
  ["boards", "/boards"],
  ["board", `/boards/${U.boardId}`],
  ["card", `/boards/${U.boardId}?card=${U.cardId}`, { dialog: true }],
  ["calendar", "/calendar"],
  ["meeting", `/today?date=${U.today}&m=${U.meetingId}&d=${U.today}`, { dialog: true }],
  ["events", "/events"],
  ["meetings", "/meetings"],
  ["stats", "/stats"],
  ["settings", "/settings", { full: true }],
  ["login", "/login", { anon: true }],
];
const TARGETS = [
  ["desk", chromium, { viewport: { width: 1280, height: 860 } }, { channel: "chrome" }],
  ["phone", webkit, { ...devices["iPhone 13"] }, {}],
].filter(([n]) => !(args.includes("--desk") && n !== "desk") && !(args.includes("--phone") && n !== "phone"));

let problems = 0;
for (const [name, engine, ctxOpts, launchOpts] of TARGETS) {
  const browser = await engine.launch({ headless: true, ...launchOpts });
  const ctx = await browser.newContext({ ...ctxOpts, locale: "th-TH", timezoneId: "Asia/Bangkok" });
  const login = await ctx.request.post(`${BASE}/api/auth/login`, { data: { username: U.username, password: U.password } });
  if (!login.ok()) throw new Error("login failed " + login.status());
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && !/favicon|Failed to load resource.*40[14]/.test(m.text()) && errors.push(m.text()));
  for (const [pname, url, opt = {}] of PAGES) {
    if (filter && !pname.includes(filter)) continue;
    if (opt.anon) await ctx.clearCookies();
    await page.goto(BASE + url);
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(opt.dialog ? 900 : 400);
    const w = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
    if (w[0] > w[1]) { problems++; console.log(`OVERFLOW ${name}/${pname} ${w[0]}>${w[1]}`); }
    await page.screenshot({ path: path.join(OUT, `${pname}-${name}.png`), fullPage: !!opt.full && !opt.dialog });
  }
  if (errors.length) { problems++; console.log(`ERRORS ${name}:`, errors.slice(0, 5)); }
  await browser.close();
}
console.log(problems ? `${problems} problem(s)` : "screenshots ok");
process.exit(problems ? 1 : 0);
