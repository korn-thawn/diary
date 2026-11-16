// Delete the UI test user created by seed.mjs (and everything it owns).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(DIR, ".user.json");
const BASE = (process.env.TEST_BASE || "http://127.0.0.1:3101") + "/api";
if (!fs.existsSync(FILE)) { console.log("nothing to clean"); process.exit(0); }
const U = JSON.parse(fs.readFileSync(FILE, "utf8"));
const login = await fetch(`${BASE}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: U.username, password: U.password }) });
if (login.ok) {
  const cookie = login.headers.get("set-cookie").split(";")[0];
  const r = await fetch(`${BASE}/auth/account`, { method: "DELETE", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify({ password: U.password }) });
  console.log(r.ok ? `deleted ${U.username}` : `delete failed ${r.status}`);
} else console.log(`${U.username} already gone`);
fs.rmSync(FILE);
