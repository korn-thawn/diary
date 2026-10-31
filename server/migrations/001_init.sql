CREATE TABLE users (
  id            bigserial PRIMARY KEY,
  username      text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE entries (
  id         bigserial PRIMARY KEY,
  user_id    bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entry_date date NOT NULL DEFAULT current_date,
  title      text NOT NULL DEFAULT '',
  body       text NOT NULL,
  mood       smallint CHECK (mood BETWEEN 1 AND 5),
  tags       text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX entries_user_date_idx ON entries (user_id, entry_date DESC, id DESC);
CREATE INDEX entries_tags_idx ON entries USING gin (tags);

-- Session store for connect-pg-simple (its standard table.sql)
CREATE TABLE "session" (
  "sid"    varchar NOT NULL COLLATE "default" PRIMARY KEY,
  "sess"   json NOT NULL,
  "expire" timestamp(6) NOT NULL
);
CREATE INDEX "IDX_session_expire" ON "session" ("expire");
