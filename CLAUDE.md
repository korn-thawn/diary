# CLAUDE.md
diary: personal diary web app — React (JS, no Vite; Rspack + Tailwind v4) + Express 5 + PostgreSQL. Korn คุยภาษาไทย ชอบคำตอบตรงๆ
- Deploy: korn-sg-01 (arm64) via PM2, port 3101, push main → GitHub Actions (MODE=pm2, runs `npm run migrate` after build)
- Server contract + order of work: D:\Side_Project\cloud_server\docs\13-new-web-app.md (read it first)
- Server-side changes (new-db, new-site, .env, Kuma) are done from the cloud_server session, not here
- Don't commit .env / secrets; don't run git write commands (Korn commits himself)

## Layout
- `server/index.js` Express: `/api/health`, `/api/auth/*`, `/api/entries/*` (session via connect-pg-simple), serves `client/dist` + SPA fallback
- `server/migrate.js` runs `server/migrations/NNN_*.sql` in order, tracked in `schema_migrations` — schema changes = new numbered file, never edit an applied one
- `client/src` React 19 + react-router; built by `rspack.config.mjs` (builtin swc-loader, postcss + @tailwindcss/postcss)
- Every entries query is scoped by `user_id = req.session.userId`

## Dev
- Local Postgres: `podman start pg` (container created with POSTGRES_PASSWORD=dev, POSTGRES_DB=diary on 127.0.0.1:5432) — Docker isn't installed on this laptop, Podman is
- `npm run migrate` → `npm run dev` (web :3000 proxies /api → :3101) · prod check: `npm run build && npm start`
- No HTTPS yet: cookie `secure` via `COOKIE_SECURE`; test with throwaway passwords only
