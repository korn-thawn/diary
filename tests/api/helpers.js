// Shared helpers for API tests: talk to a running server (TEST_BASE, default http://127.0.0.1:3101).
// Registration must be open on that server (ALLOW_REGISTER=true). Each test file makes its own users
// and deletes them at the end.
const BASE = (process.env.TEST_BASE || "http://127.0.0.1:3101") + "/api";
const PASSWORD = "testPass123";

function agent() {
  let cookie = "";
  return async function call(path, method = "GET", body) {
    const r = await fetch(BASE + path, {
      method,
      headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(cookie ? { cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const sc = r.headers.get("set-cookie");
    if (sc) cookie = sc.split(";")[0];
    const text = await r.text();
    let j;
    try { j = JSON.parse(text); } catch { j = text; }
    return { s: r.status, j, h: r.headers };
  };
}

let n = 0;
/** A fresh logged-in user: { call, username } */
async function newUser(prefix = "t") {
  const call = agent();
  const username = `${prefix}_${Date.now().toString(36)}${n++}`;
  const r = await call("/auth/register", "POST", { username, password: PASSWORD });
  if (r.s !== 201) throw new Error(`register failed ${r.s} ${JSON.stringify(r.j)} (is ALLOW_REGISTER=true?)`);
  return { call, username };
}

const removeUser = (u) => u.call("/auth/account", "DELETE", { password: PASSWORD });

module.exports = { agent, newUser, removeUser, BASE };
