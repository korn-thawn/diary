import { MOODS, moodOf } from "../api";

// Small colored dot for a mood value (1-5). Always carries an accessible label.
export function MoodDot({ value, size = "size-2.5", className = "" }) {
  const m = moodOf(value);
  if (!m) return null;
  return (
    <span
      role="img"
      aria-label={`อารมณ์: ${m.label}`}
      title={m.label}
      className={`inline-block shrink-0 rounded-full ${size} ${m.bg} ${className}`}
    />
  );
}

// Dot + Thai label, used where there's room.
export function MoodBadge({ value }) {
  const m = moodOf(value);
  if (!m) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-stone-600">
      <MoodDot value={value} size="size-2" />
      {m.label}
    </span>
  );
}

// 5-step picker for the editor. Clicking the selected one clears it.
export function MoodPicker({ value, onChange }) {
  const selected = moodOf(value);
  return (
    <div className="flex items-center gap-3">
      <div className="flex gap-1.5" role="radiogroup" aria-label="อารมณ์">
        {MOODS.map((m) => {
          const active = value === m.value;
          return (
            <button
              type="button"
              key={m.value}
              role="radio"
              aria-checked={active}
              aria-label={m.label}
              title={m.label}
              onClick={() => onChange(active ? null : m.value)}
              className={`size-7 rounded-full transition ${m.bg} ${
                active
                  ? "ring-2 ring-offset-2 ring-offset-surface ring-stone-700"
                  : "opacity-35 hover:opacity-80 focus-visible:opacity-80"
              }`}
            />
          );
        })}
      </div>
      <span className="w-16 text-sm text-stone-600">{selected ? selected.label : "อารมณ์"}</span>
    </div>
  );
}
