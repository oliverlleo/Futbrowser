create or replace function private.refresh_career_market_interest_records(p_player uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_day date; v_age int; v_stage text; v_current uuid; v_family text; v_target_squad text;
  cand record; v_target uuid; v_fit jsonb; v_fit_score int; v_old record; v_score int; v_stage_name text; v_created int:=0; v_reviewed int:=0;
  v_declared boolean; v_active_bid uuid; v_active_offer uuid;
begin
  select st.career_date,j.idade,st.career_stage,st.club_id,c.family_code into v_day,v_age,v_stage,v_current,v_family
  from public.jogadores j join public.player_career_state st on st.player_id=j.id left join public.base_clubs c on c.id=st.club_id where j.id=p_player;
  if v_day is null then return jsonb_build_object('reviewed',0,'created',0); end if;
  v_target_squad:=private.career_market_target_squad(p_player);

  for cand in
    select c.* from public.base_clubs c
    where c.is_active and c.family_code is distinct from v_family and (
      (v_stage<>'professional' and c.club_level='academy' and c.squad_level='base')
      or (v_age>=16 and c.club_level='professional' and c.squad_level='first_team')
    )
    order by c.reputation desc,c.name
  loop
    if cand.club_level='academy' then
      select id into v_target from public.base_clubs where family_code=cand.family_code and club_level='academy' and squad_level=v_target_squad and is_active limit 1;
      if v_target is null then continue; end if;
    else v_target:=cand.id; end if;
    v_fit:=private.career_market_fit(p_player,v_target);
    v_fit_score:=coalesce((v_fit->>'compatibility_score')::int,0);
    select * into v_old from public.player_market_interests where player_id=p_player and club_family_code=cand.family_code and market_path=case when cand.club_level='professional' then 'professional' else 'academy' end;
    v_declared:=coalesce(v_old.player_interest_status='declared',false);
    if v_old.id is null and not v_declared and (v_fit_score<50 or random()>least(.62,greatest(.10,(v_fit_score-38)/70.0))) then continue; end if;

    v_score:=case when v_old.id is null then greatest(25,least(94,v_fit_score-6+floor(random()*9)::int)) else greatest(15,least(97,round(v_old.club_interest_score*.62+v_fit_score*.38)::int)) end;
    if v_declared then v_score:=least(97,v_score+case when coalesce(v_old.player_interest_declared_on,v_day)>v_day-21 then 5 else 3 end); end if;

    select b.id into v_active_bid from public.player_transfer_bids b join public.base_clubs bc on bc.id=b.target_club_id
    where b.player_id=p_player and bc.family_code=cand.family_code and b.bid_kind=case when cand.club_level='professional' then 'professional_transfer' else 'academy_transfer' end
      and b.status in('pending','countered','accepted') and b.expires_on>=v_day order by b.created_at desc limit 1;
    select o.id into v_active_offer from public.player_offers o join public.base_clubs bc on bc.id=o.club_id
    where o.player_id=p_player and bc.family_code=cand.family_code and o.offer_type=case when cand.club_level='professional' then 'professional_transfer' else 'academy_transfer' end
      and o.status in('new','reviewed','negotiating','countered') order by o.created_at desc limit 1;

    v_stage_name:=case when v_active_offer is not null then 'proposal' when v_active_bid is not null then 'negotiating'
      when v_score>=85 then 'inquiry' when v_score>=74 then 'strong' when v_score>=62 then 'interested' when v_score>=50 then 'watching' else 'none' end;

    insert into public.player_market_interests(player_id,club_family_code,market_path,target_club_id,target_squad_level,club_interest_score,club_interest_stage,club_interest_reason,compatibility_score,fit_breakdown,first_seen_on,last_review_on,last_action_on,last_bid_id,last_offer_id,is_visible)
    values(p_player,cand.family_code,case when cand.club_level='professional' then 'professional' else 'academy' end,v_target,case when cand.club_level='professional' then 'first_team' else v_target_squad end,v_score,v_stage_name,v_fit->>'reason',v_fit_score,v_fit,v_day,v_day,v_day,v_active_bid,v_active_offer,v_stage_name not in('none','cooling'))
    on conflict(player_id,club_family_code,market_path) do update set
      target_club_id=excluded.target_club_id,target_squad_level=excluded.target_squad_level,club_interest_score=excluded.club_interest_score,
      club_interest_stage=excluded.club_interest_stage,club_interest_reason=excluded.club_interest_reason,compatibility_score=excluded.compatibility_score,
      fit_breakdown=excluded.fit_breakdown,first_seen_on=coalesce(public.player_market_interests.first_seen_on,excluded.first_seen_on),last_review_on=excluded.last_review_on,
      last_action_on=case when public.player_market_interests.club_interest_stage is distinct from excluded.club_interest_stage then excluded.last_action_on else public.player_market_interests.last_action_on end,
      last_bid_id=coalesce(excluded.last_bid_id,public.player_market_interests.last_bid_id),last_offer_id=coalesce(excluded.last_offer_id,public.player_market_interests.last_offer_id),
      is_visible=excluded.is_visible,updated_at=now();
    if v_old.id is null then v_created:=v_created+1; end if; v_reviewed:=v_reviewed+1;
  end loop;

  update public.player_market_interests mi set club_interest_stage='cooling',is_visible=false,updated_at=now()
  where mi.player_id=p_player and mi.player_interest_status<>'declared' and coalesce(mi.last_review_on,v_day-30)<v_day-14
    and mi.club_interest_stage not in('proposal','agreement','negotiating');

  with ranked as (
    select id,row_number() over(order by club_interest_score desc,compatibility_score desc,updated_at desc) rn
    from public.player_market_interests where player_id=p_player and is_visible and player_interest_status<>'declared' and club_interest_stage in('watching','interested','strong','inquiry')
  )
  update public.player_market_interests mi set is_visible=false where mi.id in(select id from ranked where rn>6);
  return jsonb_build_object('reviewed',v_reviewed,'created',v_created);
end
$function$;

revoke select on public.player_market_interests from authenticated;

update public.player_market_interests mi
set first_seen_on=coalesce(mi.first_seen_on,mi.last_review_on,pcs.career_date),updated_at=now()
from public.player_career_state pcs
where pcs.player_id=mi.player_id and mi.club_interest_stage in('watching','interested','strong','inquiry','negotiating','proposal','agreement') and mi.first_seen_on is null;
