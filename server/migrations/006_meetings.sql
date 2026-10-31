-- Meetings: recurring series with per-occurrence exceptions, notes and action items

CREATE TABLE meetings (
  id             bigserial PRIMARY KEY,
  user_id        bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title          text NOT NULL,
  date           date NOT NULL,                     -- first occurrence
  start_time     time NOT NULL,
  end_time       time NOT NULL,
  repeat         text NOT NULL DEFAULT 'none'
                 CHECK (repeat IN ('none', 'daily', 'weekdays', 'weekly', 'biweekly', 'monthly')),
  weekdays       smallint[] NOT NULL DEFAULT '{}',  -- ISO 1=Mon..7=Sun (weekly / biweekly)
  repeat_until   date,
  location       text NOT NULL DEFAULT '',
  url            text NOT NULL DEFAULT '',
  color          text NOT NULL DEFAULT 'indigo',
  agenda         text NOT NULL DEFAULT '',
  remind_minutes int CHECK (remind_minutes BETWEEN 0 AND 1440), -- null = user default
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (end_time > start_time),
  CHECK (repeat_until IS NULL OR repeat_until >= date)
);
CREATE INDEX meetings_user_idx ON meetings (user_id);

CREATE TABLE meeting_labels (
  meeting_id bigint NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  label_id   bigint NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  PRIMARY KEY (meeting_id, label_id)
);

-- One row per changed occurrence, keyed by its ORIGINAL date
CREATE TABLE meeting_exceptions (
  meeting_id bigint NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  date       date NOT NULL,
  cancelled  boolean NOT NULL DEFAULT false,
  new_date   date,
  new_start  time,
  new_end    time,
  PRIMARY KEY (meeting_id, date),
  CHECK (cancelled OR (new_date IS NOT NULL AND new_start IS NOT NULL AND new_end IS NOT NULL AND new_end > new_start))
);
CREATE INDEX meeting_exceptions_new_date_idx ON meeting_exceptions (new_date) WHERE new_date IS NOT NULL;

CREATE TABLE meeting_notes (
  meeting_id bigint NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  date       date NOT NULL,                       -- original occurrence date
  notes      text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (meeting_id, date)
);

CREATE TABLE meeting_actions (
  id         bigserial PRIMARY KEY,
  meeting_id bigint NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  date       date NOT NULL,                       -- original occurrence date
  text       text NOT NULL,
  done       boolean NOT NULL DEFAULT false,
  card_id    bigint REFERENCES cards(id) ON DELETE SET NULL,
  position   int NOT NULL DEFAULT 0
);
CREATE INDEX meeting_actions_occ_idx ON meeting_actions (meeting_id, date, position);

ALTER TABLE users
  ADD COLUMN tg_meeting_minutes int NOT NULL DEFAULT 10 CHECK (tg_meeting_minutes BETWEEN 0 AND 1440),
  ADD COLUMN ics_meetings boolean NOT NULL DEFAULT true;
