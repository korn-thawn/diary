const express = require("express");
const db = require("../db");
const { isDate, localToday, COLORS, isId, TIME_RE, str, tx } = require("../util");
const { isMeetingDate, diffDays } = require("../recur");
const { seriesOf, occurrencesFor, seriesWithNext } = require("../meetings");

const router = express.Router();
const bad = (res, msg) => res.status(400).json({ error: msg });
const notFound = (res) => res.status(404).json({ error: "not found" });
const uidOf = (req) => req.session.userId;
const todayOf = (req) => (isDate(req.query.today) ? req.query.today : isDate(req.body?.today) ? req.body.today : localToday());

const REPEATS = ["none", "daily", "weekdays", "weekly", "biweekly", "monthly"];
const URL_RE = /^https?:\/\/[^\s<>"]+$/i;

async function own(uid, id) {
  if (!isId(id)) return null;
  return (await seriesOf(uid, { id }))[0] || null;
}

// Validate a full (POST) or partial (PATCH, with base) payload.
function parse(b = {}, base = {}) {
  const pick = (k, d) => (b[k] === undefined ? base[k] ?? d : b[k]);
  const v = {
    title: b.title === undefined ? base.title : str(b.title, 1, 150),
    date: pick("date"),
    start_time: pick("start_time"),
    end_time: pick("end_time"),
    repeat: pick("repeat", "none"),
    weekdays: pick("weekdays", []),
    repeat_until: b.repeat_until === undefined ? base.repeat_until ?? null : b.repeat_until || null,
    location: pick("location", ""),
    url: pick("url", ""),
    color: pick("color", "indigo"),
    agenda: pick("agenda", ""),
    remind_minutes: b.remind_minutes === undefined ? base.remind_minutes ?? null : b.remind_minutes,
  };
  if (!v.title) return { error: "title must be 1-150 characters" };
  if (!isDate(v.date)) return { error: "date must be YYYY-MM-DD" };
  if (!TIME_RE.test(v.start_time || "") || !TIME_RE.test(v.end_time || "")) return { error: "start_time and end_time must be HH:MM" };
  if (v.end_time <= v.start_time) return { error: "end_time must be after start_time" };
  if (!REPEATS.includes(v.repeat)) return { error: "invalid repeat" };
  if (!Array.isArray(v.weekdays) || v.weekdays.length > 7 || !v.weekdays.every((d) => Number.isInteger(d) && d >= 1 && d <= 7)) {
    return { error: "weekdays must be integers 1-7" };
  }
  v.weekdays = ["weekly", "biweekly"].includes(v.repeat) ? [...new Set(v.weekdays)].sort() : [];
  if (v.repeat === "none") v.repeat_until = null;
  if (v.repeat_until !== null && (!isDate(v.repeat_until) || v.repeat_until < v.date)) return { error: "repeat_until must be a date on/after date" };
  if (typeof v.location !== "string" || v.location.length > 200) return { error: "location is too long" };
  if (typeof v.url !== "string" || v.url.length > 500 || (v.url && !URL_RE.test(v.url.trim()))) return { error: "url must start with http:// or https://" };
  v.url = v.url.trim();
  if (!COLORS.includes(v.color)) return { error: "invalid color" };
  if (typeof v.agenda !== "string" || v.agenda.length > 10000) return { error: "agenda is too long" };
  if (v.remind_minutes !== null && !(Number.isInteger(v.remind_minutes) && v.remind_minutes >= 0 && v.remind_minutes <= 1440)) {
    return { error: "remind_minutes must be 0-1440 or null" };
  }
  return { v };
}

async function checkLabels(uid, labelIds) {
  if (labelIds === undefined) return { ids: null };
  if (!Array.isArray(labelIds) || !labelIds.every(isId)) return { error: "labelIds must be an array of ids" };
  const ids = [...new Set(labelIds.map(String))];
  if (ids.length) {
    const { rows } = await db.query("SELECT count(*)::int AS n FROM labels WHERE user_id = $1 AND id = ANY($2::bigint[])", [uid, ids]);
    if (rows[0].n !== ids.length) return { error: "unknown label" };
  }
  return { ids };
}

async function setLabels(q, meetingId, ids) {
  if (!ids) return;
  await q.query("DELETE FROM meeting_labels WHERE meeting_id = $1", [meetingId]);
  if (ids.length) await q.query("INSERT INTO meeting_labels (meeting_id, label_id) SELECT $1, unnest($2::bigint[])", [meetingId, ids]);
}

const FIELDS = ["title", "date", "start_time", "end_time", "repeat", "weekdays", "repeat_until", "location", "url", "color", "agenda", "remind_minutes"];

// ---------- series ----------
router.get("/", async (req, res) => {
  res.json({ meetings: await seriesWithNext(uidOf(req), todayOf(req)) });
});

router.post("/", async (req, res) => {
  const uid = uidOf(req);
  const { v, error } = parse(req.body);
  if (error) return bad(res, error);
  const labels = await checkLabels(uid, req.body?.labelIds);
  if (labels.error) return bad(res, labels.error);
  const id = await tx(db.pool, async (q) => {
    const { rows } = await q.query(
      `INSERT INTO meetings (user_id, ${FIELDS.join(", ")}) VALUES ($1, ${FIELDS.map((_, i) => `$${i + 2}`).join(", ")}) RETURNING id`,
      [uid, ...FIELDS.map((f) => v[f])]
    );
    await setLabels(q, rows[0].id, labels.ids);
    return rows[0].id;
  });
  res.status(201).json({ meeting: (await seriesWithNext(uid, todayOf(req))).find((m) => m.id === String(id)) });
});

router.patch("/:id", async (req, res) => {
  const uid = uidOf(req);
  const m = await own(uid, req.params.id);
  if (!m) return notFound(res);
  const { v, error } = parse(req.body, m);
  if (error) return bad(res, error);
  const labels = await checkLabels(uid, req.body?.labelIds);
  if (labels.error) return bad(res, labels.error);
  await tx(db.pool, async (q) => {
    await q.query(
      `UPDATE meetings SET ${FIELDS.map((f, i) => `${f} = $${i + 2}`).join(", ")}, updated_at = now() WHERE id = $1`,
      [m.id, ...FIELDS.map((f) => v[f])]
    );
    await setLabels(q, m.id, labels.ids);
  });
  res.json({ meeting: (await seriesWithNext(uid, todayOf(req))).find((x) => x.id === m.id) });
});

router.delete("/:id", async (req, res) => {
  const m = await own(uidOf(req), req.params.id);
  if (!m) return notFound(res);
  await db.query("DELETE FROM meetings WHERE id = $1", [m.id]);
  res.status(204).end();
});

// ---------- occurrences ----------
router.get("/occurrences", async (req, res) => {
  const { from, to } = req.query;
  if (!isDate(from) || !isDate(to)) return bad(res, "from and to must be YYYY-MM-DD");
  const span = diffDays(to, from);
  if (span < 0 || span > 62) return bad(res, "range must be 0-62 days");
  res.json({ occurrences: await occurrencesFor(uidOf(req), from, to, { withMeta: true }) });
});

// Resolve /:id/occurrences/:date where :date is the ORIGINAL occurrence date.
async function ownOccurrence(req, res) {
  const m = await own(uidOf(req), req.params.id);
  if (!m) { notFound(res); return null; }
  if (!isDate(req.params.date) || !isMeetingDate(m, req.params.date)) { bad(res, "not an occurrence of this meeting"); return null; }
  return m;
}

router.get("/:id/occurrences/:date", async (req, res) => {
  const m = await ownOccurrence(req, res);
  if (!m) return;
  const d = req.params.date;
  // A moved occurrence lives on its new date; compute on that whole day so conflicts with other meetings show up
  const { rows: exRows } = await db.query(
    `SELECT to_char(new_date, 'YYYY-MM-DD') AS new_date FROM meeting_exceptions WHERE meeting_id = $1 AND date = $2 AND NOT cancelled`,
    [m.id, d]
  );
  const day = exRows[0]?.new_date || d;
  const occurrence = (await occurrencesFor(uidOf(req), day, day, { withMeta: true })).find((o) => o.meeting_id === m.id && o.original_date === d) || null;
  const [notes, actions] = await Promise.all([
    db.query("SELECT notes, updated_at FROM meeting_notes WHERE meeting_id = $1 AND date = $2", [m.id, d]),
    db.query(
      `SELECT a.id::text AS id, a.text, a.done, a.card_id::text AS card_id, a.position,
              k.board_id::text AS card_board_id, k.title AS card_title, c.is_done AS card_done
       FROM meeting_actions a LEFT JOIN cards k ON k.id = a.card_id LEFT JOIN board_columns c ON c.id = k.column_id
       WHERE a.meeting_id = $1 AND a.date = $2 ORDER BY a.position, a.id`,
      [m.id, d]
    ),
  ]);
  res.json({ meeting: m, occurrence, notes: notes.rows[0]?.notes ?? "", actions: actions.rows });
});

// PUT { cancelled: true } or { new_date, new_start, new_end }
router.put("/:id/occurrences/:date", async (req, res) => {
  const m = await ownOccurrence(req, res);
  if (!m) return;
  const b = req.body || {};
  if (b.cancelled === true) {
    await db.query(
      `INSERT INTO meeting_exceptions (meeting_id, date, cancelled) VALUES ($1, $2, true)
       ON CONFLICT (meeting_id, date) DO UPDATE SET cancelled = true, new_date = NULL, new_start = NULL, new_end = NULL`,
      [m.id, req.params.date]
    );
  } else {
    if (!isDate(b.new_date) || !TIME_RE.test(b.new_start || "") || !TIME_RE.test(b.new_end || "")) return bad(res, "new_date/new_start/new_end required");
    if (b.new_end <= b.new_start) return bad(res, "new_end must be after new_start");
    await db.query(
      `INSERT INTO meeting_exceptions (meeting_id, date, cancelled, new_date, new_start, new_end) VALUES ($1, $2, false, $3, $4, $5)
       ON CONFLICT (meeting_id, date) DO UPDATE SET cancelled = false, new_date = $3, new_start = $4, new_end = $5`,
      [m.id, req.params.date, b.new_date, b.new_start, b.new_end]
    );
  }
  res.json({ ok: true });
});

router.delete("/:id/occurrences/:date", async (req, res) => {
  const m = await ownOccurrence(req, res);
  if (!m) return;
  await db.query("DELETE FROM meeting_exceptions WHERE meeting_id = $1 AND date = $2", [m.id, req.params.date]);
  res.json({ ok: true });
});

router.put("/:id/occurrences/:date/notes", async (req, res) => {
  const m = await ownOccurrence(req, res);
  if (!m) return;
  const notes = req.body?.notes;
  if (typeof notes !== "string" || notes.length > 50000) return bad(res, "notes must be a string (max 50000)");
  await db.query(
    `INSERT INTO meeting_notes (meeting_id, date, notes) VALUES ($1, $2, $3)
     ON CONFLICT (meeting_id, date) DO UPDATE SET notes = $3, updated_at = now()`,
    [m.id, req.params.date, notes]
  );
  res.json({ ok: true });
});

// ---------- action items ----------
router.post("/:id/occurrences/:date/actions", async (req, res) => {
  const m = await ownOccurrence(req, res);
  if (!m) return;
  const text = str(req.body?.text, 1, 300);
  if (!text) return bad(res, "text must be 1-300 characters");
  const { rows } = await db.query(
    `INSERT INTO meeting_actions (meeting_id, date, text, position)
     VALUES ($1, $2, $3, (SELECT coalesce(max(position) + 1, 0) FROM meeting_actions WHERE meeting_id = $1 AND date = $2))
     RETURNING id::text AS id, text, done, card_id::text AS card_id, position`,
    [m.id, req.params.date, text]
  );
  res.status(201).json({ action: rows[0] });
});

async function ownAction(uid, aid) {
  if (!isId(aid)) return null;
  const { rows } = await db.query(
    `SELECT a.id::text AS id, a.meeting_id::text AS meeting_id, to_char(a.date, 'YYYY-MM-DD') AS date, a.text, a.card_id::text AS card_id
     FROM meeting_actions a JOIN meetings m ON m.id = a.meeting_id WHERE a.id = $1 AND m.user_id = $2`,
    [aid, uid]
  );
  return rows[0] || null;
}

router.patch("/actions/:aid", async (req, res) => {
  const a = await ownAction(uidOf(req), req.params.aid);
  if (!a) return notFound(res);
  const b = req.body || {};
  const text = b.text === undefined ? a.text : str(b.text, 1, 300);
  if (!text) return bad(res, "text must be 1-300 characters");
  if (b.done !== undefined && typeof b.done !== "boolean") return bad(res, "done must be boolean");
  const { rows } = await db.query(
    `UPDATE meeting_actions SET text = $2, done = coalesce($3, done) WHERE id = $1
     RETURNING id::text AS id, text, done, card_id::text AS card_id, position`,
    [a.id, text, b.done ?? null]
  );
  res.json({ action: rows[0] });
});

router.delete("/actions/:aid", async (req, res) => {
  const a = await ownAction(uidOf(req), req.params.aid);
  if (!a) return notFound(res);
  await db.query("DELETE FROM meeting_actions WHERE id = $1", [a.id]);
  res.status(204).end();
});

// POST /actions/:aid/card { columnId, due_date? } — turn an action item into a kanban card
router.post("/actions/:aid/card", async (req, res) => {
  const uid = uidOf(req);
  const a = await ownAction(uid, req.params.aid);
  if (!a) return notFound(res);
  if (a.card_id) return res.status(409).json({ error: "this action already has a card" });
  const colId = req.body?.columnId;
  if (!isId(colId)) return notFound(res);
  const { rows: cols } = await db.query(
    `SELECT c.id, c.board_id, c.is_done FROM board_columns c JOIN boards b ON b.id = c.board_id WHERE c.id = $1 AND b.user_id = $2`,
    [colId, uid]
  );
  const col = cols[0];
  if (!col) return notFound(res);
  const due = req.body?.due_date || null;
  if (due !== null && !isDate(due)) return bad(res, "due_date must be YYYY-MM-DD");
  const m = await own(uid, a.meeting_id);
  const card = await tx(db.pool, async (q) => {
    const { rows } = await q.query(
      `INSERT INTO cards (board_id, column_id, title, description, due_date, position, completed_at)
       VALUES ($1, $2, $3, $4, $5, (SELECT coalesce(max(position) + 1, 0) FROM cards WHERE column_id = $2), $6)
       RETURNING id::text AS id, board_id::text AS board_id`,
      [col.board_id, col.id, a.text, `จากการประชุม: ${m.title} (${a.date})`, due, col.is_done ? new Date() : null]
    );
    if (m.label_ids.length) {
      await q.query("INSERT INTO card_labels (card_id, label_id) SELECT $1, unnest($2::bigint[])", [rows[0].id, m.label_ids]);
    }
    await q.query("UPDATE meeting_actions SET card_id = $2 WHERE id = $1", [a.id, rows[0].id]);
    return rows[0];
  });
  res.status(201).json({ card });
});

module.exports = router;
