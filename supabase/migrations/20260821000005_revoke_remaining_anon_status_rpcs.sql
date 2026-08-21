REVOKE EXECUTE ON FUNCTION public.get_career_preparation_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_career_preparation_status() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_career_promotion_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_career_promotion_status() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_career_sponsorship_state() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_career_sponsorship_state() TO authenticated;
