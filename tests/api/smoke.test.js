// Quick end-to-end smoke over the other areas: boards, events, meetings, calendar, ICS, health.
const test = require("node:test");
const assert = require("node:assert/strict");
const { agent, newUser, removeUser, BASE } = require("./helpers");

test("smoke", async (t) => {
  const a = await newUser("smk_a");
  const b = await newUser("smk_b");
  t.after(async () => { await removeUser(a); await removeUser(b); });

  await t.test("health", async () => {
    const r = await agent()("/health");
    assert.equal(r.s, 200);
    assert.equal(r.j.db, true);
  });

  await t.test("boards: card move + stale reorder 409 + ownership", async () => {
    const board = (await a.call("/boards")).j.boards[0];
    const { columns } = (await a.call(`/boards/${board.id}`)).j;
    const card = (await a.call(`/boards/columns/${columns[0].id}/cards`, "POST", { title: "ทดสอบ" })).j.card;
    assert.ok(card.id);
    const stale = await a.call(`/boards/${board.id}/columns/order`, "PUT", { orderedIds: [columns[0].id] });
    assert.ok([409, 400, 404].includes(stale.s), `stale reorder → ${stale.s}`);
    assert.equal((await b.call(`/boards/${board.id}`)).s, 404);
    assert.equal((await b.call(`/boards/cards/${card.id}`, "PATCH", { title: "x" })).s, 404);
  });

  await t.test("events + calendar + meetings", async () => {
    const ev = await a.call("/events", "POST", { title: "วันเกิด", date: "1990-11-20", repeat: "yearly" });
    assert.equal(ev.s, 201, JSON.stringify(ev.j));
    const m = await a.call("/meetings", "POST", { title: "Standup", date: "2026-11-16", start_time: "09:30", end_time: "09:45", repeat: "weekdays" });
    assert.equal(m.s, 201, JSON.stringify(m.j));
    const cal = await a.call("/calendar?from=2026-11-16&to=2026-11-22");
    assert.equal(cal.s, 200);
    assert.ok(JSON.stringify(cal.j).includes("วันเกิด"));
    assert.ok(JSON.stringify(cal.j).includes("Standup"));
    assert.equal((await b.call(`/meetings/${m.j.meeting.id}`)).s, 404);
  });

  await t.test("ICS feed: token URL works without a session and never leaks entries", async () => {
    await a.call("/entries", "POST", { entry_date: "2026-11-16", body: "ความลับในไดอารี่" });
    const r = await a.call("/auth/ics", "POST");
    assert.equal(r.s, 200, JSON.stringify(r.j));
    const url = r.j.url.replace(/^https?:\/\/[^/]+/, BASE.replace(/\/api$/, ""));
    const feed = await (await fetch(url)).text();
    assert.match(feed, /BEGIN:VCALENDAR/);
    assert.ok(!feed.includes("ความลับ"), "diary content must not appear in the feed");
    assert.equal((await fetch(url.replace(/[0-9a-f]{64}/, "0".repeat(64)))).status, 404);
  });
});
