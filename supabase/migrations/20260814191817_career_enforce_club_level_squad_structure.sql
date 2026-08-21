ALTER TABLE public.base_clubs
  DROP CONSTRAINT IF EXISTS base_clubs_squad_level_check;

ALTER TABLE public.base_clubs
  ADD CONSTRAINT base_clubs_squad_level_check
  CHECK(
    (club_level='academy' AND squad_level IN('base','u15','u17','u18','u20'))
    OR
    (club_level='professional' AND squad_level='first_team')
  );

ALTER TABLE public.base_clubs
  DROP CONSTRAINT IF EXISTS base_clubs_academy_link_shape_check;

ALTER TABLE public.base_clubs
  ADD CONSTRAINT base_clubs_academy_link_shape_check
  CHECK(
    club_level='professional'
    OR (squad_level='base' AND academy_base_id=id)
    OR (squad_level IN('u15','u17','u18','u20') AND academy_base_id IS NOT NULL AND academy_base_id<>id)
  );