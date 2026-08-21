import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('competition center exposes a persistent sporting priority', async () => {
  const service = await read('src/pages/career/career-competition-service.js');
  const runtime = await read('src/pages/career/career-competition-center.js');
  assert.match(service, /set_career_competition_priority/);
  assert.match(runtime, /competitionPriority/);
  assert.match(runtime, /Priorizar liga/);
  assert.match(runtime, /Priorizar copa/);
  assert.match(runtime, /Priorizar desenvolvimento/);
});

test('competition hub derives the default season from the active sporting squad', async () => {
  const sql = await read('supabase/migrations/20260821191000_fix_competition_hub_squad_code.sql');
  assert.match(sql, /player_squad_assignments/);
  assert.match(sql, /WHEN 'u17' THEN 'ACA_U17_LEAGUE'/);
  assert.match(sql, /WHEN 'u18' THEN 'ACA_U18_LEAGUE'/);
  assert.doesNotMatch(sql, /ELSE\s*\n\s*v_code:='ACA_U18_LEAGUE'/);
});

test('competition priority changes next-fixture ordering and is owner-only', async () => {
  const sql = await read('supabase/migrations/20260821190000_career_competition_priority.sql');
  assert.match(sql, /competition_priority text NOT NULL DEFAULT 'balanced'/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION private\.next_career_fixture/);
  assert.match(sql, /competition_priority,'balanced'\)='cup'/);
  assert.match(sql, /competition_priority,'balanced'\)='league'/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.set_career_competition_priority/);
  assert.match(sql, /WHERE user_id=auth\.uid\(\)/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.set_career_competition_priority/);
});
