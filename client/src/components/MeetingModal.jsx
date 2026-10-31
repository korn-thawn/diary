import { useEffect, useState } from "react";
import { TrashIcon } from "@heroicons/react/20/solid";
import { UsersIcon } from "@heroicons/react/24/outline";
import Dialog from "./ui/Dialog";
import { api, today } from "../api";
import { isoWeekday, MEETING_REPEATS, REMIND_OPTIONS, WEEKDAYS } from "../palette";
import { ColorPicker } from "./Pickers";
import LabelPicker from "./LabelPicker";

const plusHour = (t) => {
  const [h, m] = t.split(":").map(Number);
  return `${String(Math.min(h + 1, 23)).padStart(2, "0")}:${h >= 23 ? "59" : String(m).padStart(2, "0")}`;
};

export const meetingsChanged = () => window.dispatchEvent(new Event("diary:meetings-changed"));

// Create (meeting = null) or edit a meeting series.
export default function MeetingModal({ meeting, defaultDate, onSaved, onDeleted, onClose, onError }) {
  const [form, setForm] = useState(() => ({
    title: meeting?.title ?? "",
    date: meeting?.date ?? defaultDate ?? today(),
    start_time: meeting?.start_time ?? "10:00",
    end_time: meeting?.end_time ?? "11:00",
    repeat: meeting?.repeat ?? "none",
    weekdays: meeting?.weekdays ?? [],
    repeat_until: meeting?.repeat_until ?? "",
    location: meeting?.location ?? "",
    url: meeting?.url ?? "",
    color: meeting?.color ?? "indigo",
    agenda: meeting?.agenda ?? "",
    remind_minutes: meeting?.remind_minutes ?? null,
    labelIds: meeting?.label_ids ?? [],
  }));
  const [labels, setLabels] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v?.target ? v.target.value : v }));

  useEffect(() => {
    api("/boards/labels").then((d) => setLabels(d.labels)).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const weekly = form.repeat === "weekly" || form.repeat === "biweekly";
  const days = form.weekdays.length ? form.weekdays : [isoWeekday(form.date)];
  const toggleDay = (d) => {
    const next = days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort();
    set("weekdays")(next.length ? next : days);
  };

  async function createLabel(name, labelColor) {
    try {
      const { label } = await api("/boards/labels", { method: "POST", body: { name, color: labelColor } });
      setLabels((ls) => [...ls, label].sort((a, b) => a.name.localeCompare(b.name, "th")));
      set("labelIds")([...form.labelIds, label.id]);
      return true;
    } catch (err) {
      setError(err.status === 409 ? "มีป้ายชื่อนี้แล้ว" : err.message);
      return false;
    }
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const body = {
      ...form,
      weekdays: weekly ? days : [],
      repeat_until: form.repeat !== "none" && form.repeat_until ? form.repeat_until : null,
      url: form.url.trim(),
      today: today(),
    };
    try {
      const { meeting: saved } = meeting
        ? await api(`/meetings/${meeting.id}`, { method: "PATCH", body })
        : await api("/meetings", { method: "POST", body });
      meetingsChanged();
      onSaved(saved);
    } catch (err) {
      if (err.status === 401) return onError(err);
      setError(err.message);
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`ลบการประชุม "${meeting.title}" ทุกครั้ง? บันทึกการประชุมและ action items จะหายไปด้วย (การ์ดที่สร้างไว้แล้วยังอยู่)`)) return;
    try {
      await api(`/meetings/${meeting.id}`, { method: "DELETE" });
      meetingsChanged();
      onDeleted(meeting);
    } catch (err) {
      onError(err);
    }
  }

  const chip = (on) => `rounded-lg px-2.5 py-1.5 text-xs transition ${on ? "border-[1.5px] border-ink bg-title text-on-title" : "border-[1.5px] border-ink/35 bg-surface text-ink hover:border-ink"}`;

  return (
    <Dialog title={meeting ? "แก้การประชุม (ทุกครั้ง)" : "เพิ่มการประชุม"} icon={UsersIcon} onClose={onClose}>
      <form onSubmit={save} className="space-y-4">

        <input className="input" placeholder="หัวข้อ เช่น Standup, คุยลูกค้า" value={form.title} onChange={set("title")} maxLength={150} required autoFocus={!meeting} />

        <div className="grid grid-cols-[1fr_auto_auto] items-end gap-2">
          <label className="block text-sm">
            <span className="mb-1 block text-stone-600">{form.repeat === "none" ? "วันที่" : "เริ่มวันที่"}</span>
            <input type="date" className="input" value={form.date} onChange={set("date")} required />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-stone-600">เริ่ม</span>
            <input
              type="time"
              className="input w-28"
              value={form.start_time}
              onChange={(e) => {
                const v = e.target.value;
                setForm((f) => ({ ...f, start_time: v, end_time: f.end_time <= v ? plusHour(v) : f.end_time }));
              }}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-stone-600">จบ</span>
            <input type="time" className="input w-28" value={form.end_time} onChange={set("end_time")} min={form.start_time} required />
          </label>
        </div>

        <div className="space-y-2">
          <p className="text-sm text-stone-600">ทำซ้ำ</p>
          <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="ทำซ้ำ">
            {MEETING_REPEATS.map((r) => (
              <button key={r.value} type="button" role="radio" aria-checked={form.repeat === r.value} className={chip(form.repeat === r.value)} onClick={() => set("repeat")(r.value)}>
                {r.label}
              </button>
            ))}
          </div>
          {weekly && (
            <div className="flex gap-1" role="group" aria-label="วันในสัปดาห์">
              {WEEKDAYS.map((d) => (
                <button key={d.value} type="button" aria-pressed={days.includes(d.value)} title={d.label} className={`size-9 rounded-full text-xs transition ${days.includes(d.value) ? "border-[1.5px] border-ink bg-title text-on-title" : "border-[1.5px] border-ink/35 bg-surface text-ink hover:border-ink"}`} onClick={() => toggleDay(d.value)}>
                  {d.short}
                </button>
              ))}
            </div>
          )}
          {form.repeat !== "none" && (
            <label className="flex items-center gap-2 text-sm text-stone-600">
              สิ้นสุด
              <input type="date" className="input w-auto py-1 text-sm" value={form.repeat_until} min={form.date} onChange={set("repeat_until")} />
              {form.repeat_until && <button type="button" className="text-xs text-stone-500 underline" onClick={() => set("repeat_until")("")}>ไม่มีวันสิ้นสุด</button>}
            </label>
          )}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <input className="input text-sm" placeholder="สถานที่ (ไม่บังคับ)" value={form.location} onChange={set("location")} maxLength={200} />
          <input className="input text-sm" type="url" placeholder="ลิงก์ Meet / Zoom / Teams" value={form.url} onChange={set("url")} maxLength={500} />
        </div>

        <div>
          <p className="mb-1.5 text-sm text-stone-600">ป้าย</p>
          <LabelPicker
            labels={labels}
            selected={form.labelIds}
            onToggle={(id) => set("labelIds")(form.labelIds.includes(id) ? form.labelIds.filter((x) => x !== id) : [...form.labelIds, id])}
            onCreate={createLabel}
          />
        </div>

        <div>
          <p className="mb-1.5 text-sm text-stone-600">สี</p>
          <ColorPicker value={form.color} onChange={set("color")} />
        </div>

        <label className="flex flex-wrap items-center gap-2 text-sm text-stone-600">
          เตือนทาง Telegram ก่อน
          <select className="input w-auto py-1 text-sm" value={form.remind_minutes ?? ""} onChange={(e) => set("remind_minutes")(e.target.value === "" ? null : Number(e.target.value))}>
            {REMIND_OPTIONS.map((o) => <option key={o.label} value={o.value ?? ""}>{o.label}</option>)}
          </select>
        </label>

        <textarea className="input min-h-20 text-sm" placeholder="วาระการประชุม (ไม่บังคับ)" value={form.agenda} onChange={set("agenda")} maxLength={10000} />

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex items-center justify-between gap-2">
          <div>
            {meeting && (
              <button type="button" className="btn btn-danger px-2 text-sm" onClick={remove}>
                <TrashIcon className="size-4" aria-hidden="true" /> ลบทุกครั้ง
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
