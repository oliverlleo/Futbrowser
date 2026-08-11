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
  assert.match(loader, /career-avatar-sync\.js/);
  assert.match(loader, /career-development-loop\.js/);
});

test('Career Hub uses the same final frame and logo crop as the dashboard', async () => {
  const career = await read('src/pages/career/career-layout-fix.css');
  const dashboard = await read('src/pages/dashboard/dashboard.css');
  for (const token of ['width: min(1420px, calc(100vw - 48px))', 'background-size: 310px auto', 'background-position: -33px -74px']) {
    assert.match(dashboard, new RegExp(token.replace(/[().]/g, '\\$&')));
    assert.match(career, new RegExp(token.replace(/[().]/g, '\\$&')));
  }
});

test('selected avatar is never silently replaced by avatar1', async () => {
  const sync = await read('src/pages/career/career-avatar-sync.js');
  assert.match(sync, /dataset\.selectedAvatar/);
  assert.match(sync, /requestedFile === 'avatar1\.webp'/);
  assert.match(sync, /expectedFile !== 'avatar1\.webp'/);
  assert.match(sync, /removeAttribute\('src'\)/);
});

test('player creation preserves selected avatar identity', async () => {
  const dashboard = await read('src/pages/dashboard/dashboard.js');
  const service = await read('src/services/player-service.js');
  assert.match(dashboard, /avatar: `avatar\$\{playerCreationState\.avatarIndex\}\.webp`/);
  assert.match(service, /p_avatar: playerData\.avatar/);
  assert.match(service, /futbrowser:selected-avatar/);
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

test('balanced development loop has absorption, multi-attribute growth and non-punitive decay', async () => {
  const sql = await read('supabase/migrations/20260811191700_balanced_development_loop.sql');
  assert.match(sql, /training_absorption_multiplier/);
  assert.match(sql, /skill_attribute_weights/);
  assert.match(sql, /skill_decay_policy/);
  assert.match(sql, /remove_skill_progress/);
  assert.match(sql, /baseline_level/);
  assert.match(sql, /baseline_value/);
  assert.match(sql, /grace_days/);
  assert.match(sql, /team_training/);
  assert.match(sql, /nutrition_session/);
  assert.match(sql, /sports_psychologist/);
  assert.match(sql, /"Velocidade":0\.16,"Passe":0\.12/);
  assert.match(sql, /"Físico":0\.16,"Finalização":0\.12/);
  assert.doesNotMatch(sql, /INSERT INTO private\.career_activity_catalog/);
});

test('development status API exposes rhythm, quality and reports negative trends', async () => {
  const sql = await read('supabase/migrations/20260811191800_development_status_reports_api.sql');
  const ui = await read('src/pages/career/career-development-loop.js');
  assert.match(sql, /get_career_development_status/);
  for (const status of ['recovering', 'evolving', 'maintained', 'low_stimulus', 'losing_rhythm']) assert.match(sql, new RegExp(status));
  assert.match(sql, /Especialidades que regrediram/);
  assert.match(sql, /Pouco estímulo \/ ritmo/);
  assert.match(ui, /get_career_development_status/);
  assert.match(ui, /Recuperando ritmo|status\.label/);
});

test('free-time balance keeps existing activities and deepens teammate choices', async () => {
  const sql = await read('supabase/migrations/20260811191900_activity_tradeoffs_and_relationship_depth.sql');
  assert.match(sql, /form_delta=0/);
  assert.match(sql, /team_hangout/);
  assert.match(sql, /teammate_extra/);
  assert.match(sql, /player_teammate_relations/);
  assert.doesNotMatch(sql, /INSERT INTO private\.career_activity_catalog/);
});

test('contextual gameplay completes recovery, position value, readiness and future match hooks', async () => {
  const sql = await read('supabase/migrations/20260811192000_complete_contextual_gameplay_loop.sql');
  for (const token of ['position_skill_development_multiplier','career_injury_risk_multiplier','career_readiness_score','current_performance_context','after_contextual_activity_tradeoffs','after_career_date_recovery_boost']) assert.match(sql, new RegExp(token));
  for (const activity of ['rest_home','early_sleep','sauna','physio','nutrition_session','sports_psychologist','family_time','gaming_friends','team_hangout','media_interview','social_media_post','fan_meet','community_action']) assert.match(sql, new RegExp(`'${activity}'`));
  for (const hook of ['duel_power','ball_shielding','aerial_power','mental_stability','preparation_score']) assert.match(sql, new RegExp(hook));
  assert.match(sql, /position_multiplier/);
  assert.match(sql, /private\.career_readiness_score\(p_player_id\)/);
  assert.doesNotMatch(sql, /INSERT INTO private\.career_activity_catalog/);
});

test('sponsors have real profiles and coach focus uses position, competition and recent rhythm', async () => {
  const sql = await read('supabase/migrations/20260811192100_sponsor_profiles_coach_focus_and_gameplay_advice.sql');
  const ui = await read('src/pages/career/career-development-loop.js');
  for (const token of ['career_sponsor_brand_catalog','brand_profile','requirements','fit_score','risk_level','coach_development_focus','skill_recommended_activity','get_career_gameplay_advice']) assert.match(sql, new RegExp(token));
  for (const brand of ['Norte Sports','Eleven Wear','Arena\+','Linha de Fundo','Pulso Tech','Sprint Mobile','Ritmo Nutrition','Vértice Energy']) assert.match(sql, new RegExp(brand));
  assert.match(sql, /competitor_gap/);
  assert.match(sql, /advisory_only/);
  assert.match(ui, /get_career_gameplay_advice/);
  assert.match(ui, /FOCO DA COMISSÃO/);
  assert.match(ui, /Contato físico/);
  assert.match(ui, /Proteção de bola/);
  assert.match(ui, /Jogo aéreo/);
  assert.match(ui, /sponsor-profile-hint/);
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
