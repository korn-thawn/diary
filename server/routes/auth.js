const express = require("express");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const db = require("../db");

const router = express.Router();

const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,32}$/;
const allowRegister = () => process.env.ALLOW_REGISTER === "true";

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "too many attempts, try again later" },
});

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
  // bcrypt only uses the first 72 bytes
  if (password.length < 8 || Buffer.byteLength(password) > 72) {
    return res.status(400).json({ error: "password must be 8-72 characters" });
  }
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

module.exports = router;
