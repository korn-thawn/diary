import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowPathIcon,
  Bars3BottomLeftIcon,
  CalendarIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  FlagIcon,
  PhotoIcon,
} from "@heroicons/react/16/solid";
import { formatDate } from "../api";
import { color, PRIORITIES, recurrenceLabel } from "../palette";
import { dueInfo } from "../kanban";

export function CardFace({ card, labelsById, todayStr, done, dragging }) {
  const due = dueInfo(card.due_date, todayStr, done);
  const labels = card.label_ids.map((id) => labelsById[id]).filter(Boolean);
  return (
    <div
      className={`relative overflow-hidden panel p-3 text-left ${
        dragging ? "rotate-1 shadow-lg ring-stone-400" : "hover:border-ink"
      } ${done && !dragging ? "opacity-60" : ""}`}
    >
      {card.color && <span className={`absolute inset-y-0 left-0 w-1 ${color(card.color).bar}`} aria-hidden="true" />}
      {labels.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1">
          {labels.map((l) => (
            <span key={l.id} className={`rounded px-1.5 py-0.5 text-[11px] leading-none font-medium ${color(l.color).soft}`}>
              {l.name}
            </span>
          ))}
        </div>
      )}
      <p className={`text-sm leading-snug break-words ${done ? "line-through decoration-stone-400" : ""}`}>{card.title}</p>
      {(due || card.items_total > 0 || card.priority > 0 || card.description || card.recurrence || card.photo_count > 0) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500">
          {due && (
            <span
              className={`inline-flex items-center gap-1 ${
                due.kind === "overdue" ? "font-medium text-red-700" : due.kind === "today" ? "font-medium text-amber-700" : ""
              }`}
            >
              {due.kind === "overdue" ? (
                <ExclamationCircleIcon className="size-3.5" aria-hidden="true" />
              ) : (
                <CalendarIcon className="size-3.5" aria-hidden="true" />
              )}
              {due.kind === "overdue" && <span className="sr-only">เลยกำหนด</span>}
              {due.text || formatDate(card.due_date, { day: "numeric", month: "short" })}
              {card.due_time && ` ${card.due_time}`}
            </span>
          )}
          {card.items_total > 0 && (
            <span
              className={`inline-flex items-center gap-1 ${card.items_done === card.items_total ? "text-emerald-700" : ""}`}
              title={`เช็กลิสต์ ${card.items_done}/${card.items_total}`}
            >
              <CheckCircleIcon className="size-3.5" aria-hidden="true" />
              {card.items_done}/{card.items_total}
            </span>
          )}
          {card.priority > 0 && (
            <span className={`inline-flex items-center gap-1 ${card.priority === 3 ? "font-medium text-rose-700" : ""}`}>
              <FlagIcon className="size-3.5" aria-hidden="true" />
              {PRIORITIES[card.priority].label}
            </span>
          )}
          {card.recurrence && (
            <span className="inline-flex items-center gap-1" title={`ทำซ้ำ${recurrenceLabel(card.recurrence)}`}>
              <ArrowPathIcon className="size-3.5" aria-hidden="true" />
              <span className="sr-only">ทำซ้ำ</span>
              {recurrenceLabel(card.recurrence)}
            </span>
          )}
          {card.photo_count > 0 && (
            <span className="inline-flex items-center gap-1" title={`รูป ${card.photo_count} รูป`}>
              <PhotoIcon className="size-3.5" aria-hidden="true" />
              {card.photo_count}
            </span>
          )}
          {card.description && (
            <Bars3BottomLeftIcon className="size-3.5" aria-label="มีรายละเอียด" />
          )}
        </div>
      )}
    </div>
  );
}

export default function KanbanCard({ card, onOpen, disabled, ...face }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `card-${card.id}`,
    data: { type: "card", card },
    disabled,
  });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`touch-manipulation ${isDragging ? "opacity-30" : ""}`}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(card.id)}
      onKeyDown={(e) => {
        listeners?.onKeyDown?.(e);
        if (e.key === "Enter" && !e.defaultPrevented) onOpen(card.id);
      }}
      aria-label={`การ์ด ${card.title}`}
    >
      <CardFace card={card} {...face} />
    </li>
  );
}
