import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const sponsor=await read('supabase/migrations/20260814005922_sponsorship_full_gameplay_v5.sql');
const sponsorRules=await read('supabase/migrations/20260814032202_sponsorship_contract_rules_and_tiers_v7.sql');
const sponsorSchedule=await read('supabase/migrations/20260814032300_sponsorship_schedule_and_breach_gameplay_v8.sql');
const market=await read('supabase/migrations/20260814005958_career_market_club_to_club_complete_v4.sql');
const lineage=await read('supabase/migrations/20260814012422_career_market_offer_lineage_guard_v5.sql');
const marketWindow=await read('supabase/migrations/20260814031817_career_market_window_completion_v6.sql');
const marketRefresh=await read('supabase/migrations/20260814032757_career_market_refresh_open_registration_dates_v7.sql');
const marketInterest=await read('supabase/migrations/20260814140949_career_market_visible_interest_system.sql');
const interestGuard=await read('supabase/migrations/20260814142323_career_market_interest_visibility_guard_v2.sql');
const youthScope=await read('supabase/migrations/20260814032924_career_youth_competition_scope_alignment_v8.sql');
const negotiationInbox=await read('supabase/migrations/20260814030054_career_market_negotiation_inbox_flow.sql');
const developmentLayout=await read('src/pages/career/career-ui-usability-v6.css');
const marketUi=await read('src/pages/career/career-club-path-v8.js');
const marketCss=await read('src/pages/career/career-club-path-v8.css');
const commercialUi=await read('src/pages/career/career-commercial-market-v12.js');
const commercialPolish=await read('src/pages/career/career-commercial-polish-v13.js');
const marketInboxUi=await read('src/pages/career/career-market-inbox-v14.js');

test('sponsorship is proposal-first and only the current inbox message can sign or negotiate',()=>{
  assert.match(sponsor,/status='proposed'/);
  assert.match(sponsor,/message_id IS DISTINCT FROM p_message_id/);
  assert.match(sponsor,/Abra a versão atual da proposta na Caixa de Entrada/);
  assert.match(sponsor,/p_action='accept'/);
  assert.match(sponsor,/p_action='negotiate'/);
  assert.match(sponsor,/p_action='decline'/);
  assert.match(sponsorRules,/ALTER COLUMN status SET DEFAULT 'proposed'/);
});

test('agent negotiation changes duration obligations exclusivity bonus and breach clauses',()=>{
  assert.match(sponsorRules,/NEW\.contract_days:=/);
  assert.match(sponsorRules,/NEW\.max_weekly_deliveries:=NEW\.max_weekly_deliveries-1/);
  assert.match(sponsorRules,/NEW\.exclusivity_category:=NULL/);
  assert.match(sponsorRules,/penalty_policy/);
  assert.match(sponsorRules,/bonus_policy/);
  assert.match(sponsorRules,/negotiated_by_agent/);
  assert.match(sponsorRules,/sponsor_contract_terms_guard/);
});

test('sponsorship has global weekly cap, 12 activity kinds and reschedules match conflicts without player fault',()=>{
  assert.match(sponsorSchedule,/IF total>=3 THEN RETURN/);
  assert.match(sponsorSchedule,/total<3/);
  for(const kind of ['sponsored_post','photo_shoot','short_video','fan_event','launch_event','campaign_interview','autograph_session','store_visit','branded_content','charity_brand_event','vip_appearance','commercial_shoot']) assert.match(sponsorSchedule,new RegExp(kind));
  assert.match(sponsorSchedule,/sponsor_reschedule_conflicts/);
  assert.match(sponsorSchedule,/match_rescheduled/);
  assert.match(sponsorSchedule,/player_fault',false/);
  assert.match(sponsorSchedule,/career_competition_fixtures/);
});

test('sponsor actions expose physical and exposure impact while missed work escalates consequences',()=>{
  assert.match(sponsorSchedule,/energy_cost/);
  assert.match(sponsorSchedule,/fatigue_gain/);
  assert.match(sponsorSchedule,/exposure_gain/);
  assert.match(sponsorSchedule,/sponsor_progressive_breach_guard/);
  assert.match(sponsorSchedule,/termination_penalty/);
  assert.match(sponsorSchedule,/bonus_lost/);
  assert.match(sponsorSchedule,/Aviso de patrocínio/);
  assert.doesNotMatch(sponsorSchedule,/cash_balance\s*=\s*cash_balance\s*-/i);
});

test('sponsorship tier eligibility uses competition exposure and cannot skip more than one historical brand tier',()=>{
  assert.match(sponsorRules,/exposure_matches/);
  assert.match(sponsorRules,/historical_tier\+1/);
  assert.match(sponsorRules,/return greatest\(1,least\(5,t\)\)/i);
});

test('sponsor proposal UI states pay obligations exclusivity bonuses penalties and action impact before signing',()=>{
  for(const label of ['Mensalidade','Luvas','Por ação','Máximo semanal','Exclusividade','Bônus por desempenho','Penalidades por descumprimento']) assert.match(commercialPolish,new RegExp(label));
  assert.match(commercialPolish,/energy/);
  assert.match(commercialPolish,/fadiga/);
  assert.match(commercialPolish,/exposição/);
  assert.match(commercialPolish,/data-sponsor-terms-key/);
});

test('market makes clubs agree before a player offer exists',()=>{
  assert.match(market,/player_transfer_bids/);
  assert.match(market,/resolve_career_transfer_bid/);
  assert.match(market,/create_career_market_offer_from_bid/);
  assert.match(market,/b\.status<>'accepted'/);
  assert.match(market,/Proposta oficial de transferência/);
});

test('visible market interest is a persistent backend state before a bid or player offer',()=>{
  assert.match(marketInterest,/create table if not exists public\.player_market_interests/);
  for(const stage of ['watching','interested','strong','inquiry','negotiating','proposal','agreement','cooling']) assert.match(marketInterest,new RegExp(`'${stage}'`));
  assert.match(marketInterest,/private\.refresh_career_market_interest_records/);
  assert.match(marketInterest,/club_interest_score/);
  assert.match(marketInterest,/compatibility_score/);
  assert.match(marketInterest,/position_need_label/);
  assert.match(marketInterest,/space_label/);
  assert.match(marketInterest,/first_seen_on<=career_day-7/);
  assert.match(marketInterest,/join public\.player_market_interests mi/);
  assert.match(marketInterest,/market_interest_id/);
  assert.match(marketInterest,/player_declared_interest/);
});

test('declared interest receives a first-seen date and hidden numeric scores stay server-side',()=>{
  assert.match(interestGuard,/first_seen_on=coalesce\(public\.player_market_interests\.first_seen_on,excluded\.first_seen_on\)/);
  assert.match(interestGuard,/revoke select on public\.player_market_interests from authenticated/);
  assert.match(interestGuard,/club_interest_stage in\('watching','interested','strong','inquiry','negotiating','proposal','agreement'\)/);
  assert.match(interestGuard,/mi\.first_seen_on is null/);
});

test('player can signal up to three clubs without creating an automatic proposal',()=>{
  assert.match(marketInterest,/public\.set_career_club_interest/);
  assert.match(marketInterest,/v_count>=3/);
  assert.match(marketInterest,/Retire um deles antes de adicionar outro/);
  assert.match(marketInterest,/player_interest_cooldown_until=v_day\+21/);
  assert.match(marketInterest,/Seu empresário só pode retomar contato/);
  const setFn=marketInterest.match(/create or replace function public\.set_career_club_interest[\s\S]*?\nend\n\$function\$;/i)?.[0]||'';
  assert.doesNotMatch(setFn,/insert into public\.player_offers/i);
  assert.doesNotMatch(setFn,/insert into public\.player_transfer_bids/i);
});

test('market dashboard exposes club interest, player destinations and compatible clubs without exact public percentages',()=>{
  assert.match(marketInterest,/public\.get_career_market_dashboard/);
  assert.match(marketInterest,/'club_interests'/);
  assert.match(marketInterest,/'my_interests'/);
  assert.match(marketInterest,/'available_clubs'/);
  assert.match(marketInterest,/'remaining_player_interests'/);
  for(const label of ['Interesse em você','Meus interesses','Explorar clubes','Demonstrar interesse','Monitorando','Interesse forte','Sondagem','Negociando com seu clube']) assert.match(marketUi,new RegExp(label));
  assert.match(marketUi,/get_career_market_dashboard/);
  assert.match(marketUi,/set_career_club_interest/);
  assert.match(marketUi,/Isso não cria proposta automática/);
  assert.match(marketCss,/market-tabs/);
  assert.match(marketCss,/market-club-grid/);
  assert.match(marketCss,/market-my-grid/);
});

test('professional career cannot regress to academy and transfers negotiate despite an active current contract',()=>{
  assert.match(market,/stage_now<>'professional'/);
  assert.match(market,/v_offer\.offer_type='initial' AND EXISTS/);
  assert.match(market,/academy_transfer','professional_transfer','professional_promotion/);
  assert.match(marketInterest,/v_stage='professional' and v_path='academy'/);
});

test('external offer negotiation and acceptance require valid accepted bid lineage',()=>{
  assert.match(lineage,/assert_career_transfer_offer_agreed/);
  assert.match(lineage,/club_to_club_agreed/);
  assert.match(lineage,/b\.status<>'accepted'/);
  assert.match(lineage,/PERFORM private\.assert_career_transfer_offer_agreed\(v_offer\.id,v_player\)/);
});

test('professional registration date is recalculated from signing game date and youth moves remain immediate',()=>{
  assert.match(marketWindow,/private\.career_next_registration_date\(v_date\)/);
  assert.match(marketWindow,/v_effective:=v_date/);
  assert.match(marketWindow,/window_recalculated_on_signing/);
  assert.match(marketRefresh,/private\.career_next_registration_date\(st\.career_date\)/);
  assert.match(marketRefresh,/po\.offer_type='academy_transfer'/);
  assert.match(marketInterest,/private\.career_next_registration_date\(career_day\)/);
});

test('every contract negotiation round creates a persistent inbox response from the club',()=>{
  assert.match(negotiationInbox,/AFTER INSERT ON public\.player_offer_history/);
  assert.match(negotiationInbox,/'negotiation_response'/);
  assert.match(negotiationInbox,/'career_market_negotiation_response'/);
  assert.match(negotiationInbox,/'requested_terms'/);
  assert.match(negotiationInbox,/'club_response_terms'/);
});

test('market inbox compares player and club terms and keeps signing explicit',()=>{
  for(const label of ['Sua contraproposta','Resposta do clube','Salário','Papel','Duração','Cláusula','Bônus','Negociar novamente','Revisar e assinar','Assinar contrato']) assert.match(marketInboxUi,new RegExp(label));
  assert.match(marketInboxUi,/accept_career_market_offer/);
  assert.match(marketInboxUi,/reject_career_market_offer/);
  assert.match(marketInboxUi,/negotiate_offer/);
});

test('2026 youth competition scope uses CBF competitions and keeps U18 internal development only',()=>{
  assert.match(youthScope,/Copa do Brasil Masculina Sub-15/);
  assert.match(youthScope,/Brasileirão Sub-17/);
  assert.match(youthScope,/Copa do Brasil Sub-17/);
  assert.match(youthScope,/Brasileirão Série A Sub-20/);
  assert.match(youthScope,/Copa do Brasil Sub-20/);
  assert.match(youthScope,/Circuito Interno de Desenvolvimento Sub-18/);
  assert.match(youthScope,/code='ACA_U18_CUP'/);
  assert.match(youthScope,/is_active=false/);
});

test('development keeps Atributos and Especialidades as separate rows with card columns inside each section',()=>{
  assert.match(developmentLayout,/development-overview ~ \.profile-grid\{[\s\S]*grid-template-columns:minmax\(0,1fr\)!important/);
  assert.match(developmentLayout,/profile-grid > \.meta-card,[\s\S]*profile-grid > \.meta-card-wide\{[\s\S]*grid-column:1\/-1!important/);
  assert.match(developmentLayout,/\.attribute-grid\{[\s\S]*grid-template-columns:repeat\(6,minmax\(0,1fr\)\)!important/);
  assert.match(developmentLayout,/\.profile-skill-list\{[\s\S]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/);
});

test('market UI exposes accept reject and interest actions without malformed handlers',()=>{
  assert.match(marketUi,/data-accept-offer/);
  assert.match(marketUi,/data-reject-offer/);
  assert.match(marketUi,/data-declare-interest/);
  assert.match(marketUi,/data-withdraw-interest/);
  assert.match(marketUi,/rejectOffer\(b\.dataset\.rejectOffer\)\)\);/);
  assert.match(commercialUi,/Negociar contrato/);
  assert.match(commercialUi,/negotiate_offer/);
});
