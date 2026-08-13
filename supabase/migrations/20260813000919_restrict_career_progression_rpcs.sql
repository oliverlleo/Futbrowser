REVOKE EXECUTE ON FUNCTION public.get_career_progression() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.spend_career_evolution_point(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_career_progression() TO authenticated;
GRANT EXECUTE ON FUNCTION public.spend_career_evolution_point(text) TO authenticated;