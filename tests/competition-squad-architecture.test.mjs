import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const competitionUi = readFileSync('src/pages/career/career-competition-center.js', 'utf8');
const loader = readFileSync('src/pages/career/career-loader-v3.js', 'utf8');
const careerHtml = readFileSync('career.html', 'utf8');
const integrityMigration = readFileSync('supabase/migrations/20260812192549_academy_squad_integrity_guards.sql', 'utf8');

test('competition UI separates current round from viewed round', () => {
  assert.match(competitionUi, /async function load\(code = state\.competition, round = null\)/);
  assert.match(competitionUi, /selected\?\.viewed_round \?\? data\?\.selected\?\.current_round/);
  assert.match(competitionUi, /load\(state\.competition, null\)/);
  assert.doesNotMatch(competitionUi, /career:hub-rendered[^\n]+load\(state\.competition, state\.round\)/);
});

test('competition teaser is driven by the next fixture', () => {
  assert.match(competitionUi, /next\.stage === 'league' \? `Rodada \$\{next\.round\}`/);
  assert.match(competitionUi, /assignment\?\.competition_ready === false/);
  assert.match(competitionUi, /Aguardando promoção/);
});

test('career loader busts the updated competition bundle', () => {
  assert.match(loader, /career-competition-center\.js\?v=20260812-2/);
  assert.match(careerHtml, /career-loader-v3\.js\?v=20260812-3/);
});

test('database migration guards academy category integrity', () => {
  assert.match(integrityMigration, /trg_validate_competition_entry_squad/);
  assert.match(integrityMigration, /trg_validate_competition_fixture_squads/);
  assert.match(integrityMigration, /trg_validate_competition_stat_squad/);
  assert.match(integrityMigration, /trg_validate_academy_offer_scope/);
  assert.match(integrityMigration, /squad_level IS DISTINCT FROM 'base'/);
});
