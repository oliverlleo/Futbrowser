import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migration = await readFile(new URL('../supabase/migrations/20260814191104_career_enforce_sporting_category_domains.sql', import.meta.url), 'utf8');
const clubStructure = await readFile(new URL('../supabase/migrations/20260814191817_career_enforce_club_level_squad_structure.sql', import.meta.url), 'utf8');
const SPORTING = "'u15','u17','u18','u20','first_team'";

test('sporting state tables reject academy root as a playable squad', () => {
  for (const constraint of [
    'player_squad_assignments_squad_level_check',
    'player_offers_target_squad_check',
    'player_transfer_bids_target_squad_level_check',
    'player_transfer_agreements_target_squad_level_check',
    'player_market_interests_target_squad_level_check',
    'player_promotion_reviews_from_squad_check',
    'player_promotion_reviews_recommended_squad_check'
  ]) assert.match(migration, new RegExp(constraint));

  assert.ok(migration.includes(`CHECK(squad_level IN(${SPORTING}))`));
  assert.ok(migration.includes(`CHECK(target_squad_level IS NULL OR target_squad_level IN(${SPORTING}))`));
  assert.ok((migration.match(new RegExp(`CHECK\\(target_squad_level IN\\(${SPORTING}\\)\\)`, 'g')) || []).length >= 3);
  assert.ok(migration.includes(`CHECK(from_squad IS NULL OR from_squad IN(${SPORTING}))`));
  assert.ok(migration.includes(`CHECK(recommended_squad IS NULL OR recommended_squad IN(${SPORTING}))`));
});

test('competition age level is youth-only or null for professional competitions', () => {
  assert.match(migration, /competition_definitions_age_level_check/);
  assert.match(migration, /CHECK\(age_level IS NULL OR age_level IN\('u15','u17','u18','u20'\)\)/);
});

test('legacy Base promotion artifact is reconstructed before constraints are tightened', () => {
  assert.match(migration, /career_promotion_snapshot\(r\.player_id\)/);
  assert.match(migration, /WHERE r\.from_squad='base'/);
  assert.match(migration, /outcome='stay'/);
  assert.match(migration, /Existem revisões de promoção legadas sem reconstrução esportiva segura/);
});

test('base_clubs reserves Base for academy roots and first_team for professional clubs', () => {
  assert.match(clubStructure, /base_clubs_squad_level_check/);
  assert.match(clubStructure, /club_level='academy' AND squad_level IN\('base','u15','u17','u18','u20'\)/);
  assert.match(clubStructure, /club_level='professional' AND squad_level='first_team'/);
});

test('academy root self-link and youth-to-root link shape are explicit', () => {
  assert.match(clubStructure, /base_clubs_academy_link_shape_check/);
  assert.match(clubStructure, /squad_level='base' AND academy_base_id=id/);
  assert.match(clubStructure, /squad_level IN\('u15','u17','u18','u20'\) AND academy_base_id IS NOT NULL AND academy_base_id<>id/);
});
