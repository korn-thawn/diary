const express = require("express");
const db = require("../db");
const { isDate, localToday, COLORS, ICONS, isId, TIME_RE, str, tx, sameIdSet } = require("../util");
const { nextDue } = require("../recur");

const RECURRENCES = ["daily", "weekly", "monthly", "yearly"];

const router = express.Router();

const bad = (res, msg) => res.status(400).json({ error: msg });
const notFound = (res) => res.status(404).json({ error: "not found" });
const uidOf = (req) => req.session.userId;

const DEFAULT_COLUMNS = [
  { name: "ต้องทำ", color: "stone", is_done: false },
  { name: "กำลังทำ", color: "sky", is_done: false },
  { name: "เสร็จแล้ว", color: "emerald", is_done: true },
];

const BOARD_COLS = "b.id::text AS id, b.name, b.color, b.icon, b.position, b.archived";
const COLUMN_COLS = "c.id::text AS id, c.name, c.color, c.position, c.is_done";
const CARD_COLS = `k.id::text AS id, k.column_id::text AS column_id, k.title, k.description,
  to_char(k.due_date, 'YYYY-MM-DD') AS due_date, to_char(k.due_time, 'HH24:MI') AS due_time,
  k.priority, k.color, k.position, k.completed_at, k.created_at, k.updated_at,
  k.recurrence, k.next_card_id::text AS next_card_id`;
const LABEL_COLS = "l.id::text AS id, l.name, l.color";

// ---------- ownership helpers (return row or null) ----------
async function ownBoard(q, uid, id) {
  if (!isId(id)) return null;
  const { rows } = await q.query(`SELECT ${BOARD_COLS} FROM boards b WHERE b.id = $1 AND b.user_id = $2`, [id, uid]);
  return rows[0] || null;
}
async function ownColumn(q, uid, id) {
  if (!isId(id)) return null;
  const { rows } = await q.query(
    `SELECT ${COLUMN_COLS}, c.board_id::text AS board_id FROM board_columns c
     JOIN boards b ON b.id = c.board_id WHERE c.id = $1 AND b.user_id = $2`,
    [id, uid]
  );
  return rows[0] || null;
}
async function ownCard(q, uid, id) {
  if (!isId(id)) return null;
  const { rows } = await q.query(
    `SELECT ${CARD_COLS}, k.board_id::text AS board_id, c.is_done FROM cards k
     JOIN boards b ON b.id = k.board_id JOIN board_columns c ON c.id = k.column_id
     WHERE k.id = $1 AND b.user_id = $2`,
    [id, uid]
  );
  return rows[0] || null;
}
async function ownItem(q, uid, id) {
  if (!isId(id)) return null;
  const { rows } = await q.query(
    `SELECT i.id::text AS id, i.card_id::text AS card_id FROM card_items i
     JOIN cards k ON k.id = i.card_id JOIN boards b ON b.id = k.board_id
     WHERE i.id = $1 AND b.user_id = $2`,
    [id, uid]
  );
  return rows[0] || null;
}
async function ownLabel(q, uid, id) {
  if (!isId(id)) return null;
  const { rows } = await q.query(`SELECT ${LABEL_COLS} FROM labels l WHERE l.id = $1 AND l.user_id = $2`, [id, uid]);
  return rows[0] || null;
}

async function cardWithDetails(q, uid, id) {
  const card = await ownCard(q, uid, id);
  if (!card) return null;
  const [items, labels] = await Promise.all([
    q.query(
      "SELECT id::text AS id, text, done, position FROM card_items WHERE card_id = $1 ORDER BY position, id",
      [id]
    ),
    q.query("SELECT label_id::text AS id FROM card_labels WHERE card_id = $1", [id]),
  ]);
  return { ...card, items: items.rows, label_ids: labels.rows.map((r) => r.id) };
}

async function createColumns(q, boardId, columns) {
  for (const [i, c] of columns.entries()) {
    await q.query(
      "INSERT INTO board_columns (board_id, name, color, position, is_done) VALUES ($1, $2, $3, $4, $5)",
      [boardId, c.name, c.color, i, c.is_done]
    );
  }
}

// Rewrite positions 0..n-1 following ids order.
const reorder = (q, table, ids) =>
  q.query(
    `UPDATE ${table} t SET position = o.ord - 1
     FROM unnest($1::bigint[]) WITH ORDINALITY AS o(id, ord) WHERE t.id = o.id`,
    [ids]
  );

// A recurring card just reached a done column: create the next one (once).
// Returns the new card in board-view shape, or null.
async function spawnNext(q, cardId, today) {
  const { rows } = await q.query(
    `SELECT id, board_id, title, description, priority, color, recurrence,
            to_char(due_date, 'YYYY-MM-DD') AS due_date, due_time, next_card_id
     FROM cards WHERE id = $1 FOR UPDATE`,
    [cardId]
  );
  const c = rows[0];
  if (!c || !c.recurrence || !c.due_date || c.next_card_id) return null;
  const { rows: cols } = await q.query(
    "SELECT id FROM board_columns WHERE board_id = $1 AND NOT is_done ORDER BY position, id LIMIT 1",
    [c.board_id]
  );
  if (!cols[0]) return null; // every column is a done column: nowhere to put it
  const due = nextDue(c.due_date, c.recurrence, today);
  const { rows: ins } = await q.query(
    `INSERT INTO cards (board_id, column_id, title, description, due_date, due_time, priority, color, recurrence, position)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, (SELECT coalesce(max(position) + 1, 0) FROM cards WHERE column_id = $2))
     RETURNING id`,
    [c.board_id, cols[0].id, c.title, c.description, due, c.due_time, c.priority, c.color, c.recurrence]
  );
  const newId = ins[0].id;
  await q.query("INSERT INTO card_labels (card_id, label_id) SELECT $1, label_id FROM card_labels WHERE card_id = $2", [newId, c.id]);
  await q.query(
    "INSERT INTO card_items (card_id, text, done, position) SELECT $1, text, false, position FROM card_items WHERE card_id = $2",
    [newId, c.id]
  );
  await q.query("UPDATE cards SET next_card_id = $2 WHERE id = $1", [c.id, newId]);
  const { rows: out } = await q.query(
    `SELECT ${CARD_COLS},
            coalesce((SELECT array_agg(cl.label_id::text) FROM card_labels cl WHERE cl.card_id = k.id), '{}') AS label_ids,
            (SELECT count(*)::int FROM card_items i WHERE i.card_id = k.id) AS items_total, 0 AS items_done
     FROM cards k WHERE k.id = $1`,
    [newId]
  );
  return out[0];
}

const todayOf = (req) => (isDate(req.body?.today) ? req.body.today : isDate(req.query.today) ? req.query.today : localToday());

// ---------- labels (shared across boards) ----------
router.get("/labels", async (req, res) => {
  const { rows } = await db.query(`SELECT ${LABEL_COLS} FROM labels l WHERE l.user_id = $1 ORDER BY l.name`, [uidOf(req)]);
  res.json({ labels: rows });
});

router.post("/labels", async (req, res) => {
  const name = str(req.body?.name, 1, 30);
  const color = req.body?.color ?? "stone";
  if (!name) return bad(res, "name must be 1-30 characters");
  if (!COLORS.includes(color)) return bad(res, "invalid color");
  const { rows } = await db.query(
    `INSERT INTO labels (user_id, name, color) VALUES ($1, $2, $3)
     ON CONFLICT (user_id, name) DO NOTHING RETURNING id::text AS id, name, color`,
    [uidOf(req), name, color]
  );
  if (!rows[0]) return res.status(409).json({ error: "label already exists" });
  res.status(201).json({ label: rows[0] });
});

router.patch("/labels/:lid", async (req, res) => {
  const label = await ownLabel(db, uidOf(req), req.params.lid);
  if (!label) return notFound(res);
  const name = req.body?.name === undefined ? label.name : str(req.body.name, 1, 30);
  const color = req.body?.color ?? label.color;
  if (!name) return bad(res, "name must be 1-30 characters");
  if (!COLORS.includes(color)) return bad(res, "invalid color");
  try {
    const { rows } = await db.query(
      "UPDATE labels SET name = $2, color = $3 WHERE id = $1 RETURNING id::text AS id, name, color",
      [label.id, name, color]
    );
    res.json({ label: rows[0] });
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "label already exists" });
    throw err;
  }
});

router.delete("/labels/:lid", async (req, res) => {
  const label = await ownLabel(db, uidOf(req), req.params.lid);
  if (!label) return notFound(res);
  await db.query("DELETE FROM labels WHERE id = $1", [label.id]);
  res.status(204).end();
});

// ---------- boards ----------
router.get("/", async (req, res) => {
  const uid = uidOf(req);
  const rows = await tx(db.pool, async (q) => {
    // Lock the user row so two parallel first visits can't both create the default board.
    await q.query("SELECT 1 FROM users WHERE id = $1 FOR UPDATE", [uid]);
    const { rows: existing } = await q.query("SELECT 1 FROM boards WHERE user_id = $1 LIMIT 1", [uid]);
    if (!existing.length) {
      const { rows: b } = await q.query(
        "INSERT INTO boards (user_id, name, color, icon) VALUES ($1, 'ทั่วไป', 'stone', 'clipboard') RETURNING id",
        [uid]
      );
      await createColumns(q, b[0].id, DEFAULT_COLUMNS);
    }
    const { rows: list } = await q.query(
      `SELECT ${BOARD_COLS},
              (SELECT count(*)::int FROM cards k JOIN board_columns c ON c.id = k.column_id
               WHERE k.board_id = b.id AND NOT c.is_done) AS open_count,
              (SELECT count(*)::int FROM cards k JOIN board_columns c ON c.id = k.column_id
               WHERE k.board_id = b.id AND NOT c.is_done AND k.due_date < $2::date) AS overdue_count
       FROM boards b WHERE b.user_id = $1 ORDER BY b.archived, b.position, b.id`,
      [uid, isDate(req.query.today) ? req.query.today : localToday()]
    );
    return list;
  });
  res.json({ boards: rows });
});

router.post("/", async (req, res) => {
  const name = str(req.body?.name, 1, 60);
  const color = req.body?.color ?? "stone";
  const icon = req.body?.icon ?? "clipboard";
  if (!name) return bad(res, "name must be 1-60 characters");
  if (!COLORS.includes(color)) return bad(res, "invalid color");
  if (!ICONS.includes(icon)) return bad(res, "invalid icon");
  const board = await tx(db.pool, async (q) => {
    const { rows } = await q.query(
      `INSERT INTO boards (user_id, name, color, icon, position)
       VALUES ($1, $2, $3, $4, (SELECT coalesce(max(position) + 1, 0) FROM boards WHERE user_id = $1))
       RETURNING id`,
      [uidOf(req), name, color, icon]
    );
    await createColumns(q, rows[0].id, DEFAULT_COLUMNS);
    return ownBoard(q, uidOf(req), rows[0].id);
  });
  res.status(201).json({ board });
});

router.put("/order", async (req, res) => {
  const ids = req.body?.ids;
  if (!Array.isArray(ids) || !ids.every(isId)) return bad(res, "ids must be an array of ids");
  const { rows } = await db.query("SELECT id::text AS id FROM boards WHERE user_id = $1", [uidOf(req)]);
  if (!sameIdSet(ids, rows.map((r) => r.id))) return bad(res, "ids must list every board exactly once");
  await reorder(db, "boards", ids);
  res.json({ ok: true });
});

router.get("/:id", async (req, res) => {
  const uid = uidOf(req);
  const board = await ownBoard(db, uid, req.params.id);
  if (!board) return notFound(res);
  const [columns, cards, labels] = await Promise.all([
    db.query(`SELECT ${COLUMN_COLS} FROM board_columns c WHERE c.board_id = $1 ORDER BY c.position, c.id`, [board.id]),
    db.query(
      `SELECT ${CARD_COLS},
              coalesce((SELECT array_agg(cl.label_id::text) FROM card_labels cl WHERE cl.card_id = k.id), '{}') AS label_ids,
              (SELECT count(*)::int FROM card_items i WHERE i.card_id = k.id) AS items_total,
              (SELECT count(*)::int FROM card_items i WHERE i.card_id = k.id AND i.done) AS items_done
       FROM cards k WHERE k.board_id = $1 ORDER BY k.position, k.id`,
      [board.id]
    ),
    db.query(`SELECT ${LABEL_COLS} FROM labels l WHERE l.user_id = $1 ORDER BY l.name`, [uid]),
  ]);
  res.json({ board, columns: columns.rows, cards: cards.rows, labels: labels.rows });
});

router.patch("/:id", async (req, res) => {
  const board = await ownBoard(db, uidOf(req), req.params.id);
  if (!board) return notFound(res);
  const b = req.body || {};
  const name = b.name === undefined ? board.name : str(b.name, 1, 60);
  const color = b.color ?? board.color;
  const icon = b.icon ?? board.icon;
  const archived = b.archived ?? board.archived;
  if (!name) return bad(res, "name must be 1-60 characters");
  if (!COLORS.includes(color)) return bad(res, "invalid color");
  if (!ICONS.includes(icon)) return bad(res, "invalid icon");
  if (typeof archived !== "boolean") return bad(res, "archived must be boolean");
  await db.query("UPDATE boards SET name = $2, color = $3, icon = $4, archived = $5 WHERE id = $1", [
    board.id, name, color, icon, archived,
  ]);
  res.json({ board: await ownBoard(db, uidOf(req), board.id) });
});

router.delete("/:id", async (req, res) => {
  const board = await ownBoard(db, uidOf(req), req.params.id);
  if (!board) return notFound(res);
  await db.query("DELETE FROM boards WHERE id = $1", [board.id]);
  res.status(204).end();
});

// ---------- columns ----------
router.post("/:id/columns", async (req, res) => {
  const board = await ownBoard(db, uidOf(req), req.params.id);
  if (!board) return notFound(res);
  const name = str(req.body?.name, 1, 40);
  const color = req.body?.color ?? "stone";
  if (!name) return bad(res, "name must be 1-40 characters");
  if (!COLORS.includes(color)) return bad(res, "invalid color");
  const { rows } = await db.query(
    `INSERT INTO board_columns (board_id, name, color, position)
     VALUES ($1, $2, $3, (SELECT coalesce(max(position) + 1, 0) FROM board_columns WHERE board_id = $1))
     RETURNING id::text AS id, name, color, position, is_done`,
    [board.id, name, color]
  );
  res.status(201).json({ column: rows[0] });
});

router.put("/:id/columns/order", async (req, res) => {
  const board = await ownBoard(db, uidOf(req), req.params.id);
  if (!board) return notFound(res);
  const ids = req.body?.ids;
  if (!Array.isArray(ids) || !ids.every(isId)) return bad(res, "ids must be an array of ids");
  const { rows } = await db.query("SELECT id::text AS id FROM board_columns WHERE board_id = $1", [board.id]);
  if (!sameIdSet(ids, rows.map((r) => r.id))) return bad(res, "ids must list every column exactly once");
  await reorder(db, "board_columns", ids);
  res.json({ ok: true });
});

router.patch("/columns/:cid", async (req, res) => {
  const col = await ownColumn(db, uidOf(req), req.params.cid);
  if (!col) return notFound(res);
  const b = req.body || {};
  const name = b.name === undefined ? col.name : str(b.name, 1, 40);
  const color = b.color ?? col.color;
  const isDone = b.is_done ?? col.is_done;
  if (!name) return bad(res, "name must be 1-40 characters");
  if (!COLORS.includes(color)) return bad(res, "invalid color");
  if (typeof isDone !== "boolean") return bad(res, "is_done must be boolean");
  const spawned = [];
  const column = await tx(db.pool, async (q) => {
    const { rows } = await q.query(
      `UPDATE board_columns SET name = $2, color = $3, is_done = $4 WHERE id = $1
       RETURNING id::text AS id, name, color, position, is_done`,
      [col.id, name, color, isDone]
    );
    if (isDone !== col.is_done) {
      // Keep completed_at consistent with the column's new meaning
      await q.query(
        `UPDATE cards SET completed_at = ${isDone ? "coalesce(completed_at, now())" : "NULL"} WHERE column_id = $1`,
        [col.id]
      );
      if (isDone) {
        const { rows: rec } = await q.query(
          "SELECT id FROM cards WHERE column_id = $1 AND recurrence IS NOT NULL AND next_card_id IS NULL ORDER BY position",
          [col.id]
        );
        for (const r of rec) {
          const s = await spawnNext(q, r.id, todayOf(req));
          if (s) spawned.push(s);
        }
      }
    }
    return rows[0];
  });
  res.json({ column, spawned });
});

// DELETE /columns/:cid?moveTo=<cid> | ?deleteCards=1
router.delete("/columns/:cid", async (req, res) => {
  const uid = uidOf(req);
  const col = await ownColumn(db, uid, req.params.cid);
  if (!col) return notFound(res);
  const { rows: siblings } = await db.query("SELECT count(*)::int AS n FROM board_columns WHERE board_id = $1", [col.board_id]);
  if (siblings[0].n <= 1) return bad(res, "a board needs at least one column");
  const { rows: cnt } = await db.query("SELECT count(*)::int AS n FROM cards WHERE column_id = $1", [col.id]);
  const cardCount = cnt[0].n;

  let target = null;
  if (cardCount > 0) {
    if (req.query.moveTo !== undefined) {
      target = await ownColumn(db, uid, req.query.moveTo);
      if (!target || target.board_id !== col.board_id || target.id === col.id) {
        return bad(res, "moveTo must be another column on the same board");
      }
    } else if (req.query.deleteCards !== "1") {
      return res.status(400).json({ error: "column has cards: pass moveTo or deleteCards=1", cardCount });
    }
  }

  await tx(db.pool, async (q) => {
    if (target) {
      await q.query(
        `UPDATE cards k SET column_id = $2,
           position = (SELECT coalesce(max(position) + 1, 0) FROM cards WHERE column_id = $2) + k.position,
           completed_at = ${target.is_done ? "coalesce(k.completed_at, now())" : "NULL"}
         WHERE k.column_id = $1`,
        [col.id, target.id]
      );
    }
    await q.query("DELETE FROM board_columns WHERE id = $1", [col.id]);
  });
  res.status(204).end();
});

// ---------- cards ----------
router.post("/columns/:cid/cards", async (req, res) => {
  const col = await ownColumn(db, uidOf(req), req.params.cid);
  if (!col) return notFound(res);
  const title = str(req.body?.title, 1, 200);
  if (!title) return bad(res, "title must be 1-200 characters");
  const { rows } = await db.query(
    `INSERT INTO cards (board_id, column_id, title, position, completed_at)
     VALUES ($1, $2, $3, (SELECT coalesce(max(position) + 1, 0) FROM cards WHERE column_id = $2), $4)
     RETURNING id`,
    [col.board_id, col.id, title, col.is_done ? new Date() : null]
  );
  res.status(201).json({ card: await cardWithDetails(db, uidOf(req), rows[0].id) });
});

router.get("/cards/:id", async (req, res) => {
  const card = await cardWithDetails(db, uidOf(req), req.params.id);
  if (!card) return notFound(res);
  res.json({ card });
});

router.patch("/cards/:id", async (req, res) => {
  const uid = uidOf(req);
  const card = await ownCard(db, uid, req.params.id);
  if (!card) return notFound(res);
  const b = req.body || {};
  const v = {
    title: b.title === undefined ? card.title : str(b.title, 1, 200),
    description: b.description === undefined ? card.description : b.description,
    due_date: b.due_date === undefined ? card.due_date : b.due_date || null,
    due_time: b.due_time === undefined ? card.due_time : b.due_time || null,
    priority: b.priority ?? card.priority,
    color: b.color === undefined ? card.color : b.color || null,
    recurrence: b.recurrence === undefined ? card.recurrence : b.recurrence || null,
  };
  if (!v.title) return bad(res, "title must be 1-200 characters");
  if (typeof v.description !== "string" || v.description.length > 20000) return bad(res, "description is too long");
  if (v.due_date !== null && !isDate(v.due_date)) return bad(res, "due_date must be YYYY-MM-DD");
  if (v.due_time !== null && !TIME_RE.test(v.due_time)) return bad(res, "due_time must be HH:MM");
  if (v.recurrence !== null && !RECURRENCES.includes(v.recurrence)) return bad(res, "recurrence must be daily, weekly, monthly or yearly");
  if (v.recurrence !== null && v.due_date === null) {
    if (b.recurrence) return bad(res, "a recurring card needs a due date");
    v.recurrence = null; // clearing the date also stops the repeat
  }
  if (v.due_date === null) v.due_time = null; // a time without a date makes no sense
  if (!Number.isInteger(v.priority) || v.priority < 0 || v.priority > 3) return bad(res, "priority must be 0-3");
  if (v.color !== null && !COLORS.includes(v.color)) return bad(res, "invalid color");

  let labelIds = null;
  if (b.labelIds !== undefined) {
    if (!Array.isArray(b.labelIds) || !b.labelIds.every(isId)) return bad(res, "labelIds must be an array of ids");
    labelIds = [...new Set(b.labelIds.map(String))];
    if (labelIds.length) {
      const { rows } = await db.query("SELECT count(*)::int AS n FROM labels WHERE user_id = $1 AND id = ANY($2::bigint[])", [uid, labelIds]);
      if (rows[0].n !== labelIds.length) return bad(res, "unknown label");
    }
  }

  await tx(db.pool, async (q) => {
    await q.query(
      `UPDATE cards SET title = $2, description = $3, due_date = $4, due_time = $5, priority = $6, color = $7,
         recurrence = $8, updated_at = now() WHERE id = $1`,
      [card.id, v.title, v.description, v.due_date, v.due_time, v.priority, v.color, v.recurrence]
    );
    if (labelIds) {
      await q.query("DELETE FROM card_labels WHERE card_id = $1", [card.id]);
      if (labelIds.length) {
        await q.query(
          "INSERT INTO card_labels (card_id, label_id) SELECT $1, unnest($2::bigint[])",
          [card.id, labelIds]
        );
      }
    }
  });
  res.json({ card: await cardWithDetails(db, uid, card.id) });
});

router.delete("/cards/:id", async (req, res) => {
  const card = await ownCard(db, uidOf(req), req.params.id);
  if (!card) return notFound(res);
  await db.query("DELETE FROM cards WHERE id = $1", [card.id]);
  res.status(204).end();
});

// PUT /cards/:id/move { columnId, orderedIds } — orderedIds = full order of the target column after the drop
router.put("/cards/:id/move", async (req, res) => {
  const uid = uidOf(req);
  const card = await ownCard(db, uid, req.params.id);
  if (!card) return notFound(res);
  const target = await ownColumn(db, uid, req.body?.columnId);
  if (!target || target.board_id !== card.board_id) return bad(res, "columnId must be a column on the same board");
  const ids = req.body?.orderedIds;
  if (!Array.isArray(ids) || !ids.every(isId)) return bad(res, "orderedIds must be an array of ids");

  const spawned = await tx(db.pool, async (q) => {
    // Lock the target column's cards so the check and the write see the same state
    const { rows } = await q.query(
      "SELECT id::text AS id FROM cards WHERE column_id = $1 AND id <> $2 FOR UPDATE",
      [target.id, card.id]
    );
    const expected = [...rows.map((r) => r.id), card.id];
    if (!sameIdSet(ids, expected)) {
      const err = new Error("orderedIds must list the target column's cards (including the moved one) exactly once");
      err.status = 409;
      throw err;
    }
    if (target.id !== card.column_id) {
      await q.query(
        `UPDATE cards SET column_id = $2, updated_at = now(),
           completed_at = ${target.is_done ? "coalesce(completed_at, now())" : "NULL"}
         WHERE id = $1`,
        [card.id, target.id]
      );
    }
    await reorder(q, "cards", ids);
    return target.is_done && !card.is_done ? spawnNext(q, card.id, todayOf(req)) : null;
  });
  res.json({ card: await ownCard(db, uid, card.id), spawned });
});

// ---------- checklist items ----------
router.post("/cards/:id/items", async (req, res) => {
  const card = await ownCard(db, uidOf(req), req.params.id);
  if (!card) return notFound(res);
  const text = str(req.body?.text, 1, 300);
  if (!text) return bad(res, "text must be 1-300 characters");
  const { rows } = await db.query(
    `INSERT INTO card_items (card_id, text, position)
     VALUES ($1, $2, (SELECT coalesce(max(position) + 1, 0) FROM card_items WHERE card_id = $1))
     RETURNING id::text AS id, text, done, position`,
    [card.id, text]
  );
  res.status(201).json({ item: rows[0] });
});

router.put("/cards/:id/items/order", async (req, res) => {
  const card = await ownCard(db, uidOf(req), req.params.id);
  if (!card) return notFound(res);
  const ids = req.body?.ids;
  if (!Array.isArray(ids) || !ids.every(isId)) return bad(res, "ids must be an array of ids");
  const { rows } = await db.query("SELECT id::text AS id FROM card_items WHERE card_id = $1", [card.id]);
  if (!sameIdSet(ids, rows.map((r) => r.id))) return bad(res, "ids must list every item exactly once");
  await reorder(db, "card_items", ids);
  res.json({ ok: true });
});

router.patch("/items/:iid", async (req, res) => {
  const item = await ownItem(db, uidOf(req), req.params.iid);
  if (!item) return notFound(res);
  const b = req.body || {};
  const sets = [], params = [item.id];
  if (b.text !== undefined) {
    const text = str(b.text, 1, 300);
    if (!text) return bad(res, "text must be 1-300 characters");
    params.push(text);
    sets.push(`text = $${params.length}`);
  }
  if (b.done !== undefined) {
    if (typeof b.done !== "boolean") return bad(res, "done must be boolean");
    params.push(b.done);
    sets.push(`done = $${params.length}`);
  }
  if (!sets.length) return bad(res, "nothing to update");
  const { rows } = await db.query(
    `UPDATE card_items SET ${sets.join(", ")} WHERE id = $1 RETURNING id::text AS id, text, done, position`,
    params
  );
  res.json({ item: rows[0] });
});

router.delete("/items/:iid", async (req, res) => {
  const item = await ownItem(db, uidOf(req), req.params.iid);
  if (!item) return notFound(res);
  await db.query("DELETE FROM card_items WHERE id = $1", [item.id]);
  res.status(204).end();
});

module.exports = router;
