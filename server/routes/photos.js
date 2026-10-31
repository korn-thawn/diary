const express = require("express");
const db = require("../db");
const { isId, tx, sameIdSet } = require("../util");

const router = express.Router();
const bad = (res, msg) => res.status(400).json({ error: msg });
const notFound = (res) => res.status(404).json({ error: "not found" });

const MAX_FULL = 2.5 * 1024 * 1024;
const MAX_THUMB = 300 * 1024;
const MAX_PER_ITEM = 12;
const quotaBytes = () => (Number(process.env.PHOTO_QUOTA_MB) || 500) * 1024 * 1024;

// Identify the real format from the bytes; never trust the declared content-type.
function sniff(buf) {
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  return null;
}

// Resolve ?entryId= / ?cardId= (or body fields) to an owned parent, locking it when q is a tx client.
async function ownParent(q, uid, { entryId, cardId }, lock = false) {
  const forUpdate = lock ? "FOR UPDATE" : "";
  if (entryId !== undefined && cardId === undefined) {
    if (!isId(entryId)) return null;
    const { rows } = await q.query(`SELECT id FROM entries WHERE id = $1 AND user_id = $2 ${forUpdate}`, [entryId, uid]);
    return rows[0] ? { col: "entry_id", id: String(rows[0].id) } : null;
  }
  if (cardId !== undefined && entryId === undefined) {
    if (!isId(cardId)) return null;
    const { rows } = await q.query(
      `SELECT k.id FROM cards k JOIN boards b ON b.id = k.board_id WHERE k.id = $1 AND b.user_id = $2 ${lock ? "FOR UPDATE OF k" : ""}`,
      [cardId, uid]
    );
    return rows[0] ? { col: "card_id", id: String(rows[0].id) } : null;
  }
  return null;
}

const tooBig = (msg) => Object.assign(new Error(msg), { status: 413 });

// POST /api/photos?entryId=|cardId=  (multipart: full, thumb, width, height)
router.post(
  "/",
  express.raw({ type: "multipart/form-data", limit: "4mb" }),
  async (req, res) => {
    const uid = req.session.userId;
    if (!Buffer.isBuffer(req.body) || !req.body.length) return bad(res, "expected multipart/form-data");
    let form;
    try {
      form = await new Request("http://local/upload", {
        method: "POST",
        headers: { "content-type": req.get("content-type") },
        body: req.body,
      }).formData();
    } catch {
      return bad(res, "invalid multipart body");
    }
    const fullFile = form.get("full"), thumbFile = form.get("thumb");
    if (!(fullFile instanceof Blob) || !(thumbFile instanceof Blob)) return bad(res, "full and thumb files are required");
    const full = Buffer.from(await fullFile.arrayBuffer());
    const thumb = Buffer.from(await thumbFile.arrayBuffer());
    if (full.length > MAX_FULL) return res.status(413).json({ error: "image is too large (max 2.5 MB after resizing)" });
    if (thumb.length > MAX_THUMB) return res.status(413).json({ error: "thumbnail is too large" });
    const mime = sniff(full), thumbMime = sniff(thumb);
    if (!mime || !thumbMime) return res.status(415).json({ error: "only WebP or JPEG images are accepted" });
    const width = Number(form.get("width")), height = Number(form.get("height"));
    if (![width, height].every((n) => Number.isInteger(n) && n >= 1 && n <= 4096)) return bad(res, "width/height must be 1-4096");

    const photo = await tx(db.pool, async (q) => {
      const parent = await ownParent(q, uid, { entryId: req.query.entryId, cardId: req.query.cardId }, true);
      if (!parent) return null;
      const { rows: cnt } = await q.query(`SELECT count(*)::int AS n FROM photos WHERE ${parent.col} = $1`, [parent.id]);
      if (cnt[0].n >= MAX_PER_ITEM) throw tooBig(`at most ${MAX_PER_ITEM} photos per item`);
      // Serialize quota checks per user
      await q.query("SELECT 1 FROM users WHERE id = $1 FOR UPDATE", [uid]);
      const { rows: used } = await q.query("SELECT coalesce(sum(bytes + octet_length(thumb)), 0)::bigint AS b FROM photos WHERE user_id = $1", [uid]);
      if (Number(used[0].b) + full.length + thumb.length > quotaBytes()) throw tooBig("photo storage quota is full");
      const { rows } = await q.query(
        `INSERT INTO photos (user_id, ${parent.col}, mime, width, height, bytes, data, thumb, thumb_mime, position)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9,
                 (SELECT coalesce(max(position) + 1, 0) FROM photos WHERE ${parent.col} = $2))
         RETURNING id::text AS id, width, height, bytes, position`,
        [uid, parent.id, mime, width, height, full.length, full, thumb, thumbMime]
      );
      return rows[0];
    });
    if (!photo) return notFound(res);
    res.status(201).json({ photo });
  }
);

router.get("/usage", async (req, res) => {
  const { rows } = await db.query(
    "SELECT count(*)::int AS count, coalesce(sum(bytes + octet_length(thumb)), 0)::bigint AS bytes FROM photos WHERE user_id = $1",
    [req.session.userId]
  );
  res.json({ count: rows[0].count, bytes: Number(rows[0].bytes), quota: quotaBytes() });
});

// PUT /api/photos/order { entryId | cardId, ids }
router.put("/order", async (req, res) => {
  const { entryId, cardId, ids } = req.body || {};
  const parent = await ownParent(db, req.session.userId, { entryId, cardId });
  if (!parent) return notFound(res);
  if (!Array.isArray(ids) || !ids.every(isId)) return bad(res, "ids must be an array of ids");
  const { rows } = await db.query(`SELECT id::text AS id FROM photos WHERE ${parent.col} = $1`, [parent.id]);
  if (!sameIdSet(ids, rows.map((r) => r.id))) return res.status(409).json({ error: "ids must list every photo exactly once" });
  await db.query(
    `UPDATE photos p SET position = o.ord - 1 FROM unnest($1::bigint[]) WITH ORDINALITY AS o(id, ord) WHERE p.id = o.id`,
    [ids]
  );
  res.json({ ok: true });
});

async function sendImage(req, res, which) {
  if (!isId(req.params.id)) return notFound(res);
  const col = which === "thumb" ? "thumb, thumb_mime AS mime" : "data AS thumb, mime";
  const { rows } = await db.query(`SELECT ${col} FROM photos WHERE id = $1 AND user_id = $2`, [req.params.id, req.session.userId]);
  if (!rows[0]) return notFound(res);
  const etag = `"p${req.params.id}-${which}"`;
  res.setHeader("ETag", etag);
  res.setHeader("Cache-Control", "private, max-age=31536000, immutable");
  if (req.get("if-none-match") === etag) return res.status(304).end();
  res.setHeader("Content-Type", rows[0].mime);
  res.setHeader("Content-Length", rows[0].thumb.length);
  res.end(rows[0].thumb);
}

router.get("/:id", (req, res) => sendImage(req, res, "full"));
router.get("/:id/thumb", (req, res) => sendImage(req, res, "thumb"));

router.delete("/:id", async (req, res) => {
  if (!isId(req.params.id)) return notFound(res);
  const { rowCount } = await db.query("DELETE FROM photos WHERE id = $1 AND user_id = $2", [req.params.id, req.session.userId]);
  if (!rowCount) return notFound(res);
  res.status(204).end();
});

module.exports = router;
