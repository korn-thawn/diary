-- Important dates, recurring cards, ICS feed settings

CREATE TABLE events (
  id         bigserial PRIMARY KEY,
  user_id    bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      text NOT NULL,
  date       date NOT NULL,              -- first occurrence (e.g. the real birth date)
  repeat     text NOT NULL DEFAULT 'none' CHECK (repeat IN ('none', 'monthly', 'yearly')),
  time       time,
  color      text NOT NULL DEFAULT 'rose',
  icon       text NOT NULL DEFAULT 'star',
  note       text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX events_user_idx ON events (user_id);

ALTER TABLE cards
  ADD COLUMN recurrence text CHECK (recurrence IN ('daily', 'weekly', 'monthly', 'yearly')),
  ADD COLUMN next_card_id bigint REFERENCES cards(id) ON DELETE SET NULL;

ALTER TABLE users
  ADD COLUMN ics_token text UNIQUE,
  ADD COLUMN ics_cards boolean NOT NULL DEFAULT true,
  ADD COLUMN ics_events boolean NOT NULL DEFAULT true;
