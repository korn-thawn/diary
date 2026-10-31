import { useEffect, useState } from "react";
import { PlusIcon, TrashIcon } from "@heroicons/react/20/solid";
import { api } from "../api";
import { color } from "../palette";
import { ColorPicker } from "./Pickers";
import Popover from "./Popover";

// Settings card: rename / recolor / delete / add labels shared by all boards.
export default function LabelManager({ onAuthError }) {
  const [labels, setLabels] = useState(null);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");

  const fail = (err) => {
    if (err.status === 401) return onAuthError();
    setMsg(err.status === 409 ? "มีป้ายชื่อนี้แล้ว" : err.message);
  };

  useEffect(() => {
    api("/boards/labels").then((d) => setLabels(d.labels)).catch(fail);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function update(l, fields) {
    setMsg("");
    try {
      const { label } = await api(`/boards/labels/${l.id}`, { method: "PATCH", body: fields });
      setLabels((ls) => ls.map((x) => (x.id === l.id ? label : x)));
    } catch (err) { fail(err); }
  }
  async function remove(l) {
    if (!confirm(`ลบป้าย "${l.name}"? การ์ดที่ติดป้ายนี้จะถูกถอดป้ายออก`)) return;
    try {
      await api(`/boards/labels/${l.id}`, { method: "DELETE" });
      setLabels((ls) => ls.filter((x) => x.id !== l.id));
    } catch (err) { fail(err); }
  }
  async function add(e) {
    e.preventDefault();
    setMsg("");
    try {
      const { label } = await api("/boards/labels", { method: "POST", body: { name, color: "sky" } });
      setLabels((ls) => [...ls, label]);
      setName("");
    } catch (err) { fail(err); }
  }

  if (!labels) return <p className="text-sm text-stone-500">กำลังโหลด…</p>;
  return (
    <div className="space-y-3">
      <p className="text-sm text-stone-600">ป้ายใช้ร่วมกันทุกบอร์ด แก้ชื่อได้โดยคลิกที่ชื่อ</p>
      {labels.length === 0 && <p className="text-sm text-stone-400">ยังไม่มีป้าย</p>}
      <ul className="space-y-1.5">
        {labels.map((l) => (
          <li key={l.id} className="flex items-center gap-2">
            <Popover
              align="left"
              button={({ toggle }) => (
                <button className={`size-6 shrink-0 rounded-full ${color(l.color).dot}`} onClick={toggle} aria-label={`เปลี่ยนสีป้าย ${l.name}`} />
              )}
            >
              {({ close }) => <div className="w-64"><ColorPicker value={l.color} onChange={(c) => { close(); update(l, { color: c }); }} /></div>}
            </Popover>
            <input
              className="input py-1 text-sm"
              defaultValue={l.name}
              key={l.name}
              maxLength={30}
              aria-label="ชื่อป้าย"
              onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== l.name) update(l, { name: v }); else e.target.value = l.name; }}
              onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
            />
            <button className="rounded-lg p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600" onClick={() => remove(l)} aria-label={`ลบป้าย ${l.name}`}>
              <TrashIcon className="size-4" />
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="flex gap-2">
        <input className="input py-1.5 text-sm" placeholder="ป้ายใหม่" value={name} maxLength={30} onChange={(e) => setName(e.target.value)} required />
        <button className="btn btn-ghost px-3 ring-1 ring-stone-300" aria-label="เพิ่มป้าย"><PlusIcon className="size-4" /></button>
      </form>
      {msg && <p className="text-sm text-red-600">{msg}</p>}
    </div>
  );
}
