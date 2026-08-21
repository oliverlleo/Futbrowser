with defaults as (
  select c.id,
    case
      when coalesce(c.reputation,3) >= 5 then jsonb_build_object('squad_role','Promessa','monthly_wage',1600,'signing_bonus',4000,'release_clause',1000000,'duration_seasons',3,'contract_scope','academy_base')
      when coalesce(c.reputation,3) = 4 then jsonb_build_object('squad_role','Reserva','monthly_wage',1800,'signing_bonus',3000,'release_clause',600000,'duration_seasons',2,'contract_scope','academy_base')
      when coalesce(c.reputation,3) = 3 then jsonb_build_object('squad_role','Rotação','monthly_wage',1500,'signing_bonus',2250,'release_clause',475000,'duration_seasons',2,'contract_scope','academy_base')
      else jsonb_build_object('squad_role','Titular','monthly_wage',1250,'signing_bonus',1000,'release_clause',250000,'duration_seasons',2,'contract_scope','academy_base')
    end as fallback_terms
  from public.base_clubs c
  where c.is_active=true and c.club_level='academy' and c.squad_level='base'
)
update public.base_clubs c
set base_terms = d.fallback_terms || coalesce(c.base_terms,'{}'::jsonb)
from defaults d
where c.id=d.id
  and (
    not (coalesce(c.base_terms,'{}'::jsonb) ? 'monthly_wage')
    or not (coalesce(c.base_terms,'{}'::jsonb) ? 'duration_seasons')
    or not (coalesce(c.base_terms,'{}'::jsonb) ? 'signing_bonus')
    or not (coalesce(c.base_terms,'{}'::jsonb) ? 'release_clause')
    or not (coalesce(c.base_terms,'{}'::jsonb) ? 'squad_role')
  );

update public.player_offers po
set initial_terms = c.base_terms || coalesce(po.initial_terms,'{}'::jsonb),
    current_terms = c.base_terms || coalesce(po.current_terms,'{}'::jsonb)
from public.base_clubs c
where po.club_id=c.id
  and po.offer_type='initial'
  and po.status='new'
  and (
    not (coalesce(po.current_terms,'{}'::jsonb) ? 'monthly_wage')
    or not (coalesce(po.current_terms,'{}'::jsonb) ? 'duration_seasons')
    or not (coalesce(po.current_terms,'{}'::jsonb) ? 'signing_bonus')
    or not (coalesce(po.current_terms,'{}'::jsonb) ? 'release_clause')
    or not (coalesce(po.current_terms,'{}'::jsonb) ? 'squad_role')
  );

create or replace function public.generate_initial_offers()
returns void
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user_id uuid:=auth.uid();
  v_player_id uuid;
  v_club record;
  v_context jsonb;
  v_terms jsonb;
begin
  if v_user_id is null then raise exception 'Não autenticado'; end if;
  select j.id into v_player_id from public.jogadores j where j.user_id=v_user_id;
  if v_player_id is null then raise exception 'Jogador não encontrado'; end if;
  if exists(select 1 from public.player_contracts pc where pc.player_id=v_player_id and pc.status='active') then
    raise exception 'Jogador já possui contrato';
  end if;

  for v_club in
    select c.*
    from public.base_clubs c
    where c.is_active=true
      and c.club_level='academy'
      and c.squad_level='base'
      and not exists(
        select 1 from public.player_offers po
        where po.player_id=v_player_id and po.club_id=c.id
      )
    order by c.reputation desc,c.name
  loop
    v_context:=private.build_offer_context(v_player_id,v_club.id);
    v_terms := (
      case
        when coalesce(v_club.reputation,3) >= 5 then jsonb_build_object('squad_role','Promessa','monthly_wage',1600,'signing_bonus',4000,'release_clause',1000000,'duration_seasons',3,'contract_scope','academy_base')
        when coalesce(v_club.reputation,3) = 4 then jsonb_build_object('squad_role','Reserva','monthly_wage',1800,'signing_bonus',3000,'release_clause',600000,'duration_seasons',2,'contract_scope','academy_base')
        when coalesce(v_club.reputation,3) = 3 then jsonb_build_object('squad_role','Rotação','monthly_wage',1500,'signing_bonus',2250,'release_clause',475000,'duration_seasons',2,'contract_scope','academy_base')
        else jsonb_build_object('squad_role','Titular','monthly_wage',1250,'signing_bonus',1000,'release_clause',250000,'duration_seasons',2,'contract_scope','academy_base')
      end
    ) || coalesce(v_club.base_terms,'{}'::jsonb);

    insert into public.player_offers(
      player_id,club_id,initial_terms,current_terms,status,internal_tolerance,
      compatibility_breakdown,snapshot_data,is_emergency
    ) values(
      v_player_id,v_club.id,v_terms,v_terms,'new',
      (v_context->>'internal_tolerance')::int,
      v_context->'compatibility_breakdown',v_context->'snapshot_data',false
    );
  end loop;
end
$function$;
