BEGIN;

-- Forma deixa de ser um prêmio automático de todo treino individual.
-- Treino desenvolve habilidade/preparação; forma deve depender muito mais da sequência esportiva.
UPDATE private.career_activity_catalog
SET form_delta=0
WHERE category='training' OR activity_key='watch_match_analysis';

CREATE OR REPLACE FUNCTION private.after_activity_relationship_depth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_count integer;
  v_relation_gain integer;
  v_chemistry_gain integer;
  v_row record;
BEGIN
  IF NEW.activity_key NOT IN ('team_hangout','teammate_extra') THEN RETURN NEW; END IF;
  PERFORM private.ensure_teammate_relations(NEW.player_id);

  IF NEW.activity_key='team_hangout' THEN
    v_count:=2;
    v_relation_gain:=4;
    v_chemistry_gain:=3;
  ELSE
    v_count:=1;
    v_relation_gain:=5;
    v_chemistry_gain:=4;
  END IF;

  FOR v_row IN
    SELECT r.teammate_id
    FROM public.player_teammate_relations r
    JOIN public.base_ai_players ai ON ai.id=r.teammate_id
    JOIN public.jogadores j ON j.id=r.player_id
    WHERE r.player_id=NEW.player_id
    ORDER BY
      CASE WHEN NEW.activity_key='teammate_extra' AND ai.primary_position=j.posicao THEN 0 ELSE 1 END,
      random()
    LIMIT v_count
  LOOP
    UPDATE public.player_teammate_relations
    SET relation=private.career_clamp(relation+v_relation_gain),
        chemistry=private.career_clamp(chemistry+v_chemistry_gain),
        rivalry=CASE WHEN relation+v_relation_gain>=45 THEN false ELSE rivalry END,
        updated_at=now()
    WHERE player_id=NEW.player_id AND teammate_id=v_row.teammate_id;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_after_activity_relationship_depth ON public.player_career_actions;
CREATE TRIGGER trg_after_activity_relationship_depth
AFTER INSERT ON public.player_career_actions
FOR EACH ROW
EXECUTE FUNCTION private.after_activity_relationship_depth();

COMMIT;
