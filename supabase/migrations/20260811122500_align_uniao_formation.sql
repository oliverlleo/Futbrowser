-- O elenco da União Litorânea foi gerado para 4-4-2 (meias abertos + 2 atacantes).
-- Alinha formação, treinador, titulares e recalcula as ofertas sem alterar a interface.

UPDATE public.base_clubs
SET formation = '4-4-2'
WHERE name = 'União Litorânea Sub-18';

UPDATE public.base_coaches
SET impacts = jsonb_set(impacts, '{preferred_formation}', '"4-4-2"'::jsonb, true)
WHERE name = 'Bruno Salles';

WITH ranked AS (
  SELECT
    p.id,
    ROW_NUMBER() OVER (
      PARTITION BY p.club_id, p.primary_position
      ORDER BY p.ovr DESC, p.id
    ) AS rn,
    private.formation_slots(c.formation, p.primary_position) AS slots
  FROM public.base_ai_players p
  JOIN public.base_clubs c ON c.id = p.club_id
)
UPDATE public.base_ai_players p
SET is_starter = (ranked.slots > 0 AND ranked.rn <= ranked.slots)
FROM ranked
WHERE ranked.id = p.id;

DO $$
DECLARE
  v_offer RECORD;
  v_context JSONB;
BEGIN
  FOR v_offer IN
    SELECT po.id, po.player_id, po.club_id
    FROM public.player_offers po
    JOIN public.base_clubs c ON c.id = po.club_id
    WHERE po.status IN ('new', 'reviewed', 'negotiating', 'countered')
      AND po.is_emergency = false
      AND c.name = 'União Litorânea Sub-18'
  LOOP
    v_context := private.build_offer_context(v_offer.player_id, v_offer.club_id);
    UPDATE public.player_offers
    SET compatibility_breakdown = v_context->'compatibility_breakdown',
        snapshot_data = v_context->'snapshot_data',
        internal_tolerance = CASE
          WHEN round = 0 THEN (v_context->>'internal_tolerance')::INT
          ELSE internal_tolerance
        END
    WHERE id = v_offer.id;
  END LOOP;
END;
$$;
