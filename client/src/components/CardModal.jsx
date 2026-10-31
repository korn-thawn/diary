import { useEffect, useRef, useState } from "react";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowPathIcon,
  Bars2Icon,
  CalendarIcon,
  CheckCircleIcon,
  FlagIcon,
  PaintBrushIcon,
  PhotoIcon,
  PlusIcon,
  TagIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/20/solid";
import { api } from "../api";
import { color, PRIORITIES, RECURRENCES } from "../palette";
import { useDndSensors } from "../pages/Boards";
import { ColorPicker } from "./Pickers";
import PhotoManager from "./Photos";

// Fields the board view needs to redraw a card face
const faceOf = (card, items) => ({
  id: card.id,
  title: card.title,
  description: card.description,
  due_date: card.due_date,
  due_time: card.due_time,
  priority: card.priority,
  color: card.color,
  label_ids: card.label_ids,
  recurrence: card.recurrence,
  completed_at: card.completed_at,
  items_total: items.length,
  items_done: items.filter((i) => i.done).length,
  photo_count: card.photos?.length ?? 0,
});

function Section({ icon: Icon, title, children, aside }) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <Icon className="size-4 text-stone-500" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-stone-700">{title}</h3>
        {aside && <div className="ml-auto">{aside}</div>}
      </div>
      {children}
    </section>
  );
}

function ItemRow({ item, onToggle, onEdit, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const [text, setText] = useState(item.text);
  useEffect(() => setText(item.text), [item.text]);
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`group flex items-center gap-2 rounded-lg px-1 py-0.5 hover:bg-stone-50 ${isDragging ? "z-10 bg-surface shadow" : ""}`}
    >
      <button className="cursor-grab touch-none p-1 text-stone-300 hover:text-stone-500" {...attributes} {...listeners} aria-label="ลากเพื่อเรียง">
        <Bars2Icon className="size-4" />
      </button>
      <input type="checkbox" className="size-4 accent-emerald-600" checked={item.done} onChange={(e) => onToggle(e.target.checked)} aria-label={item.text} />
      <input
        className={`min-w-0 flex-1 rounded border-0 bg-transparent px-1 py-0.5 text-sm outline-none focus:bg-surface focus:ring-1 focus:ring-stone-300 ${item.done ? "text-stone-400 line-through" : ""}`}
        value={text}
        maxLength={300}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => (text.trim() && text !== item.text ? onEdit(text) : setText(item.text))}
        onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
      />
      <button className="p-1 text-stone-300 opacity-0 group-hover:opacity-100 hover:text-red-600 focus:opacity-100" onClick={onDelete} aria-label={`ลบ ${item.text}`}>
        <XMarkIcon className="size-4" />
      </button>
    </li>
  );
}

function LabelPicker({ labels, selected, onToggle, onCreate }) {
  const [name, setName] = useState("");
  const [labelColor, setLabelColor] = useState("sky");
  const [adding, setAdding] = useState(false);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {labels.map((l) => {
          const on = selected.includes(l.id);
          return (
            <button
              key={l.id}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(l.id)}
              className={`rounded-md px-2 py-1 text-xs font-medium transition ${color(l.color).soft} ${
                on ? "ring-2 ring-stone-700" : "opacity-50 hover:opacity-90"
              }`}
            >
              {l.name}
            </button>
          );
        })}
        {!adding && (
          <button type="button" className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-stone-500 border border-dashed border-stone-300 hover:bg-stone-100" onClick={() => setAdding(true)}>
            <PlusIcon className="size-3.5" aria-hidden="true" /> ป้ายใหม่
          </button>
        )}
      </div>
      {adding && (
        <form
          className="space-y-2 rounded-lg bg-stone-50 p-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await onCreate(name, labelColor)) {
              setName("");
              setAdding(false);
            }
          }}
        >
          <input className="input py-1 text-sm" placeholder="ชื่อป้าย" value={name} maxLength={30} onChange={(e) => setName(e.target.value)} autoFocus required />
          <ColorPicker value={labelColor} onChange={setLabelColor} />
          <div className="flex gap-2">
            <button className="btn btn-primary py-1 text-sm">สร้างและติดป้าย</button>
            <button type="button" className="btn btn-ghost py-1 text-sm" onClick={() => setAdding(false)}>ยกเลิก</button>
          </div>
        </form>
      )}
    </div>
  );
}

export default function CardModal({ cardId, labels, onLabelsChange, onChanged, onClose, onError }) {
  const [card, setCard] = useState(null);
  const [items, setItems] = useState([]);
  const [desc, setDesc] = useState("");
  const [status, setStatus] = useState(""); // "", "saving", "saved"
  const [newItem, setNewItem] = useState("");
  const descTimer = useRef(null);
  const sensors = useDndSensors();

  useEffect(() => {
    let cancelled = false;
    api(`/boards/cards/${cardId}`)
      .then(({ card: c }) => {
        if (cancelled) return;
        setCard(c);
        setItems(c.items);
        setDesc(c.description);
      })
      .catch((err) => {
        onError(err.status === 404 ? { message: "ไม่พบการ์ดนี้" } : err);
        onClose();
      });
    return () => { cancelled = true; };
  }, [cardId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  async function patch(fields) {
    setStatus("saving");
    try {
      const { card: c } = await api(`/boards/cards/${cardId}`, { method: "PATCH", body: fields });
      setCard(c);
      onChanged(faceOf(c, c.items));
      setStatus("saved");
    } catch (err) {
      setStatus("");
      onError(err);
    }
  }

  function onDescChange(v) {
    setDesc(v);
    clearTimeout(descTimer.current);
    descTimer.current = setTimeout(() => patch({ description: v }), 500);
  }
  function flushDesc() {
    if (descTimer.current) {
      clearTimeout(descTimer.current);
      descTimer.current = null;
      if (card && desc !== card.description) patch({ description: desc });
    }
  }
  function close() {
    flushDesc();
    onClose();
  }

  function itemsChanged(next) {
    setItems(next);
    onChanged({ ...faceOf(card, next) });
  }
  async function addItem(e) {
    e.preventDefault();
    if (!newItem.trim()) return;
    try {
      const { item } = await api(`/boards/cards/${cardId}/items`, { method: "POST", body: { text: newItem } });
      itemsChanged([...items, item]);
      setNewItem("");
    } catch (err) { onError(err); }
  }
  async function updateItem(item, fields) {
    const prev = items;
    itemsChanged(items.map((i) => (i.id === item.id ? { ...i, ...fields } : i)));
    try {
      await api(`/boards/items/${item.id}`, { method: "PATCH", body: fields });
    } catch (err) {
      itemsChanged(prev);
      onError(err);
    }
  }
  async function deleteItem(item) {
    const prev = items;
    itemsChanged(items.filter((i) => i.id !== item.id));
    try {
      await api(`/boards/items/${item.id}`, { method: "DELETE" });
    } catch (err) {
      itemsChanged(prev);
      onError(err);
    }
  }
  async function reorderItems({ active, over }) {
    if (!over || active.id === over.id) return;
    const prev = items;
    const next = arrayMove(items, items.findIndex((i) => i.id === active.id), items.findIndex((i) => i.id === over.id));
    setItems(next);
    try {
      await api(`/boards/cards/${cardId}/items/order`, { method: "PUT", body: { ids: next.map((i) => i.id) } });
    } catch (err) {
      setItems(prev);
      onError(err);
    }
  }

  async function createLabel(name, labelColor) {
    try {
      const { label } = await api("/boards/labels", { method: "POST", body: { name, color: labelColor } });
      onLabelsChange([...labels, label].sort((a, b) => a.name.localeCompare(b.name, "th")));
      await patch({ labelIds: [...card.label_ids, label.id] });
      return true;
    } catch (err) {
      onError(err.status === 409 ? { message: "มีป้ายชื่อนี้แล้ว" } : err);
      return false;
    }
  }
  function toggleLabel(id) {
    const ids = card.label_ids.includes(id) ? card.label_ids.filter((x) => x !== id) : [...card.label_ids, id];
    setCard((c) => ({ ...c, label_ids: ids }));
    patch({ labelIds: ids });
  }

  async function deleteCard() {
    if (!confirm(`ลบการ์ด "${card.title}"?`)) return;
    try {
      await api(`/boards/cards/${cardId}`, { method: "DELETE" });
      onChanged({ id: card.id }, { deleted: true });
      onClose();
    } catch (err) { onError(err); }
  }

  const doneCount = items.filter((i) => i.done).length;

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:py-12"
      onPointerDown={(e) => e.target === e.currentTarget && close()}
    >
      <div className="w-full max-w-xl rounded-2xl bg-surface shadow-xl" role="dialog" aria-modal="true" aria-label="รายละเอียดการ์ด">
        {!card ? (
          <p className="p-8 text-center text-stone-500">กำลังโหลด…</p>
        ) : (
          <div className="space-y-5 p-5">
            <div className="flex items-start gap-2">
              {card.color && <span className={`mt-2 h-6 w-1.5 shrink-0 rounded ${color(card.color).bar}`} aria-hidden="true" />}
              <textarea
                className="min-h-0 flex-1 resize-none rounded-lg border-0 px-1 py-1 font-serif text-xl font-semibold outline-none focus:ring-2 focus:ring-accent/30"
                rows={Math.min(4, Math.ceil(card.title.length / 40) || 1)}
                defaultValue={card.title}
                key={card.updated_at}
                maxLength={200}
                aria-label="ชื่อการ์ด"
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), e.target.blur())}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== card.title) patch({ title: v });
                  else e.target.value = card.title;
                }}
              />
              <span className="mt-2 w-16 shrink-0 text-right text-xs text-stone-400" role="status">
                {status === "saving" ? "กำลังบันทึก" : status === "saved" ? "บันทึกแล้ว" : ""}
              </span>
              <button className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-100" onClick={close} aria-label="ปิด">
                <XMarkIcon className="size-5" />
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Section icon={CalendarIcon} title="กำหนดส่ง">
                <div className="flex gap-2">
                  <input type="date" className="input py-1.5 text-sm" value={card.due_date || ""} onChange={(e) => patch({ due_date: e.target.value || null })} aria-label="วันที่กำหนด" />
                  <input
                    type="time"
                    className="input w-28 py-1.5 text-sm"
                    value={card.due_time || ""}
                    disabled={!card.due_date}
                    onChange={(e) => patch({ due_time: e.target.value || null })}
                    aria-label="เวลา (ไม่บังคับ)"
                  />
                </div>
              </Section>
              <Section icon={FlagIcon} title="ความสำคัญ">
                <div className="flex gap-1" role="radiogroup" aria-label="ความสำคัญ">
                  {PRIORITIES.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      role="radio"
                      aria-checked={card.priority === p.value}
                      onClick={() => patch({ priority: p.value })}
                      className={`flex-1 rounded-lg px-2 py-1.5 text-xs transition ${
                        card.priority === p.value ? "bg-ink text-paper" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </Section>
            </div>

            <Section icon={ArrowPathIcon} title="ทำซ้ำ">
              <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="ทำซ้ำ">
                {RECURRENCES.map((r) => (
                  <button
                    key={r.label}
                    type="button"
                    role="radio"
                    aria-checked={card.recurrence === r.value}
                    disabled={!card.due_date && r.value !== null}
                    onClick={() => patch({ recurrence: r.value })}
                    className={`rounded-lg px-2.5 py-1.5 text-xs transition disabled:cursor-not-allowed disabled:opacity-40 ${
                      card.recurrence === r.value ? "bg-ink text-paper" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-stone-500">
                {!card.due_date
                  ? "ตั้งกำหนดส่งก่อนถึงจะเลือกทำซ้ำได้"
                  : card.recurrence
                    ? "เมื่อย้ายการ์ดนี้ไปคอลัมน์ที่เสร็จแล้ว จะสร้างการ์ดรอบถัดไปให้อัตโนมัติ (คัดลอกป้ายและเช็กลิสต์ไปด้วย)"
                    : "เลือกความถี่ แล้วระบบจะสร้างการ์ดรอบถัดไปเมื่องานนี้เสร็จ"}
              </p>
            </Section>

            <Section icon={TagIcon} title="ป้าย">
              <LabelPicker labels={labels} selected={card.label_ids} onToggle={toggleLabel} onCreate={createLabel} />
            </Section>

            <Section icon={PaintBrushIcon} title="สีการ์ด">
              <ColorPicker value={card.color} onChange={(c) => patch({ color: c })} allowNone />
            </Section>

            <Section icon={PhotoIcon} title="รูป">
              <PhotoManager
                target={{ cardId: card.id }}
                photos={card.photos || []}
                onPhotosChange={(next) => {
                  setCard((c) => ({ ...c, photos: next }));
                  onChanged({ id: card.id, photo_count: next.length });
                }}
                onError={onError}
              />
            </Section>

            <section>
              <h3 className="mb-2 text-sm font-semibold text-stone-700">รายละเอียด</h3>
              <textarea
                className="input min-h-28 resize-y text-sm leading-relaxed"
                placeholder="โน้ต ลิงก์ รายละเอียดเพิ่มเติม…"
                value={desc}
                onChange={(e) => onDescChange(e.target.value)}
                onBlur={flushDesc}
              />
            </section>

            <Section
              icon={CheckCircleIcon}
              title="เช็กลิสต์"
              aside={items.length > 0 && <span className="text-xs text-stone-500 tabular-nums">{doneCount}/{items.length}</span>}
            >
              {items.length > 0 && (
                <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-stone-100" aria-hidden="true">
                  <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(doneCount / items.length) * 100}%` }} />
                </div>
              )}
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={reorderItems}>
                <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                  <ul className="space-y-0.5">
                    {items.map((item) => (
                      <ItemRow
                        key={item.id}
                        item={item}
                        onToggle={(done) => updateItem(item, { done })}
                        onEdit={(text) => updateItem(item, { text })}
                        onDelete={() => deleteItem(item)}
                      />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
              <form onSubmit={addItem} className="mt-2 flex gap-2">
                <input className="input py-1.5 text-sm" placeholder="เพิ่มรายการ แล้วกด Enter" value={newItem} maxLength={300} onChange={(e) => setNewItem(e.target.value)} />
                <button className="btn btn-ghost px-3 py-1.5 ring-1 ring-stone-300" aria-label="เพิ่มรายการ">
                  <PlusIcon className="size-4" />
                </button>
              </form>
            </Section>

            <div className="flex items-center justify-between border-t border-stone-100 pt-4 text-xs text-stone-400">
              <span>สร้างเมื่อ {new Date(card.created_at).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })}</span>
              <button className="btn px-2 py-1 text-sm text-red-600 hover:bg-red-50" onClick={deleteCard}>
                <TrashIcon className="size-4" aria-hidden="true" /> ลบการ์ด
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
