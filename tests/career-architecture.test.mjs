import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('career page loads only the safe loader runtime', async () => {
  const html = await read('career.html');
  assert.match(html, /career-loader-v3\.js\?v=/);
  assert.doesNotMatch(html, /<script[^>]+career-enhancements\.js/);
  assert.doesNotMatch(html, /<script[^>]+career-live-sync\.js/);
  assert.doesNotMatch(html, /<script[^>]+career-v2\.js/);
});

test('career service has no UI side-effect imports', async () => {
  const service = await read('src/services/career-service.js');
  assert.doesNotMatch(service, /pages\/career\/career-(?:enhancements|live-sync|profile)/);
});

test('legacy compatibility modules cannot restore recursive observers', async () => {
  const enhancement = await read('src/pages/career/career-enhancements.js');
  const liveSync = await read('src/pages/career/career-live-sync.js');
  assert.doesNotMatch(enhancement, /new\s+MutationObserver/);
  assert.doesNotMatch(liveSync, /new\s+MutationObserver/);
  assert.doesNotMatch(liveSync, /cloneNode/);
});

test('safe loader blocks subtree observation on hot Career Hub nodes', async () => {
  const loader = await read('src/pages/career/career-loader-v3.js');
  assert.match(loader, /target\?\.id === 'activityGrid'/);
  assert.match(loader, /safe\.subtree = false/);
  assert.match(loader, /career-v3\.js/);
});

test('player profile contains stats, development and history tabs', async () => {
  const profile = await read('src/pages/career/career-profile-v2.js');
  for (const tab of ['profile', 'stats', 'development', 'history']) {
    assert.match(profile, new RegExp(`data-player-tab=\\"${tab}\\"`));
  }
  for (const stat of ['Jogos', 'Gols', 'Assist.', 'Vitórias', 'Empates', 'Derrotas']) {
    assert.match(profile, new RegExp(stat.replace('.', '\\.'), 'i'));
  }
});

test('career history schema separates academy, professional and national teams', async () => {
  const sql = await read('supabase/migrations/20260811190600_career_player_history_stats.sql');
  assert.match(sql, /player_match_history/);
  assert.match(sql, /player_honours/);
  assert.match(sql, /player_national_callups/);
  assert.match(sql, /'academy'/);
  assert.match(sql, /'professional'/);
  for (const level of ['u15', 'u17', 'u20', 'senior']) assert.match(sql, new RegExp(`'${level}'`));
});

test('teammate engine has at least twenty distinct contextual dialogues', async () => {
  const sql = await read('supabase/migrations/20260811191000_varied_teammate_dialogues.sql');
  const keys = [...sql.matchAll(/\('((?:mate_)[a-z0-9_]+)'\s*,/g)].map(match => match[1]);
  const unique = new Set(keys);
  assert.ok(unique.size >= 20, `expected >=20 teammate dialogues, found ${unique.size}`);
  assert.match(sql, /pick_teammate_dialogue_event/);
});

test('rewritten teammate events synchronize sanitized public choices', async () => {
  const sql = await read('supabase/migrations/20260811191300_sync_teammate_dialogue_choices.sql');
  assert.match(sql, /jsonb_build_object\('key',e->>'key','label',e->>'label'\)/);
  assert.match(sql, /choices=v_public_choices/);
  assert.doesNotMatch(sql, /jsonb_build_object\('key',e->>'key','label',e->>'label','effects'/);
});

test('national call-up requires nationality and actual appearances', async () => {
  const sql = await read('supabase/migrations/20260811191400_national_callup_requirements.sql');
  assert.match(sql, /nullif\(trim\(v_nationality\),''\) IS NULL/);
  assert.match(sql, /v_games,0\)<3/);
});
