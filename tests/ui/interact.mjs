// Interaction checks on the noir UI (Chrome desktop + WebKit iPhone). Run seed.mjs first.
// usage: node tests/ui/interact.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, devices, webkit } from "playwright-core";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.TEST_BASE || "http://127.0.0.1:3101";
const U = JSON.parse(fs.readFileSync(path.join(DIR, ".user.json"), "utf8"));
let fails = 0;
const ok = (c, m, x) => { console.log(`${c ? "PASS" : "FAIL"}  ${m}${x !== undefined && !c ? "  → " + JSON.stringify(x) : ""}`); if (!c) fails++; };
const css = (page, name) => page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name);

async function session(engine, opts, launch = {}) {
  const browser = await engine.launch({ headless: true, ...launch });
  const ctx = await browser.newContext({ ...opts, locale: "th-TH", timezoneId: "Asia/Bangkok" });
  await ctx.request.post(`${BASE}/api/auth/login`, { data: { username: U.username, password: U.password } });
  await ctx.request.put(`${BASE}/api/auth/appearance`, { data: {} });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return { browser, ctx, page, errors };
}
const go = async (page, u) => { await page.goto(BASE + u); await page.waitForLoadState("networkidle"); };

// ---------- desktop (Chrome) ----------
{
  const { browser, ctx, page, errors } = await session(chromium, { viewport: { width: 1280, height: 860 } }, { channel: "chrome" });
  await go(page, "/");
  ok(await page.locator("h1").first().isVisible(), "home hero renders");
  ok((await page.locator("#entries article").count()) === 6, "6 earlier entries on home", await page.locator("#entries article").count());
  ok(await page.evaluate(() => document.fonts.check('300 16px "Prompt"', "ก") && document.fonts.check('16px "IBM Plex Mono"', "0")), "Prompt + IBM Plex Mono loaded");
  ok((await css(page, "--bg")) === "#0b1211", "noir tokens on :root");
  ok(await page.evaluate(() => document.documentElement.classList.contains("dark")), ".dark always set");

  // photos below the fold load when scrolled to
  await page.locator("#entries").scrollIntoViewIfNeeded();
  await page.mouse.wheel(0, 1600);
  await page.waitForTimeout(800);
  const imgs = await page.evaluate(() => [...document.querySelectorAll("main img")].map((i) => i.complete && i.naturalWidth > 0));
  ok(imgs.length >= 3 && imgs.every(Boolean), "entry cover photos load", imgs);

  // mood calendar: previous month, then back, then tap a written night
  const title = () => page.locator("#moods h2").textContent();
  const before = await title();
  await page.getByRole("button", { name: "เดือนก่อน" }).click();
  await page.waitForTimeout(500);
  ok((await title()) !== before, "mood calendar goes to previous month");
  await page.getByRole("button", { name: "เดือนถัดไป" }).click();
  await page.waitForTimeout(500);
  ok((await title()) === before, "and back");
  await page.locator(`#moods a[href="/entries/${U.entryId}"]`).click();
  await page.waitForURL(new RegExp(`/entries/${U.entryId}$`));
  ok(true, "tapping a night opens its entry");

  // editor: atmosphere is saved and recolors the calendar square
  await page.getByRole("radio", { name: "ร้อนรุ่ม" }).click();
  await page.getByRole("button", { name: "บันทึก", exact: true }).click();
  await page.waitForURL(`${BASE}/`);
  await page.waitForLoadState("networkidle");
  const label = await page.locator(`#moods a[href="/entries/${U.entryId}"]`).getAttribute("aria-label");
  ok(/ร้อนรุ่ม/.test(label || ""), "atmosphere saved and shown in the mood calendar", label);

  // accent: live change + no flash on reload
  await go(page, "/settings");
  await page.getByRole("radio", { name: "หยก" }).click();
  await page.getByText("บันทึกแล้ว").waitFor({ timeout: 5000 });
  ok((await css(page, "--color-title")) === "#4fb8a0", "accent jade applied live", await css(page, "--color-title"));
  const p2 = await ctx.newPage();
  await p2.route(/\/assets\/.*\.js$/, (r) => r.abort());
  await p2.goto(BASE + "/settings");
  ok((await css(p2, "--color-title")) === "#4fb8a0", "accent applied before the app script runs");
  await p2.close();
  await page.getByRole("button", { name: "กลับค่าเริ่มต้น" }).click();
  await page.getByText("บันทึกแล้ว").waitFor({ timeout: 5000 });
  ok((await css(page, "--color-title")).toLowerCase() === "var(--red)" || (await css(page, "--color-title")) === "#c8261c", "reset to red");

  // motion: header/dock keep their own view-transition names; page changes run a view transition
  await go(page, "/");
  ok((await page.evaluate(() => getComputedStyle(document.querySelector("header")).viewTransitionName)) === "site-header", "header has its own view-transition name");
  const vtStarted = await page.evaluate(async () => {
    let started = false;
    const orig = document.startViewTransition?.bind(document);
    if (!orig) return "unsupported";
    document.startViewTransition = (cb) => { started = true; return orig(cb); };
    document.querySelector('header a[href="/boards"]').click();
    await new Promise((r) => setTimeout(r, 600));
    return started;
  });
  ok(vtStarted === true, "page change uses a view transition", vtStarted);
  ok(page.url().endsWith("/boards"), "navigated to boards");
  // shared element: card time ↔ big time in the editor carry the same name
  await go(page, "/");
  const cardId = await page.locator("#entries article a").first().getAttribute("href");
  await page.locator(`#entries article a[href="${cardId}"]`).first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(900);
  // names are given on tap, so record what is named when the transition starts
  await page.evaluate(() => {
    const orig = document.startViewTransition.bind(document);
    document.startViewTransition = (cb) => {
      window.__named = [...document.querySelectorAll("[data-vt-named]")].map((el) => el.style.viewTransitionName);
      return orig(cb);
    };
  });
  await page.locator(`#entries article a[href="${cardId}"]`).first().click();
  const nameOnCard = (await page.evaluate(() => window.__named || [])).find((n) => n.startsWith("entry-time-"));
  await page.waitForURL(new RegExp(cardId + "$"));
  await page.waitForTimeout(600);
  const nameInEditor = await page.locator(".neon-glow").first().evaluate((el) => getComputedStyle(el).viewTransitionName);
  ok(nameOnCard && nameOnCard === nameInEditor, "entry time morphs card → editor", { nameOnCard, nameInEditor });
  // home: everything revealed after scrolling, nothing stuck invisible
  await go(page, "/");
  await page.mouse.wheel(0, 4000);
  await page.waitForTimeout(1400);
  const hidden = await page.evaluate(() => [...document.querySelectorAll("[data-reveal] > *")].filter((el) => Number(getComputedStyle(el).opacity) < 0.99).length);
  ok(hidden === 0, "all revealed items visible after scrolling", hidden);
  // month change slides the grid (view transition with data-vt=month)
  const vtKind = await page.evaluate(async () => {
    let kind = null;
    const orig = document.startViewTransition.bind(document);
    document.startViewTransition = (cb) => { kind = document.documentElement.dataset.vt; return orig(cb); };
    document.querySelector('button[aria-label="เดือนก่อน"]').click();
    await new Promise((r) => setTimeout(r, 900));
    return kind;
  });
  ok(vtKind === "month", "month change slides with its own transition", vtKind);

  // dialog: closing animation, then gone; Esc closes it
  await go(page, `/boards/${U.boardId}?card=${U.cardId}`);
  await page.waitForTimeout(500);
  ok(await page.locator('[role="dialog"]').isVisible(), "card dialog opens");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(40);
  ok(await page.locator('[role="dialog"].is-closing').count() === 1, "dialog plays a closing animation");
  await page.waitForTimeout(400);
  ok(!(await page.locator('[role="dialog"]').count()), "Esc closes the dialog");
  ok(!new URL(page.url()).searchParams.get("card"), "closing clears ?card");

  // kanban drag still persists
  const card = page.locator('li[aria-label^="การ์ด ซื้อของเข้าบ้าน"]');
  const target = page.locator(`section[aria-label="คอลัมน์ กำลังทำ"]`);
  const a = await card.boundingBox(), b = await target.boundingBox();
  if (a && b) {
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    for (let i = 1; i <= 12; i++) await page.mouse.move(a.x + (b.x + b.width / 2 - a.x) * (i / 12), a.y + 20 + (b.y + 120 - a.y) * (i / 12));
    await page.mouse.up();
    await page.waitForTimeout(800);
    const board = await (await ctx.request.get(`${BASE}/api/boards/${U.boardId}`)).json();
    const doing = board.columns.find((c) => c.name === "กำลังทำ");
    ok(doing && board.cards.some((c) => c.title === "ซื้อของเข้าบ้าน" && c.column_id === doing.id), "kanban drag saved to server");
  } else ok(false, "kanban elements found", { a, b });

  ok(!errors.length, "no page errors (desktop)", errors.slice(0, 3));
  await browser.close();
}

// ---------- phone (WebKit iPhone 13) ----------
{
  const { browser, page, errors } = await session(webkit, { ...devices["iPhone 13"] });
  for (const u of ["/", "/entries", "/entries/new", `/boards/${U.boardId}`, "/calendar", "/settings", "/today"]) {
    await go(page, u);
    const w = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
    ok(w[0] <= w[1] || u.startsWith("/boards/"), `no sideways scroll ${u}`, w);
  }
  const dock = await page.locator('nav[aria-label="เมนูหลัก"] a, nav[aria-label="เมนูหลัก"] button').evaluateAll((els) => els.filter((e) => e.offsetParent).map((e) => Math.round(e.getBoundingClientRect().height)));
  ok(dock.length === 5 && dock.every((h) => h >= 44), "dock: 5 targets, all ≥ 44px tall", dock);
  await page.getByRole("button", { name: "เพิ่มเติม" }).click();
  await page.waitForTimeout(500);
  await page.getByRole("link", { name: "บันทึกทั้งหมด" }).click();
  await page.waitForURL(/\/entries$/);
  ok(true, "more sheet → all entries");
  // editor date/time fields don't overlap on iOS
  await go(page, "/meetings");
  await page.locator("button").filter({ hasText: "เพิ่ม" }).first().click();
  await page.waitForTimeout(700);
  const overlap = await page.evaluate(() => {
    const bs = [...document.querySelectorAll('[role="dialog"] input[type=date],[role="dialog"] input[type=time]')].map((e) => e.getBoundingClientRect());
    return bs.some((b, i) => bs.some((c, j) => j > i && b.left < c.right - 1 && c.left < b.right - 1 && b.top < c.bottom - 1 && c.top < b.bottom - 1));
  });
  ok(!overlap, "meeting dialog date/time fields don't overlap");


  ok(!errors.length, "no page errors (phone)", errors.slice(0, 3));
  await browser.close();
}

// ---------- swipe-to-close (Chrome mobile emulation: WebKit on Windows can't construct Touch events) ----------
{
  const { browser, page, errors } = await session(chromium, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, { channel: "chrome" });
  await go(page, "/meetings");
  await page.locator("button").filter({ hasText: "เพิ่ม" }).first().click();
  // bottom sheet: a short pull springs back, a long pull closes it
  const drag = async (dy) => {
    const h = await page.locator("[role=dialog] header").boundingBox();
    const x = h.x + 40, y = h.y + h.height / 2;
    await page.evaluate(async ({ x, y, dy }) => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const target = document.elementFromPoint(x, y);
      const t = (yy) => new Touch({ identifier: 1, target, clientX: x, clientY: yy });
      target.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, touches: [t(y)], changedTouches: [t(y)] }));
      for (let i = 1; i <= 6; i++) {
        await wait(50); // a finger, not a flick
        target.dispatchEvent(new TouchEvent("touchmove", { bubbles: true, touches: [t(y + (dy * i) / 6)], changedTouches: [t(y + (dy * i) / 6)] }));
      }
      target.dispatchEvent(new TouchEvent("touchend", { bubbles: true, touches: [], changedTouches: [t(y + dy)] }));
    }, { x, y, dy });
  };
  await page.waitForTimeout(300);
  await drag(40);
  await page.waitForTimeout(500);
  ok(await page.locator("[role=dialog]").count() === 1, "short pull: sheet stays open");
  await page.waitForTimeout(400); // slow enough not to count as a flick
  await drag(160);
  await page.waitForTimeout(500);
  ok(await page.locator("[role=dialog]").count() === 0, "long pull: sheet closes");
  ok(!errors.length, "no page errors (swipe)", errors.slice(0, 3));
  await browser.close();
}

console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
