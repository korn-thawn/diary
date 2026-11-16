// /api/auth/appearance for the noir theme: { accent?, size? }
const test = require("node:test");
const assert = require("node:assert/strict");
const { agent, newUser, removeUser } = require("./helpers");

test("appearance", async (t) => {
  const a = await newUser("app_a");
  const b = await newUser("app_b");
  t.after(async () => { await removeUser(a); await removeUser(b); });

  assert.equal((await agent()("/auth/appearance", "PUT", {})).s, 401);

  for (const [body, name] of [
    [[], "array"], [{ accent: "pink" }, "unknown accent"], [{ accent: "#12345" }, "short hex"], [{ size: "xl" }, "size"],
    [{ preset: "navy" }, "old preset field"], [{ fontBody: "kanit" }, "old font field"], [{ accent: 5 }, "accent number"],
  ]) {
    assert.equal((await a.call("/auth/appearance", "PUT", body)).s, 400, name);
  }

  let r = await a.call("/auth/appearance", "PUT", { accent: "jade", size: "l" });
  assert.equal(r.s, 200);
  assert.deepEqual(r.j.appearance, { accent: "jade", size: "l" });
  r = await a.call("/auth/appearance", "PUT", { accent: "#ABCDEF" });
  assert.deepEqual(r.j.appearance, { accent: "#abcdef" });
  assert.deepEqual((await a.call("/auth/me")).j.user.appearance, { accent: "#abcdef" });
  assert.deepEqual((await b.call("/auth/me")).j.user.appearance, {});
  await a.call("/auth/appearance", "PUT", {});
  assert.deepEqual((await a.call("/auth/me")).j.user.appearance, {});
});
