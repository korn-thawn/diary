# CLAUDE.md
diary: personal diary web app — React (JS, no Vite; Rspack + Tailwind v4) + Express 5 + PostgreSQL. Korn คุยภาษาไทย ชอบคำตอบตรงๆ
- Deploy: korn-sg-01 (arm64) via PM2, port 3101, push main → GitHub Actions (MODE=pm2, runs `npm run migrate` after build)
- Server contract + order of work: D:\Side_Project\cloud_server\docs\13-new-web-app.md (read it first)
- Server-side changes (new-db, new-site, .env, Kuma) are done from the cloud_server session, not here
- Don't commit .env / secrets; don't run git write commands (Korn commits himself)

## Layout
- `server/index.js` Express: `/api/health`, `/api/auth/*`, `/api/entries/*` (+ `/calendar`), `/api/stats`, `/api/export` (session via connect-pg-simple), serves `client/dist` + SPA fallback
- `server/routes/auth.js` also has account settings: `PUT /password`, `POST /logout-others`, `DELETE /account` (sessions found via `sess->>'userId'`)
- `server/routes/boards.js` kanban (`/api/boards`): boards → board_columns → cards (+ card_items, labels/card_labels). Ownership via `boards.user_id` helpers `ownBoard/ownColumn/ownCard/ownItem/ownLabel` (404 otherwise). Reorders send the **full ordered id list** (`orderedIds` / `ids`) and the server checks it's exactly the current set (409 if stale); `completed_at` follows the column's `is_done`
- Phase 2 (done): `server/routes/events.js` important dates (repeat none/monthly/yearly) · `server/routes/calendar.js` `/api/calendar?from&to` (≤62 days: entries + due cards + event occurrences) and `/upcoming` · recurring cards: `cards.recurrence` + `next_card_id`, `spawnNext()` in boards.js runs when a card enters a done column (move or column toggled done) · `server/recur.js` pure date math (month-end clamping, Feb 29) — keep its unit test passing
- ICS feed: public `GET /ical/<64-hex token>.ics` (`server/routes/ical.js` + `server/ics.js`, no session, rate limited); token/toggles in `users.ics_*` via `/api/auth/ics`. Never put diary entry content in the feed
- Phase 3 (done): photos in Postgres `photos` table (bytea full + thumb, entry_id XOR card_id). `server/routes/photos.js`: multipart parsed with Node's built-in `Request.formData()` (no multer), format checked by **magic bytes** (WebP/JPEG only), 2.5 MB full / 300 KB thumb, 12 per item, per-user quota `PHOTO_QUOTA_MB` (default 500). Served only to the owner with private immutable cache. Client resizes in `client/src/images.js` (createImageBitmap EXIF-aware → canvas → WebP, JPEG fallback; strips EXIF/GPS). `components/Photos.jsx` = grid + upload queue + lightbox. Recurring card spawns don't copy photos; JSON export has photo_count only
- Roadmap: phase 4 Telegram reminders, PWA, dark mode · phase 5 Google Calendar 2-way after HTTPS
- `server/util.js` `isDate` / `localToday` / `COLORS` / `ICONS` (shared by boards and events; must match `client/src/palette.js`) / `tx` / `sameIdSet` — Postgres runs in UTC, so "today" comes from the client (`?today=`) or Node, never `current_date`
- `server/migrate.js` runs `server/migrations/NNN_*.sql` in order, tracked in `schema_migrations` — schema changes = new numbered file, never edit an applied one
- `client/src` React 19 + react-router; built by `rspack.config.mjs` (builtin swc-loader, postcss + @tailwindcss/postcss)
- Pages: EntryList, EntryEditor, Calendar (unified: `?month=`/`?date=` + upcoming), Events (`/events`), Stats (hand-made SVG charts, no chart lib), Settings, Boards, Board (kanban, `?card=<id>` opens CardModal) · `dates.js` month-grid helpers · `kanban.js` due/filter helpers · `components/Mood.jsx`
- Drag & drop: `@dnd-kit` (sensors in `pages/Boards.jsx` `useDndSensors`: pointer distance 6, touch delay 200, keyboard Space only). Dragging is disabled while a filter is active (partial lists would break `orderedIds`)
- **No emoji anywhere in the UI** — icons from `@heroicons/react`, mood = 5-step color scale in `api.js` `MOODS` (rose-700/rose-400/stone-500/emerald-500/emerald-700, validated with the dataviz checker; always paired with a Thai label)
- Every entries query is scoped by `user_id = req.session.userId`

## Dev
- Local Postgres: `podman start pg` (container created with POSTGRES_PASSWORD=dev, POSTGRES_DB=diary on 127.0.0.1:5432) — Docker isn't installed on this laptop, Podman is
- `npm run migrate` → `npm run dev` (web :3000 proxies /api → :3101) · prod check: `npm run build && npm start`
- No HTTPS yet: cookie `secure` via `COOKIE_SECURE`; test with throwaway passwords only
