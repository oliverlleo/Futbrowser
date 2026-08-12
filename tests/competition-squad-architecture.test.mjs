import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const competitionUi = readFileSync('src/pages/career/career-competition-center.js', 'utf8');
const loader = readFileSync('src/pages/career/career-loader-v3.js', 'utf8');
const careerHtml = readFileSync('career.html', 'utf8');
const integrityMigration = readFileSync('supabase/migrations/20260812192549_academy_squad_integrity_guards.sql', 'utf8');
const dialogueRuntime = readFileSync('supabase/migrations/20260812221810_teammate_dialogue_and_rivalry_runtime.sql', 'utf8');
const dialogueCatalog = readFileSync('supabase/migrations/20260812221934_teammate_dialogue_catalog.sql', 'utf8');
const rivalryDeescalation = readFileSync('supabase/migrations/20260812222607_teammate_rivalry_deescalation.sql', 'utf8');

test('competition UI separates current round from viewed round', () => {
  assert.match(competitionUi, /async function load\(code = state\.competition, round = null\)/);
  assert.match(competitionUi, /selected\?\.viewed_round \?\? data\?\.selected\?\.current_round/);
  assert.match(competitionUi, /load\(state\.competition, null\)/);
  assert.doesNotMatch(competitionUi, /career:hub-rendered[^\n]+load\(state\.competition, state\.round\)/);
});

test('competition teaser is driven by the next fixture', () => {
  assert.match(competitionUi, /next\.stage === 'league' \? `Rodada \$\{next\.round\}`/);
  assert.match(competitionUi, /assignment\?\.competition_ready === false/);
  assert.match(competitionUi, /Aguardando promoção/);
});

test('career loader busts the updated competition bundle', () => {
  assert.match(loader, /career-competition-center\.js\?v=20260812-2/);
  assert.match(careerHtml, /career-loader-v3\.js\?v=20260812-5/);
});

test('database migration guards academy category integrity', () => {
  assert.match(integrityMigration, /trg_validate_competition_entry_squad/);
  assert.match(integrityMigration, /trg_validate_competition_fixture_squads/);
  assert.match(integrityMigration, /trg_validate_competition_stat_squad/);
  assert.match(integrityMigration, /trg_validate_academy_offer_scope/);
  assert.match(integrityMigration, /v_squad IS DISTINCT FROM 'base'/);
});

test('teammate dialogue runtime never selects relations from an old sporting squad', () => {
  assert.match(dialogueRuntime, /JOIN public\.player_career_state pcs ON pcs\.player_id=r\.player_id/);
  assert.match(dialogueRuntime, /AND ai\.club_id=pcs\.club_id/);
  assert.match(dialogueRuntime, /AND ai\.club_id=v_state\.club_id/);
});

test('generic teammate moment is rewritten on the live career action table after event generation', () => {
  assert.match(dialogueRuntime, /trg_zzzz_rewrite_teammate_dialogue/);
  assert.match(dialogueRuntime, /AFTER INSERT ON public\.player_career_actions/);
  assert.match(dialogueRuntime, /EXECUTE FUNCTION private\.rewrite_generic_teammate_dialogue/);
});

test('teammate catalogue has broad contextual variation with three choices per event', () => {
  const eventKeys = [...dialogueCatalog.matchAll(/\('mate_[a-z_]+',/g)].map(match => match[0]);
  assert.ok(eventKeys.length >= 27, `expected at least 27 teammate events, got ${eventKeys.length}`);
  assert.match(dialogueCatalog, /mate_rival_challenge/);
  assert.match(dialogueCatalog, /mate_tactical_disagreement/);
  assert.match(dialogueCatalog, /mate_goal_drought_support/);
  assert.match(dialogueCatalog, /mate_contract_money/);
  assert.match(dialogueCatalog, /mate_leadership_test/);
  assert.match(dialogueCatalog, /"rivalry":1/);
  assert.match(dialogueCatalog, /"teammate_relation":-1/);
  assert.match(dialogueCatalog, /"teammate_relation":3/);
});

test('dialogue picker keeps recent anti-repetition memory', () => {
  assert.match(dialogueRuntime, /event_key LIKE 'mate_%'/);
  assert.match(dialogueRuntime, /LIMIT 8/);
  assert.match(dialogueRuntime, /NOT \(c=ANY\(v_recent\)\)/);
});

test('active same-position rivalry affects selection contextually instead of being a fixed punishment', () => {
  assert.match(dialogueRuntime, /r\.rivalry=true/);
  assert.match(dialogueRuntime, /ai\.primary_position=v_player\.posicao/);
  assert.match(dialogueRuntime, /WHEN v_state\.form>=60 THEN 2\.5/);
  assert.match(dialogueRuntime, /WHEN v_state\.form<40 THEN -2\.5/);
  assert.match(dialogueRuntime, /'selection_modifier',v_rival_modifier/);
});

test('rivalry can intensify or cool down through different plausible choices', () => {
  assert.match(dialogueCatalog, /"rivalry":1/);
  assert.match(rivalryDeescalation, /"rivalry":-1/);
  assert.match(rivalryDeescalation, /mate_rival_respect/);
  assert.match(rivalryDeescalation, /mate_rival_contact/);
  assert.match(rivalryDeescalation, /A disputa fica mais direta/);
});