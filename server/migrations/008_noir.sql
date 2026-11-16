-- Noir theme ("บันทึกหลังเที่ยงคืน"): per-entry atmosphere / weather / temperature / photo caption,
-- and the appearance object shrinks to { accent?, size? } (old presets and fonts don't apply any more).
ALTER TABLE entries
  ADD COLUMN atmosphere text CHECK (atmosphere IN ('hot', 'calm', 'warm')),
  ADD COLUMN weather    text CHECK (weather IN ('clear', 'cloudy', 'drizzle', 'rain', 'storm', 'fog', 'hot', 'cold')),
  ADD COLUMN temp_c     smallint CHECK (temp_c BETWEEN -30 AND 60),
  ADD COLUMN caption    text CHECK (char_length(caption) <= 120);

UPDATE users
SET appearance = CASE WHEN appearance ? 'size' THEN jsonb_build_object('size', appearance->'size') ELSE '{}'::jsonb END;
