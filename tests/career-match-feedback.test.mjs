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

test('live match usability keeps narration in its own row and intensity near the player card',async()=>{
  const css=await read('src/pages/career/career-ui-usability-v6.css');
  const intensity=await read('src/pages/career/career-match-gameplay-depth-ui.js');
  assert.match(css,/\.match-stage \.match-pitch\{[\s\S]*min-height:0!important/);
  assert.match(css,/\.match-left-rail,[\s\S]*\.match-right-rail\{[\s\S]*overflow-y:auto/);
  assert.match(css,/\.match-commentary-panel\.match-commentary-v3\{[\s\S]*flex:0 0 112px/);
  assert.match(intensity,/match-player-live/);
  assert.match(intensity,/insertAdjacentElement\('afterend',card\)/);
});

test('development keeps parent sections on separate rows, attribute cards in columns and specialties in rows',async()=>{
  const css=await read('src/pages/career/career-ui-usability-v6.css');
  const layout=await read('src/pages/career/career-development-row-layout-v14.css');
  const ui=await read('src/pages/career/career-ui-usability-v6.js');
  const development=await read('src/pages/career/career-development-loop.js');
  assert.match(layout,/development-overview ~ \.profile-grid\{[\s\S]*grid-template-columns:minmax\(0,1fr\)!important/);
  assert.match(layout,/profile-grid > \.meta-card,[\s\S]*profile-grid > \.meta-card-wide\{[\s\S]*grid-column:1\/-1!important/);
  assert.match(layout,/attribute-grid\{[\s\S]*grid-template-columns:repeat\(6,minmax\(0,1fr\)\)!important/);
  assert.match(layout,/profile-skill-list\{[\s\S]*grid-template-columns:minmax\(0,1fr\)!important/);
  assert.match(css,/\.profile-career-level\{/);
  assert.match(development,/profileCareerLevel/);
  assert.match(development,/profile-level-xp/);
  assert.doesNotMatch(development,/Níveis normais dão 2 pts;/);
  assert.match(css,/career-upgrade-alert/);
  assert.match(css,/development-tab-alert/);
  assert.match(css,/career-level-up-toast/);
  assert.match(ui,/get_career_progression/);
  assert.match(ui,/renderAvatarAlert/);
  assert.match(ui,/renderDevelopmentTabAlert/);
  assert.match(ui,/showLevelUpToast/);
});

test('postgame summary uses one readable content width and larger development report text',async()=>{
  const css=await read('src/pages/career/career-ui-usability-v6.css');
  assert.match(css,/postgame-head\{[\s\S]*width:min\(1120px,100%\)/);
  assert.match(css,/postgame-development-advice\{[\s\S]*width:min\(1120px,100%\)/);
  assert.match(css,/postgame-dev-head strong\{[\s\S]*font-size:17px!important/);
  assert.match(css,/postgame-xp-note::after/);
  assert.match(css,/atributo principal ou especialidade/);
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

test('commercial career UI exposes sponsorship decisions, full terms, live refresh and market negotiation',async()=>{
  const commercial=await read('src/pages/career/career-commercial-market-v12.js');
  const polish=await read('src/pages/career/career-commercial-polish-v13.js');
  assert.match(commercial,/get_career_sponsorship_state/);
  assert.match(commercial,/respond_career_sponsor_proposal/);
  assert.match(commercial,/complete_career_sponsor_deliverable/);
  assert.match(commercial,/negotiate_offer/);
  assert.match(commercial,/Negociar com empresário/);
  assert.match(commercial,/Negociar contrato/);
  assert.match(polish,/Mensalidade/);
  assert.match(polish,/Luvas/);
  assert.match(polish,/Máximo semanal/);
  assert.match(polish,/Exclusividade/);
  assert.match(polish,/get_career_hub/);
  assert.match(polish,/career:hub-rendered/);
});

test('Career Hub loads continuous possession, option guard, balance and current commercial bundles in the correct order',async()=>{
  const html=await read('career.html');
  const loader=await read('src/pages/career/career-loader-v3.js');
  const usability=await read('src/pages/career/career-ui-usability-v6.js');
  assert.match(html,/career-loader-v3\.js\?v=20260814-3/);
  assert.match(loader,/career-development-row-layout-v14\.css\?v=20260814-2/);
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
  assert.ok(loader.indexOf('career-development-loop.js')<loader.indexOf('career-ui-usability-v6.js'),'usability layer must load after development and match UI');
  assert.match(loader,/career-match-gameplay-depth-ui\.js\?v=20260813-1/);
  assert.match(loader,/career-match-backend-guard\.js\?v=20260812-1/);
  assert.match(loader,/career-match-runtime-v3\.js\?v=20260812-2/);
  assert.match(loader,/career-development-loop\.js\?v=20260814-1/);
  assert.match(loader,/career-ui-usability-v6\.js\?v=20260814-4/);
  assert.match(usability,/career-commercial-market-v12\.js\?v=20260813-1/);
  assert.match(usability,/career-commercial-polish-v13\.js\?v=20260814-1/);
  assert.match(usability,/career-ui-usability-v6\.css\?v=20260814-2/);
});
