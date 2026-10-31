import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  closestCorners,
  pointerWithin,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import {
  ArchiveBoxIcon,
  ArrowUturnLeftIcon,
  ChevronLeftIcon,
  Cog6ToothIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/20/solid";
import { api, formatDate, today } from "../api";
import { useAuth } from "../auth";
import { boardIcon, color } from "../palette";
import { groupCards, matchesFilter } from "../kanban";
import { useDndSensors, useJustDragged } from "./Boards";
import KanbanColumn from "../components/KanbanColumn";
import { CardFace } from "../components/KanbanCard";
import CardModal from "../components/CardModal";
import Popover, { MenuItem } from "../components/Popover";
import { ColorPicker, IconPicker } from "../components/Pickers";

const cardKey = (id) => `card-${id}`;
const colKey = (id) => `col-${id}`;
const rawId = (key) => String(key).replace(/^(card|col)-/, "");

// Columns only collide with columns; cards prefer the pointer, then nearest corners.
function collision(args) {
  if (args.active.data.current?.type === "column") {
    return closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter((c) => c.data.current?.type === "column"),
    });
  }
  const within = pointerWithin(args);
  return within.length ? within : closestCorners(args);
}

function BoardSettings({ board, onUpdate, onDelete }) {
  return (
    <Popover
      button={({ toggle }) => (
        <button className="btn btn-ghost px-2" onClick={toggle} aria-label="ตั้งค่าบอร์ด">
          <Cog6ToothIcon className="size-5" />
        </button>
      )}
    >
      {({ close }) => (
        <div className="w-72 space-y-3 p-1">
          <div>
            <p className="mb-1.5 text-xs text-stone-500">สี</p>
            <ColorPicker value={board.color} onChange={(c) => onUpdate({ color: c })} />
          </div>
          <div>
            <p className="mb-1.5 text-xs text-stone-500">ไอคอน</p>
            <IconPicker value={board.icon} onChange={(i) => onUpdate({ icon: i })} />
          </div>
          <div className="border-t border-stone-100 pt-2">
            <MenuItem icon={board.archived ? ArrowUturnLeftIcon : ArchiveBoxIcon} onClick={() => { close(); onUpdate({ archived: !board.archived }); }}>
              {board.archived ? "นำออกจากที่เก็บถาวร" : "เก็บบอร์ดถาวร"}
            </MenuItem>
            <MenuItem icon={TrashIcon} danger onClick={() => { close(); onDelete(); }}>ลบบอร์ด</MenuItem>
          </div>
        </div>
      )}
    </Popover>
  );
}

function DeleteColumnDialog({ column, others, cardCount, onCancel, onConfirm }) {
  const [moveTo, setMoveTo] = useState(others[0]?.id || "");
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm space-y-4 rounded-2xl bg-surface p-5 shadow-xl">
        <h2 className="font-serif text-lg font-semibold">ลบคอลัมน์ "{column.name}"</h2>
        <p className="text-sm text-stone-600">คอลัมน์นี้มี {cardCount} การ์ด จะทำอย่างไรกับการ์ด?</p>
        <label className="block text-sm">
          <span className="mb-1 block text-stone-600">ย้ายการ์ดไปที่</span>
          <select className="input" value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
            {others.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <div className="flex flex-wrap justify-end gap-2">
          <button className="btn btn-ghost" onClick={onCancel}>ยกเลิก</button>
          <button className="btn text-red-600 hover:bg-red-50" onClick={() => onConfirm({ deleteCards: true })}>ลบการ์ดทิ้งด้วย</button>
          <button className="btn btn-primary" onClick={() => onConfirm({ moveTo })}>ย้ายแล้วลบคอลัมน์</button>
        </div>
      </div>
    </div>
  );
}

export default function Board() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const openCardId = params.get("card");
  const { setUser } = useAuth();
  const todayStr = today();
  const sensors = useDndSensors();
  const justDragged = useJustDragged();

  const [board, setBoard] = useState(null);
  const [columns, setColumns] = useState([]);
  const [byCol, setByCol] = useState({});
  const [labels, setLabels] = useState([]);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [active, setActive] = useState(null); // { type, card|column }
  const [filter, setFilter] = useState({ q: "", labelId: "", due: "" });
  const [deleting, setDeleting] = useState(null); // column pending delete
  const [editingName, setEditingName] = useState(false);
  const snapshot = useRef(null);
  const dragFrom = useRef(null);

  const notify = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 4000);
  };
  const fail = (err) => (err.status === 401 ? setUser(null) : notify(err.message));
  // Put cards spawned by recurring cards into their column and tell the user
  function addSpawned(list) {
    if (!list?.length) return;
    setByCol((m) => {
      const next = { ...m };
      for (const s of list) next[s.column_id] = [...(next[s.column_id] || []).filter((c) => c.id !== s.id), s];
      return next;
    });
    notify(list.length === 1
      ? `สร้างงานรอบถัดไปแล้ว: ${list[0].title} (${formatDate(list[0].due_date, { day: "numeric", month: "short" })})`
      : `สร้างงานรอบถัดไปแล้ว ${list.length} รายการ`);
  }

  async function load() {
    try {
      const d = await api(`/boards/${id}`);
      setBoard(d.board);
      setColumns(d.columns);
      setByCol(groupCards(d.columns, d.cards));
      setLabels(d.labels);
    } catch (err) {
      if (err.status === 404) return navigate("/boards", { replace: true });
      if (err.status === 401) return setUser(null);
      setError(err.message);
    }
  }
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const labelsById = useMemo(() => Object.fromEntries(labels.map((l) => [l.id, l])), [labels]);
  const filtering = Boolean(filter.q || filter.labelId || filter.due);
  const visible = useMemo(() => {
    if (!filtering) return byCol;
    return Object.fromEntries(Object.entries(byCol).map(([cid, cards]) => [cid, cards.filter((c) => matchesFilter(c, filter, todayStr))]));
  }, [byCol, filter, filtering, todayStr]);
  const colOfCard = (cardId, map = byCol) => Object.keys(map).find((cid) => map[cid].some((c) => c.id === cardId));

  // ---------- drag & drop ----------
  function onDragStart({ active: a }) {
    snapshot.current = { columns, byCol };
    const data = a.data.current;
    if (data.type === "card") dragFrom.current = colOfCard(data.card.id);
    setActive(data);
  }

  function onDragOver({ active: a, over }) {
    if (!over || a.data.current.type !== "card") return;
    const cardId = rawId(a.id);
    const overIsCard = String(over.id).startsWith("card-");
    setByCol((map) => {
      const from = colOfCard(cardId, map);
      const to = overIsCard ? colOfCard(rawId(over.id), map) : rawId(over.id);
      if (!from || !to || from === to) return map;
      const card = map[from].find((c) => c.id === cardId);
      const target = map[to].filter((c) => c.id !== cardId);
      let idx = target.length;
      if (overIsCard) {
        const overIdx = target.findIndex((c) => c.id === rawId(over.id));
        const below = a.rect.current.translated && a.rect.current.translated.top > over.rect.top + over.rect.height / 2;
        idx = overIdx + (below ? 1 : 0);
      }
      return {
        ...map,
        [from]: map[from].filter((c) => c.id !== cardId),
        [to]: [...target.slice(0, idx), { ...card, column_id: to }, ...target.slice(idx)],
      };
    });
  }

  async function onDragEnd({ active: a, over }) {
    justDragged.mark();
    setActive(null);
    const type = a.data.current.type;
    if (!over) return revert();

    if (type === "column") {
      if (a.id === over.id) return;
      const fromIdx = columns.findIndex((c) => colKey(c.id) === a.id);
      const toIdx = columns.findIndex((c) => colKey(c.id) === over.id);
      if (fromIdx < 0 || toIdx < 0) return;
      const next = arrayMove(columns, fromIdx, toIdx);
      setColumns(next);
      try {
        await api(`/boards/${id}/columns/order`, { method: "PUT", body: { ids: next.map((c) => c.id) } });
      } catch (err) {
        revert();
        fail(err);
      }
      return;
    }

    // card
    const cardId = rawId(a.id);
    let map = byCol;
    const col = colOfCard(cardId, map);
    if (String(over.id).startsWith("card-") && colOfCard(rawId(over.id), map) === col && over.id !== a.id) {
      const list = map[col];
      map = { ...map, [col]: arrayMove(list, list.findIndex((c) => c.id === cardId), list.findIndex((c) => c.id === rawId(over.id))) };
      setByCol(map);
    }
    const before = snapshot.current.byCol[dragFrom.current].map((c) => c.id).join();
    const after = map[col].map((c) => c.id).join();
    if (col === dragFrom.current && before === after) return;
    const target = columns.find((c) => c.id === col);
    // reflect done-state immediately; the server will confirm
    setByCol((m) => ({
      ...m,
      [col]: m[col].map((c) => (c.id === cardId ? { ...c, completed_at: target.is_done ? c.completed_at || new Date().toISOString() : null } : c)),
    }));
    try {
      const res = await api(`/boards/cards/${cardId}/move`, { method: "PUT", body: { columnId: col, orderedIds: map[col].map((c) => c.id), today: todayStr } });
      if (res.spawned) addSpawned([res.spawned]);
      setByCol((m) => ({ ...m, [col]: m[col].map((c) => (c.id === cardId ? { ...c, next_card_id: res.card.next_card_id, completed_at: res.card.completed_at } : c)) }));
    } catch (err) {
      revert();
      fail(err);
      if (err.status === 409) load(); // someone else changed the board: resync
    }
  }

  function revert() {
    if (!snapshot.current) return;
    setColumns(snapshot.current.columns);
    setByCol(snapshot.current.byCol);
  }

  // ---------- mutations ----------
  async function updateBoard(patch) {
    try {
      const { board: b } = await api(`/boards/${id}`, { method: "PATCH", body: patch });
      setBoard(b);
    } catch (err) { fail(err); }
  }
  async function deleteBoard() {
    if (!confirm(`ลบบอร์ด "${board.name}" และการ์ดทั้งหมด? กู้คืนไม่ได้`)) return;
    try {
      await api(`/boards/${id}`, { method: "DELETE" });
      navigate("/boards");
    } catch (err) { fail(err); }
  }
  async function addColumn() {
    const name = prompt("ชื่อคอลัมน์ใหม่");
    if (!name?.trim()) return;
    try {
      const { column } = await api(`/boards/${id}/columns`, { method: "POST", body: { name } });
      setColumns((cs) => [...cs, column]);
      setByCol((m) => ({ ...m, [column.id]: [] }));
    } catch (err) { fail(err); }
  }
  async function updateColumn(colId, patch) {
    try {
      const { column, spawned } = await api(`/boards/columns/${colId}`, { method: "PATCH", body: { ...patch, today: todayStr } });
      setColumns((cs) => cs.map((c) => (c.id === colId ? column : c)));
      if (patch.is_done !== undefined) {
        await load(); // completed_at of its cards changed (and maybe new recurring cards)
        if (spawned?.length) addSpawned(spawned);
      }
    } catch (err) { fail(err); }
  }
  async function deleteColumn(col, opts = {}) {
    const count = byCol[col.id]?.length || 0;
    if (count && !opts.moveTo && !opts.deleteCards) return setDeleting(col);
    if (!count && !confirm(`ลบคอลัมน์ "${col.name}"?`)) return;
    setDeleting(null);
    const qs = opts.moveTo ? `?moveTo=${opts.moveTo}` : opts.deleteCards ? "?deleteCards=1" : "";
    try {
      await api(`/boards/columns/${col.id}${qs}`, { method: "DELETE" });
      load();
    } catch (err) { fail(err); }
  }
  async function addCard(colId, title) {
    try {
      const { card } = await api(`/boards/columns/${colId}/cards`, { method: "POST", body: { title } });
      setByCol((m) => ({ ...m, [colId]: [...m[colId], { ...card, items_total: 0, items_done: 0 }] }));
      return true;
    } catch (err) {
      fail(err);
      return false;
    }
  }
  function openCard(cardId) {
    if (justDragged()) return;
    setParams((p) => { p.set("card", cardId); return p; });
  }
  function closeCard() {
    setParams((p) => { p.delete("card"); return p; }, { replace: true });
  }
  // Merge a card update coming from the modal (or remove it if deleted)
  function onCardChanged(card, { deleted } = {}) {
    setByCol((m) => {
      const cid = colOfCard(card.id, m);
      if (!cid) return m;
      if (deleted) return { ...m, [cid]: m[cid].filter((c) => c.id !== card.id) };
      return { ...m, [cid]: m[cid].map((c) => (c.id === card.id ? { ...c, ...card } : c)) };
    });
  }

  if (error) return <p className="text-red-600">{error}</p>;
  if (!board) return <p className="text-center text-stone-500">กำลังโหลด…</p>;

  const Icon = boardIcon(board.icon);
  const face = { labelsById, todayStr };
  const activeCard = active?.type === "card" ? active.card : null;
  const activeCardDone = activeCard && columns.find((c) => c.id === colOfCard(activeCard.id))?.is_done;

  return (
    <div>
      <div className="mx-auto mb-4 flex max-w-6xl flex-wrap items-center gap-2">
        <Link to="/boards" className="btn btn-ghost px-2" aria-label="กลับไปหน้ารายการบอร์ด">
          <ChevronLeftIcon className="size-5" />
        </Link>
        <span className={`flex size-9 items-center justify-center rounded-xl ${color(board.color).soft}`}>
          <Icon className="size-5" aria-hidden="true" />
        </span>
        {editingName ? (
          <input
            className="input w-auto font-serif text-xl"
            defaultValue={board.name}
            maxLength={60}
            autoFocus
            onBlur={(e) => { setEditingName(false); if (e.target.value.trim() && e.target.value !== board.name) updateBoard({ name: e.target.value }); }}
            onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); if (e.key === "Escape") setEditingName(false); }}
          />
        ) : (
          <h1 className="cursor-text font-serif text-xl font-semibold" onClick={() => setEditingName(true)} title="คลิกเพื่อเปลี่ยนชื่อ">
            {board.name}
          </h1>
        )}
        {board.archived && <span className="rounded-full bg-stone-200 px-2 py-0.5 text-xs text-stone-600">เก็บถาวร</span>}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="relative">
            <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-stone-400" aria-hidden="true" />
            <input
              className="input w-44 py-1.5 pl-8! text-sm"
              type="search"
              placeholder="ค้นหาการ์ด"
              aria-label="ค้นหาการ์ด"
              value={filter.q}
              onChange={(e) => setFilter((f) => ({ ...f, q: e.target.value }))}
            />
          </div>
          <Popover
            button={({ toggle }) => (
              <button className={`btn px-2.5 py-1.5 text-sm ${filtering && !filter.q ? "bg-ink text-paper" : "btn-ghost"}`} onClick={toggle}>
                <FunnelIcon className="size-4" aria-hidden="true" />
                กรอง
              </button>
            )}
          >
            <div className="w-56 space-y-3 p-1 text-sm">
              <label className="block">
                <span className="mb-1 block text-xs text-stone-500">ป้าย</span>
                <select className="input py-1.5 text-sm" value={filter.labelId} onChange={(e) => setFilter((f) => ({ ...f, labelId: e.target.value }))}>
                  <option value="">ทั้งหมด</option>
                  {labels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-stone-500">กำหนดส่ง</span>
                <select className="input py-1.5 text-sm" value={filter.due} onChange={(e) => setFilter((f) => ({ ...f, due: e.target.value }))}>
                  <option value="">ทั้งหมด</option>
                  <option value="overdue">เลยกำหนด</option>
                  <option value="week">ภายใน 7 วัน</option>
                </select>
              </label>
            </div>
          </Popover>
          <BoardSettings board={board} onUpdate={updateBoard} onDelete={deleteBoard} />
        </div>
      </div>

      {filtering && (
        <div className="mx-auto mb-3 flex max-w-6xl items-center gap-2 text-sm text-stone-600">
          <span>กำลังกรองอยู่ ลากการ์ดไม่ได้ระหว่างกรอง</span>
          <button className="inline-flex items-center gap-1 rounded-full bg-stone-200 px-2.5 py-0.5 text-xs" onClick={() => setFilter({ q: "", labelId: "", due: "" })}>
            ล้างตัวกรอง <XMarkIcon className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={collision}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => { setActive(null); revert(); }}
      >
        <div className="flex snap-x gap-3 overflow-x-auto pb-4 sm:snap-none">
          <SortableContext items={columns.map((c) => colKey(c.id))} strategy={horizontalListSortingStrategy}>
            {columns.map((col) => (
              <KanbanColumn
                key={col.id}
                column={col}
                cards={visible[col.id] || []}
                dragDisabled={filtering}
                onAddCard={(title) => addCard(col.id, title)}
                onOpenCard={openCard}
                onUpdate={(patch) => updateColumn(col.id, patch)}
                onDelete={() => deleteColumn(col)}
                face={face}
              />
            ))}
          </SortableContext>
          <button
            className="flex h-12 w-60 shrink-0 items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-stone-300 text-sm text-stone-500 hover:border-stone-400 hover:text-stone-700"
            onClick={addColumn}
          >
            <PlusIcon className="size-4" aria-hidden="true" />
            เพิ่มคอลัมน์
          </button>
        </div>
        <DragOverlay>
          {activeCard ? (
            <div className="w-68"><CardFace card={activeCard} {...face} done={activeCardDone} dragging /></div>
          ) : active?.type === "column" ? (
            <div className="w-72 rounded-2xl bg-stone-200 px-3 py-3 text-sm font-semibold shadow-lg">{active.column.name}</div>
          ) : null}
        </DragOverlay>
      </DndContext>
      <p className="mx-auto max-w-6xl text-xs text-stone-400">
        ลากการ์ดเพื่อย้าย · ลากจุดสีหรือชื่อคอลัมน์เพื่อเรียงคอลัมน์ · มือถือ: แตะค้างแล้วลาก · คีย์บอร์ด: Space เพื่อหยิบ/วาง
      </p>

      {deleting && (
        <DeleteColumnDialog
          column={deleting}
          others={columns.filter((c) => c.id !== deleting.id)}
          cardCount={byCol[deleting.id]?.length || 0}
          onCancel={() => setDeleting(null)}
          onConfirm={(opts) => deleteColumn(deleting, opts)}
        />
      )}

      {openCardId && (
        <CardModal
          cardId={openCardId}
          labels={labels}
          onLabelsChange={setLabels}
          onChanged={onCardChanged}
          onClose={closeCard}
          onError={fail}
        />
      )}

      {toast && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-ink px-4 py-2 text-sm text-paper shadow-lg" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
