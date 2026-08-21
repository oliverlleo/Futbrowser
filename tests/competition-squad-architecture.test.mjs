import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const competitionUi = readFileSync('src/pages/career/career-competition-center.js', 'utf8');
const loader = readFileSync('src/pages/career/career-loader-v3.js', 'utf8');
const careerHtml = readFileSync('career.html', 'utf8');
const clubPathUi = readFileSync('src/pages/career/career-club-path-v8.js', 'utf8');
const integrityMigration = readFileSync('supabase/migrations/20260812192549_academy_squad_integrity_guards.sql', 'utf8');
const rootRosterCleanup = readFileSync('supabase/migrations/20260814183457_career_remove_organizational_base_ai_rosters.sql', 'utf8');
const competitionBackfill = readFileSync('supabase/migrations/20260814192140_career_backfill_competitions_for_existing_sporting_squads.sql', 'utf8');
const dialogueRuntime = readFileSync('supabase/migrations/20260812221810_teammate_dialogue_and_rivalry_runtime.sql', 'utf8');
const dialogueCatalog = readFileSync('supabase/migrations/20260812221934_teammate_dialogue_catalog.sql', 'utf8');
const rivalryDeescalation = readFileSync('supabase/migrations/20260812222607_teammate_rivalry_deescalation.sql', 'utf8');

test('competition UI separates current round from viewed round', () => {
  assert.match(competitionUi, /async function load\(code = state\.competition, round = null\)/);
  assert.match(competitionUi, /selected\?\.viewed_round \?\? data\?\.selected\?\.current_round/);
  assert.match(competitionUi, /load\(state\.competition, null\)/);
  assert.doesNotMatch(competitionUi, /career:hub-rendered[^\n]+load\(state\.competition, state\.round\)/);
});

test('competition UI uses the real sporting category and never exposes Base as a separate team', () => {
  assert.match(competitionUi, /const SQUAD_LABEL = \{/);
  for (const label of ['Sub-15', 'Sub-17', 'Sub-18', 'Sub-20', 'Profissional']) assert.match(competitionUi, new RegExp(label));
  assert.match(competitionUi, /selected\?\.squad_level \|\| data\?\.assignment\?\.squad_level/);
  assert.match(competitionUi, /sportingCategory\(d\)/);
  assert.doesNotMatch(competitionUi, /Aguardando promoção/);
  assert.doesNotMatch(competitionUi, /Base do clube/);
  assert.doesNotMatch(competitionUi, /<em>Base<\/em>/);
  assert.doesNotMatch(competitionUi, /<small>Base<\/small>/);
});

test('competition teaser is driven by the next fixture', () => {
  assert.match(competitionUi, /next\.stage === 'league' \? `Rodada \$\{next\.round\}`/);
  assert.match(competitionUi, /assignment\?\.competition_ready === false/);
  assert.match(competitionUi, /Categoria indisponível/);
});

test('career loader busts the updated competition bundle', () => {
  assert.match(loader, /career-competition-center\.js\?v=20260821-2/);
  assert.match(careerHtml, /career-loader-v3\.js\?v=20260814-12/);
});

test('database migration guards academy category integrity', () => {
  assert.match(integrityMigration, /trg_validate_competition_entry_squad/);
  assert.match(integrityMigration, /trg_validate_competition_fixture_squads/);
  assert.match(integrityMigration, /trg_validate_competition_stat_squad/);
  assert.match(integrityMigration, /trg_validate_academy_offer_scope/);
  assert.match(integrityMigration, /v_squad IS DISTINCT FROM 'base'/);
});

test('academy root has no sporting roster and cannot receive one again', () => {
  assert.match(rootRosterCleanup, /DELETE FROM public\.base_ai_players ai/);
  assert.match(rootRosterCleanup, /c\.squad_level='base'/);
  assert.match(rootRosterCleanup, /guard_base_ai_player_sporting_roster/);
  assert.match(rootRosterCleanup, /trg_guard_base_ai_player_sporting_roster/);
  assert.match(rootRosterCleanup, /PERFORM private\.ensure_teammate_relations\(p\.player_id\)/);
  assert.match(rootRosterCleanup, /ON CONFLICT\(player_id,teammate_id\) DO UPDATE/);
});

test('existing careers are backfilled only through real sporting squads and official competition helpers', () => {
  assert.match(competitionBackfill, /c\.squad_level IN\('u15','u17','u18','u20','first_team'\)/);
  assert.doesNotMatch(competitionBackfill, /squad_level[^\n]*'base'/);
  assert.match(competitionBackfill, /PERFORM private\.ensure_competition_world\(r\.player_id\)/);
  assert.match(competitionBackfill, /PERFORM private\.sync_competition_next_match\(r\.player_id\)/);
});

test('career market exposes real sporting categories instead of a Base category', () => {
  assert.match(clubPathUi, /const PATH=\['u15','u17','u18','u20','first_team'\]/);
  for (const pair of ["['u15','Sub-15']", "['u17','Sub-17']", "['u18','Sub-18']", "['u20','Sub-20']", "['first_team','Profissional']"]) {
    assert.match(clubPathUi, new RegExp(pair.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.doesNotMatch(clubPathUi, /\['base','Base'\]/);
});

test('teammate dialogue runtime never selects relations from an old sporting squad', () => {
  assert.match(dialogueRuntime, /JOIN public\.player_career_state pcs ON pcs\.player_id=r\.player_id/);
  assert.match(dialogueRuntime, /AND ai\.club_id=pcs\.club_id/);
  assert.match(dialogueRuntime, /AND ai\.club_id=v_state\.club_id/);
});

test('generic teammate moment is rewritten by the post-action dialogue trigger', () => {
  assert.match(dialogueRuntime, /DROP TRIGGER IF EXISTS trg_zzzz_rewrite_teammate_dialogue/);
  assert.match(dialogueRuntime, /CREATE TRIGGER trg_zzzz_rewrite_teammate_dialogue AFTER INSERT ON public\.player_career_actions/);
  assert.match(dialogueRuntime, /EXECUTE FUNCTION private\.rewrite_generic_teammate_dialogue\(\)/);
});

test('teammate catalogue has broad contextual variation with at least three authored choices per event', () => {
  const events = [...dialogueCatalog.matchAll(/\('mate_[^']+'/g)];
  const choices = [...dialogueCatalog.matchAll(/"key":"[^"]+"/g)];
  assert.ok(events.length >= 20, `expected at least 20 teammate dialogues, found ${events.length}`);
  assert.ok(choices.length >= events.length * 3, `expected at least three choices per teammate dialogue, found ${choices.length} choices for ${events.length} events`);
  assert.match(dialogueCatalog, /WITH templates\(event_key,title,body,choices\) AS/);
  assert.match(dialogueCatalog, /::jsonb/);
});

test('dialogue picker keeps recent anti-repetition memory', () => {
  assert.match(dialogueRuntime, /ORDER BY resolved_at DESC NULLS LAST,created_at DESC LIMIT 8/);
  assert.match(dialogueRuntime, /WHERE NOT \(c=ANY\(v_recent\)\)/);
});

test('active same-position rivalry affects selection contextually instead of being a fixed punishment', () => {
  assert.match(dialogueRuntime, /rivalry/);
  assert.match(dialogueRuntime, /primary_position/);
  assert.match(dialogueRuntime, /selection/);
});

test('rivalry can intensify or cool down through different plausible choices', () => {
  assert.match(rivalryDeescalation, /\{effects,rivalry\}','-1'/);
  assert.match(rivalryDeescalation, /"rivalry":1/);
  assert.match(rivalryDeescalation, /"rivalry":-1/);
  assert.match(rivalryDeescalation, /rival_training_tension/);
});