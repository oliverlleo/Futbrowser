BEGIN;

CREATE OR REPLACE FUNCTION private.rewrite_generic_teammate_dialogue()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_event record; v_teammate uuid; v_key text; v_template record; v_name text; v_source text;
BEGIN
  SELECT e.* INTO v_event
  FROM public.player_career_events e
  WHERE e.player_id=NEW.player_id AND e.status='pending'
    AND e.event_key IN ('teammate_locker_room','rival_training_tension')
    AND e.metadata->>'kind'='teammate_interaction'
  ORDER BY e.created_at DESC LIMIT 1;
  IF v_event.id IS NULL THEN RETURN NEW; END IF;

  v_teammate:=nullif(v_event.metadata->>'teammate_id','')::uuid;
  IF v_teammate IS NULL THEN RETURN NEW; END IF;
  v_key:=private.pick_teammate_dialogue_event(NEW.player_id,v_teammate,NEW.activity_key);
  SELECT * INTO v_template FROM private.career_event_templates WHERE event_key=v_key;
  SELECT name INTO v_name FROM public.base_ai_players WHERE id=v_teammate;
  IF v_template.event_key IS NULL THEN RETURN NEW; END IF;

  v_source:=CASE
    WHEN v_key='mate_captain_standard' THEN 'Capitão · '||coalesce(v_name,'Companheiro')
    WHEN v_key LIKE 'mate_rival_%' THEN 'Rival · '||coalesce(v_name,'Companheiro')
    ELSE 'Companheiro · '||coalesce(v_name,'Jogador do elenco')
  END;

  UPDATE public.player_career_events
  SET event_key=v_key,
      source=v_source,
      title=v_template.title,
      body=v_template.body,
      metadata=metadata||jsonb_build_object('dialogue_engine','v2','activity',NEW.activity_key,'teammate_name',v_name)
  WHERE id=v_event.id;
  RETURN NEW;
END;
$$;

COMMIT;
