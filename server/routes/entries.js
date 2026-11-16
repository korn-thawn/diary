const express = require("express");
const db = require("../db");
const { isDate } = require("../util");
const { addPeriod } = require("../recur");
const { entrySummary } = require("./calendar");

const router = express.Router();

const ID_RE = /^\d{1,18}$/;
const COLUMNS =
  "id::text AS id, to_char(entry_date, 'YYYY-MM-DD') AS entry_date, title, body, mood, tags, atmosphere, weather, temp_c, caption, created_at, updated_at";
const ATMOSPHERES = ["hot", "calm", "warm"];
const WEATHERS = ["clear", "cloudy", "drizzle", "rain", "storm", "fog", "hot", "cold"];
// Photo summary for lists (only valid in queries selecting FROM entries)
const PHOTO_META = `,
  (SELECT count(*)::int FROM photos p WHERE p.entry_id = entries.id) AS photo_count,
  (SELECT p.id::text FROM photos p WHERE p.entry_id = entries.id ORDER BY p.position, p.id LIMIT 1) AS cover_id`;
const PHOTOS_OF = (idExpr) =>
  `coalesce((SELECT json_agg(json_build_object('id', p.id::text, 'width', p.width, 'height', p.height) ORDER BY p.position, p.id)
             FROM photos p WHERE p.entry_id = ${idExpr}), '[]') AS photos`;

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
  const atmosphere = b.atmosphere ?? null;
  if (atmosphere !== null && !ATMOSPHERES.includes(atmosphere)) return { error: "atmosphere must be hot, calm or warm" };
  const weather = b.weather ?? null;
  if (weather !== null && !WEATHERS.includes(weather)) return { error: "unknown weather" };
  const tempC = b.temp_c ?? null;
  if (tempC !== null && !(Number.isInteger(tempC) && tempC >= -30 && tempC <= 60)) return { error: "temp_c must be an integer -30..60" };
  let caption = b.caption ?? null;
  if (caption !== null) {
    if (typeof caption !== "string") return { error: "caption must be text" };
    caption = caption.trim();
    if (caption.length > 120) return { error: "caption is too long (max 120)" };
    if (!caption) caption = null;
  }
  return { value: { entryDate, title, body: b.body, mood, tags, atmosphere, weather, tempC, caption } };
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
    `SELECT ${COLUMNS}${PHOTO_META} FROM entries WHERE ${where.join(" AND ")}
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
  const first = `${month}-01`;
  const last = addPeriod(addPeriod(first, "month", 1), "day", -1);
  const rows = await entrySummary(req.session.userId, first, last);
  res.json({ days: rows });
});

// GET /api/entries/home?month=YYYY-MM — everything the home page needs in one request:
// the latest entry (hero), the next 6, and one month of atmospheres for the mood calendar.
// entry_no is the entry's position in this user's diary (oldest = 1), so it shifts if older ones are deleted.
router.get("/home", async (req, res) => {
  const { month } = req.query;
  if (month !== undefined && (typeof month !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month))) {
    return bad(res, "month must be YYYY-MM");
  }
  const uid = req.session.userId;
  const { rows: list } = await db.query(
    `WITH numbered AS (
       SELECT entries.*, row_number() OVER (ORDER BY entry_date, created_at, id) AS entry_no
       FROM entries WHERE user_id = $1
     )
     SELECT id::text AS id, to_char(entry_date, 'YYYY-MM-DD') AS entry_date, title, mood, atmosphere, weather, temp_c, caption,
            created_at, entry_no::int AS entry_no,
            left(body, 400) AS excerpt,
            coalesce(array_length(regexp_split_to_array(trim(body), '\\s+'), 1), 0) AS words,
            char_length(body) AS chars,
            (SELECT p.id::text FROM photos p WHERE p.entry_id = numbered.id ORDER BY p.position, p.id LIMIT 1) AS cover_id
     FROM numbered
     ORDER BY entry_date DESC, created_at DESC, id DESC
     LIMIT 7`,
    [uid]
  );
  let days = [];
  if (month) {
    const first = `${month}-01`;
    const last = addPeriod(addPeriod(first, "month", 1), "day", -1);
    ({ rows: days } = await db.query(
      `SELECT DISTINCT ON (entry_date) to_char(entry_date, 'YYYY-MM-DD') AS date, id::text AS id, atmosphere, mood
       FROM entries WHERE user_id = $1 AND entry_date BETWEEN $2 AND $3
       ORDER BY entry_date, (atmosphere IS NULL), created_at DESC`,
      [uid, first, last]
    ));
  }
  const { rows: cnt } = await db.query("SELECT count(*)::int AS n FROM entries WHERE user_id = $1", [uid]);
  res.json({ latest: list[0] || null, recent: list.slice(1), month: days, total: cnt[0].n });
});

router.get("/:id", async (req, res) => {
  if (!ID_RE.test(req.params.id)) return notFound(res);
  const { rows } = await db.query(
    `SELECT ${COLUMNS}, ${PHOTOS_OF("entries.id")} FROM entries WHERE id = $1 AND user_id = $2`,
    [req.params.id, req.session.userId]
  );
  if (!rows[0]) return notFound(res);
  res.json({ entry: rows[0] });
});

router.post("/", async (req, res) => {
  const { value, error } = parseEntry(req.body);
  if (error) return bad(res, error);
  const { rows } = await db.query(
    `INSERT INTO entries (user_id, entry_date, title, body, mood, tags, atmosphere, weather, temp_c, caption)
     VALUES ($1, COALESCE($2::date, current_date), $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING ${COLUMNS}`,
    [req.session.userId, value.entryDate, value.title, value.body, value.mood, value.tags,
     value.atmosphere, value.weather, value.tempC, value.caption]
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
         mood = $6, tags = $7, atmosphere = $8, weather = $9, temp_c = $10, caption = $11, updated_at = now()
     WHERE id = $1 AND user_id = $2
     RETURNING ${COLUMNS}`,
    [req.params.id, req.session.userId, value.entryDate, value.title, value.body, value.mood, value.tags,
     value.atmosphere, value.weather, value.tempC, value.caption]
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
