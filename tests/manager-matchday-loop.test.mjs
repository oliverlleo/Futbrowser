import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Manager exposes a recurring matchday loop in the UI and service', async () => {
  const html = await read('manager.html');
  const runtime = await read('src/pages/manager/manager.js');
  const service = await read('src/services/manager-service.js');
  assert.match(html, /managerNextFixture/);
  assert.match(html, /managerMatchApproach/);
  assert.match(html, /managerObjectiveTitle/);
  assert.match(runtime, /playManagerMatch/);
  assert.match(runtime, /renderMatchday/);
  assert.match(service, /play_manager_match/);
});

test('Manager matchday persists fixtures, objectives and club consequences', async () => {
  const sql = await read('supabase/migrations/20260821183000_manager_matchday_loop.sql');
  for (const table of ['manager_fixtures', 'manager_season_objectives']) assert.match(sql, new RegExp(`public\\.${table}`));
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.play_manager_match/);
  assert.match(sql, /UPDATE public\.manager_squad_state/);
  assert.match(sql, /UPDATE public\.manager_careers/);
  assert.match(sql, /board_confidence/);
  assert.match(sql, /season_label/);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
});

test('Manager matchday advances the career date and records a report', async () => {
  const sql = await read('supabase/migrations/20260821183000_manager_matchday_loop.sql');
  assert.match(sql, /career_date=GREATEST\(career_date,v_fixture\.match_date\+7\)/);
  assert.match(sql, /match_report=v_report/);
  assert.match(sql, /last_result=v_report/);
  assert.match(sql, /RETURN public\.get_manager_hub\(\)\|\|jsonb_build_object/);
});
