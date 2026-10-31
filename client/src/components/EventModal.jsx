import { useEffect, useState } from "react";
import { TrashIcon, XMarkIcon } from "@heroicons/react/20/solid";
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

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

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
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:py-12" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <form onSubmit={save} className="w-full max-w-md space-y-4 rounded-2xl bg-surface p-5 shadow-xl" role="dialog" aria-modal="true" aria-label={event ? "แก้วันสำคัญ" : "เพิ่มวันสำคัญ"}>
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-lg font-semibold">{event ? "แก้วันสำคัญ" : "เพิ่มวันสำคัญ"}</h2>
          <button type="button" className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-100" onClick={onClose} aria-label="ปิด">
            <XMarkIcon className="size-5" />
          </button>
        </div>
        <input className="input" placeholder="เช่น วันเกิดแม่, ครบรอบแต่งงาน, จ่ายค่าเช่า" value={form.title} onChange={set("title")} maxLength={100} required autoFocus />
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <label className="block text-sm">
            <span className="mb-1 block text-stone-600">วันที่ {form.repeat === "yearly" && <span className="text-xs text-stone-400">(ใส่ปีจริงเพื่อนับว่าครบกี่ปี)</span>}</span>
            <input type="date" className="input" value={form.date} onChange={set("date")} required />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-stone-600">เวลา</span>
            <input type="time" className="input w-28" value={form.time} onChange={set("time")} aria-label="เวลา (ไม่บังคับ)" />
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
                className={`flex-1 rounded-lg px-2 py-1.5 text-sm transition ${form.repeat === r.value ? "bg-ink text-paper" : "bg-stone-100 text-stone-600 hover:bg-stone-200"}`}
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
              <button type="button" className="btn px-2 text-sm text-red-600 hover:bg-red-50" onClick={remove}>
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
    </div>
  );
}
