-- Per-account look: color preset or custom colors (light + night), fonts, text size.
-- Validated in server/appearance.js; '{}' means the default design.
ALTER TABLE users ADD COLUMN appearance jsonb NOT NULL DEFAULT '{}';
