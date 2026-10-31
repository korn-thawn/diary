-- Telegram reminders: per-user chat link + notification settings, and a sent-log for de-duplication

ALTER TABLE users
  ADD COLUMN tg_chat_id      bigint UNIQUE,
  ADD COLUMN tg_link_code    text UNIQUE,
  ADD COLUMN tg_link_expires timestamptz,
  ADD COLUMN tg_daily        boolean NOT NULL DEFAULT true,
  ADD COLUMN tg_daily_time   time    NOT NULL DEFAULT '07:00',
  ADD COLUMN tg_event_days   int[]   NOT NULL DEFAULT '{7,1}',
  ADD COLUMN tg_card_minutes int     NOT NULL DEFAULT 30 CHECK (tg_card_minutes BETWEEN 0 AND 1440),
  ADD COLUMN tg_diary        boolean NOT NULL DEFAULT false,
  ADD COLUMN tg_diary_time   time    NOT NULL DEFAULT '21:00';

-- One row per notification actually claimed for sending (kind + ref is unique per user)
CREATE TABLE notifications_sent (
  user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind    text NOT NULL,
  ref     text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, kind, ref)
);
CREATE INDEX notifications_sent_at_idx ON notifications_sent (sent_at);
