// Entries API incl. the noir fields (atmosphere / weather / temp_c / caption) and /home.
const test = require("node:test");
const assert = require("node:assert/strict");
const { agent, newUser, removeUser } = require("./helpers");

test("entries", async (t) => {
  const a = await newUser("ent_a");
  const b = await newUser("ent_b");
  t.after(async () => { await removeUser(a); await removeUser(b); });

  await t.test("anonymous requests are refused", async () => {
    const anon = agent();
    for (const p of ["/entries", "/entries/home", "/entries/1"]) assert.equal((await anon(p)).s, 401, p);
  });

  let first;
  await t.test("create with the noir fields", async () => {
    const r = await a.call("/entries", "POST", {
      entry_date: "2026-11-14", title: "รถไฟเที่ยวสุดท้าย", body: "ชานชาลาว่าง", mood: 4,
      atmosphere: "calm", weather: "drizzle", temp_c: 24, caption: "  คืนนี้ฝนตก  ",
    });
    assert.equal(r.s, 201, JSON.stringify(r.j));
    first = r.j.entry;
    assert.equal(first.atmosphere, "calm");
    assert.equal(first.weather, "drizzle");
    assert.equal(first.temp_c, 24);
    assert.equal(first.caption, "คืนนี้ฝนตก");
  });

  await t.test("validation", async () => {
    const ok = { entry_date: "2026-11-15", body: "x" };
    for (const [extra, name] of [
      [{ atmosphere: "sad" }, "atmosphere"], [{ weather: "snow" }, "weather"], [{ temp_c: 99 }, "temp too high"],
      [{ temp_c: 2.5 }, "temp not integer"], [{ temp_c: "24" }, "temp as string"], [{ caption: "x".repeat(121) }, "caption too long"],
      [{ caption: 5 }, "caption not text"], [{ mood: 6 }, "mood"], [{ body: "" }, "empty body"], [{ entry_date: "2026-13-01" }, "bad date"],
    ]) {
      const r = await a.call("/entries", "POST", { ...ok, ...extra });
      assert.equal(r.s, 400, `${name}: ${JSON.stringify(r.j)}`);
    }
  });

  await t.test("update clears optional fields when sent as null / empty", async () => {
    const r = await a.call(`/entries/${first.id}`, "PUT", { entry_date: "2026-11-14", body: "ชานชาลาว่าง", atmosphere: null, weather: null, temp_c: null, caption: "   " });
    assert.equal(r.s, 200);
    assert.equal(r.j.entry.atmosphere, null);
    assert.equal(r.j.entry.caption, null);
    await a.call(`/entries/${first.id}`, "PUT", { entry_date: "2026-11-14", title: "รถไฟเที่ยวสุดท้าย", body: "ชานชาลาว่าง", atmosphere: "calm" });
  });

  await t.test("/home: latest + recent + month, with entry numbers", async () => {
    await a.call("/entries", "POST", { entry_date: "2026-11-15", body: "สอง", atmosphere: "hot" });
    await a.call("/entries", "POST", { entry_date: "2026-11-16", title: "สาม", body: "หนึ่ง สอง สาม", atmosphere: "warm" });
    await a.call("/entries", "POST", { entry_date: "2026-10-30", body: "เดือนก่อน" });
    const r = await a.call("/entries/home?month=2026-11");
    assert.equal(r.s, 200);
    assert.equal(r.j.total, 4);
    assert.equal(r.j.latest.title, "สาม");
    assert.equal(r.j.latest.entry_no, 4);
    assert.equal(r.j.latest.words, 3);
    assert.equal(r.j.latest.cover_id, null);
    assert.deepEqual(r.j.recent.map((e) => e.entry_no), [3, 2, 1]);
    assert.deepEqual(r.j.month.map((d) => [d.date, d.atmosphere]), [["2026-11-14", "calm"], ["2026-11-15", "hot"], ["2026-11-16", "warm"]]);
    assert.equal((await a.call("/entries/home?month=2026-13")).s, 400);
    assert.equal((await a.call("/entries/home")).j.month.length, 0);
  });

  await t.test("other users can't see or touch these entries", async () => {
    assert.equal((await b.call(`/entries/${first.id}`)).s, 404);
    assert.equal((await b.call(`/entries/${first.id}`, "PUT", { body: "x" })).s, 404);
    assert.equal((await b.call(`/entries/${first.id}`, "DELETE")).s, 404);
    const home = (await b.call("/entries/home?month=2026-11")).j;
    assert.equal(home.total, 0);
    assert.equal(home.latest, null);
  });

  await t.test("export includes the new fields", async () => {
    const md = await a.call("/export?format=md");
    assert.match(md.j, /บรรยากาศ: นิ่ง/);
    const json = (await a.call("/export?format=json")).j;
    const e = json.entries.find((x) => x.id === first.id);
    assert.equal(e.atmosphere, "calm");
  });
});
