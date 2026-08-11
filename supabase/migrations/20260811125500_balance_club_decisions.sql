BEGIN;

-- Every academy gets the same total development budget (15 points).
-- What changes is the specialization, not the amount of raw advantage.
UPDATE public.base_academy_profiles a
SET physical = v.physical,
    speed = v.speed,
    technical = v.technical,
    recovery = v.recovery,
    tactical = v.tactical
FROM (
  VALUES
    ('Academia Aurora Sub-18', 1, 3, 5, 2, 4),
    ('Atlético do Vale Sub-18', 5, 4, 2, 1, 3),
    ('Ferroviário Central Sub-18', 3, 2, 1, 5, 4),
    ('Real Horizonte Sub-18', 4, 3, 2, 1, 5),
    ('União Litorânea Sub-18', 2, 5, 4, 3, 1)
) AS v(club_name, physical, speed, technical, recovery, tactical)
JOIN public.base_clubs c ON c.name = v.club_name
WHERE a.club_id = c.id;

-- One clear upside + one clear downside per coach.
-- Preferred style/archetype/formation stay as fit inputs, but are not extra stat bonuses.
UPDATE public.base_coaches
SET impacts = CASE name
  WHEN 'Henrique Paiva' THEN jsonb_build_object(
    'preferred_style', 'Posse de bola',
    'preferred_archetype', 'Criador',
    'preferred_formation', '4-3-3',
    'tolerance_to_bad_games', 'low',
    'technical_evolution_bonus', 12,
    'physical_evolution_penalty', -5
  )
  WHEN 'Marcelo Ferraz' THEN jsonb_build_object(
    'preferred_style', 'Ofensivo',
    'preferred_archetype', 'Finalizador',
    'preferred_formation', '4-3-3',
    'tolerance_to_bad_games', 'low',
    'general_evolution_bonus', 8,
    'morale_penalty_on_failure', -12
  )
  WHEN 'Sérgio Almeida' THEN jsonb_build_object(
    'preferred_style', 'Equilibrado',
    'preferred_archetype', 'Raçudo',
    'preferred_formation', '4-4-2',
    'tolerance_to_bad_games', 'medium',
    'tactical_evolution_bonus', 15,
    'creative_freedom_penalty', -8
  )
  WHEN 'Eduardo Braga' THEN jsonb_build_object(
    'preferred_style', 'Pelas alas',
    'preferred_archetype', 'Driblador',
    'preferred_formation', '4-2-3-1',
    'tolerance_to_bad_games', 'medium',
    'general_evolution_bonus', 6,
    'physical_evolution_penalty', -2
  )
  WHEN 'Bruno Salles' THEN jsonb_build_object(
    'preferred_style', 'Contra-ataque',
    'preferred_archetype', 'Driblador',
    'preferred_formation', '4-4-2',
    'tolerance_to_bad_games', 'high',
    'morale_initial_bonus', 8,
    'technical_evolution_bonus', -3
  )
  ELSE impacts
END
WHERE name IN ('Henrique Paiva', 'Marcelo Ferraz', 'Sérgio Almeida', 'Eduardo Braga', 'Bruno Salles');

COMMIT;
