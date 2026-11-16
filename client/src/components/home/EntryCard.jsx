import { Link } from "react-router";
import { atmosphereOf, entryNo, excerpt, nightDate, timeOf } from "../../night";
import Cover from "./Cover";

/** One earlier night: cover, number · time · date (colored by its atmosphere), title, two-line excerpt. */
export default function EntryCard({ entry }) {
  const atm = atmosphereOf(entry.atmosphere);
  return (
    <article className="group">
      <Link to={`/entries/${entry.id}`} viewTransition className="flex flex-col gap-3.5 hover:text-ink">
        <Cover entry={entry} className="h-[200px] rounded-[2px]" />
        <div className={`meta ${atm ? atm.text : "text-dim"}`}>
          {entryNo(entry.entry_no)} · {timeOf(entry.created_at)} · {nightDate(entry.entry_date, { weekday: false, year: false })}
          {atm && <span className="sr-only"> · บรรยากาศ{atm.label}</span>}
        </div>
        <h3 className="m-0 text-[22px] transition-colors group-hover:text-warm">{entry.title || excerpt(entry.excerpt, 40)}</h3>
        <p className="m-0 line-clamp-2 text-[15px] text-muted">{excerpt(entry.excerpt, 160)}</p>
      </Link>
    </article>
  );
}
