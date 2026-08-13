import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('preparation UI explains qualitative impact without clutter',async()=>{
  const ui=await read('src/pages/career/career-preparation-ui-v7.js');
  const css=await read('src/pages/career/career-preparation-ui-v7.css');
  assert.match(ui,/get_career_preparation_status/);
  assert.match(ui,/activity-impact-chips/);
  assert.match(ui,/IMPACTO PRINCIPAL/);
  assert.match(ui,/environment-trend/);
  assert.match(ui,/trendGlyph/);
  assert.match(ui,/overload_days/);
  assert.match(ui,/Carga muscular/);
  assert.match(ui,/Química/);
  assert.match(ui,/Oportunidades/);
  assert.match(css,/environment-trend/);
  assert.match(css,/activity-impact-modal/);
  assert.match(css,/match-physical-risk-hint/);
});

test('overload has a visible light-training restriction',async()=>{
  const ui=await read('src/pages/career/career-preparation-ui-v7.js');
  const team=await read('src/pages/career/career-preparation-team-guard-v7.js');
  assert.match(ui,/data-intensity="light"/);
  assert.match(ui,/button\.disabled=!allow/);
  assert.match(team,/team_training_normal/);
  assert.match(team,/team_training_intense/);
  assert.match(team,/carga reduzida/i);
  assert.match(team,/overload_days/);
});

test('career state affects match decisions and progressive physical risk',async()=>{
  const context=await read('src/pages/career/career-match-career-context-v6.js');
  assert.match(context,/team_chemistry_modifier/);
  assert.match(context,/lockerRoomBonus/);
  assert.match(context,/physical_load/);
  assert.match(context,/state\?\.fatigue/);
  assert.match(context,/user\?\.energy/);
  assert.match(context,/mode==='light'/);
  assert.match(context,/mode==='intense'/);
  assert.match(context,/match_injury/);
  assert.match(context,/overload/);
  assert.match(context,/minor/);
  assert.match(context,/moderate/);
  assert.match(context,/severe/);
  assert.match(context,/Risco físico/);
});

test('career context wraps action balance before possession continuity',async()=>{
  const loader=await read('src/pages/career/career-loader-v3.js');
  const action=loader.indexOf('career-match-action-balance-v4.js');
  const career=loader.indexOf('career-match-career-context-v6.js');
  const chain=loader.indexOf('career-match-possession-chain-v5.js');
  assert.ok(action>=0&&career>action);
  assert.ok(chain>career);
  assert.match(loader,/career-preparation-ui-v7\.js/);
  assert.match(loader,/career-preparation-team-guard-v7\.js/);
});
