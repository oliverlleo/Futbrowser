CREATE OR REPLACE FUNCTION private.career_match_load(p_minutes integer, p_started boolean, p_metadata jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO ''
AS $function$
DECLARE
 v_ps jsonb:=coalesce(p_metadata->'player_stats','{}'::jsonb);
 v_minutes int:=greatest(0,coalesce(p_minutes,0));
 v_actions numeric;
 v_end_energy numeric;
 v_intensity numeric;
 v_energy_loss int;
 v_fatigue_gain int;
 v_label text;
 v_recovery int;
 v_light numeric:=coalesce((v_ps->'intensity_minutes'->>'light')::numeric,0);
 v_moderate numeric:=coalesce((v_ps->'intensity_minutes'->>'moderate')::numeric,0);
 v_intense numeric:=coalesce((v_ps->'intensity_minutes'->>'intense')::numeric,0);
 v_mode_total numeric;
 v_mode_factor numeric:=1;
 v_action_energy numeric:=coalesce((v_ps->>'energy_spent_actions')::numeric,0);
 v_decisions numeric:=coalesce((v_ps->>'decision_count')::numeric,0);
BEGIN
 IF v_minutes<=0 THEN
  RETURN jsonb_build_object('label','Sem carga','intensity',0,'energy_loss',0,'fatigue_gain',0,'recovery_days',0,'minutes',0,'physical_actions',0,'end_match_energy',NULL,'intensity_profile',jsonb_build_object('light',0,'moderate',0,'intense',0));
 END IF;

 v_mode_total:=v_light+v_moderate+v_intense;
 IF v_mode_total>0 THEN
  v_mode_factor:=least(1.12,greatest(.88,(v_light*.88+v_moderate+v_intense*1.12)/v_mode_total));
 END IF;

 v_actions:=coalesce((v_ps->>'high_intensity_actions')::numeric,0)*1.5
  +coalesce((v_ps->>'physical_actions')::numeric,0)
  +coalesce((v_ps->>'duelsWon')::numeric,0)
  +coalesce((v_ps->>'duelsLost')::numeric,0)
  +coalesce((v_ps->>'dribblesAttempted')::numeric,0)*.7
  +coalesce((v_ps->>'shots')::numeric,0)*1.2
  +least(35,v_action_energy*.22)
  +least(10,v_decisions*.18);

 v_end_energy:=coalesce((v_ps->>'end_match_energy')::numeric,coalesce((p_metadata->>'end_match_energy')::numeric,65));
 v_intensity:=least(1.65,greatest(.55,(.42+(v_minutes/150.0)+(v_actions/85.0)+((100-least(100,greatest(0,v_end_energy)))/210.0)+CASE WHEN p_started THEN .06 ELSE 0 END)*v_mode_factor));
 v_energy_loss:=greatest(CASE WHEN v_minutes>0 THEN 5 ELSE 0 END,least(34,round((4+v_minutes*.105)*v_intensity)::int));
 v_fatigue_gain:=greatest(CASE WHEN v_minutes>0 THEN 3 ELSE 0 END,least(30,round((3+v_minutes*.082)*v_intensity)::int));
 v_label:=CASE WHEN v_intensity>=1.35 THEN 'Muito desgastante' WHEN v_intensity>=1.12 THEN 'Desgastante' WHEN v_intensity>=.88 THEN 'Moderada' ELSE 'Leve' END;
 v_recovery:=CASE WHEN v_intensity>=1.35 THEN 3 WHEN v_intensity>=1.05 THEN 2 ELSE 1 END;

 RETURN jsonb_build_object(
  'label',v_label,
  'intensity',round(v_intensity,2),
  'energy_loss',v_energy_loss,
  'fatigue_gain',v_fatigue_gain,
  'recovery_days',v_recovery,
  'minutes',v_minutes,
  'physical_actions',round(v_actions),
  'end_match_energy',round(v_end_energy),
  'intensity_profile',jsonb_build_object('light',round(v_light),'moderate',round(v_moderate),'intense',round(v_intense)),
  'action_energy_spent',round(v_action_energy),
  'decision_count',round(v_decisions)
 );
END
$function$;
