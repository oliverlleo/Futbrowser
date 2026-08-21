BEGIN;

DO $$
DECLARE
  r record;
  v_teammate uuid;
  v_name text;
  v_key text;
  v_template record;
  v_choices jsonb;
  v_source text;
BEGIN
  FOR r IN
    SELECT *
    FROM public.player_career_events
    WHERE status='pending'
      AND event_key IN ('teammate_locker_room','rival_training_tension')
      AND metadata->>'kind'='teammate_interaction'
    ORDER BY created_at
  LOOP
    v_teammate:=nullif(r.metadata->>'teammate_id','')::uuid;
    IF v_teammate IS NULL THEN CONTINUE; END IF;

    v_key:=private.pick_teammate_dialogue_event(r.player_id,v_teammate,'existing_interaction');
    SELECT * INTO v_template FROM private.career_event_templates WHERE event_key=v_key;
    IF v_template.event_key IS NULL THEN CONTINUE; END IF;
    SELECT name INTO v_name FROM public.base_ai_players WHERE id=v_teammate;

    SELECT coalesce(jsonb_agg(jsonb_build_object('key',e->>'key','label',e->>'label')),'[]'::jsonb)
    INTO v_choices
    FROM jsonb_array_elements(v_template.choices)e;

    v_source:=CASE
      WHEN v_key='mate_captain_standard' THEN 'Companheiro experiente · '||coalesce(v_name,'Jogador do elenco')
      WHEN v_key LIKE 'mate_rival_%' THEN 'Rival · '||coalesce(v_name,'Companheiro')
      ELSE 'Companheiro · '||coalesce(v_name,'Jogador do elenco')
    END;

    UPDATE public.player_career_events
    SET event_key=v_key,
        source=v_source,
        title=v_template.title,
        body=v_template.body,
        choices=v_choices,
        metadata=metadata||jsonb_build_object('dialogue_engine','v3','upgraded_pending',true,'teammate_name',v_name)
    WHERE id=r.id;
  END LOOP;
END $$;

COMMIT;
