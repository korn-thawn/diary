const express = require("express");
const db = require("../db");
const { isDate, localToday, COLORS, ICONS, isId, TIME_RE, str } = require("../util");
const { nextOccurrence } = require("../recur");

const router = express.Router();
const bad = (res, msg) => res.status(400).json({ error: msg });
const notFound = (res) => res.status(404).json({ error: "not found" });

const REPEATS = ["none", "monthly", "yearly"];
const COLS = `id::text AS id, title, to_char(date, 'YYYY-MM-DD') AS date, repeat,
  to_char(time, 'HH24:MI') AS time, color, icon, note, created_at`;

function withNext(e, today) {
  const n = nextOccurrence(e, today);
  return { ...e, next: n?.date ?? null, days_left: n?.days_left ?? null, years: n?.years ?? null };
}

// Validate a full or partial payload against `base` (existing row for PATCH).
function parse(body, base = {}) {
  const b = body || {};
  const v = {
    title: b.title === undefined ? base.title : str(b.title, 1, 100),
    date: b.date === undefined ? base.date : b.date,
    repeat: b.repeat ?? base.repeat ?? "none",
    time: b.time === undefined ? base.time ?? null : b.time || null,
    color: b.color ?? base.color ?? "rose",
    icon: b.icon ?? base.icon ?? "star",
    note: b.note === undefined ? base.note ?? "" : b.note,
  };
  if (!v.title) return { error: "title must be 1-100 characters" };
  if (!isDate(v.date)) return { error: "date must be YYYY-MM-DD" };
  if (!REPEATS.includes(v.repeat)) return { error: "repeat must be none, monthly or yearly" };
  if (v.time !== null && !TIME_RE.test(v.time)) return { error: "time must be HH:MM" };
  if (!COLORS.includes(v.color)) return { error: "invalid color" };
  if (!ICONS.includes(v.icon)) return { error: "invalid icon" };
  if (typeof v.note !== "string" || v.note.length > 2000) return { error: "note is too long" };
  return { v };
}

async function own(uid, id) {
  if (!isId(id)) return null;
  const { rows } = await db.query(`SELECT ${COLS} FROM events WHERE id = $1 AND user_id = $2`, [id, uid]);
  return rows[0] || null;
}

// GET /api/events?today= — all events, soonest next occurrence first (past one-offs last)
router.get("/", async (req, res) => {
  const today = isDate(req.query.today) ? req.query.today : localToday();
  const { rows } = await db.query(`SELECT ${COLS} FROM events WHERE user_id = $1`, [req.session.userId]);
  const list = rows.map((e) => withNext(e, today));
  list.sort((a, b) =>
    a.next && b.next ? a.next.localeCompare(b.next) || a.title.localeCompare(b.title, "th") : a.next ? -1 : b.next ? 1 : b.date.localeCompare(a.date)
  );
  res.json({ events: list });
});

router.post("/", async (req, res) => {
  const { v, error } = parse(req.body);
  if (error) return bad(res, error);
  const { rows } = await db.query(
    `INSERT INTO events (user_id, title, date, repeat, time, color, icon, note)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING ${COLS}`,
    [req.session.userId, v.title, v.date, v.repeat, v.time, v.color, v.icon, v.note]
  );
  const today = isDate(req.body?.today) ? req.body.today : localToday();
  res.status(201).json({ event: withNext(rows[0], today) });
});

router.patch("/:id", async (req, res) => {
  const ev = await own(req.session.userId, req.params.id);
  if (!ev) return notFound(res);
  const { v, error } = parse(req.body, ev);
  if (error) return bad(res, error);
  const { rows } = await db.query(
    `UPDATE events SET title = $2, date = $3, repeat = $4, time = $5, color = $6, icon = $7, note = $8
     WHERE id = $1 RETURNING ${COLS}`,
    [ev.id, v.title, v.date, v.repeat, v.time, v.color, v.icon, v.note]
  );
  const today = isDate(req.body?.today) ? req.body.today : localToday();
  res.json({ event: withNext(rows[0], today) });
});

router.delete("/:id", async (req, res) => {
  const ev = await own(req.session.userId, req.params.id);
  if (!ev) return notFound(res);
  await db.query("DELETE FROM events WHERE id = $1", [ev.id]);
  res.status(204).end();
});

module.exports = router;
