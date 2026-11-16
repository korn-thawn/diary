# Handoff: Diary theme "บันทึกหลังเที่ยงคืน"

Theme สำหรับเว็บ diary โทน neon-noir ฮ่องกงยุค 90s (แรงบันดาลใจจากหนัง Wong Kar-wai)
ไฟล์อ้างอิง: `Main.dc.html` (mockup หน้าแรก) — ใช้เป็น reference ของ layout/สี/ฟอนต์เท่านั้น

> หมายเหตุ: `Main.dc.html` เป็นไฟล์จาก design canvas มี wrapper เฉพาะ (`<x-dc>`, `<helmet>`, `support.js`, `{{accent}}`, บล็อก `text/x-dc`)
> ห้าม copy wrapper พวกนี้ไปใช้ ให้ดึงเฉพาะ markup + inline style ไปแปลงเป็น component/CSS จริง
> `{{accent}}` = `#C8261C`

## Design tokens

```css
:root {
  /* พื้น */
  --bg: #0B1211;          /* ดำอมเขียว */
  --bg-raised: #1A2422;
  --line: #22302D;
  --line-strong: #3A4A46;

  /* ตัวหนังสือ */
  --text: #F2E8D5;        /* ครีม */
  --text-muted: #B9C4BF;
  --text-dim: #9BA8A3;

  /* accent */
  --red: #C8261C;         /* accent หลัก, ปุ่ม, เวลาตัวใหญ่ */
  --red-deep: #8E1B14;
  --red-text: #FF8A75;    /* แดงสำหรับตัวหนังสือเล็กบนพื้นมืด */
  --jade: #4FB8A0;
  --jade-text: #7FD1BD;
  --jade-deep: #123B33;
  --amber: #F4D35E;       /* subtitle, ไฟโคม */
  --amber-soft: #E9B872;

  --font-body: 'Prompt', sans-serif;      /* 300 เนื้อหา, 500-600 หัวข้อ, หัวข้อใช้ italic */
  --font-mono: 'IBM Plex Mono', monospace; /* เวลา, เลขบันทึก, metadata */

  --radius: 2px;          /* มุมเกือบเหลี่ยม */
  --container: 1200px;
}
```

Google Fonts:
`https://fonts.googleapis.com/css2?family=Prompt:ital,wght@0,300;0,400;0,500;0,600;1,400;1,500;1,600&family=IBM+Plex+Mono:wght@400;500&display=swap`

## Type scale

| ใช้กับ | ฟอนต์ | ขนาด | น้ำหนัก |
|---|---|---|---|
| เวลา hero (`03:27`) | Mono | 112px, line-height 1 | 500 |
| H1 ชื่อบันทึก | Prompt italic | 46px / 1.25 | 600 |
| H2 หัว section | Prompt italic | 32px | 600 |
| H3 ชื่อ card | Prompt | 22px / 1.35 | 600 |
| เนื้อหา | Prompt | 16–17px / 1.6 | 300 |
| metadata (เลขบันทึก, วันที่) | Mono | 13–14px, letter-spacing 0.08–0.12em | 400 |

## Overlay (ส่วนที่ต้องเก็บไว้ให้ได้)

1. **พื้นหลังหน้า** — แสงฟุ้ง 2 จุดไล่จางเข้าพื้นดำ
   ```css
   background-color: var(--bg);
   background-image:
     radial-gradient(60% 520px at 88% 0%, rgba(200,38,28,.30), rgba(200,38,28,0) 70%),
     radial-gradient(50% 460px at 0% 320px, rgba(31,111,95,.26), rgba(31,111,95,0) 70%);
   background-repeat: no-repeat;
   ```
2. **บนรูปทุกใบ** — ชั้น `position:absolute; inset:0` ที่ blur + ไล่มืดลงล่าง
   ```css
   backdrop-filter: blur(8px);   /* hero ใช้ 10px */
   background: linear-gradient(180deg, rgba(11,18,17,0) 30%, rgba(11,18,17,.78) 100%);
   ```
   รูป hero เพิ่ม `radial-gradient(90% 70% at 15% 0%, rgba(244,211,94,.22), transparent 60%)` ทับอีกชั้น
3. รูป hero อยู่ในกรอบดำแบบ letterbox (`padding-top: 36px`) มี caption italic สี `--amber` กลางใต้ภาพ เหมือน subtitle หนัง

## โครงหน้าแรก

1. **Header** — โลโก้ (Prompt italic 24px) / nav: บันทึก, ปฏิทินอารมณ์, เกี่ยวกับ / ปุ่ม "เขียนบันทึก" (พื้น `--red`)
2. **Hero** — ซ้าย: เลขบันทึก+วันที่ (mono, jade) → เวลาตัวใหญ่ (red) → H1 → excerpt → ปุ่ม "อ่านต่อ" (outline) + metadata; ขวา: รูป letterbox + subtitle
3. **บันทึกก่อนหน้า** — grid `repeat(auto-fit, minmax(280px, 1fr))`, card = รูป 200px + metadata + H3 + excerpt 2 บรรทัด; สี metadata สลับ jade / red-text / amber ตามอารมณ์ของบันทึก
4. **ปฏิทินอารมณ์** — ช่อง 56px ต่อคืน: red = ร้อนรุ่ม, jade = นิ่ง, amber = อบอุ่น, `--bg-raised` = ไม่ได้เขียน, เส้นประ = วันที่ยังมาไม่ถึง, วันนี้มี outline ครีม
5. **Footer** — mono 13px สี `--text-dim`

## Data model ที่ theme นี้ต้องการ (ต่อ 1 บันทึก)

`entry_no`, `written_at` (datetime — เวลาเป็นตัวเอกของ design), `title`, `body`, `excerpt`, `mood` (`hot` | `calm` | `warm`), `weather` (optional), `temp_c` (optional), `cover_image` (optional), `caption` (optional, subtitle ใต้รูป)

## ยังไม่ได้ออกแบบ

- หน้าอ่านบันทึกเต็ม
- หน้าเขียน/แก้บันทึก
- login (ถ้าเป็น diary ส่วนตัว)
- stack ยังไม่ได้เลือก — ตัดสินใจกับ Claude Code ได้เลย

## ข้อห้าม

- ห้ามใช้ภาพนิ่ง, โปสเตอร์, หรือบทพูดจากหนังจริง — ใช้รูปของตัวเองเท่านั้น
- ข้อความบันทึกใน mockup เป็นตัวอย่าง แทนด้วยข้อมูลจริงจาก database
