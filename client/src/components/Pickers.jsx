import { CheckIcon } from "@heroicons/react/20/solid";
import { BOARD_ICONS, COLOR_KEYS, color } from "../palette";

export function ColorPicker({ value, onChange, allowNone = false }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="สี">
      {allowNone && (
        <button
          type="button"
          role="radio"
          aria-checked={!value}
          aria-label="ไม่มีสี"
          title="ไม่มีสี"
          onClick={() => onChange(null)}
          className={`flex size-7 items-center justify-center rounded-full bg-surface ring-1 ring-stone-300 ${
            !value ? "ring-2 ring-stone-700 ring-offset-1 ring-offset-surface" : ""
          }`}
        >
          <span className="h-0.5 w-4 rotate-45 bg-stone-400" />
        </button>
      )}
      {COLOR_KEYS.map((k) => (
        <button
          type="button"
          key={k}
          role="radio"
          aria-checked={value === k}
          aria-label={color(k).label}
          title={color(k).label}
          onClick={() => onChange(k)}
          className={`flex size-7 items-center justify-center rounded-full ${color(k).dot} ${
            value === k ? "ring-2 ring-stone-700 ring-offset-1 ring-offset-surface" : ""
          }`}
        >
          {value === k && <CheckIcon className="size-4 text-white" aria-hidden="true" />}
        </button>
      ))}
    </div>
  );
}

export function IconPicker({ value, onChange }) {
  return (
    <div className="grid grid-cols-6 gap-1.5" role="radiogroup" aria-label="ไอคอน">
      {Object.entries(BOARD_ICONS).map(([k, { label, Icon }]) => (
        <button
          type="button"
          key={k}
          role="radio"
          aria-checked={value === k}
          aria-label={label}
          title={label}
          onClick={() => onChange(k)}
          className={`flex aspect-square items-center justify-center rounded-lg transition ${
            value === k ? "border-[1.5px] border-ink bg-title text-on-title" : "border-[1.5px] border-ink/35 bg-surface text-ink hover:border-ink"
          }`}
        >
          <Icon className="size-5" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
