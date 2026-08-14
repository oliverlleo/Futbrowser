revoke all privileges on table public.player_market_interests from authenticated, anon;

grant execute on function public.get_career_market_dashboard() to authenticated;
grant execute on function public.set_career_club_interest(uuid,boolean) to authenticated;
