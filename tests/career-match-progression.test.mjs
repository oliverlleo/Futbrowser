import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('scheduled club match advances the career to the next week and cannot leave match lock stuck', async () => {
  const sql = await read('supabase/migrations/20260811193100_match_calendar_and_development_stimulus.sql');
  assert.match(sql,/after_scheduled_career_match/);
  assert.match(sql,/NEW\.match_date=v_state\.next_match_date/);
  assert.match(sql,/career_date=NEW\.match_date\+1/);
  assert.match(sql,/next_match_date=NEW\.match_date\+7/);
  assert.match(sql,/day_period=0/);
  assert.match(sql,/weekly_objective='\{\}'::jsonb/);
});

test('match participation counts as development maintenance without inventing large XP rewards', async () => {
  const sql = await read('supabase/migrations/20260811193100_match_calendar_and_development_stimulus.sql');
  assert.match(sql,/match_maintenance_skills/);
  assert.match(sql,/apply_match_development_maintenance/);
  assert.match(sql,/last_stimulated_on/);
  assert.match(sql,/event_type,skill_key,amount/);
  assert.match(sql,/'maintenance',v_skill,0/);
  for (const skill of ['positioning','tactical_awareness','short_pass','marking','stamina','sprint','crossing','dribbling','finishing_touch','heading','strength']) assert.match(sql,new RegExp(skill));
  assert.doesNotMatch(sql,/add_skill_progress\(/);
});

test('player left out of the squad can still finish the fixture and advance the career without fake appearances', async () => {
  const sql = await read('supabase/migrations/20260811193200_match_out_selection_and_result_integrity.sql');
  assert.match(sql,/v_session\.selection_status='out'/);
  assert.match(sql,/'out',false,false,0,0,0,NULL/);
  assert.match(sql,/Jogador fora da lista não pode registrar participação em campo/);
  assert.match(sql,/player_match_history/);
  assert.match(sql,/record_career_match_result/);
});

test('legacy saved match can be reconciled after refresh instead of remaining stuck on match day', async () => {
  const sql = await read('supabase/migrations/20260811193300_match_progression_reconciliation.sql');
  assert.match(sql,/reconcile_career_match_progression/);
  assert.match(sql,/player_match_history/);
  assert.match(sql,/career_date=v_match\.match_date\+1/);
  assert.match(sql,/next_match_date=v_match\.match_date\+7/);
  assert.match(sql,/status='completed'/);
});

test('contextual gameplay migration uses an escape string for injected function newline', async () => {
  const sql = await read('supabase/migrations/20260811192000_complete_contextual_gameplay_loop.sql');
  assert.match(sql,/regexp_replace\([\s\S]*,E'v_risk := v_risk \* private\.career_injury_risk_multiplier/);
  assert.doesNotMatch(sql,/,\s*'v_risk := v_risk \* private\.career_injury_risk_multiplier\(v_player\.id\);\\n/);
});

test('Career Hub no longer tells the player matches are unimplemented and loads v3 runtime', async () => {
  const loader = await read('src/pages/career/career-loader-v3.js');
  assert.match(loader,/A partida fica disponível no dia do jogo/);
  assert.match(loader,/career-match-runtime-v3\.js/);
});
