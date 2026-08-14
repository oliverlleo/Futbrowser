UPDATE public.competition_definitions
SET is_active=false,
    rules=coalesce(rules,'{}'::jsonb)||jsonb_build_object('official_cbf',false,'disabled_reason','No national U15 league in CBF 2026 calendar')
WHERE code='ACA_U15_LEAGUE';

UPDATE public.competition_definitions
SET name='Copa do Brasil Masculina Sub-15',short_name='Copa do Brasil Sub-15',
    rules=coalesce(rules,'{}'::jsonb)||jsonb_build_object('official_cbf',true,'scope','national','season',2026)
WHERE code='ACA_U15_CUP';

UPDATE public.competition_definitions
SET name='Brasileirão Sub-17',short_name='Brasileirão Sub-17',
    rules=coalesce(rules,'{}'::jsonb)||jsonb_build_object('official_cbf',true,'scope','national','season',2026)
WHERE code='ACA_U17_LEAGUE';

UPDATE public.competition_definitions
SET name='Copa do Brasil Sub-17',short_name='Copa do Brasil Sub-17',
    rules=coalesce(rules,'{}'::jsonb)||jsonb_build_object('official_cbf',true,'scope','national','season',2026)
WHERE code='ACA_U17_CUP';

UPDATE public.competition_definitions
SET name='Circuito Interno de Desenvolvimento Sub-18',short_name='Desenvolvimento Sub-18',
    rules=coalesce(rules,'{}'::jsonb)||jsonb_build_object('official_cbf',false,'scope','internal_development','national',false,'development_only',true)
WHERE code='ACA_U18_LEAGUE';

UPDATE public.competition_definitions
SET is_active=false,
    rules=coalesce(rules,'{}'::jsonb)||jsonb_build_object('official_cbf',false,'disabled_reason','U18 is internal development, not a fictional national cup')
WHERE code='ACA_U18_CUP';

UPDATE public.competition_definitions
SET name='Brasileirão Série A Sub-20',short_name='Brasileirão Sub-20',
    rules=coalesce(rules,'{}'::jsonb)||jsonb_build_object('official_cbf',true,'scope','national','season',2026)
WHERE code='ACA_U20_LEAGUE';

UPDATE public.competition_definitions
SET name='Copa do Brasil Sub-20',short_name='Copa do Brasil Sub-20',
    rules=coalesce(rules,'{}'::jsonb)||jsonb_build_object('official_cbf',true,'scope','national','season',2026)
WHERE code='ACA_U20_CUP';
