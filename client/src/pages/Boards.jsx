import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArchiveBoxIcon, ExclamationCircleIcon, PlusIcon } from "@heroicons/react/20/solid";
import { api, today } from "../api";
import { useAuth } from "../auth";
import { boardIcon, color } from "../palette";
import { ColorPicker, IconPicker } from "../components/Pickers";

export function useDndSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    // Space picks up / drops; Enter is left free to open a card
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space"] },
    })
  );
}

// Swallow the click that some browsers fire right after a drop.
export function useJustDragged() {
  const t = useRef(0);
  const fn = () => Date.now() - t.current < 250;
  fn.mark = () => { t.current = Date.now(); };
  return fn;
}

function BoardTile({ board, justDragged }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: board.id });
  const Icon = boardIcon(board.icon);
  const c = color(board.color);
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? "z-10 opacity-60" : ""}
      {...attributes}
      {...listeners}
    >
      <Link
        to={`/boards/${board.id}`}
        onClick={(e) => justDragged() && e.preventDefault()}
        className="block h-full rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-stone-200 transition hover:ring-stone-400"
      >
        <div className="flex items-start gap-3">
          <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${c.soft}`}>
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate font-serif text-lg font-semibold">{board.name}</h2>
            <p className="text-sm text-stone-500">
              {board.open_count ? `ค้าง ${board.open_count} งาน` : "ไม่มีงานค้าง"}
            </p>
            {board.overdue_count > 0 && (
              <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-red-700">
                <ExclamationCircleIcon className="size-3.5" aria-hidden="true" />
                เลยกำหนด {board.overdue_count}
              </p>
            )}
          </div>
        </div>
      </Link>
    </li>
  );
}

function NewBoardForm({ onCreated, onCancel }) {
  const [name, setName] = useState("");
  const [boardColor, setBoardColor] = useState("sky");
  const [icon, setIcon] = useState("clipboard");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { board } = await api("/boards", { method: "POST", body: { name, color: boardColor, icon } });
      onCreated(board);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl bg-surface p-5 shadow-sm ring-1 ring-stone-200">
      <h2 className="font-serif text-lg font-semibold">บอร์ดใหม่</h2>
      <input className="input" placeholder="ชื่อบอร์ด เช่น งานบ้าน, ทริปญี่ปุ่น" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required autoFocus />
      <div>
        <p className="mb-1.5 text-sm text-stone-600">สี</p>
        <ColorPicker value={boardColor} onChange={setBoardColor} />
      </div>
      <div>
        <p className="mb-1.5 text-sm text-stone-600">ไอคอน</p>
        <IconPicker value={icon} onChange={setIcon} />
      </div>
      <p className="text-xs text-stone-500">เริ่มด้วยคอลัมน์ ต้องทำ / กำลังทำ / เสร็จแล้ว ปรับได้ทีหลัง</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>ยกเลิก</button>
        <button className="btn btn-primary" disabled={busy}>สร้างบอร์ด</button>
      </div>
    </form>
  );
}

export default function Boards() {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [boards, setBoards] = useState(null);
  const [creating, setCreating] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState("");
  const sensors = useDndSensors();
  const justDragged = useJustDragged();

  useEffect(() => {
    api(`/boards?today=${today()}`)
      .then((d) => setBoards(d.boards))
      .catch((err) => (err.status === 401 ? setUser(null) : setError(err.message)));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <p className="text-red-600">{error}</p>;
  if (!boards) return <p className="text-center text-stone-500">กำลังโหลด…</p>;

  const active = boards.filter((b) => !b.archived);
  const archived = boards.filter((b) => b.archived);

  async function onDragEnd({ active: a, over }) {
    if (!over || a.id === over.id) return;
    const prev = boards;
    const from = active.findIndex((b) => b.id === a.id);
    const to = active.findIndex((b) => b.id === over.id);
    const next = [...arrayMove(active, from, to), ...archived];
    setBoards(next);
    try {
      await api("/boards/order", { method: "PUT", body: { ids: next.map((b) => b.id) } });
    } catch (err) {
      setBoards(prev);
      setError(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-serif text-2xl font-semibold">บอร์ดงาน</h1>
        {!creating && (
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            <PlusIcon className="size-4" aria-hidden="true" />
            บอร์ดใหม่
          </button>
        )}
      </div>

      {creating && (
        <NewBoardForm onCancel={() => setCreating(false)} onCreated={(b) => navigate(`/boards/${b.id}`)} />
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => { justDragged.mark(); onDragEnd(e); }}>
        <SortableContext items={active.map((b) => b.id)} strategy={rectSortingStrategy}>
          <ul className="grid gap-3 sm:grid-cols-2">
            {active.map((b) => (
              <BoardTile key={b.id} board={b} justDragged={justDragged} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      {active.length > 1 && <p className="text-xs text-stone-400">ลากเพื่อเรียงบอร์ด (มือถือ: แตะค้างแล้วลาก)</p>}

      {archived.length > 0 && (
        <div>
          <button className="btn btn-ghost px-2 text-sm" onClick={() => setShowArchived((s) => !s)}>
            <ArchiveBoxIcon className="size-4" aria-hidden="true" />
            {showArchived ? "ซ่อน" : "ดู"}บอร์ดที่เก็บถาวร ({archived.length})
          </button>
          {showArchived && (
            <ul className="mt-2 grid gap-3 opacity-70 sm:grid-cols-2">
              {archived.map((b) => {
                const Icon = boardIcon(b.icon);
                return (
                  <li key={b.id}>
                    <Link to={`/boards/${b.id}`} className="flex items-center gap-3 rounded-xl bg-surface p-3 ring-1 ring-stone-200 hover:ring-stone-400">
                      <span className={`flex size-8 items-center justify-center rounded-lg ${color(b.color).soft}`}>
                        <Icon className="size-4" aria-hidden="true" />
                      </span>
                      <span className="truncate">{b.name}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
