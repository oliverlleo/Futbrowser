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

test('development keeps parent sections on separate rows, responsive card columns and only one full career level surface',async()=>{
  const css=await read('src/pages/career/career-ui-usability-v6.css');
  const ui=await read('src/pages/career/career-ui-usability-v6.js');
  const development=await read('src/pages/career/career-development-loop.js');
  assert.match(css,/development-overview ~ \.profile-grid\{[\s\S]*grid-template-columns:minmax\(0,1fr\)!important/);
  assert.match(css,/profile-grid > \.meta-card,[\s\S]*profile-grid > \.meta-card-wide\{[\s\S]*grid-column:1\/-1!important/);
  assert.match(css,/attribute-grid\{[\s\S]*grid-template-columns:repeat\(6,minmax\(0,1fr\)\)!important/);
  assert.match(css,/profile-skill-list\{[\s\S]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/);
  assert.match(css,/@media\(max-width:1180px\)\{[\s\S]*attribute-grid\{grid-template-columns:repeat\(3/);
  assert.match(css,/@media\(max-width:820px\)\{[\s\S]*attribute-grid\{grid-template-columns:repeat\(2/);
  assert.match(css,/@media\(max-width:820px\)\{[\s\S]*profile-skill-list\{grid-template-columns:1fr!important/);
  assert.match(css,/@media\(max-width:560px\)\{[\s\S]*attribute-grid\{grid-template-columns:1fr!important/);
  assert.match(development,/career-level-card/);
  assert.doesNotMatch(development,/profileCareerLevel/);
  assert.doesNotMatch(development,/profile-level-xp/);
  assert.doesNotMatch(development,/installProfileLevelObserver/);
  assert.doesNotMatch(development,/Níveis normais dão 2 pts;/);
  assert.match(css,/career-upgrade-alert/);
  assert.match(css,/development-tab-alert/);
  assert.match(css,/career-level-up-toast/);
  assert.match(ui,/get_career_progression/);
  assert.match(ui,/renderAvatarAlert/);
  assert.match(ui,/renderDevelopmentTabAlert/);
  assert.match(ui,/showLevelUpToast/);
});

test('career level summary is isolated, readable, stable across profile renders and does not open the player modal itself',async()=>{
  const summary=await read('src/pages/career/career-level-summary-v8.js');
  assert.match(summary,/career-level-track/);
  assert.match(summary,/career-level-rank/);
  assert.match(summary,/career-level-summary-strip/);
  assert.match(summary,/career-level-xp/);
  assert.match(summary,/classList\.remove\('career-level-badge'\)/);
  assert.match(summary,/classList\.add\('career-level-summary-strip'\)/);
  assert.match(summary,/var\(--green-2\)/);
  assert.match(summary,/% para o nível/);
  assert.match(summary,/host=player\?\.children\?\.\[1\]/);
  assert.match(summary,/badge\.parentElement!==host/);
  assert.match(summary,/host\.appendChild\(badge\)/);
  assert.match(summary,/event=>event\.stopPropagation\(\)/);
  assert.match(summary,/summarySignature/);
  assert.match(summary,/badge\.querySelector\('\.career-level-track'\)/);
  assert.match(summary,/observer\.observe\(player,/);
  assert.doesNotMatch(summary,/observer\.observe\(document\.body/);
  assert.doesNotMatch(summary,/identity-player > div:last-child/);
  assert.doesNotMatch(summary,/background:linear-gradient\(145deg,#2563eb/);
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

test('commercial career UI exposes direct decisions and a real editable sponsor counteroffer flow',async()=>{
  const commercial=await read('src/pages/career/career-commercial-market-v12.js');
  const polish=await read('src/pages/career/career-commercial-polish-v13.js');
  const negotiation=await read('src/pages/career/career-sponsor-negotiation-v15.js');
  const migration=await read('supabase/migrations/20260814103939_manual_sponsor_counter_negotiation.sql');
  assert.match(commercial,/get_career_sponsorship_state/);
  assert.match(commercial,/respond_career_sponsor_proposal/);
  assert.match(commercial,/complete_career_sponsor_deliverable/);
  assert.match(commercial,/negotiate_offer/);
  assert.match(commercial,/sponsor-proposal-card/);
  assert.match(commercial,/data-sponsor-modal-response=\"decline\"/);
  assert.match(commercial,/data-sponsor-modal-response=\"negotiate\"/);
  assert.match(commercial,/data-sponsor-modal-response=\"accept\"/);
  assert.match(commercial,/Negociar com empresário/);
  assert.match(commercial,/Negociar contrato/);
  assert.doesNotMatch(commercial,/new MutationObserver/);
  assert.doesNotMatch(polish,/new MutationObserver/);
  assert.match(polish,/Mensalidade/);
  assert.match(polish,/Luvas/);
  assert.match(polish,/Máximo semanal/);
  assert.match(polish,/Exclusividade/);
  assert.match(polish,/Bônus por desempenho/);
  assert.match(polish,/Penalidades por descumprimento/);
  assert.match(negotiation,/Sua contraproposta/);
  assert.match(negotiation,/name=\"monthly_fee\"/);
  assert.match(negotiation,/name=\"per_delivery_fee\"/);
  assert.match(negotiation,/name=\"contract_days\"/);
  assert.match(negotiation,/name=\"max_weekly_deliveries\"/);
  assert.match(negotiation,/name=\"exclusivity\"/);
  assert.match(negotiation,/name=\"first_miss_percent\"/);
  assert.match(negotiation,/name=\"bonus_multiplier\"/);
  assert.match(negotiation,/negotiate_career_sponsor_proposal/);
  assert.match(negotiation,/stopImmediatePropagation/);
  assert.match(migration,/CREATE OR REPLACE FUNCTION public\.negotiate_career_sponsor_proposal/);
  assert.match(migration,/result:='accepted'/);
  assert.match(migration,/result:='countered'/);
  assert.match(migration,/result:='rejected'/);
  assert.match(migration,/negotiation_history/);
  assert.match(polish,/get_career_hub/);
  assert.match(polish,/career:mail-selected/);
});

test('career market bootstraps immediately even if career:hub-rendered already fired',async()=>{
  const clubPath=await read('src/pages/career/career-club-path-v8.js');
  assert.match(clubPath,/async function bootstrapMarket\(\)/);
  assert.match(clubPath,/currentHub=await rpc\('get_career_hub'\)/);
  assert.match(clubPath,/await reviewWorld\(\);\s*await loadData\(\);/);
  assert.match(clubPath,/document\.addEventListener\('career:hub-rendered',handleHub\)/);
  assert.match(clubPath,/await bootstrapMarket\(\);/);
});

test('Career Hub loads continuous possession, safe inbox events and current commercial bundles in the correct order',async()=>{
  const html=await read('career.html');
  const loader=await read('src/pages/career/career-loader-v3.js');
  const usability=await read('src/pages/career/career-ui-usability-v6.js');
  const inbox=await read('src/pages/career/career-inbox.js');
  assert.match(html,/career-loader-v3\.js\?v=20260814-11/);
  assert.match(html,/career-level-summary-v8\.js\?v=20260814-5/);
  assert.match(html,/career-sponsor-negotiation-v15\.js\?v=20260814-1/);
  assert.doesNotMatch(loader,/career-development-row-layout-v14/);
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
  assert.ok(loader.indexOf('career-development-loop.js')<loader.indexOf('career-level-summary-v8.js'),'summary must normalize the legacy level badge after development renders it');
  assert.ok(loader.indexOf('career-level-summary-v8.js')<loader.indexOf('career-ui-usability-v6.js'),'level summary must stabilize before the usability layer decorates player identity');
  assert.match(loader,/target === document\.body/);
  assert.match(loader,/career-development-loop\.js\?v=20260814-2/);
  assert.match(loader,/career-level-summary-v8\.js\?v=20260814-5/);
  assert.match(loader,/career-ui-usability-v6\.js\?v=20260814-9/);
  assert.match(usability,/career-club-path-v8\.js\?v=20260814-1/);
  assert.match(usability,/career-commercial-market-v12\.js\?v=20260814-3/);
  assert.match(usability,/career-commercial-polish-v13\.js\?v=20260814-3/);
  assert.match(usability,/career-market-inbox-v14\.js\?v=20260814-1/);
  assert.match(usability,/career-sponsor-negotiation-v15\.js\?v=20260814-1/);
  assert.match(usability,/career-ui-usability-v6\.css\?v=20260814-5/);
  assert.match(usability,/career:mail-selected/);
  assert.match(inbox,/career:mail-selected/);
});