// Shared kanban helpers (pure functions).

const DAY = 86400000;
const toDays = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / DAY;

// Due-date badge info relative to today (YYYY-MM-DD strings, no TZ shifts).
export function dueInfo(due, todayStr, done) {
  if (!due) return null;
  const diff = toDays(due) - toDays(todayStr);
  if (done) return { kind: "done", diff };
  if (diff < 0) return { kind: "overdue", diff, text: diff === -1 ? "เมื่อวาน" : `เลยมา ${-diff} วัน` };
  if (diff === 0) return { kind: "today", diff, text: "วันนี้" };
  if (diff === 1) return { kind: "soon", diff, text: "พรุ่งนี้" };
  if (diff < 7) return { kind: "soon", diff, text: `อีก ${diff} วัน` };
  return { kind: "later", diff };
}

// Group a flat card list into { [columnId]: card[] } sorted by position.
export function groupCards(columns, cards) {
  const map = Object.fromEntries(columns.map((c) => [c.id, []]));
  for (const c of [...cards].sort((a, b) => a.position - b.position || a.id - b.id)) {
    (map[c.column_id] ||= []).push(c);
  }
  return map;
}

export function matchesFilter(card, { q, labelId, due }, todayStr) {
  if (q) {
    const needle = q.toLowerCase();
    if (!card.title.toLowerCase().includes(needle) && !card.description.toLowerCase().includes(needle)) return false;
  }
  if (labelId && !card.label_ids.includes(labelId)) return false;
  if (due) {
    const info = dueInfo(card.due_date, todayStr, false);
    if (!info || card.completed_at) return false;
    if (due === "overdue" && info.kind !== "overdue") return false;
    if (due === "week" && !(info.diff >= 0 && info.diff < 7)) return false;
  }
  return true;
}
