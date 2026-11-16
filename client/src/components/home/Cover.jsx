import { photoUrl } from "../../api";
import NightArt from "./NightArt";

/**
 * An entry's cover: the first photo (or NightArt) under the handoff's veil — a blur plus a fade to
 * night at the bottom. `hero` adds the amber lamp glow from the top-left and a stronger blur.
 */
export default function Cover({ entry, hero = false, className = "" }) {
  return (
    <div className={`relative overflow-hidden ${className}`} data-vt-cover="">
      {entry.cover_id ? (
        <img
          src={photoUrl(entry.cover_id, !hero)}
          alt={entry.caption || ""}
          className="absolute inset-0 size-full object-cover"
          loading={hero ? "eager" : "lazy"}
          decoding="async"
          data-fade=""
          ref={(img) => { if (img?.complete && img.naturalWidth) img.dataset.loaded = ""; }}
          onLoad={(e) => { e.currentTarget.dataset.loaded = ""; }}
        />
      ) : (
        <NightArt seed={entry.id} atmosphere={entry.atmosphere} />
      )}
      <div
        className="veil"
        style={
          hero
            ? {
                "--veil-blur": "10px",
                background:
                  "radial-gradient(90% 70% at 15% 0%, rgb(244 211 94 / 0.22), rgb(244 211 94 / 0) 60%), linear-gradient(180deg, rgb(0 0 0 / 0) 35%, rgb(0 0 0 / 0.8) 100%)",
              }
            : undefined
        }
      />
    </div>
  );
}
