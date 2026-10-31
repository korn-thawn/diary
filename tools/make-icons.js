// Generates the PWA / home-screen PNG icons into client/public/icons (no dependencies).
// Run once (or after changing the design):  node tools/make-icons.js
// Design: cream open book on the title green (retro-desk theme). Maskable variant is full-bleed with a 20% safe zone.
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const ACCENT = [0x23, 0x66, 0x3e]; // title green
const WHITE = [0xfb, 0xf5, 0xe6]; // cream paper
const LINE = [0x9f, 0xc8, 0xa9];

// Coverage-based shape test in unit coordinates (0..1). Returns color or null.
function sample(x, y, { rounded, scale }) {
  // background: rounded square (radius 0.22) or full bleed
  if (rounded) {
    const r = 0.22, cx = Math.min(Math.max(x, r), 1 - r), cy = Math.min(Math.max(y, r), 1 - r);
    if ((x - cx) ** 2 + (y - cy) ** 2 > r * r) return null;
  }
  // map into the glyph box (scaled around the centre)
  const u = (x - 0.5) / scale + 0.5, v = (y - 0.5) / scale + 0.5;
  const sag = 0.035 * Math.sin(Math.PI * ((u - 0.2) / 0.6)); // pages curve down towards the spine
  const top = 0.27 + (Math.abs(u - 0.5) < 0.3 ? 0.04 - sag : 0);
  const bottom = 0.73 + (Math.abs(u - 0.5) < 0.3 ? 0.03 - sag : 0);
  const inLeft = u >= 0.2 && u <= 0.485 && v >= top && v <= bottom;
  const inRight = u >= 0.515 && u <= 0.8 && v >= top && v <= bottom;
  if (inLeft || inRight) {
    // three text lines on each page
    const lu = inLeft ? (u - 0.2) / 0.285 : (u - 0.515) / 0.285;
    for (const ly of [0.42, 0.5, 0.58]) {
      if (Math.abs(v - (ly + 0.02 - sag)) < 0.012 && lu > 0.15 && lu < 0.85) return LINE;
    }
    return WHITE;
  }
  return ACCENT;
}

function render(size, opts) {
  const SS = 4; // supersampling for anti-aliasing
  const px = Buffer.alloc(size * size * 4);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sj = 0; sj < SS; sj++) {
        for (let si = 0; si < SS; si++) {
          const c = sample((i + (si + 0.5) / SS) / size, (j + (sj + 0.5) / SS) / size, opts);
          if (c) { r += c[0]; g += c[1]; b += c[2]; a += 1; }
        }
      }
      const o = (j * size + i) * 4, n = SS * SS;
      px[o] = a ? Math.round(r / a) : 0;
      px[o + 1] = a ? Math.round(g / a) : 0;
      px[o + 2] = a ? Math.round(b / a) : 0;
      px[o + 3] = Math.round((a / n) * 255);
    }
  }
  return png(size, size, px);
}

function png(w, h, rgba) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0; // 8-bit RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const out = path.join(__dirname, "..", "client", "public", "icons");
fs.mkdirSync(out, { recursive: true });
const icons = [
  ["icon-192.png", 192, { rounded: true, scale: 1 }],
  ["icon-512.png", 512, { rounded: true, scale: 1 }],
  ["maskable-512.png", 512, { rounded: false, scale: 0.8 }],
  ["apple-touch-icon.png", 180, { rounded: false, scale: 0.9 }], // iOS rounds corners itself
  ["favicon-32.png", 32, { rounded: true, scale: 1.1 }],
];
for (const [name, size, opts] of icons) {
  const buf = render(size, opts);
  fs.writeFileSync(path.join(out, name), buf);
  console.log(`${name} ${size}x${size} ${buf.length} bytes`);
}
