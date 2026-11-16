import { ATMOSPHERES, WEATHERS } from "../night";

/** ร้อนรุ่ม / นิ่ง / อบอุ่น — how the night felt. Clicking the selected one clears it. */
export function AtmospherePicker({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="บรรยากาศคืนนี้">
      {ATMOSPHERES.map((a) => {
        const active = value === a.id;
        return (
          <button
            key={a.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(active ? null : a.id)}
            className={`inline-flex min-h-10 items-center gap-2 rounded-[2px] border px-3 text-sm transition-colors ${
              active ? `${a.fill} ${a.on} border-transparent font-medium` : "border-line-strong text-muted hover:border-dim hover:text-ink"
            }`}
          >
            <span aria-hidden="true" className={`size-3 ${active ? "bg-current opacity-60" : a.fill}`} />
            {a.label}
          </button>
        );
      })}
    </div>
  );
}

/** Weather as chips (optional). */
export function WeatherPicker({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="สภาพอากาศ">
      {WEATHERS.map((w) => (
        <button key={w.id} type="button" role="radio" aria-checked={value === w.id} className="chip" onClick={() => onChange(value === w.id ? null : w.id)}>
          {w.label}
        </button>
      ))}
    </div>
  );
}
