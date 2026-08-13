import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('resolved match choice is hidden immediately and replaced by explicit outcome feedback',async()=>{
  const runtime=await read('src/pages/career/career-match-runtime-v3.js');
  assert.match(runtime,/hideDecision\(\);showOutcome\(result,label,beforeCount\)/);
  assert.match(runtime,/AÇÃO BEM-SUCEDIDA/);
  assert.match(runtime,/A JOGADA NÃO FUNCIONOU/);
  assert.match(runtime,/outcomeText/);
});

test('follow-up decisions stay on screen when the legacy engine creates a chained play',async()=>{
  const runtime=await read('src/pages/career/career-match-runtime-v3.js');
  assert.match(runtime,/engine\?\.awaitingDecision&&engine\?\.pendingDecision/);
  assert.match(runtime,/return;/);
});

test('v5 action outcome remains readable before a chained decision is revealed',async()=>{
  const feedback=await read('src/pages/career/career-match-feedback-hold.js');
  assert.match(feedback,/FEEDBACK_HOLD_MS=2800/);
  assert.match(feedback,/career:match-choice-resolved-v5/);
  assert.match(feedback,/engine\.paused=true/);
  assert.match(feedback,/decision\.classList\.add\('hidden'\)/);
  assert.match(feedback,/decision\.classList\.remove\('hidden'\)/);
  assert.match(feedback,/A MOVIMENTAÇÃO FUNCIONOU/);
  assert.match(feedback,/A JOGADA AVANÇOU/);
});

test('substituted player can skip directly to final result instead of being forced to watch',async()=>{
  const runtime=await read('src/pages/career/career-match-runtime-v3.js');
  assert.match(runtime,/Ir direto para o resultado/);
  assert.match(runtime,/skipRestBtn/);
  assert.match(runtime,/fastForwardToEnd/);
  assert.match(runtime,/Você não precisa assistir aos minutos restantes/);
});

test('speed selector advances multiple fixed simulation steps at 2x and 4x',async()=>{
  const runtime=await read('src/pages/career/career-match-runtime-v3.js');
  assert.match(runtime,/\[1,2,4\]\.includes\(value\)/);
  assert.match(runtime,/for\(let step=0;step<speed;step\+\+\)/);
  assert.match(runtime,/2× · acelerado/);
  assert.match(runtime,/4× · muito rápido/);
});

test('commentary is bounded and cannot pile indefinitely over the pitch',async()=>{
  const runtime=await read('src/pages/career/career-match-runtime-v3.js');
  const css=await read('src/pages/career/career-match-runtime-v3.css');
  assert.match(runtime,/while\(box\.children\.length>6\)box\.firstElementChild\.remove\(\)/);
  assert.match(runtime,/box\.scrollTop=box\.scrollHeight/);
  assert.match(css,/max-height:132px/);
  assert.match(css,/text-overflow:ellipsis/);
});

test('match-day action card lives in the free center Career Hub column',async()=>{
  const runtime=await read('src/pages/career/career-match-runtime-v3.js');
  const css=await read('src/pages/career/career-match-hub-fix.css');
  assert.match(runtime,/document\.querySelector\('\.activity-column'\)/);
  assert.match(runtime,/center\.prepend\(lock\)/);
  assert.match(runtime,/match-lock-centered/);
  assert.match(css,/\.activity-column > \.match-lock\.match-lock-centered/);
});

test('post-game UI only unlocks return after backend confirms calendar progression',async()=>{
  const runtime=await read('src/pages/career/career-match-runtime-v3.js');
  assert.match(runtime,/confirmCareerAdvanced/);
  assert.match(runtime,/!hub\.match_locked/);
  assert.match(runtime,/finishMatchBtn'\)\.disabled=false/);
  assert.match(runtime,/resultado foi salvo, mas o calendário ainda não confirmou o avanço/);
});

test('Career Hub loads continuous possession, option guard, balance and readable feedback in the correct order',async()=>{
  const html=await read('career.html');
  const loader=await read('src/pages/career/career-loader-v3.js');
  assert.match(html,/career-loader-v3\.js\?v=20260813-3/);
  assert.match(loader,/career-match-football-flow-patch\.js\?v=20260811-2/);
  assert.match(loader,/career-match-football-intelligence-patch\.js\?v=20260811-2/);
  assert.match(loader,/career-match-flow-ui-patch\.js\?v=20260811-2/);
  assert.match(loader,/career-match-balance-v3\.js\?v=20260812-1/);
  assert.match(loader,/career-match-action-balance-v4\.js\?v=20260813-1/);
  assert.match(loader,/career-match-possession-chain-v5\.js\?v=20260813-1/);
  assert.match(loader,/career-match-decision-option-guard\.js\?v=20260813-1/);
  assert.match(loader,/career-match-gameplay-depth-v2\.js\?v=20260812-2/);
  assert.match(loader,/career-match-feedback-hold\.js\?v=20260813-1/);
  assert.ok(loader.indexOf('career-match-balance-v3.js')<loader.indexOf('career-match-action-balance-v4.js'),'shot balance must wrap the core before action balance');
  assert.ok(loader.indexOf('career-match-action-balance-v4.js')<loader.indexOf('career-match-possession-chain-v5.js'),'action balance must load before possession continuity');
  assert.ok(loader.indexOf('career-match-possession-chain-v5.js')<loader.indexOf('career-match-decision-option-guard.js'),'possession continuity must wrap before final option guard');
  assert.ok(loader.indexOf('career-match-decision-option-guard.js')<loader.indexOf('career-match-gameplay-depth-v2.js'),'gameplay-depth must generate options through the guard wrapper');
  assert.ok(loader.indexOf('career-match-runtime-v3.js')<loader.indexOf('career-match-feedback-hold.js'),'feedback hold needs the runtime DOM before handling outcomes');
  assert.match(loader,/career-match-gameplay-depth-ui\.js\?v=20260812-2/);
  assert.match(loader,/career-match-backend-guard\.js\?v=20260812-1/);
  assert.match(loader,/career-match-runtime-v3\.js\?v=20260812-2/);
  assert.match(loader,/career-development-loop\.js\?v=20260813-1/);
});
