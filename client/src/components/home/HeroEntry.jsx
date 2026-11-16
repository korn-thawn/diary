import { Link } from "react-router";
import { entryFacts, entryNo, excerpt, nightDate, timeOf } from "../../night";
import Cover from "./Cover";

/** The time an entry was written, set huge in mono: the star of the design. */
export function BigTime({ value, className = "", style, ...rest }) {
  return (
    <div className={`w-fit font-mono text-[72px] leading-none font-medium text-title tabular-nums sm:text-[112px] ${className}`} style={style} {...rest}>
      {value}
    </div>
  );
}

/** Photo in a black letterbox frame, with the caption set like a film subtitle. */
export function LetterboxPhoto({ entry }) {
  return (
    <figure className="intro-film m-0 overflow-hidden rounded-[2px] bg-black pt-9">
      <Cover entry={entry} hero className="h-[240px] sm:h-[360px]" />
      {entry.caption ? (
        <figcaption className="intro-caption px-5 pt-4 pb-5 text-center text-[19px] font-normal text-warm italic">“{entry.caption}”</figcaption>
      ) : (
        <div className="h-9" aria-hidden="true" />
      )}
    </figure>
  );
}

/** Latest entry: number + date, the big time, title, excerpt, then the letterboxed cover. */
export default function HeroEntry({ entry, intro = false }) {
  const facts = entryFacts(entry);
  const rise = (i) => ({ className: "intro-rise", style: { "--i": i } });
  return (
    <section
      className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-10 px-4 pt-8 pb-16 sm:gap-14 sm:px-8 sm:pt-10 sm:pb-18"
      data-intro={intro ? "" : undefined}
      data-entry-link={entry.id}
    >
      <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-5">
        <div className="intro-meta meta text-sm tracking-[0.12em] text-calm-text">
          {entryNo(entry.entry_no)} · {nightDate(entry.entry_date)}
        </div>
        <BigTime
          value={timeOf(entry.created_at)}
          className="intro-time neon-glow"
          data-vt-time=""
        />
        <h1 {...rise(0)} className="intro-rise m-0 text-[34px] leading-[1.25] sm:text-[46px]">{entry.title || excerpt(entry.excerpt, 48)}</h1>
        <p {...rise(1)} className="intro-rise m-0 max-w-[520px] text-[17px] text-muted">{excerpt(entry.excerpt, 220)}</p>
        <div {...rise(2)} className="intro-rise mt-2 flex flex-wrap items-center gap-5">
          <Link to={`/entries/${entry.id}`} viewTransition className="btn btn-outline min-h-11 px-5.5">
            อ่านต่อ
          </Link>
          {facts && <span className="meta text-dim">{facts}</span>}
        </div>
      </div>
      <div className="min-w-0 flex-[1_1_420px]">
        <LetterboxPhoto entry={entry} />
      </div>
    </section>
  );
}
