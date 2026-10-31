const express = require("express");
const db = require("../db");
const { isDate } = require("../util");

const router = express.Router();

const ID_RE = /^\d{1,18}$/;
const COLUMNS =
  "id::text AS id, to_char(entry_date, 'YYYY-MM-DD') AS entry_date, title, body, mood, tags, created_at, updated_at";

const bad = (res, msg) => res.status(400).json({ error: msg });
const notFound = (res) => res.status(404).json({ error: "not found" });

// Normalise + validate an entry payload. Returns { value } or { error }.
function parseEntry(body) {
  const b = body || {};
  const entryDate = b.entry_date || null;
  if (entryDate !== null && !isDate(entryDate)) return { error: "entry_date must be YYYY-MM-DD" };
  const title = typeof b.title === "string" ? b.title.trim().slice(0, 200) : "";
  if (typeof b.body !== "string" || !b.body.trim()) return { error: "body is required" };
  if (b.body.length > 100_000) return { error: "body is too long" };
  const mood = b.mood ?? null;
  if (mood !== null && !(Number.isInteger(mood) && mood >= 1 && mood <= 5)) {
    return { error: "mood must be an integer 1-5" };
  }
  const rawTags = Array.isArray(b.tags) ? b.tags : [];
  const tags = [
    ...new Set(
      rawTags
        .filter((t) => typeof t === "string")
        .map((t) => t.trim().replace(/^#+/, "").trim().toLowerCase().slice(0, 40))
        .filter(Boolean)
    ),
  ].slice(0, 20);
  return { value: { entryDate, title, body: b.body, mood, tags } };
}

// GET /api/entries?q=&tag=&from=&to=&limit=&offset=
router.get("/", async (req, res) => {
  const where = ["user_id = $1"];
  const params = [req.session.userId];
  const { q, tag, from, to } = req.query;

  if (typeof q === "string" && q.trim()) {
    params.push("%" + q.trim().replace(/[\\%_]/g, (c) => "\\" + c) + "%");
    where.push(`(title ILIKE $${params.length} OR body ILIKE $${params.length})`);
  }
  if (typeof tag === "string" && tag.trim()) {
    params.push(tag.trim().toLowerCase());
    where.push(`$${params.length} = ANY(tags)`);
  }
  if (from !== undefined) {
    if (!isDate(from)) return bad(res, "from must be YYYY-MM-DD");
    params.push(from);
    where.push(`entry_date >= $${params.length}`);
  }
  if (to !== undefined) {
    if (!isDate(to)) return bad(res, "to must be YYYY-MM-DD");
    params.push(to);
    where.push(`entry_date <= $${params.length}`);
  }

  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
  params.push(limit + 1, offset);

  const { rows } = await db.query(
    `SELECT ${COLUMNS} FROM entries WHERE ${where.join(" AND ")}
     ORDER BY entry_date DESC, id DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  res.json({ entries: rows.slice(0, limit), hasMore: rows.length > limit });
});

// GET /api/entries/tags — this user's tags with counts
router.get("/tags", async (req, res) => {
  const { rows } = await db.query(
    `SELECT t AS tag, count(*)::int AS count
     FROM entries, unnest(tags) AS t
     WHERE user_id = $1
     GROUP BY t ORDER BY count DESC, t`,
    [req.session.userId]
  );
  res.json({ tags: rows });
});

// GET /api/entries/calendar?month=YYYY-MM — per-day summary for one month
router.get("/calendar", async (req, res) => {
  const { month } = req.query;
  if (typeof month !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return bad(res, "month must be YYYY-MM");
  }
  const { rows } = await db.query(
    `SELECT to_char(entry_date, 'YYYY-MM-DD') AS date, count(*)::int AS count,
            round(avg(mood))::int AS mood, min(id)::text AS first_id
     FROM entries
     WHERE user_id = $1 AND entry_date >= $2::date AND entry_date < ($2::date + interval '1 month')
     GROUP BY entry_date ORDER BY entry_date`,
    [req.session.userId, `${month}-01`]
  );
  res.json({ days: rows });
});

router.get("/:id", async (req, res) => {
  if (!ID_RE.test(req.params.id)) return notFound(res);
  const { rows } = await db.query(
    `SELECT ${COLUMNS} FROM entries WHERE id = $1 AND user_id = $2`,
    [req.params.id, req.session.userId]
  );
  if (!rows[0]) return notFound(res);
  res.json({ entry: rows[0] });
});

router.post("/", async (req, res) => {
  const { value, error } = parseEntry(req.body);
  if (error) return bad(res, error);
  const { rows } = await db.query(
    `INSERT INTO entries (user_id, entry_date, title, body, mood, tags)
     VALUES ($1, COALESCE($2::date, current_date), $3, $4, $5, $6)
     RETURNING ${COLUMNS}`,
    [req.session.userId, value.entryDate, value.title, value.body, value.mood, value.tags]
  );
  res.status(201).json({ entry: rows[0] });
});

router.put("/:id", async (req, res) => {
  if (!ID_RE.test(req.params.id)) return notFound(res);
  const { value, error } = parseEntry(req.body);
  if (error) return bad(res, error);
  const { rows } = await db.query(
    `UPDATE entries
     SET entry_date = COALESCE($3::date, entry_date), title = $4, body = $5,
         mood = $6, tags = $7, updated_at = now()
     WHERE id = $1 AND user_id = $2
     RETURNING ${COLUMNS}`,
    [req.params.id, req.session.userId, value.entryDate, value.title, value.body, value.mood, value.tags]
  );
  if (!rows[0]) return notFound(res);
  res.json({ entry: rows[0] });
});

router.delete("/:id", async (req, res) => {
  if (!ID_RE.test(req.params.id)) return notFound(res);
  const { rowCount } = await db.query("DELETE FROM entries WHERE id = $1 AND user_id = $2", [
    req.params.id,
    req.session.userId,
  ]);
  if (!rowCount) return notFound(res);
  res.status(204).end();
});

module.exports = router;
