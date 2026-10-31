require("dotenv").config({ quiet: true });
const path = require("node:path");
const express = require("express");
const helmet = require("helmet");
const session = require("express-session");
const PgStore = require("connect-pg-simple")(session);
const { pool } = require("./db");
const requireAuth = require("./middleware/requireAuth");

if (!process.env.SESSION_SECRET) {
  console.error("SESSION_SECRET is not set (see .env.example)");
  process.exit(1);
}

const PORT = Number(process.env.PORT) || 3101;
const DIST = path.join(__dirname, "..", "client", "dist");

const app = express();
app.set("trust proxy", 1); // behind Nginx
app.disable("x-powered-by");

app.use(
  helmet({
    // No HTTPS yet: don't force https upgrades / HSTS on the sslip.io http URL.
    contentSecurityPolicy: {
      directives: { upgradeInsecureRequests: null },
    },
    strictTransportSecurity: process.env.COOKIE_SECURE === "true",
  })
);
app.use(express.json({ limit: "1mb" }));

// Health check for Uptime Kuma (no session needed)
app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, db: true });
  } catch (err) {
    console.error("[health] db check failed:", err.message);
    res.status(503).json({ ok: false, db: false });
  }
});

app.use(
  "/api",
  session({
    name: "diary.sid",
    store: new PgStore({ pool, tableName: "session" }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.COOKIE_SECURE === "true",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    },
  })
);

app.use("/api/auth", require("./routes/auth"));
app.use("/api/entries", requireAuth, require("./routes/entries"));
app.use("/api/stats", requireAuth, require("./routes/stats"));
app.use("/api/export", requireAuth, require("./routes/export"));
app.use("/api/boards", requireAuth, require("./routes/boards"));
app.use("/api", (req, res) => res.status(404).json({ error: "not found" }));

// React build: hashed assets get long cache, index.html never cached
app.use(
  express.static(DIST, {
    index: false,
    setHeaders(res, filePath) {
      if (/\.[0-9a-f]{8,}\.(js|css)$/.test(filePath)) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      }
    },
  })
);
app.get(/^(?!\/api(\/|$)).*/, (req, res, next) => {
  res.setHeader("Cache-Control", "no-cache");
  res.sendFile(path.join(DIST, "index.html"), (err) => {
    if (err) next(err);
  });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") return res.status(400).json({ error: "invalid JSON" });
  if (req.path.startsWith("/api/") && err.status >= 400 && err.status < 500) {
    // Deliberate 4xx thrown from a route (e.g. 409 stale reorder) or body-parser (413 too large)
    return res.status(err.status).json({ error: err.expose === false ? "bad request" : err.message });
  }
  if (err.status === 404 || err.code === "ENOENT") {
    return res.status(404).send("Not found (did you run `npm run build`?)");
  }
  console.error("[error]", req.method, req.originalUrl, err);
  res.status(500).json({ error: "internal error" });
});

// Express 5 passes listen errors (e.g. EADDRINUSE) to this callback
const server = app.listen(PORT, (err) => {
  if (err) {
    console.error(`[diary] cannot listen on :${PORT}: ${err.message}`);
    process.exit(1);
  }
  console.log(`[diary] listening on :${PORT} (${process.env.NODE_ENV || "development"})`);
});

// Graceful shutdown for pm2 reload
function shutdown(signal) {
  console.log(`[diary] ${signal} received, shutting down`);
  server.close(() => pool.end().finally(() => process.exit(0)));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
