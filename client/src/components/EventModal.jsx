import { useState } from "react";
import { TrashIcon } from "@heroicons/react/20/solid";
import { StarIcon } from "@heroicons/react/24/outline";
import Dialog from "./ui/Dialog";
import { api, today } from "../api";
import { ColorPicker, IconPicker } from "./Pickers";

const REPEATS = [
  { value: "none", label: "ครั้งเดียว" },
  { value: "monthly", label: "ทุกเดือน" },
  { value: "yearly", label: "ทุกปี" },
];

// Create (event = null, defaultDate) or edit an important date.
export default function EventModal({ event, defaultDate, onSaved, onDeleted, onClose, onError }) {
  const [form, setForm] = useState(() => ({
    title: event?.title ?? "",
    date: event?.date ?? defaultDate ?? today(),
    repeat: event?.repeat ?? "yearly",
    time: event?.time ?? "",
    color: event?.color ?? "rose",
    icon: event?.icon ?? "cake",
    note: event?.note ?? "",
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v?.target ? v.target.value : v }));


  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const body = { ...form, time: form.time || null, today: today() };
    try {
      const { event: saved } = event
        ? await api(`/events/${event.id}`, { method: "PATCH", body })
        : await api("/events", { method: "POST", body });
      onSaved(saved);
    } catch (err) {
      if (err.status === 401) return onError(err);
      setError(err.message);
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`ลบ "${event.title}"?`)) return;
    try {
      await api(`/events/${event.id}`, { method: "DELETE" });
      onDeleted(event);
    } catch (err) {
      onError(err);
    }
  }

  return (
    <Dialog title={event ? "แก้วันสำคัญ" : "เพิ่มวันสำคัญ"} icon={StarIcon} onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <input className="input" placeholder="เช่น วันเกิดแม่, ครบรอบแต่งงาน, จ่ายค่าเช่า" value={form.title} onChange={set("title")} maxLength={100} required autoFocus />
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,7rem)] items-end gap-2">
          <label className="block min-w-0 text-sm">
            <span className="mb-1 block text-stone-600">วันที่ {form.repeat === "yearly" && <span className="text-xs text-stone-400">(ใส่ปีจริงเพื่อนับว่าครบกี่ปี)</span>}</span>
            <input type="date" className="input" value={form.date} onChange={set("date")} required />
          </label>
          <label className="block min-w-0 text-sm">
            <span className="mb-1 block text-stone-600">เวลา</span>
            <input type="time" className="input" value={form.time} onChange={set("time")} aria-label="เวลา (ไม่บังคับ)" />
          </label>
        </div>
        <div>
          <p className="mb-1.5 text-sm text-stone-600">ซ้ำ</p>
          <div className="flex gap-1" role="radiogroup" aria-label="ซ้ำ">
            {REPEATS.map((r) => (
              <button
                key={r.value}
                type="button"
                role="radio"
                aria-checked={form.repeat === r.value}
                onClick={() => set("repeat")(r.value)}
                className={`flex-1 rounded-lg px-2 py-1.5 text-sm transition ${form.repeat === r.value ? "border-[1.5px] border-ink bg-title text-on-title" : "border-[1.5px] border-ink/35 bg-surface text-ink hover:border-ink"}`}
              >
                {r.label}
              </button>
            ))}
          </div>
          {form.repeat === "monthly" && Number(form.date.slice(8)) > 28 && (
            <p className="mt-1 text-xs text-stone-500">เดือนที่ไม่มีวันที่ {Number(form.date.slice(8))} จะใช้วันสุดท้ายของเดือนแทน</p>
          )}
        </div>
        <div>
          <p className="mb-1.5 text-sm text-stone-600">สี</p>
          <ColorPicker value={form.color} onChange={set("color")} />
        </div>
        <div>
          <p className="mb-1.5 text-sm text-stone-600">ไอคอน</p>
          <IconPicker value={form.icon} onChange={set("icon")} />
        </div>
        <textarea className="input min-h-20 text-sm" placeholder="โน้ต (ไม่บังคับ)" value={form.note} onChange={set("note")} maxLength={2000} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex items-center justify-between gap-2">
          <div>
            {event && (
              <button type="button" className="btn btn-danger px-2 text-sm" onClick={remove}>
                <TrashIcon className="size-4" aria-hidden="true" /> ลบ
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn btn-ghost" onClick={onClose}>ยกเลิก</button>
            <button className="btn btn-primary" disabled={busy}>บันทึก</button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
