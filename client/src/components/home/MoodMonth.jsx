import { Link } from "react-router";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/20/solid";
import { addMonths } from "../../dates";
import { ATMOSPHERES, atmosphereOf } from "../../night";
import { useReveal } from "../../motion";

const monthName = (month) => {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("th-TH", { month: "long" });
};

/**
 * One square per night of the month. Color = how the night felt (atmosphere), dark = not written,
 * dashed = still to come, cream outline = tonight. Every square also says it in words for screen readers.
 */
export default function MoodMonth({ month, days, today, onMonth }) {
  const lights = useReveal();
  const [y, m] = month.split("-").map(Number);
  const count = new Date(y, m, 0).getDate();
  const byDate = new Map(days.map((d) => [d.date, d]));
  const thisMonth = today.slice(0, 7);
  const title = monthName(month) + (y !== Number(today.slice(0, 4)) ? ` ${y}` : "");

  const cells = Array.from({ length: count }, (_, i) => {
    const day = i + 1;
    const date = `${month}-${String(day).padStart(2, "0")}`;
    const entry = byDate.get(date);
    const future = date > today;
    const atm = atmosphereOf(entry?.atmosphere);
    let cls, state;
    if (entry && atm) { cls = `${atm.fill} ${atm.on}`; state = atm.label; }
    else if (entry) { cls = "bg-line-strong text-ink"; state = "เขียนแล้ว ไม่ได้ระบุบรรยากาศ"; }
    else if (future) { cls = "border border-dashed border-line-strong text-dim"; state = "ยังมาไม่ถึง"; }
    else { cls = "bg-surface text-dim"; state = "ไม่ได้เขียน"; }
    const isToday = date === today;
    const label = `${day} ${monthName(month)}: ${state}${isToday ? " (คืนนี้)" : ""}`;
    const base = `meta block h-14 px-2 py-1.5 ${cls} ${isToday ? "outline-2 outline-offset-2 outline-ink" : ""}`;
    if (future) return <div key={date} className={base} aria-label={label}>{String(day).padStart(2, "0")}</div>;
    return (
      <Link
        key={date}
        to={entry ? `/entries/${entry.id}` : `/entries/new?date=${date}`}
        viewTransition
        className={`${base} transition-[filter,transform] duration-200 hover:-translate-y-0.5 hover:brightness-110 hover:text-current`}
        aria-label={label}
        title={state}
      >
        {String(day).padStart(2, "0")}
      </Link>
    );
  });

  return (
    <section id="moods" className="border-t border-line">
      <div className="mx-auto flex max-w-[1200px] flex-wrap gap-12 px-4 py-16 sm:px-8">
        <div className="flex flex-[1_1_280px] flex-col gap-4">
          <div className="flex items-center gap-3">
            <h2 className="m-0 text-[32px]">{title}</h2>
            <div className="ml-auto flex gap-1">
              <button className="btn btn-ghost size-11 min-h-0 p-0" onClick={() => onMonth(addMonths(month, -1))} aria-label="เดือนก่อน">
                <ChevronLeftIcon className="size-5" />
              </button>
              <button
                className="btn btn-ghost size-11 min-h-0 p-0"
                onClick={() => onMonth(addMonths(month, 1))}
                disabled={month >= thisMonth}
                aria-label="เดือนถัดไป"
              >
                <ChevronRightIcon className="size-5" />
              </button>
            </div>
          </div>
          <p className="m-0 max-w-[340px] text-[15px] text-muted">หนึ่งช่องคือหนึ่งคืน สีบอกว่าคืนนั้นรู้สึกอย่างไร ช่องมืดคือคืนที่ไม่ได้เขียน แตะช่องเพื่อเปิดหรือเขียนบันทึกของคืนนั้น</p>
          <ul className="mt-2 flex flex-col gap-2.5 text-sm">
            {ATMOSPHERES.map((a) => (
              <li key={a.id} className="flex items-center gap-3">
                <span aria-hidden="true" className={`inline-block size-4 ${a.fill}`} />
                {a.label}
              </li>
            ))}
            <li className="flex items-center gap-3">
              <span aria-hidden="true" className="inline-block size-4 bg-line-strong" />
              เขียนแล้ว ไม่ได้ระบุบรรยากาศ
            </li>
            <li className="flex items-center gap-3">
              <span aria-hidden="true" className="inline-block size-4 border border-line-strong bg-surface" />
              ไม่ได้เขียน
            </li>
          </ul>
        </div>
        <div
          ref={lights}
          data-reveal="lights"
          className="grid flex-[2_1_420px] grid-cols-[repeat(auto-fill,minmax(56px,1fr))] content-start gap-2"
          style={{ viewTransitionName: "mood-grid" }}
          role="list"
          aria-label={`ปฏิทินอารมณ์ ${title}`}
        >
          {cells.map((c, i) => <div key={c.key} role="listitem" style={{ "--i": i }}>{c}</div>)}
        </div>
      </div>
    </section>
  );
}
