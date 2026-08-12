BEGIN;

-- A season row is created before its fixtures are generated. The final end date
-- is filled immediately after schedule generation, so it must be nullable during
-- that short bootstrap window.
ALTER TABLE public.career_competition_seasons
  ALTER COLUMN ends_on DROP NOT NULL;

COMMIT;
