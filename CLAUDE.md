# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

diary: personal diary / planner web app — React 19 (plain JS, **no TypeScript, no Vite/CRA**; Rspack + Tailwind v4) + Express 5 + PostgreSQL. Korn คุยภาษาไทย ชอบคำตอบตรงๆ

## Rules
- Don't commit `.env` / secrets; **don't run git write commands** (Korn commits himself)
- Never edit `D:\Side_Project\cloud_server` or change the server by SSH — server-side work (new-db, new-site, `.env`, Kuma) is done from the cloud_server session. Contract + order of work: `D:\Side_Project\cloud_server\docs\13-new-web-app.md`
- Schema changes = a new numbered file in `server/migrations/`, never edit an applied one
- Every query on user data is scoped by `user_id = req.session.userId`, parameterized; someone else's row → 404 (not 403)
- **No emoji anywhere in the UI** — icons from `@heroicons/react`
- `TELEGRAM_BOT_TOKEN` lives only in the **server** `.env` (two pollers on one token → 409); don't add it to the laptop `.env`
- No HTTPS yet: cookie `secure` via `COOKIE_SECURE`; test with throwaway passwords only
- Don't kill Korn's running `npm run dev` (:3000 + :3101); stop temp processes by PID

## Commands
- Local DB: `podman start pg` (Podman, not Docker; container `pg`, POSTGRES_PASSWORD=dev, POSTGRES_DB=diary, 127.0.0.1:5432)
- `npm run migrate` — applies `server/migrations/NNN_*.sql` in order (tracked in `schema_migrations`)
- `npm run dev` — API on :3101 (`node --watch`) + Rspack dev server on :3000 (proxies `/api`). Restart it after changing `rspack.config.mjs` or installing packages
- `npm run build && npm start` — production build into `client/dist`, served by Express on :3101
- Generators (outputs are committed, re-run after changing the source):
  - `node tools/gen-dark-css.js` → `client/src/dark.css` (night theme variables)
  - `node tools/make-icons.js` → `client/public/icons/`
- Tests (server must be running on :3101 with `ALLOW_REGISTER=true`; override with `TEST_BASE`; each file creates and deletes its own users):
  - `npm test` — `node:test` unit (`tests/unit/recur.test.js`, no server needed) + API (`tests/api/*.test.js`: entries, appearance, smoke)
  - one file: `node --test tests/api/entries.test.js` · unit only: `npm run test:unit`
  - `npm run test:ui` — `tests/ui/seed.mjs` → `interact.mjs` (Chrome desktop + WebKit iPhone 13 checks) → `shoot.mjs` (screenshots to `tests/ui/out/`, fails on sideways scroll / page errors) → `cleanup.mjs`. Uses `playwright-core` with the locally installed Chrome (`channel: "chrome"`) and Playwright's WebKit (`npx playwright-core install webkit` once)
  - Telegram reminders were tested with a fake Bot API (`TELEGRAM_API_BASE`) + `reminders.tick(fakeNow)`; that suite isn't in the repo yet
- No lint config
- Deploy: push `main` → GitHub Actions SSHes to korn-sg-01 (arm64) → `npm ci`, build, `npm run migrate`, `pm2 startOrReload` (port 3101). After `npm install`, check `package-lock.json` still lists the `linux-arm64-gnu` bindings for `@rspack/binding`, `@tailwindcss/oxide`, `lightningcss`

## Architecture
**Server** (`server/index.js`): helmet (CSP `script-src 'self'`, `img-src 'self' data: blob:`) → JSON → `/api/health` (no session) → express-session in Postgres (connect-pg-simple, cookie `diary.sid`) on `/api` → routers (`requireAuth` except auth) → `/api` 404 → public `/ical/<token>.ics` → static `client/dist` (`/assets/` immutable cache; `sw.js`/`theme.js`/manifest no-cache) → SPA fallback. Telegram poller + reminder tick start only after `listen` succeeds.
- `server/util.js`: `isDate`, `localToday`, `COLORS`/`ICONS` (must match `client/src/palette.js`), `tx`, `sameIdSet`. Postgres runs in UTC, so "today" comes from the client (`?today=`) or Node — never `current_date`
- Auth (`routes/auth.js`): register/login (session regenerate), `/me`, password change, logout-others, delete account (sessions found via `sess->>'userId'`), ICS token (`/ics`, also returns a `webcal://` URL), appearance (`PUT /appearance`)
- Kanban (`routes/boards.js`): boards → board_columns → cards (+ card_items, labels/card_labels). Ownership helpers `ownBoard/ownColumn/ownCard/ownItem/ownLabel`. **Reorders send the full ordered id list** and the server checks it equals the current set (409 if stale). `completed_at` follows the column's `is_done`; recurring cards (`cards.recurrence`, `next_card_id`) spawn via `spawnNext()` when a card enters a done column
- Dates: `routes/events.js` (important dates, repeat none/monthly/yearly), `routes/calendar.js` (`?from&to` ≤62 days: entries + due cards + events + meetings; `/upcoming`). `server/recur.js` is pure date math (month-end clamping, Feb 29, `meetingOccurrences`, `findConflicts`)
- Meetings: `meetings` series (none/daily/weekdays/weekly/biweekly/monthly + weekdays[] + repeat_until), `meeting_exceptions` (cancel/move keyed by the ORIGINAL date), `meeting_notes`, `meeting_actions` (→ kanban card), `meeting_labels`. `server/meetings.js` `occurrencesFor()` is the single expansion used by API, calendar, reminders and ICS
- ICS (`routes/ical.js` + `ics.js`): public token URL, rate limited, 75-octet folding, Asia/Bangkok VTIMEZONE; meetings expanded per occurrence (-30..+180 days), never RRULE. **Never put diary entry content or meeting notes in the feed**
- Photos (`routes/photos.js`): bytea full + thumb in `photos` (entry_id XOR card_id); multipart parsed with Node's built-in `Request.formData()` (no multer); format checked by **magic bytes** (WebP/JPEG only); 2.5 MB full / 300 KB thumb, 12 per item, quota `PHOTO_QUOTA_MB` (default 500); owner-only, private immutable cache. Client resizes in `client/src/images.js` (EXIF-aware, strips GPS)
- Telegram (`telegram.js` long polling: `/start <code>`, `/today`, `/stop`) + `reminders.js` (1-minute tick, Bangkok time via Intl: morning summary, events N days ahead, timed cards / meetings N min before, evening diary nudge). Each message is claimed in `notifications_sent` before sending so nothing double-sends

**Client** (`client/src`): React Router 7 with `viewTransition`.
- Shell `App.jsx`: MenuBar + FolderTabs (desktop) / Dock + "more" sheet (mobile) from `components/ui/Chrome.jsx`, and one `Window` whose title/icon/back come from `routes.js` `windowFor(pathname)`. Pages add title-bar buttons with `<WindowActions><TitleButton>` and rename it with `useWindowTitle()`. `OccurrenceModal` is mounted in App and opens anywhere via `?m=<id>&d=<original date>`; meeting changes broadcast the `diary:meetings-changed` window event
- All modals use `components/ui/Dialog.jsx` (window on desktop, bottom sheet on mobile, Esc closes only the top one, focus restore, scroll lock)
- Drag & drop: `@dnd-kit` with sensors from `pages/Boards.jsx` `useDndSensors` (pointer distance 6, touch delay 200, keyboard Space). Dragging is disabled while a filter is active (partial lists would break `orderedIds`)
- Stats charts are hand-made SVG (no chart lib)

**Design system — "บันทึกหลังเที่ยงคืน" (noir, dark-only, 2026-11-16)** from the design handoff in `docs/design/` (`handoff-diary-theme.md` + `Main.dc.html`, reference only — never copy the canvas wrapper `<x-dc>`/`<helmet>`/`support.js`; never use film stills or quotes, only the user's own photos). Green-black night `--bg #0b1211`, raised `#1a2422`, hairlines `#22302d`/`#3a4a46`, cream text `#f2e8d5` (+ muted/dim), neon accent (red by default), jade + amber for atmosphere, 2px corners, two radial glows on `body`.
- Handoff tokens live as raw CSS vars on `:root` in `index.css`; `@theme` maps the Tailwind names pages already use onto them: `paper`=bg, `surface`=raised, `ink`=text, `line`, `line-strong`, `muted`, `dim`, `title` = accent **fill** (buttons, selected chips) / `on-title`, `accent` = readable accent **text**, `highlight`=amber, atmosphere `hot|calm|warm` (+ `-text`, `-deep`). Never use `text-title` for small text (red fill is < 4.5:1)
- Utilities: `win` (raised floating box), `win-title`, `panel`, `btn` + `btn-primary|btn-outline|btn-ghost|btn-danger`, `input`, `chip` (state via `aria-pressed`/`aria-checked`), `meter`, `meta` (IBM Plex Mono 13px tracked — entry numbers, dates, times), `veil` (blur + fade-to-night layer over photos)
- Fonts: Prompt 300 body / 600 italic for h1–h2, IBM Plex Mono for time & metadata (bundled via @fontsource in `index.jsx`)
- `dark.css` (generated) applies on `:root, .dark`: green-black stone scale, hue tints mixed with `var(--color-surface)`, mood colors. `theme.js` always sets `.dark` (the 12 `dark:` variants still work) and injects the cached user CSS
- User appearance = accent (`red|jade|amber|#rrggbb`) + text size (`s|m|l` = root 15/16/18px): `users.appearance` validated by `server/appearance.js`; `client/src/appearance.js` builds `html:root{--color-title…}` (custom accents get on-color + readable text via `colors.js`), cached in localStorage `diary-appearance` as `{v:2, css}` (older caches ignored), cleared on logout
- Home `/` (`pages/Home.jsx`, no page frame) = `GET /api/entries/home?month=`: latest entry as hero (`components/home/HeroEntry` — entry no, huge Bangkok time of `created_at`, letterboxed cover + caption as a film subtitle), 6 earlier entries (`EntryCard`), `MoodMonth` (one square per night colored by atmosphere). No cover photo → `NightArt` (deterministic CSS stripes). All entries with search/tags moved to `/entries`
- Entry noir fields (migration 008): `atmosphere hot|calm|warm` (separate from the 1–5 `mood` used by stats/Telegram), `weather`, `temp_c`, `caption`; vocab in `client/src/night.js` (must match `server/routes/entries.js`). `entry_no` = row_number over the user's entries (shifts if older ones are deleted)
- Shell: `components/ui/Chrome.jsx` = `SiteHeader` (logo, text nav, clock, "เขียนบันทึก") + `SiteFooter` + mobile `Dock`; `Window.jsx` is now a plain page frame (← กลับ, italic title, actions) but keeps its API
- Mood 1–5 = `--mood-1..5` (#f43f5e/#fecdd3/#a8a29e/#a7f3d0/#10b981, all ≥ 3:1 on the noir surface), always paired with a Thai label
- PWA: manifest, `sw.js` (never caches `/api` or `/ical`; bump `VERSION` when the shell changes) and icons are copied to dist by CopyRspackPlugin; SW registers only on secure contexts in production
- iOS Safari gotcha: date/time inputs keep a native min width — the `input` utility sets `min-width:0` + `appearance:none` (iOS only via `@supports (-webkit-touch-callout:none)`); put date fields on their own row on mobile. `truncate` clips Thai tone marks on headings — add `py-1 leading-normal`

## Roadmap (plan: `C:\Users\Korn\.claude\plans\project-web-app-majestic-stallman.md`)
- Next: iOS Shortcuts / Siri via personal API tokens (`009_api_tokens.sql`, `/api/hooks/*`: quick entry, photo, card, today summary)
- Then trips (places per custom section, OSM map from Google Maps links, photos, share link, print/PDF, ZIP, calendar/ICS/Telegram) — `010_trips.sql`, styled noir
- After HTTPS: Google Calendar/Tasks 2-way, CalDAV for iOS Reminders, Drive backup; share an event with friends
