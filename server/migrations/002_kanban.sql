-- Kanban: boards → columns → cards (+ checklist items, labels)
-- Ownership is always checked through boards.user_id (labels: labels.user_id).

CREATE TABLE boards (
  id         bigserial PRIMARY KEY,
  user_id    bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       text NOT NULL,
  color      text NOT NULL DEFAULT 'stone',
  icon       text NOT NULL DEFAULT 'clipboard',
  position   int NOT NULL DEFAULT 0,
  archived   boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX boards_user_idx ON boards (user_id, position);

CREATE TABLE board_columns (
  id       bigserial PRIMARY KEY,
  board_id bigint NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  name     text NOT NULL,
  color    text NOT NULL DEFAULT 'stone',
  position int NOT NULL DEFAULT 0,
  is_done  boolean NOT NULL DEFAULT false
);
CREATE INDEX board_columns_board_idx ON board_columns (board_id, position);

CREATE TABLE cards (
  id           bigserial PRIMARY KEY,
  board_id     bigint NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  column_id    bigint NOT NULL REFERENCES board_columns(id) ON DELETE CASCADE,
  title        text NOT NULL,
  description  text NOT NULL DEFAULT '',
  due_date     date,
  due_time     time,
  priority     smallint NOT NULL DEFAULT 0 CHECK (priority BETWEEN 0 AND 3),
  color        text,
  position     int NOT NULL DEFAULT 0,
  completed_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX cards_column_idx ON cards (column_id, position);
CREATE INDEX cards_board_idx ON cards (board_id);
CREATE INDEX cards_due_idx ON cards (due_date) WHERE due_date IS NOT NULL;

CREATE TABLE card_items (
  id       bigserial PRIMARY KEY,
  card_id  bigint NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  text     text NOT NULL,
  done     boolean NOT NULL DEFAULT false,
  position int NOT NULL DEFAULT 0
);
CREATE INDEX card_items_card_idx ON card_items (card_id, position);

CREATE TABLE labels (
  id      bigserial PRIMARY KEY,
  user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name    text NOT NULL,
  color   text NOT NULL DEFAULT 'stone',
  UNIQUE (user_id, name)
);

CREATE TABLE card_labels (
  card_id  bigint NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  label_id bigint NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  PRIMARY KEY (card_id, label_id)
);
CREATE INDEX card_labels_label_idx ON card_labels (label_id);
