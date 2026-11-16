// Stand-in for an entry without a photo: a few neon bands on a dark field, colored by the night's
// atmosphere and laid out from the entry id so each card keeps the same picture. Decorative only.

const PALETTES = {
  hot: { base: "#8e1b14", bands: ["#c8261c", "#f4d35e", "#7fd1bd"], block: "#123b33" },
  calm: { base: "#123b33", bands: ["#1f6f5f", "#f4d35e", "#4fb8a0"], block: "#0b1211" },
  warm: { base: "#5c4416", bands: ["#e9b872", "#0b1211", "#f4d35e"], block: "#8e1b14" },
  none: { base: "#1a2422", bands: ["#3a4a46", "#22302d", "#9ba8a3"], block: "#123b33" },
};

// small deterministic PRNG (mulberry32)
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default function NightArt({ seed = 1, atmosphere }) {
  const p = PALETTES[atmosphere] || PALETTES.none;
  const r = rng(Number(seed) * 2654435761);
  const tilt = -2 - r() * 5;
  const blockLeft = r() < 0.5;
  const blockW = 26 + r() * 16;
  const bands = [0, 1, 2, 3].map((i) => ({
    top: 12 + i * 20 + r() * 10,
    h: [3, 12, 2, 6][i],
    color: p.bands[i % p.bands.length],
    opacity: [0.55, 1, 0.7, 0.35][i],
  }));
  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden" style={{ background: p.base }}>
      <div className="absolute top-0 h-full" style={{ [blockLeft ? "left" : "right"]: 0, width: `${blockW}%`, background: p.block }} />
      {bands.map((b, i) => (
        <div
          key={i}
          className="absolute -left-[10%] w-[120%]"
          style={{ top: `${b.top}%`, height: b.h, background: b.color, opacity: b.opacity, transform: `rotate(${tilt}deg)` }}
        />
      ))}
    </div>
  );
}
