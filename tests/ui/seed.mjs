// Create a UI test user with realistic sample data (entries with atmosphere / weather / photos, a board,
// meetings, events). Writes tests/ui/.user.json for the other UI scripts. Remove it with cleanup.mjs.
// usage: node tests/ui/seed.mjs   (server must be running; TEST_BASE defaults to http://127.0.0.1:3101)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.TEST_BASE || "http://127.0.0.1:3101";
const B = BASE + "/api";
let cookie = "";
async function call(p, method = "GET", body, raw) {
  const headers = { ...(cookie ? { cookie } : {}) };
  if (body !== undefined && !raw) headers["Content-Type"] = "application/json";
  const r = await fetch(B + p, { method, headers, body: raw ? body : body === undefined ? undefined : JSON.stringify(body) });
  const sc = r.headers.get("set-cookie");
  if (sc) cookie = sc.split(";")[0];
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`${method} ${p} → ${r.status} ${JSON.stringify(j)}`);
  return j;
}

// Paint a few abstract "night photos" in a real browser so they are genuine WebP files (no film stills).
async function makePhotos() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage();
  const out = await page.evaluate(async () => {
    const scenes = [
      ["#0b1d2a", "#c8261c", "#f4d35e"],
      ["#123b33", "#4fb8a0", "#f2e8d5"],
      ["#2a1a0a", "#e9b872", "#c8261c"],
    ];
    const enc = async (c, q) => new Uint8Array(await (await new Promise((r) => c.toBlob(r, "image/webp", q))).arrayBuffer());
    const res = [];
    for (const [bg, a, b] of scenes) {
      const c = document.createElement("canvas");
      c.width = 1200; c.height = 800;
      const g = c.getContext("2d");
      g.fillStyle = bg; g.fillRect(0, 0, 1200, 800);
      for (let i = 0; i < 40; i++) {
        g.globalAlpha = 0.15 + Math.random() * 0.5;
        g.fillStyle = i % 3 ? a : b;
        g.beginPath(); g.arc(Math.random() * 1200, Math.random() * 800, 10 + Math.random() * 80, 0, Math.PI * 2); g.fill();
      }
      g.globalAlpha = 1;
      g.fillStyle = b; g.fillRect(0, 560, 1200, 6);
      const t = document.createElement("canvas"); t.width = 480; t.height = 320;
      t.getContext("2d").drawImage(c, 0, 0, 480, 320);
      res.push({ full: Array.from(await enc(c, 0.85)), thumb: Array.from(await enc(t, 0.8)) });
    }
    return res;
  });
  await browser.close();
  return out.map((p) => ({ full: new Uint8Array(p.full), thumb: new Uint8Array(p.thumb) }));
}

async function upload(entryId, photo, w = 1200, h = 800) {
  const fd = new FormData();
  fd.append("full", new Blob([photo.full], { type: "image/webp" }), "full.webp");
  fd.append("thumb", new Blob([photo.thumb], { type: "image/webp" }), "thumb.webp");
  fd.append("width", String(w));
  fd.append("height", String(h));
  return call(`/photos?entryId=${entryId}`, "POST", fd, true);
}

const pad = (n) => String(n).padStart(2, "0");
const day = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const username = `uidemo_${Date.now().toString(36)}`, password = "demoPass123";
await call("/auth/register", "POST", { username, password });
const photos = await makePhotos();

// [days ago, title, body, mood, atmosphere, weather, temp, caption, photo index]
const E = [
  [-12, "ตลาดเช้าที่ยังไม่ตื่น", "เดินผ่านตลาดตอนตีห้า แผงผักเพิ่งเปิด ไฟนีออนสีเขียวของร้านยาฝั่งตรงข้ามยังไม่ดับ", 3, "calm", "fog", 22, null, null],
  [-9, "ประชุมยาวกว่าที่คิด", "สามชั่วโมงเต็ม จบด้วยข้อสรุปที่ทุกคนรู้ตั้งแต่ชั่วโมงแรก กลับบ้านมาเลยต้มมาม่ากินเงียบๆ", 2, "hot", "hot", 33, null, null],
  [-7, "แมวข้างบ้านกลับมาแล้ว", "หายไปสองอาทิตย์ วันนี้มานั่งรอหน้าประตูเหมือนไม่เคยไปไหน", 4, "warm", "clear", 29, "มันกลับมาตอนที่ผมเลิกรอพอดี", 2],
  [-5, "", "วันธรรมดาที่ไม่มีอะไรเกิดขึ้น และนั่นก็ดีแล้ว", 3, null, "cloudy", null, null, null],
  [-4, "เพลงเดิมในร้านกาแฟ", "เจ้าของร้านเปิดอัลบั้มเดิมทุกวันพฤหัส ฟังจนจำได้ว่าเพลงที่สามจะสะดุดตรงไหน", 4, "calm", "drizzle", 26, null, 1],
  [-2, "รถเมล์สายสุดท้าย", "วิ่งไล่ทันแบบเฉียดฉิว คนขับพยักหน้าเหมือนรู้ว่าผมจะมา", 4, "warm", "rain", 25, null, null],
  [-1, "งานเสร็จก่อนเที่ยงคืน", "ส่งงานได้สักที เปิดหน้าต่างรับลม ข้างล่างมีคนหัวเราะเสียงดัง", 5, "hot", "clear", 28, null, null],
  [0, "ฝนหยุดตอนตีสอง", "ถนนยังเปียก ไฟจากร้านสะดวกซื้อสะท้อนเป็นทางยาว ผมจดเวลาไว้เผื่อวันหนึ่งอยากจำว่าคืนนี้เงียบแค่ไหน", 4, "calm", "drizzle", 24, "คืนนี้ฝนตกนานกว่าที่พยากรณ์บอกไว้", 0],
];
let entryId;
for (const [off, title, body, mood, atmosphere, weather, temp_c, caption, ph] of E) {
  const { entry } = await call("/entries", "POST", { entry_date: day(off), title, body, mood, tags: [], atmosphere, weather, temp_c, caption });
  if (ph !== null) await upload(entry.id, photos[ph]);
  entryId = entry.id;
}

const board = (await call("/boards")).boards[0];
const cols = (await call(`/boards/${board.id}`)).columns;
const l1 = (await call("/boards/labels", "POST", { name: "ด่วน", color: "rose" })).label;
const l2 = (await call("/boards/labels", "POST", { name: "บ้าน", color: "teal" })).label;
const mk = async (col, title, patch = {}) => {
  const c = (await call(`/boards/columns/${col}/cards`, "POST", { title })).card;
  if (Object.keys(patch).length) await call(`/boards/cards/${c.id}`, "PATCH", patch);
  return c;
};
const card = await mk(cols[0].id, "จ่ายค่าไฟ ค่าน้ำ", { due_date: day(-2), labelIds: [l1.id, l2.id], priority: 3 });
await mk(cols[0].id, "ซื้อของเข้าบ้าน", { due_date: day(1), due_time: "18:00", labelIds: [l2.id] });
await mk(cols[1].id, "ทำสไลด์นำเสนอ", { due_date: day(3), priority: 2 });
await mk(cols[2].id, "ล้างรถ");
await call("/boards", "POST", { name: "ทริปญี่ปุ่น", color: "rose", icon: "airplane" });
await call("/events", "POST", { title: "วันเกิดแม่", date: "1965-" + day(5).slice(5), repeat: "yearly", icon: "cake", color: "rose" });
const m = (await call("/meetings", "POST", { title: "Standup ทีม", date: day(0), start_time: "09:30", end_time: "09:45", repeat: "weekdays" })).meeting;
await call("/meetings", "POST", { title: "คุยลูกค้า", date: day(0), start_time: "09:40", end_time: "10:30", location: "ออฟฟิศชั้น 5" });

fs.writeFileSync(path.join(DIR, ".user.json"), JSON.stringify({ username, password, entryId, boardId: board.id, cardId: card.id, meetingId: m.id, today: day(0) }, null, 2));
console.log("seeded", username);
