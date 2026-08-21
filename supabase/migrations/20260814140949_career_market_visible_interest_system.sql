create table if not exists public.player_market_interests (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.jogadores(id) on delete cascade,
  club_family_code text not null,
  market_path text not null check (market_path in ('academy','professional')),
  target_club_id uuid not null references public.base_clubs(id),
  target_squad_level text not null,
  club_interest_score integer not null default 0 check (club_interest_score between 0 and 100),
  club_interest_stage text not null default 'none' check (club_interest_stage in ('none','watching','interested','strong','inquiry','negotiating','proposal','agreement','cooling')),
  club_interest_reason text,
  compatibility_score integer not null default 0 check (compatibility_score between 0 and 100),
  fit_breakdown jsonb not null default '{}'::jsonb,
  player_interest_status text not null default 'none' check (player_interest_status in ('none','declared','withdrawn')),
  player_interest_declared_on date,
  player_interest_withdrawn_on date,
  player_interest_cooldown_until date,
  first_seen_on date,
  last_review_on date,
  last_action_on date,
  last_bid_id uuid references public.player_transfer_bids(id) on delete set null,
  last_offer_id uuid references public.player_offers(id) on delete set null,
  is_visible boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(player_id,club_family_code,market_path)
);

create index if not exists idx_player_market_interests_player_stage on public.player_market_interests(player_id,club_interest_stage,is_visible);
create index if not exists idx_player_market_interests_player_declared on public.player_market_interests(player_id,player_interest_status);

alter table public.player_market_interests enable row level security;
drop policy if exists player_market_interests_select_own on public.player_market_interests;
create policy player_market_interests_select_own on public.player_market_interests for select to authenticated using (
  exists(select 1 from public.jogadores j where j.id=player_id and j.user_id=auth.uid())
);
revoke all on public.player_market_interests from anon;
grant select on public.player_market_interests to authenticated;

create or replace function private.career_market_target_squad(p_player uuid)
returns text
language plpgsql
security definer
set search_path=''
as $function$
declare v_age int; v_current text;
begin
  select j.idade,c.squad_level into v_age,v_current
  from public.jogadores j
  left join public.player_career_state st on st.player_id=j.id
  left join public.base_clubs c on c.id=st.club_id
  where j.id=p_player;
  if v_current='u20' then return 'u20'; end if;
  if v_current='u18' then return case when v_age>=19 then 'u20' else 'u18' end; end if;
  return case when coalesce(v_age,16)<=15 then 'u15' when v_age<=17 then 'u17' when v_age=18 then 'u18' else 'u20' end;
end
$function$;

create or replace function private.career_market_fit(p_player uuid,p_target_club uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  j record; st record; current_club record; target record;
  v_ovr int:=50; v_target_avg numeric:=50; v_recent numeric:=6.5;
  v_pos_count int:=0; v_starter_pos int:=0; v_need int:=50; v_space int:=50; v_rep_gap int:=0; v_score int:=50;
  v_fit_label text; v_need_label text; v_space_label text; v_reason text;
begin
  select * into j from public.jogadores where id=p_player;
  select * into st from public.player_career_state where player_id=p_player;
  select * into current_club from public.base_clubs where id=st.club_id;
  select * into target from public.base_clubs where id=p_target_club and is_active;
  if j.id is null or target.id is null then return '{}'::jsonb; end if;
  v_ovr:=public.calculate_player_ovr(j.atributos);
  select coalesce(avg(rating),6.5) into v_recent from (
    select rating from public.player_match_history where player_id=p_player and context='club' and appeared order by match_date desc limit 5
  ) q;
  select coalesce(avg(ovr),50),count(*) filter(where primary_position=j.posicao or secondary_position=j.posicao),count(*) filter(where (primary_position=j.posicao or secondary_position=j.posicao) and is_starter)
  into v_target_avg,v_pos_count,v_starter_pos
  from public.base_ai_players where club_id=p_target_club;
  v_need:=greatest(15,least(95,82-(v_pos_count*13)+(case when v_starter_pos=0 then 14 when v_starter_pos=1 then 6 else 0 end)));
  v_space:=greatest(10,least(95,round(52+((v_ovr-v_target_avg)*5)+(v_need-50)*.38)::int));
  v_rep_gap:=coalesce(target.reputation,2)-coalesce(current_club.reputation,2);
  v_score:=greatest(5,least(96,round(58+((v_ovr-v_target_avg)*3.5)+((v_recent-6.5)*12)+((coalesce(st.form,50)-50)*.16)+(coalesce(st.fame,0)*.08)+((v_need-50)*.10)-(greatest(0,v_rep_gap)*5)-(case when target.club_level='professional' then 7 else 0 end))::int));
  v_fit_label:=case when v_score>=82 then 'Excelente encaixe' when v_score>=70 then 'Boa oportunidade' when v_score>=58 then 'Possível' when v_score>=45 then 'Desafio' else 'Muito improvável' end;
  v_need_label:=case when v_need>=76 then 'Alta' when v_need>=58 then 'Média' else 'Baixa' end;
  v_space_label:=case when v_space>=76 then 'Muito bom' when v_space>=60 then 'Bom' when v_space>=44 then 'Disputado' else 'Difícil' end;
  v_reason:=case
    when v_need>=76 and v_recent>=7.2 then 'O clube tem necessidade na sua posição e seu momento recente combina com o elenco.'
    when v_recent>=7.4 then 'Seu desempenho recente elevou seu nome no radar do departamento de futebol.'
    when v_ovr>=v_target_avg then 'Seu nível atual já é competitivo para o elenco observado.'
    when v_score>=58 then 'O clube vê margem de desenvolvimento e acompanha sua evolução.'
    else 'O salto esportivo ainda é grande, mas seu perfil pode entrar no radar se continuar evoluindo.' end;
  return jsonb_build_object(
    'compatibility_score',v_score,'fit_label',v_fit_label,'target_avg_ovr',round(v_target_avg)::int,'player_ovr',v_ovr,
    'ovr_gap',v_ovr-round(v_target_avg)::int,'recent_rating',round(v_recent::numeric,2),'position_need_score',v_need,
    'position_need_label',v_need_label,'space_score',v_space,'space_label',v_space_label,'position_players',v_pos_count,
    'position_starters',v_starter_pos,'reputation_gap',v_rep_gap,'reason',v_reason
  );
end
$function$;

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
      fit_breakdown=excluded.fit_breakdown,last_review_on=excluded.last_review_on,last_action_on=case when public.player_market_interests.club_interest_stage is distinct from excluded.club_interest_stage then excluded.last_action_on else public.player_market_interests.last_action_on end,
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

create or replace function public.set_career_club_interest(p_club_id uuid,p_active boolean default true)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_player uuid; v_day date; v_age int; v_stage text; v_current_family text; c record; v_target uuid; v_target_squad text; v_path text; v_fit jsonb; v_count int; v_row record;
begin
  select j.id,st.career_date,j.idade,st.career_stage,bc.family_code into v_player,v_day,v_age,v_stage,v_current_family
  from public.jogadores j join public.player_career_state st on st.player_id=j.id left join public.base_clubs bc on bc.id=st.club_id where j.user_id=auth.uid();
  if v_player is null then raise exception 'Jogador não encontrado.'; end if;
  select * into c from public.base_clubs where id=p_club_id and is_active;
  if c.id is null then raise exception 'Clube não encontrado.'; end if;
  if c.family_code is not distinct from v_current_family then raise exception 'Esse caminho pertence ao seu clube atual. Evolução dentro da mesma família acontece por promoção interna.'; end if;
  v_path:=case when c.club_level='professional' then 'professional' else 'academy' end;
  if v_stage='professional' and v_path='academy' then raise exception 'Jogador profissional não pode voltar para a base pelo mercado.'; end if;
  if v_path='professional' and v_age<16 then raise exception 'Seu jogador ainda não pode abrir negociação com equipes profissionais.'; end if;
  if v_path='academy' then
    v_target_squad:=private.career_market_target_squad(v_player);
    select id into v_target from public.base_clubs where family_code=c.family_code and club_level='academy' and squad_level=v_target_squad and is_active limit 1;
    if v_target is null then raise exception 'Esse clube não possui equipe compatível com sua categoria atual.'; end if;
  else v_target:=c.id;v_target_squad:='first_team'; end if;

  select * into v_row from public.player_market_interests where player_id=v_player and club_family_code=c.family_code and market_path=v_path;
  if p_active then
    if v_row.player_interest_status='declared' then return jsonb_build_object('status','already_declared','club',c.name,'remaining_slots',3-(select count(*) from public.player_market_interests where player_id=v_player and player_interest_status='declared')); end if;
    if v_row.player_interest_cooldown_until is not null and v_day<v_row.player_interest_cooldown_until then raise exception 'Seu empresário só pode retomar contato com esse clube em %.',to_char(v_row.player_interest_cooldown_until,'DD/MM/YYYY'); end if;
    select count(*) into v_count from public.player_market_interests where player_id=v_player and player_interest_status='declared';
    if v_count>=3 then raise exception 'Você já marcou 3 clubes como destinos de interesse. Retire um deles antes de adicionar outro.'; end if;
    v_fit:=private.career_market_fit(v_player,v_target);
    insert into public.player_market_interests(player_id,club_family_code,market_path,target_club_id,target_squad_level,compatibility_score,fit_breakdown,player_interest_status,player_interest_declared_on,player_interest_withdrawn_on,player_interest_cooldown_until,club_interest_reason,first_seen_on,last_review_on,is_visible)
    values(v_player,c.family_code,v_path,v_target,v_target_squad,coalesce((v_fit->>'compatibility_score')::int,0),v_fit,'declared',v_day,null,null,v_fit->>'reason',null,v_day,false)
    on conflict(player_id,club_family_code,market_path) do update set target_club_id=excluded.target_club_id,target_squad_level=excluded.target_squad_level,compatibility_score=excluded.compatibility_score,fit_breakdown=excluded.fit_breakdown,player_interest_status='declared',player_interest_declared_on=v_day,player_interest_withdrawn_on=null,player_interest_cooldown_until=null,club_interest_reason=excluded.club_interest_reason,updated_at=now();
    select count(*) into v_count from public.player_market_interests where player_id=v_player and player_interest_status='declared';
    return jsonb_build_object('status','declared','club',c.name,'remaining_slots',greatest(0,3-v_count),'fit_label',v_fit->>'fit_label');
  else
    if v_row.id is null or v_row.player_interest_status<>'declared' then return jsonb_build_object('status','not_declared','club',c.name); end if;
    update public.player_market_interests set player_interest_status='withdrawn',player_interest_withdrawn_on=v_day,player_interest_cooldown_until=v_day+21,updated_at=now() where id=v_row.id;
    return jsonb_build_object('status','withdrawn','club',c.name,'cooldown_until',v_day+21);
  end if;
end
$function$;

revoke execute on function public.set_career_club_interest(uuid,boolean) from public,anon;
grant execute on function public.set_career_club_interest(uuid,boolean) to authenticated;

create or replace function public.get_career_market_dashboard()
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_player uuid; v_day date; v_age int; v_stage text; v_club uuid; v_family text; v_target_squad text; v_value int;
  v_club_interests jsonb:='[]'::jsonb; v_my jsonb:='[]'::jsonb; v_available jsonb:='[]'::jsonb; v_declared_count int:=0;
begin
  select j.id,st.career_date,j.idade,st.career_stage,st.club_id,c.family_code into v_player,v_day,v_age,v_stage,v_club,v_family
  from public.jogadores j join public.player_career_state st on st.player_id=j.id left join public.base_clubs c on c.id=st.club_id where j.user_id=auth.uid();
  if v_player is null then raise exception 'Jogador não encontrado.'; end if;
  v_target_squad:=private.career_market_target_squad(v_player);
  v_value:=private.career_player_market_value(v_player);

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',mi.id,'club_id',mi.target_club_id,'family_code',mi.club_family_code,'market_path',mi.market_path,'club_name',c.name,'club_short_name',c.short_name,
    'shield_url',c.shield_url,'city',c.city,'reputation',c.reputation,'target_squad_level',mi.target_squad_level,'stage',mi.club_interest_stage,
    'reason',mi.club_interest_reason,'first_seen_on',mi.first_seen_on,'last_action_on',mi.last_action_on,'fit_label',mi.fit_breakdown->>'fit_label',
    'need_label',mi.fit_breakdown->>'position_need_label','space_label',mi.fit_breakdown->>'space_label','player_declared',mi.player_interest_status='declared'
  ) order by case mi.club_interest_stage when 'proposal' then 1 when 'negotiating' then 2 when 'inquiry' then 3 when 'strong' then 4 when 'interested' then 5 else 6 end,mi.club_interest_score desc),'[]'::jsonb)
  into v_club_interests
  from public.player_market_interests mi join public.base_clubs c on c.id=mi.target_club_id
  where mi.player_id=v_player and mi.is_visible and mi.club_interest_stage in('watching','interested','strong','inquiry','negotiating','proposal','agreement');

  select count(*) into v_declared_count from public.player_market_interests where player_id=v_player and player_interest_status='declared';
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',mi.id,'club_id',mi.target_club_id,'family_code',mi.club_family_code,'market_path',mi.market_path,'club_name',c.name,'shield_url',c.shield_url,
    'target_squad_level',mi.target_squad_level,'stage',mi.club_interest_stage,'fit_label',mi.fit_breakdown->>'fit_label','need_label',mi.fit_breakdown->>'position_need_label',
    'space_label',mi.fit_breakdown->>'space_label','declared_on',mi.player_interest_declared_on,'cooldown_until',mi.player_interest_cooldown_until
  ) order by mi.player_interest_declared_on desc),'[]'::jsonb) into v_my
  from public.player_market_interests mi join public.base_clubs c on c.id=mi.target_club_id
  where mi.player_id=v_player and mi.player_interest_status='declared';

  with eligible as (
    select c.family_code,'academy'::text market_path,
      (select x.id from public.base_clubs x where x.family_code=c.family_code and x.club_level='academy' and x.squad_level=v_target_squad and x.is_active limit 1) target_id
    from public.base_clubs c where v_stage<>'professional' and c.is_active and c.club_level='academy' and c.squad_level='base' and c.family_code is distinct from v_family
    union all
    select c.family_code,'professional'::text,c.id from public.base_clubs c where v_age>=16 and c.is_active and c.club_level='professional' and c.squad_level='first_team' and c.family_code is distinct from v_family
  ), scored as (
    select e.*,c.name,c.short_name,c.shield_url,c.city,c.reputation,c.club_level,c.squad_level,private.career_market_fit(v_player,e.target_id) fit,
      mi.player_interest_status,mi.club_interest_stage
    from eligible e join public.base_clubs c on c.id=e.target_id
    left join public.player_market_interests mi on mi.player_id=v_player and mi.club_family_code=e.family_code and mi.market_path=e.market_path
    where e.target_id is not null
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'club_id',target_id,'family_code',family_code,'market_path',market_path,'club_name',name,'club_short_name',short_name,'shield_url',shield_url,'city',city,
    'reputation',reputation,'target_squad_level',squad_level,'fit_label',fit->>'fit_label','need_label',fit->>'position_need_label','space_label',fit->>'space_label',
    'reason',fit->>'reason','declared',player_interest_status='declared','club_stage',coalesce(club_interest_stage,'none')
  ) order by (fit->>'compatibility_score')::int desc,name),'[]'::jsonb) into v_available from scored;

  return jsonb_build_object('career_date',v_day,'career_stage',v_stage,'target_academy_squad',v_target_squad,'market_value',v_value,
    'max_player_interests',3,'used_player_interests',v_declared_count,'remaining_player_interests',greatest(0,3-v_declared_count),
    'club_interests',v_club_interests,'my_interests',v_my,'available_clubs',v_available);
end
$function$;

revoke execute on function public.get_career_market_dashboard() from public,anon;
grant execute on function public.get_career_market_dashboard() to authenticated;

create or replace function public.review_career_market_interest_core()
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  pid uuid; career_day date; age_now int; ovr_now int; form_now int; fame_now int; club_now uuid; stage_now text;
  current_club record; last_check date; active_offers int; recent_rating numeric; created_offers int:=0; created_bids int:=0; checked int:=0;
  cand record; target_avg numeric; interest int; effective_day date; fee int; bid_id uuid; bid_result jsonb; refresh_result jsonb;
begin
  select j.id,st.career_date,j.idade,public.calculate_player_ovr(j.atributos),coalesce(st.form,50),coalesce(st.fame,0),st.club_id,st.career_stage
  into pid,career_day,age_now,ovr_now,form_now,fame_now,club_now,stage_now
  from public.jogadores j join public.player_career_state st on st.player_id=j.id where j.user_id=auth.uid();
  if pid is null then raise exception 'Jogador não encontrado.'; end if;
  select * into current_club from public.base_clubs where id=club_now;
  insert into public.player_market_state(player_id) values(pid) on conflict do nothing;

  if exists(select 1 from public.player_transfer_agreements where player_id=pid and status='pending') then
    update public.player_transfer_bids set status='expired',updated_at=now(),metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('closed_reason','signed_transfer_pending_registration') where player_id=pid and status in('pending','countered');
    update public.player_offers set status='withdrawn' where player_id=pid and offer_type in('academy_transfer','professional_transfer') and status in('new','reviewed','negotiating','countered');
    update public.player_market_interests set club_interest_stage=case when last_offer_id in(select offer_id from public.player_transfer_agreements where player_id=pid and status='pending') then 'agreement' else 'cooling' end,is_visible=last_offer_id in(select offer_id from public.player_transfer_agreements where player_id=pid and status='pending'),updated_at=now() where player_id=pid;
    update public.player_market_state set last_interest_check=career_day,updated_at=now() where player_id=pid;
    return jsonb_build_object('created',0,'new_bids',0,'blocked_by_pending_transfer',true);
  end if;

  for bid_id in select id from public.player_transfer_bids where player_id=pid and status in('pending','countered') and expires_on>=career_day order by created_at loop
    bid_result:=private.settle_career_transfer_bid(bid_id);
    if bid_result->>'offer_id' is not null then created_offers:=created_offers+1; end if;
  end loop;
  update public.player_transfer_bids set status='expired',updated_at=now() where player_id=pid and status in('pending','countered') and expires_on<career_day;

  update public.player_market_interests mi set club_interest_stage='proposal',is_visible=true,last_offer_id=o.id,last_action_on=career_day,updated_at=now()
  from public.player_offers o,public.base_clubs c where mi.player_id=pid and o.player_id=pid and o.club_id=c.id and c.family_code=mi.club_family_code
    and mi.market_path=case when o.offer_type='professional_transfer' then 'professional' else 'academy' end and o.offer_type in('academy_transfer','professional_transfer') and o.status in('new','reviewed','negotiating','countered');
  update public.player_market_interests mi set club_interest_stage='negotiating',is_visible=true,last_bid_id=b.id,last_action_on=career_day,updated_at=now()
  from public.player_transfer_bids b,public.base_clubs c where mi.player_id=pid and b.player_id=pid and b.target_club_id=c.id and c.family_code=mi.club_family_code
    and mi.market_path=case when b.bid_kind='professional_transfer' then 'professional' else 'academy' end and b.status in('pending','countered','accepted') and not exists(select 1 from public.player_offers o where o.id=mi.last_offer_id and o.status in('new','reviewed','negotiating','countered'));
  update public.player_market_interests mi set club_interest_stage=case when club_interest_score>=85 then 'inquiry' when club_interest_score>=74 then 'strong' when club_interest_score>=62 then 'interested' when club_interest_score>=50 then 'watching' else 'none' end,is_visible=club_interest_score>=50,updated_at=now()
  where mi.player_id=pid and mi.club_interest_stage='negotiating' and not exists(select 1 from public.player_transfer_bids b where b.id=mi.last_bid_id and b.status in('pending','countered','accepted')) and not exists(select 1 from public.player_offers o where o.id=mi.last_offer_id and o.status in('new','reviewed','negotiating','countered'));

  select last_interest_check into last_check from public.player_market_state where player_id=pid;
  if last_check is not null and career_day-last_check<7 then
    return jsonb_build_object('created',created_offers,'new_bids',0,'cooldown_until',last_check+7);
  end if;

  refresh_result:=private.refresh_career_market_interest_records(pid);
  select count(*) into active_offers from public.player_offers where player_id=pid and offer_type in('academy_transfer','professional_transfer') and status in('new','reviewed','negotiating','countered');
  if active_offers>=3 then
    update public.player_market_state set last_interest_check=career_day,updated_at=now() where player_id=pid;
    return jsonb_build_object('created',created_offers,'new_bids',0,'active_offers',active_offers,'interest_refresh',refresh_result);
  end if;

  select coalesce(avg(rating),6.5) into recent_rating from (select rating from public.player_match_history where player_id=pid and context='club' and appeared order by match_date desc limit 5) q;
  for cand in
    select mi.*,c.club_level,c.reputation,c.name from public.player_market_interests mi join public.base_clubs c on c.id=mi.target_club_id
    where mi.player_id=pid and mi.is_visible and mi.club_interest_stage in('strong','inquiry') and mi.first_seen_on is not null and mi.first_seen_on<=career_day-7
      and not exists(select 1 from public.player_transfer_bids b where b.player_id=pid and b.target_club_id=mi.target_club_id and b.status in('pending','countered','accepted'))
      and not exists(select 1 from public.player_offers o where o.player_id=pid and o.club_id=mi.target_club_id and o.status in('new','reviewed','negotiating','countered'))
    order by (mi.player_interest_status='declared') desc,mi.club_interest_score desc,random()
  loop
    exit when active_offers+created_offers+created_bids>=3 or checked>=8; checked:=checked+1;
    if exists(select 1 from public.player_transfer_bids pb join public.base_clubs tc on tc.id=pb.target_club_id where pb.player_id=pid and tc.family_code=cand.club_family_code and pb.created_at>now()-interval '45 days') then continue; end if;
    interest:=cand.club_interest_score;
    if random()>least(.78,greatest(.10,(interest-55)/58.0+(case when cand.player_interest_status='declared' then .08 else 0 end))) then continue; end if;
    select coalesce(avg(ovr),50) into target_avg from public.base_ai_players where club_id=cand.target_club_id;
    effective_day:=case when cand.market_path='professional' then private.career_next_registration_date(career_day) else career_day end;
    fee:=round(private.career_player_market_value(pid)*case when cand.market_path='professional' then 1.0+(interest-60)/100.0 else .35+(interest-60)/160.0 end)::int;
    insert into public.player_transfer_bids(player_id,source_club_id,target_club_id,target_squad_level,bid_kind,current_fee,asking_fee,round,status,interest_score,effective_on,expires_on,generated_reason,metadata)
    values(pid,current_club.id,cand.target_club_id,cand.target_squad_level,case when cand.market_path='professional' then 'professional_transfer' else 'academy_transfer' end,fee,0,0,'pending',interest,effective_day,career_day+10,
      case when interest>=86 then 'O clube transformou a sondagem em contato formal com sua equipe atual.' when interest>=78 then 'O departamento de futebol decidiu avançar depois de acompanhar seu momento.' else 'O clube entende que seu perfil pode encaixar no projeto esportivo.' end,
      jsonb_build_object('career_date',career_day,'player_ovr',ovr_now,'recent_rating',recent_rating,'target_squad_avg',round(target_avg)::int,'market_interest_id',cand.id,'player_declared_interest',cand.player_interest_status='declared')) returning id into bid_id;
    created_bids:=created_bids+1;
    update public.player_market_interests set club_interest_stage='negotiating',is_visible=true,last_bid_id=bid_id,last_action_on=career_day,updated_at=now() where id=cand.id;
    bid_result:=private.settle_career_transfer_bid(bid_id);
    if bid_result->>'offer_id' is not null then
      created_offers:=created_offers+1;
      update public.player_market_interests set club_interest_stage='proposal',is_visible=true,last_offer_id=(bid_result->>'offer_id')::uuid,last_action_on=career_day,updated_at=now() where id=cand.id;
    else
      if (bid_result->>'status') in('rejected','withdrawn') then update public.player_market_interests set club_interest_score=greatest(40,club_interest_score-7),club_interest_stage=case when club_interest_score-7>=74 then 'strong' else 'interested' end,last_action_on=career_day,updated_at=now() where id=cand.id; end if;
    end if;
  end loop;
  update public.player_market_state set last_interest_check=career_day,last_offer_date=case when created_offers>0 then career_day else last_offer_date end,updated_at=now() where player_id=pid;
  return jsonb_build_object('created',created_offers,'new_bids',created_bids,'active_offers',active_offers+created_offers,'interest_refresh',refresh_result);
end
$function$;

insert into public.player_market_interests(player_id,club_family_code,market_path,target_club_id,target_squad_level,club_interest_score,club_interest_stage,club_interest_reason,compatibility_score,fit_breakdown,first_seen_on,last_review_on,last_action_on,last_bid_id,is_visible)
select b.player_id,c.family_code,case when b.bid_kind='professional_transfer' then 'professional' else 'academy' end,b.target_club_id,b.target_squad_level,b.interest_score,
  case when b.status in('pending','countered','accepted') then 'negotiating' else 'interested' end,b.generated_reason,b.interest_score,coalesce(b.metadata,'{}'::jsonb),coalesce((b.metadata->>'career_date')::date,b.expires_on-10),coalesce((b.metadata->>'career_date')::date,b.expires_on-10),coalesce((b.metadata->>'career_date')::date,b.expires_on-10),b.id,b.status in('pending','countered','accepted')
from public.player_transfer_bids b join public.base_clubs c on c.id=b.target_club_id
on conflict(player_id,club_family_code,market_path) do nothing;

update public.player_market_interests mi set club_interest_stage='proposal',is_visible=true,last_offer_id=o.id,updated_at=now()
from public.player_offers o join public.base_clubs c on c.id=o.club_id
where mi.player_id=o.player_id and mi.club_family_code=c.family_code and mi.market_path=case when o.offer_type='professional_transfer' then 'professional' else 'academy' end
  and o.offer_type in('academy_transfer','professional_transfer') and o.status in('new','reviewed','negotiating','countered');
