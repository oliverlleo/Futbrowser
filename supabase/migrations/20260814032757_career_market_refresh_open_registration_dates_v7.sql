UPDATE public.player_offers po
SET effective_on=CASE
  WHEN po.offer_type='professional_transfer' OR po.target_squad_level='first_team'
    THEN private.career_next_registration_date(st.career_date)
  WHEN po.offer_type='academy_transfer'
    THEN st.career_date
  ELSE po.effective_on
END
FROM public.player_career_state st
WHERE st.player_id=po.player_id
  AND po.offer_type IN('academy_transfer','professional_transfer')
  AND po.status IN('new','reviewed','negotiating','countered');
