import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('club monograms are word-based and crests are regenerated after seeding', async () => {
  const sql = await read('supabase/migrations/20260812103010_competition_distinct_club_monograms.sql');
  assert.match(sql, /regexp_split_to_array/);
  assert.match(sql, /\[\[:space:\]\]\+/);
  assert.match(sql, /v_code := v_code \|\| upper\(left\(v_word,1\)\)/);
  assert.match(sql, /SET short_name=private\.club_monogram\(name\)/);
  assert.match(sql, /SET shield_url=private\.generated_club_crest/);
});

test('production validation requires unique abbreviations and generated crests per division', async () => {
  const sql = await read('supabase/migrations/20260812103500_competition_post_deploy_validation.sql');
  assert.match(sql, /count\(DISTINCT short_name\)/);
  assert.match(sql, /shield_url LIKE 'data:image\/svg\+xml;base64,%'/);
  assert.match(sql, /20 distinct club abbreviations/);
  assert.match(sql, /20 generated club crests/);
});
