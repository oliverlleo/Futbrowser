import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('professional clubs never enter initial academy offers', async () => {
  const guard = await read('supabase/migrations/20260812103025_competition_club_level_onboarding_guard.sql');
  assert.match(guard, /generate_initial_offers/);
  assert.match(guard, /WHERE is_active AND club_level=''academy''/);
});

test('production validation requires the academy offer guard', async () => {
  const validation = await read('supabase/migrations/20260812103500_competition_post_deploy_validation.sql');
  assert.match(validation, /club_level=''academy''/);
  assert.match(validation, /professional clubs can leak into academy onboarding offers/);
});
