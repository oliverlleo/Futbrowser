import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('generated squads have formation-aware starters and shirt numbers', async () => {
  const sql = await read('supabase/migrations/20260812103020_competition_generated_squad_integrity.sql');
  for (const text of [
    "formation='4-2-3-1'",
    "formation='4-4-2'",
    "role_group='gk'",
    "group_rank<=2",
    "'Titular'",
    "'Rotação'",
    'squad_number',
    'count(DISTINCT p.squad_number)<>22'
  ]) assert.ok(sql.includes(text), `missing ${text}`);
});

test('production validation rejects malformed professional squads', async () => {
  const sql = await read('supabase/migrations/20260812103500_competition_post_deploy_validation.sql');
  for (const text of [
    'count(p.id)<>22',
    'p.is_starter)<>11',
    "c.formation='4-2-3-1'",
    "c.formation='4-4-2'",
    'count(DISTINCT p.squad_number)<>22'
  ]) assert.ok(sql.includes(text), `missing ${text}`);
});
