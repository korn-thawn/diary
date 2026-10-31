const express = require("express");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const db = require("../db");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,32}$/;
const allowRegister = () => process.env.ALLOW_REGISTER === "true";

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true, // only failed attempts (4xx) count toward the limit
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "too many attempts, try again later" },
});

// bcrypt only uses the first 72 bytes
const validPassword = (p) => typeof p === "string" && p.length >= 8 && Buffer.byteLength(p) <= 72;
const PASSWORD_RULE = "password must be 8-72 characters";

async function checkPassword(userId, password) {
  const { rows } = await db.query("SELECT password_hash FROM users WHERE id = $1", [userId]);
  return Boolean(rows[0] && typeof password === "string" && (await bcrypt.compare(password, rows[0].password_hash)));
}

// Remove this user's sessions. Pass keepSid to keep the current device logged in.
async function deleteSessions(client, userId, keepSid = null) {
  const { rowCount } = await client.query(
    `DELETE FROM session WHERE sess->>'userId' = $1 AND ($2::text IS NULL OR sid <> $2)`,
    [String(userId), keepSid]
  );
  return rowCount;
}

function readCredentials(body) {
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  return { username, password };
}

// Regenerate the session id on login to prevent session fixation.
function startSession(req, user) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      req.session.userId = String(user.id);
      req.session.username = user.username;
      req.session.save((err2) => (err2 ? reject(err2) : resolve()));
    });
  });
}

router.get("/config", (req, res) => {
  res.json({ allowRegister: allowRegister() });
});

router.post("/register", loginLimiter, async (req, res) => {
  if (!allowRegister()) return res.status(403).json({ error: "registration is closed" });
  const { username, password } = readCredentials(req.body);
  if (!USERNAME_RE.test(username)) {
    return res.status(400).json({ error: "username must be 3-32 chars: a-z 0-9 _ . -" });
  }
  if (!validPassword(password)) return res.status(400).json({ error: PASSWORD_RULE });
  const hash = await bcrypt.hash(password, 12);
  const { rows } = await db.query(
    `INSERT INTO users (username, password_hash) VALUES ($1, $2)
     ON CONFLICT (username) DO NOTHING
     RETURNING id, username`,
    [username, hash]
  );
  if (!rows[0]) return res.status(409).json({ error: "username is taken" });
  await startSession(req, rows[0]);
  res.status(201).json({ user: { id: String(rows[0].id), username: rows[0].username } });
});

router.post("/login", loginLimiter, async (req, res) => {
  const { username, password } = readCredentials(req.body);
  const { rows } = await db.query(
    "SELECT id, username, password_hash FROM users WHERE username = $1",
    [username]
  );
  const user = rows[0];
  const ok = user && (await bcrypt.compare(password, user.password_hash));
  if (!ok) return res.status(401).json({ error: "invalid username or password" });
  await startSession(req, user);
  res.json({ user: { id: String(user.id), username: user.username } });
});

router.post("/logout", (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie("diary.sid");
    res.status(204).end();
  });
});

router.get("/me", (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: "unauthorized" });
  res.json({ user: { id: req.session.userId, username: req.session.username } });
});

// PUT /api/auth/password — change password, log out every other device
router.put("/password", requireAuth, loginLimiter, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!(await checkPassword(req.session.userId, currentPassword))) {
    return res.status(401).json({ error: "current password is incorrect" });
  }
  if (!validPassword(newPassword)) return res.status(400).json({ error: PASSWORD_RULE });
  const hash = await bcrypt.hash(newPassword, 12);
  await db.query("UPDATE users SET password_hash = $2 WHERE id = $1", [req.session.userId, hash]);
  const loggedOut = await deleteSessions(db, req.session.userId, req.sessionID);
  res.json({ ok: true, loggedOut });
});

// POST /api/auth/logout-others — keep this device, end every other session
router.post("/logout-others", requireAuth, async (req, res) => {
  const loggedOut = await deleteSessions(db, req.session.userId, req.sessionID);
  res.json({ ok: true, loggedOut });
});

// DELETE /api/auth/account — delete the user, all entries (cascade) and sessions
router.delete("/account", requireAuth, loginLimiter, async (req, res, next) => {
  const userId = req.session.userId;
  if (!(await checkPassword(userId, req.body?.password))) {
    return res.status(401).json({ error: "password is incorrect" });
  }
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    await deleteSessions(client, userId);
    await client.query("DELETE FROM users WHERE id = $1", [userId]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  // The session row is already gone; destroy just clears it from req.
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie("diary.sid");
    res.status(204).end();
  });
});

// ---------- ICS feed (Google Calendar subscribe-by-URL) ----------
async function icsState(req) {
  const { rows } = await db.query("SELECT ics_token, ics_cards, ics_events FROM users WHERE id = $1", [req.session.userId]);
  const u = rows[0];
  return {
    enabled: Boolean(u.ics_token),
    url: u.ics_token ? `${req.protocol}://${req.get("host")}/ical/${u.ics_token}.ics` : null,
    cards: u.ics_cards,
    events: u.ics_events,
  };
}

router.get("/ics", requireAuth, async (req, res) => res.json(await icsState(req)));

// Create or rotate the secret URL (old URL stops working immediately)
router.post("/ics", requireAuth, async (req, res) => {
  const token = require("node:crypto").randomBytes(32).toString("hex");
  await db.query("UPDATE users SET ics_token = $2 WHERE id = $1", [req.session.userId, token]);
  res.json(await icsState(req));
});

router.patch("/ics", requireAuth, async (req, res) => {
  const { cards, events } = req.body || {};
  if ((cards !== undefined && typeof cards !== "boolean") || (events !== undefined && typeof events !== "boolean")) {
    return res.status(400).json({ error: "cards and events must be boolean" });
  }
  await db.query(
    "UPDATE users SET ics_cards = coalesce($2, ics_cards), ics_events = coalesce($3, ics_events) WHERE id = $1",
    [req.session.userId, cards ?? null, events ?? null]
  );
  res.json(await icsState(req));
});

router.delete("/ics", requireAuth, async (req, res) => {
  await db.query("UPDATE users SET ics_token = NULL WHERE id = $1", [req.session.userId]);
  res.json(await icsState(req));
});

module.exports = router;
