import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('competition world defines youth categories, professional A-D pyramid and national cup', async () => {
  const sql = await read('supabase/migrations/20260812103000_competition_world_schema_and_clubs.sql');
  for (const code of ['ACA_U15_LEAGUE','ACA_U17_LEAGUE','ACA_U18_LEAGUE','ACA_U20_LEAGUE','PRO_A','PRO_B','PRO_C','PRO_D','PRO_CUP']) {
    assert.match(sql, new RegExp(code));
  }
  assert.match(sql, /generated_club_crest/);
  assert.match(sql, /Belmiro F\.C\./);
  assert.match(sql, /career_competition_fixtures/);
  assert.match(sql, /career_competition_player_stats/);
  assert.match(sql, /career_competition_rewards/);
});

test('season bootstrap allows the schedule to determine ends_on after inserting the season', async () => {
  const sql = await read('supabase/migrations/20260812103050_competition_season_bootstrap_integrity.sql');
  assert.match(sql, /ALTER COLUMN ends_on DROP NOT NULL/);
});

test('competition engine schedules leagues and knockouts and exposes standings, leaders and hub RPC', async () => {
  const sql = await read('supabase/migrations/20260812103100_competition_schedule_simulation_rewards.sql');
  assert.match(sql, /generate_league_schedule/);
  assert.match(sql, /generate_knockout_schedule/);
  assert.match(sql, /competition_standings/);
  assert.match(sql, /competition_leaders/);
  assert.match(sql, /finalize_competition_season/);
  assert.match(sql, /finalize_professional_pyramid/);
  assert.match(sql, /get_career_competition_hub\(p_competition_code text DEFAULT NULL,p_round integer DEFAULT NULL\)/);
  assert.match(sql, /top_scorer_reward/);
  assert.match(sql, /top_assist_reward/);
});

test('match integration uses the scheduled fixture and calculates variable physical load', async () => {
  const sql = await read('supabase/migrations/20260812103200_competition_match_integration_and_variable_load.sql');
  assert.match(sql, /fixture_id uuid REFERENCES public\.career_competition_fixtures/);
  assert.match(sql, /career_match_load/);
  assert.match(sql, /high_intensity_actions/);
  assert.match(sql, /physical_actions/);
  assert.match(sql, /end_match_energy/);
  assert.match(sql, /energy_loss/);
  assert.match(sql, /fatigue_gain/);
  assert.match(sql, /complete_player_competition_fixture/);
});

test('deploy bridge preserves an already-active legacy match day until its result is saved', async () => {
  const sql = await read('supabase/migrations/20260812103250_competition_active_match_bridge_integrity.sql');
  assert.match(sql, /private\.career_match_sessions/);
  assert.match(sql, /s\.match_date=v_state\.career_date/);
  assert.match(sql, /s\.status='active'/);
  assert.match(sql, /IF v_has_active_match THEN/);
  assert.match(sql, /RETURN v_state\.next_match_date/);
});

test('academy world follows player age and keeps out-of-squad match integrity', async () => {
  const sql = await read('supabase/migrations/20260812103300_competition_integrity_age_categories_and_out_player.sql');
  assert.match(sql, /academy_competition_level/);
  for (const level of ['U15','U17','U18','U20']) assert.match(sql, new RegExp(level));
  assert.match(sql, /v_session\.selection_status='out'/);
  assert.match(sql, /Jogador fora da lista não pode registrar participação em campo/);
});

test('runtime integrity fixes select the actual academy age category and keep exactly eleven starters', async () => {
  const sql = await read('supabase/migrations/20260812103400_competition_runtime_integrity_fixes.sql');
  assert.match(sql, /private\.academy_competition_level\(v_player\)/);
  assert.match(sql, /CASE WHEN v_is_home AND p_started THEN 10 ELSE 11 END/);
  assert.match(sql, /CASE WHEN NOT v_is_home AND p_started THEN 10 ELSE 11 END/);
  assert.match(sql, /NOTIFY pgrst, 'reload schema'/);
});

test('post-deploy validation refuses a partial competition backend', async () => {
  const sql = await read('supabase/migrations/20260812103500_competition_post_deploy_validation.sql');
  assert.match(sql, /get_career_competition_hub\(text,integer\)/);
  assert.match(sql, /bootstrap_career_competitions\(\)/);
  assert.match(sql, /division % has % active clubs, expected 20/);
  assert.match(sql, /13 required competitions/);
  assert.match(sql, /academy hub is not age-aware/);
  assert.match(sql, /invalid AI lineup count/);
});

test('competition center supports explicit light-dark themes and responsive desktop-mobile layouts', async () => {
  const css = await read('src/pages/career/career-competition-center.css');
  const ui = await read('src/pages/career/career-competition-center.js');
  assert.match(css, /:root\{/);
  assert.match(css, /html\[data-theme="dark"\]/);
  assert.match(css, /@media\(max-width:1050px\)/);
  assert.match(css, /@media\(max-width:720px\)/);
  assert.match(css, /@media\(max-width:430px\)/);
  assert.match(ui, /Calendário/);
  assert.match(ui, /Classificação/);
  assert.match(ui, /Chave/);
  assert.match(ui, /Líderes/);
  assert.match(ui, /Prêmios/);
});
