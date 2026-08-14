import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const sponsor=await read('supabase/migrations/20260814005922_sponsorship_full_gameplay_v5.sql');
const market=await read('supabase/migrations/20260814005958_career_market_club_to_club_complete_v4.sql');
const lineage=await read('supabase/migrations/20260814012422_career_market_offer_lineage_guard_v5.sql');

test('sponsorship is proposal-first and only the current inbox message can sign or negotiate',()=>{
  assert.match(sponsor,/status='proposed'/);
  assert.match(sponsor,/message_id IS DISTINCT FROM p_message_id/);
  assert.match(sponsor,/Abra a versão atual da proposta na Caixa de Entrada/);
  assert.match(sponsor,/p_action='accept'/);
  assert.match(sponsor,/p_action='negotiate'/);
  assert.match(sponsor,/p_action='decline'/);
});

test('sponsorship has hard weekly cap, tier gate and fixture-safe scheduling',()=>{
  assert.match(sponsor,/IF total>=3 THEN RETURN/);
  assert.match(sponsor,/total<3/);
  assert.match(sponsor,/x\.tier<=tier_cap/);
  assert.match(sponsor,/career_competition_fixtures/);
  assert.match(sponsor,/Compromisso comercial não pode ser realizado em dia de jogo/);
});

test('sponsorship consequences, payments, bonuses and renewal are persistent without auto-renew',()=>{
  assert.match(sponsor,/strikes=newstrikes/);
  assert.match(sponsor,/total_penalties=total_penalties\+greatest\(0,d\.penalty\)/);
  assert.match(sponsor,/status='terminated'/);
  assert.match(sponsor,/months_due/);
  assert.match(sponsor,/player_sponsor_performance_rewards/);
  assert.match(sponsor,/UNIQUE\(contract_id,match_history_id\)/);
  assert.match(sponsor,/Proposta de renovação/);
  assert.match(sponsor,/status='proposed'/);
  assert.doesNotMatch(sponsor,/cash_balance\s*=\s*cash_balance\s*-/i);
});

test('market makes clubs agree before a player offer exists',()=>{
  assert.match(market,/player_transfer_bids/);
  assert.match(market,/resolve_career_transfer_bid/);
  assert.match(market,/create_career_market_offer_from_bid/);
  assert.match(market,/b\.status<>'accepted'/);
  assert.match(market,/Proposta oficial de transferência/);
});

test('professional career cannot regress to academy and transfers negotiate despite an active current contract',()=>{
  assert.match(market,/stage_now<>'professional'/);
  assert.match(market,/v_offer\.offer_type='initial' AND EXISTS/);
  assert.match(market,/academy_transfer','professional_transfer','professional_promotion/);
});

test('external offer negotiation and acceptance require valid accepted bid lineage',()=>{
  assert.match(lineage,/assert_career_transfer_offer_agreed/);
  assert.match(lineage,/club_to_club_agreed/);
  assert.match(lineage,/b\.status<>'accepted'/);
  assert.match(lineage,/PERFORM private\.assert_career_transfer_offer_agreed\(v_offer\.id,v_player\)/);
  assert.match(lineage,/PERFORM private\.assert_career_transfer_offer_agreed\(v_offer\.id,v_offer\.player_id\)/);
});
