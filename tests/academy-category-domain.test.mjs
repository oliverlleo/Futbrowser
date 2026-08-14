import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const SPORTING_LEVELS = ['u15', 'u17', 'u18', 'u20', 'first_team'];

test('career sporting path contains only real squads and never the academy root', async () => {
  const ui = await read('src/pages/career/career-club-path-v8.js');
  assert.match(ui, /const PATH=\['u15','u17','u18','u20','first_team'\]/);
  assert.doesNotMatch(ui, /const PATH=\[[^\]]*'base'/);
  for (const [key, label] of [['u15','Sub-15'],['u17','Sub-17'],['u18','Sub-18'],['u20','Sub-20'],['first_team','Profissional']]) {
    assert.match(ui, new RegExp(`${key}:'${label}'`));
  }
});

test('market exposes every sporting category instead of a generic Base filter', async () => {
  const ui = await read('src/pages/career/career-club-path-v8.js');
  assert.match(ui, /\['all','Todos'\],\['u15','Sub-15'\],\['u17','Sub-17'\],\['u18','Sub-18'\],\['u20','Sub-20'\],\['first_team','Profissional'\]/);
  assert.doesNotMatch(ui, /\['academy','Base'\]/);
  assert.doesNotMatch(ui, /\['base','Base'\]/);
  assert.match(ui, /i\.target_squad_level===clubFilter/);
});

test('onboarding reads the sporting squad returned by the backend and has no fixed Sub-18 category', async () => {
  const ui = await read('src/pages/dashboard/offers-ui.js');
  const html = await read('dashboard.html');
  assert.match(ui, /const SQUAD_LABEL = \{ u15: 'Sub-15', u17: 'Sub-17', u18: 'Sub-18', u20: 'Sub-20', first_team: 'Profissional' \}/);
  assert.match(ui, /currentDossier\.sporting_squad\?\.squad_level/);
  assert.match(ui, /offer\.target_squad_level/);
  assert.match(ui, /sportingClub\.squad_level/);
  assert.equal((ui.match(/'Sub-18'/g) || []).length, 1, 'Sub-18 must only exist in the category label map');
  assert.doesNotMatch(html, /equipe de base Sub-18/);
  assert.doesNotMatch(html, /clubes Sub-18 demonstraram interesse/);
  assert.match(html, /categoria esportiva, o projeto, o elenco/);
});

test('dashboard pins the corrected onboarding module graph instead of reusing stale cached bundles', async () => {
  const html = await read('dashboard.html');
  assert.match(html, /<script type="importmap">/);
  assert.match(html, /"\.\/src\/pages\/dashboard\/offers-ui\.js": "\.\/src\/pages\/dashboard\/offers-ui\.js\?v=20260814-1"/);
  assert.match(html, /"\.\/src\/services\/offer-service\.js": "\.\/src\/services\/offer-service\.js\?v=20260814-1"/);
  assert.match(html, /src\/pages\/dashboard\/dashboard\.js\?v=20260814-1/);
  assert.match(html, /src\/pages\/dashboard\/manager-path\.js\?v=20260814-1/);
});

test('Career Hub uses the current sporting club crest and has no legacy Sub-18 crest map', async () => {
  const career = await read('src/pages/career/career-v3.js');
  const loader = await read('src/pages/career/career-loader-v3.js');
  assert.doesNotMatch(career, /CLUB_CRESTS/);
  assert.doesNotMatch(career, /Academia Aurora Sub-18/);
  assert.match(career, /return club\.shield_url \|\| 'img\/logo\.png'/);
  assert.match(loader, /career-v3\.js\?v=20260812-2/);
});

test('career profile derives academy versus professional from sporting squad structure, never from club name', async () => {
  const profile = await read('src/pages/career/career-profile-v2.js');
  const loader = await read('src/pages/career/career-loader-v3.js');
  assert.match(profile, /const YOUTH_SQUADS = new Set\(\['u15', 'u17', 'u18', 'u20'\]\)/);
  assert.match(profile, /ui\.hub\?\.club\?\.squad_level \|\| ui\.hub\?\.state\?\.sporting_squad_level/);
  assert.match(profile, /level === 'first_team'/);
  assert.match(profile, /YOUTH_SQUADS\.has\(level\)/);
  assert.doesNotMatch(profile, /club\?\.name[^\n]*includes\('Sub-'\)/);
  assert.doesNotMatch(profile, /Titular-base/);
  assert.match(loader, /career-profile-v2\.js\?v=20260814-1/);
});

test('initial-offer service preserves target sporting category and backend sporting dossier', async () => {
  const service = await read('src/services/offer-service.js');
  assert.match(service, /target_squad_level/);
  assert.match(service, /data\.sporting_squad = data\.sporting_squad \|\|/);
  assert.match(service, /squad_level: data\.offer\.target_squad_level/);
  assert.match(service, /base_clubs:base_clubs!player_offers_club_id_fkey/);
});

test('academy root cannot receive new AI roster players', async () => {
  const migration = await read('supabase/migrations/20260814181523_career_base_root_ai_roster_write_guard.sql');
  assert.match(migration, /guard_base_ai_player_sporting_roster/);
  assert.match(migration, /v_level = 'base'/);
  assert.match(migration, /trg_guard_base_ai_player_sporting_roster/);
  for (const label of ['Sub-15', 'Sub-17', 'Sub-18', 'Sub-20']) assert.match(migration, new RegExp(label));
});

test('remaining backend fallbacks cannot present Base as a sporting category', async () => {
  const migration = await read('supabase/migrations/20260814185600_career_remove_remaining_base_sporting_fallbacks.sql');
  assert.match(migration, /c\.squad_level IN\('u15','u17','u18','u20'\)/);
  assert.match(migration, /c\.squad_level NOT IN\('u15','u17','u18','u20','first_team'\)/);
  assert.match(migration, /Categoria esportiva inválida para patrocínio/);
  assert.doesNotMatch(migration, /Base do clube/);
  assert.doesNotMatch(migration, /IN\('base','u15','u17'\)/);
});

test('onboarding migrations keep five initial offers and preserve career date', async () => {
  const fiveOffers = await read('supabase/migrations/20260814174746_career_onboarding_five_offer_integrity.sql');
  const dates = await read('supabase/migrations/20260814175210_career_onboarding_initial_date_integrity.sql');
  assert.match(fiveOffers, /LIMIT 5/);
  assert.match(fiveOffers, /target_squad_level/);
  assert.match(fiveOffers, /expected_offer_clubs',5/);
  assert.match(dates, /career_youth_squad_for_age/);
  assert.match(dates, /player_squad_assignments/);
  assert.match(dates, /career_date=coalesce\(public\.player_career_state\.career_date/);
});

test('architecture documentation defines Base as organization, not a playable squad', async () => {
  const doc = await read('docs/ACADEMY_SQUAD_ARCHITECTURE.md');
  assert.match(doc, /Base não é uma categoria esportiva/);
  assert.match(doc, /Sub-15 → Sub-17 → Sub-18 → Sub-20 → Profissional/);
  assert.match(doc, /player_career_state\.club_id.*u15.*u17.*u18.*u20.*first_team/s);
  assert.match(doc, /Não existe filtro\/categoria esportiva chamada simplesmente “Base”/);
  for (const level of SPORTING_LEVELS) assert.match(doc, new RegExp(`\`${level}\``));
});
