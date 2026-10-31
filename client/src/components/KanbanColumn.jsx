import { useState } from "react";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  CheckBadgeIcon,
  EllipsisHorizontalIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/20/solid";
import { color } from "../palette";
import { ColorPicker } from "./Pickers";
import Popover, { MenuItem } from "./Popover";
import KanbanCard from "./KanbanCard";

function AddCard({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    const ok = await onAdd(title.trim());
    setBusy(false);
    if (ok) setTitle(""); // keep the box open for quick entry
  }

  if (!open) {
    return (
      <button className="flex w-full items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-stone-500 hover:bg-stone-200/60" onClick={() => setOpen(true)}>
        <PlusIcon className="size-4" aria-hidden="true" />
        เพิ่มการ์ด
      </button>
    );
  }
  return (
    <form onSubmit={submit} className="space-y-2">
      <textarea
        className="input min-h-16 resize-none text-sm"
        placeholder="ชื่องาน แล้วกด Enter"
        value={title}
        maxLength={200}
        autoFocus
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) submit(e);
          if (e.key === "Escape") setOpen(false);
        }}
      />
      <div className="flex gap-2">
        <button className="btn btn-primary py-1 text-sm" disabled={busy}>เพิ่ม</button>
        <button type="button" className="btn btn-ghost py-1 text-sm" onClick={() => setOpen(false)}>ปิด</button>
      </div>
    </form>
  );
}

function ColumnMenu({ column, onRename, onUpdate, onDelete }) {
  return (
    <Popover
      button={({ toggle }) => (
        <button className="rounded-md p-1 text-stone-500 hover:bg-stone-200" onClick={toggle} aria-label={`เมนูคอลัมน์ ${column.name}`}>
          <EllipsisHorizontalIcon className="size-5" />
        </button>
      )}
    >
      {({ close }) => (
        <div className="w-60 space-y-2">
          <MenuItem icon={PencilIcon} onClick={() => { close(); onRename(); }}>เปลี่ยนชื่อ</MenuItem>
          <MenuItem icon={CheckBadgeIcon} onClick={() => { close(); onUpdate({ is_done: !column.is_done }); }}>
            {column.is_done ? "เลิกเป็นคอลัมน์ \"เสร็จแล้ว\"" : "ตั้งเป็นคอลัมน์ \"เสร็จแล้ว\""}
          </MenuItem>
          <div className="px-2.5">
            <p className="mb-1.5 text-xs text-stone-500">สีคอลัมน์</p>
            <ColorPicker value={column.color} onChange={(c) => onUpdate({ color: c })} />
          </div>
          <div className="border-t border-stone-100 pt-1">
            <MenuItem icon={TrashIcon} danger onClick={() => { close(); onDelete(); }}>ลบคอลัมน์</MenuItem>
          </div>
        </div>
      )}
    </Popover>
  );
}

export default function KanbanColumn({ column, cards, dragDisabled, onAddCard, onOpenCard, onUpdate, onDelete, face }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `col-${column.id}`,
    data: { type: "column", column },
    disabled: dragDisabled,
  });
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(column.name);

  async function saveName(e) {
    e?.preventDefault();
    setRenaming(false);
    if (name.trim() && name.trim() !== column.name) await onUpdate({ name: name.trim() });
    else setName(column.name);
  }

  return (
    <section
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`flex max-h-[calc(100dvh-14rem)] w-72 shrink-0 snap-start flex-col rounded-2xl bg-stone-200/50 ${isDragging ? "opacity-40" : ""}`}
      aria-label={`คอลัมน์ ${column.name}`}
    >
      <header className="flex items-center gap-2 px-3 pt-3 pb-2">
        <span
          className={`size-2.5 shrink-0 cursor-grab rounded-full ${color(column.color).dot} touch-none`}
          {...attributes}
          {...listeners}
          aria-label={`ลากเพื่อย้ายคอลัมน์ ${column.name}`}
          title="ลากเพื่อย้ายคอลัมน์"
        />
        {renaming ? (
          <form onSubmit={saveName} className="min-w-0 flex-1">
            <input
              className="input py-1 text-sm"
              value={name}
              maxLength={40}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => e.key === "Escape" && (setName(column.name), setRenaming(false))}
            />
          </form>
        ) : (
          <h2
            className="min-w-0 flex-1 cursor-grab truncate text-sm font-semibold touch-none"
            {...attributes}
            {...listeners}
            onDoubleClick={() => setRenaming(true)}
          >
            {column.name}
          </h2>
        )}
        {column.is_done && <CheckBadgeIcon className="size-4 shrink-0 text-emerald-600" aria-label="คอลัมน์เสร็จแล้ว" />}
        <span className="text-xs text-stone-500 tabular-nums">{cards.length}</span>
        <ColumnMenu column={column} onRename={() => setRenaming(true)} onUpdate={onUpdate} onDelete={onDelete} />
      </header>
      <SortableContext items={cards.map((c) => `card-${c.id}`)} strategy={verticalListSortingStrategy}>
        <ul className="flex min-h-12 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
          {cards.map((card) => (
            <KanbanCard key={card.id} card={card} onOpen={onOpenCard} disabled={dragDisabled} done={column.is_done} {...face} />
          ))}
        </ul>
      </SortableContext>
      <div className="px-2 pb-2">
        <AddCard onAdd={onAddCard} />
      </div>
    </section>
  );
}
