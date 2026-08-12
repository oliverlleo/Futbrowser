CREATE OR REPLACE FUNCTION private.match_action_skill(p_key text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $$
SELECT CASE
  WHEN p_key IN ('pen_place','pen_power','pen_wait','pen_low','sp_panenka') THEN 'penalties'
  WHEN p_key IN ('fk_curve','fk_power','sp_knuckle','sp_underwall') THEN 'free_kicks'
  WHEN p_key IN ('fk_cross','box_low_cross','wide_early_cross','wide_low_cross','sp_rabona_cross','sp_trivela_cross') THEN 'crossing'
  WHEN p_key IN ('box_finish','box_set','central_shot','sp_volley','sp_chip','sp_heel_finish','sp_trivela_finish','sp_long_knuckle','sp_bicycle_cross','sp_scissor','sp_chest_volley','sp_first_time_volley','sp_bicycle') THEN 'finishing_touch'
  WHEN p_key IN ('off_header_finish','sp_diving_header','def_aerial','sp_aerial_bicycle_clear') THEN 'heading'
  WHEN p_key IN ('box_feint','box_open','wide_line','wide_inside','build_turn','central_carry','sp_elastico','sp_nutmeg','sp_sombrero','sp_roulette','sp_roulette_mid') THEN 'dribbling'
  WHEN p_key IN ('build_diagonal','build_clear','central_switch','sp_trivela_pass') THEN 'long_pass'
  WHEN p_key IN ('fk_short','box_layoff','box_square','wide_wall','wide_recycle','build_one_touch','build_draw','central_vertical','central_wall','central_killer','central_hold','sp_heel_escape','sp_no_look','sp_backheel_link') THEN 'short_pass'
  WHEN p_key IN ('wide_burst','rec_sprint') THEN 'sprint'
  WHEN p_key IN ('build_shield') THEN 'strength'
  WHEN p_key IN ('def_tackle','def_press','def_track','rec_track','rec_foul','sp_slide_hook') THEN 'marking'
  WHEN p_key IN ('def_contain','def_lane','rec_center','rec_lane','sp_intercept_launch') THEN 'tactical_awareness'
  WHEN p_key LIKE 'off_%' OR p_key LIKE 'sup_%' OR p_key IN ('rec_high') THEN 'positioning'
  ELSE NULL END;
$$;