import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('dashboard exposes only Jogador and Manager as creation paths', async () => {
  const html = await read('dashboard.html');
  assert.match(html, /data-role="jogador"/);
  assert.match(html, /data-role="manager"/);
  assert.doesNotMatch(html, /data-role="tecnico"/);
  assert.doesNotMatch(html, /data-role="presidente"/);
  assert.match(html, /manager-path\.js/);
});

test('Manager path is persisted and resumes without changing Player career data', async () => {
  const router = await read('src/pages/dashboard/manager-path.js');
  assert.match(router, /update\(\{ caminho: 'manager' \}\)/);
  assert.match(router, /manager\.html/);
  assert.doesNotMatch(router, /player_career_state/);
  assert.doesNotMatch(router, /career_competition_/);
});

test('manager mode has a dedicated page and service', async () => {
  const html = await read('manager.html');
  const service = await read('src/services/manager-service.js');
  const runtime = await read('src/pages/manager/manager.js');
  assert.match(html, /MODO MANAGER/);
  assert.match(runtime, /saveManagerLineup/);
  assert.match(runtime, /saveManagerTactics/);
  assert.match(runtime, /saveManagerTraining/);
  for (const rpc of ['get_manager_onboarding','create_manager_profile','accept_manager_job','get_manager_hub','set_manager_tactics','set_manager_training_plan','set_manager_lineup']) {
    assert.match(service, new RegExp(rpc));
  }
});

test('manager persistence is isolated from player career state', async () => {
  const sql = await read('supabase/migrations/20260814144500_manager_mode_foundation.sql');
  for (const table of ['manager_profiles','manager_careers','manager_squad_state']) {
    assert.match(sql, new RegExp(`public\\.${table}`));
  }
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /base_player_id uuid NOT NULL REFERENCES public\.base_ai_players/);
  assert.doesNotMatch(sql, /UPDATE public\.player_career_state/);
  assert.doesNotMatch(sql, /INSERT INTO public\.career_competition_/);
  assert.doesNotMatch(sql, /UPDATE public\.base_ai_players/);
});

test('manager lineup requires exactly eleven players', async () => {
  const sql = await read('supabase/migrations/20260814144500_manager_mode_foundation.sql');
  assert.match(sql, /array_length\(p_starters,1\),0\) <> 11/);
  assert.match(sql, /count\(DISTINCT x\)/);
});
