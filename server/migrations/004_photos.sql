-- Photos attached to diary entries or kanban cards, stored in Postgres
-- (covered by the daily pg_dumpall + off-site backup; no files on disk).

CREATE TABLE photos (
  id         bigserial PRIMARY KEY,
  user_id    bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entry_id   bigint REFERENCES entries(id) ON DELETE CASCADE,
  card_id    bigint REFERENCES cards(id) ON DELETE CASCADE,
  mime       text NOT NULL CHECK (mime IN ('image/webp', 'image/jpeg')),
  width      int NOT NULL CHECK (width BETWEEN 1 AND 4096),
  height     int NOT NULL CHECK (height BETWEEN 1 AND 4096),
  bytes      int NOT NULL,
  data       bytea NOT NULL,
  thumb      bytea NOT NULL,
  thumb_mime text NOT NULL CHECK (thumb_mime IN ('image/webp', 'image/jpeg')),
  position   int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((entry_id IS NULL) <> (card_id IS NULL))
);
CREATE INDEX photos_entry_idx ON photos (entry_id, position) WHERE entry_id IS NOT NULL;
CREATE INDEX photos_card_idx ON photos (card_id, position) WHERE card_id IS NOT NULL;
CREATE INDEX photos_user_idx ON photos (user_id);
