import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('dialogue frequency layer adds contextual families beyond teammate and night-out events', async () => {
  const sql = await read('supabase/migrations/20260821193000_career_dialogue_frequency_and_context.sql');
  for (const key of [
    'coach_tactical_feedback',
    'coach_role_expectation',
    'medical_load_check',
    'matchday_briefing',
    'agent_market_update',
    'media_interview_followup',
    'community_reaction',
    'family_routine_call'
  ]) assert.match(sql, new RegExp(`\\('${key}'`));
  assert.match(sql, /tactical_study/);
  assert.match(sql, /agent_meeting/);
  assert.match(sql, /media_interview/);
  assert.match(sql, /community_action/);
  assert.match(sql, /category='recovery'/);
});

test('dialogue frequency layer allows one contextual conversation per day and blocks pending overlap', async () => {
  const sql = await read('supabase/migrations/20260821193000_career_dialogue_frequency_and_context.sql');
  assert.match(sql, /status='pending'/);
  assert.match(sql, /last_interaction_date IS NOT NULL AND v_state\.last_interaction_date>=NEW\.career_date/);
  assert.match(sql, /last_interaction_date=NEW\.career_date/);
  assert.match(sql, /trg_zzzzzz_richer_dialogue/);
});

test('dialogue frequency layer uses teammate anti-repetition picker instead of duplicating relation logic', async () => {
  const sql = await read('supabase/migrations/20260821193000_career_dialogue_frequency_and_context.sql');
  assert.match(sql, /private\.pick_teammate_dialogue_event/);
  assert.match(sql, /v_key LIKE 'mate_%'/);
  assert.match(sql, /teammate_id/);
  assert.match(sql, /kind','teammate_interaction/);
});

test('new dialogue choices carry career consequences instead of only narrative text', async () => {
  const sql = await read('supabase/migrations/20260821193000_career_dialogue_frequency_and_context.sql');
  const choiceEffects = [...sql.matchAll(/"effects":\{([^}]+)\}/g)].map(match => match[1]);
  assert.ok(choiceEffects.length >= 24, `expected many authored choice effects, found ${choiceEffects.length}`);
  assert.match(sql, /"coach":/);
  assert.match(sql, /"pressure":/);
  assert.match(sql, /"professionalism":/);
  assert.match(sql, /pick_teammate_dialogue_event/);
});
