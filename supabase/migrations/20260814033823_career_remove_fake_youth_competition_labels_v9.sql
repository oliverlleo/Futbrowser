UPDATE public.competition_definitions
SET name='Sem liga nacional Sub-15',short_name='Sem liga nacional Sub-15',
    rules=coalesce(rules,'{}'::jsonb)||jsonb_build_object('official_cbf',false,'scope','inactive_reference','national',false)
WHERE code='ACA_U15_LEAGUE' AND is_active=false;

UPDATE public.competition_definitions
SET name='Sem copa nacional Sub-18',short_name='Sem copa nacional Sub-18',
    rules=coalesce(rules,'{}'::jsonb)||jsonb_build_object('official_cbf',false,'scope','inactive_reference','national',false,'development_only',true)
WHERE code='ACA_U18_CUP' AND is_active=false;
