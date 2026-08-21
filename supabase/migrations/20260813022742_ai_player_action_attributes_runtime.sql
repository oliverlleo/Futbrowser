INSERT INTO private.base_ai_player_attributes(ai_player_id,pace,passing,finishing,physical,vision,marking,source)
SELECT ai.id,
  private.ai_player_attribute_value(ai.id,ai.ovr,ai.primary_position,ai.archetype,'pace'),
  private.ai_player_attribute_value(ai.id,ai.ovr,ai.primary_position,ai.archetype,'passing'),
  private.ai_player_attribute_value(ai.id,ai.ovr,ai.primary_position,ai.archetype,'finishing'),
  private.ai_player_attribute_value(ai.id,ai.ovr,ai.primary_position,ai.archetype,'physical'),
  private.ai_player_attribute_value(ai.id,ai.ovr,ai.primary_position,ai.archetype,'vision'),
  private.ai_player_attribute_value(ai.id,ai.ovr,ai.primary_position,ai.archetype,'marking'),
  'generated'
FROM public.base_ai_players ai
ON CONFLICT(ai_player_id) DO NOTHING;

CREATE OR REPLACE FUNCTION private.sync_ai_player_action_attributes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  INSERT INTO private.base_ai_player_attributes(ai_player_id,pace,passing,finishing,physical,vision,marking,source,updated_at)
  VALUES(
    NEW.id,
    private.ai_player_attribute_value(NEW.id,NEW.ovr,NEW.primary_position,NEW.archetype,'pace'),
    private.ai_player_attribute_value(NEW.id,NEW.ovr,NEW.primary_position,NEW.archetype,'passing'),
    private.ai_player_attribute_value(NEW.id,NEW.ovr,NEW.primary_position,NEW.archetype,'finishing'),
    private.ai_player_attribute_value(NEW.id,NEW.ovr,NEW.primary_position,NEW.archetype,'physical'),
    private.ai_player_attribute_value(NEW.id,NEW.ovr,NEW.primary_position,NEW.archetype,'vision'),
    private.ai_player_attribute_value(NEW.id,NEW.ovr,NEW.primary_position,NEW.archetype,'marking'),
    'generated',now()
  )
  ON CONFLICT(ai_player_id) DO UPDATE SET
    pace=EXCLUDED.pace,passing=EXCLUDED.passing,finishing=EXCLUDED.finishing,
    physical=EXCLUDED.physical,vision=EXCLUDED.vision,marking=EXCLUDED.marking,updated_at=now()
  WHERE private.base_ai_player_attributes.source='generated';
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_ai_player_action_attributes ON public.base_ai_players;
CREATE TRIGGER trg_sync_ai_player_action_attributes
AFTER INSERT OR UPDATE OF ovr,primary_position,archetype ON public.base_ai_players
FOR EACH ROW EXECUTE FUNCTION private.sync_ai_player_action_attributes();

CREATE OR REPLACE FUNCTION private.ai_player_attributes_json(p_ai_player_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT coalesce((
    SELECT jsonb_build_object(
      'Velocidade',a.pace,'Passe',a.passing,'Finalização',a.finishing,
      'Físico',a.physical,'Visão de jogo',a.vision,'Marcação',a.marking
    ) FROM private.base_ai_player_attributes a WHERE a.ai_player_id=p_ai_player_id
  ),'{}'::jsonb);
$function$;