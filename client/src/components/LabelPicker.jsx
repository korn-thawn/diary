import { useState } from "react";
import { PlusIcon } from "@heroicons/react/20/solid";
import { color } from "../palette";
import { ColorPicker } from "./Pickers";

// Toggle chips for the shared labels + inline "new label" form (used by cards and meetings).
export default function LabelPicker({ labels, selected, onToggle, onCreate }) {
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
