import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('resolved match choice cannot remain stuck over the pitch',async()=>{
  const patch=await read('src/pages/career/career-match-choice-feedback.js');
  assert.match(patch,/\[data-match-choice\]/);
  assert.match(patch,/panel\.classList\.contains\('success'\)/);
  assert.match(patch,/panel\.classList\.contains\('fail'\)/);
  assert.match(patch,/hideResolvedDecision\(panel\)/);
  assert.match(patch,/match-decision hidden/);
  assert.match(patch,/showOutcome/);
  assert.match(patch,/AÇÃO BEM-SUCEDIDA/);
  assert.match(patch,/A JOGADA NÃO FUNCIONOU/);
});

test('follow-up decisions are preserved instead of being hidden by feedback patch',async()=>{
  const patch=await read('src/pages/career/career-match-choice-feedback.js');
  assert.match(patch,/if\(!success&&!fail\)return/);
  assert.match(patch,/jogada encadeada/i);
});

test('match-day action card is moved into the free center Career Hub column',async()=>{
  const patch=await read('src/pages/career/career-match-choice-feedback.js');
  const css=await read('src/pages/career/career-match-hub-fix.css');
  assert.match(patch,/document\.querySelector\('\.activity-column'\)/);
  assert.match(patch,/center\.prepend\(lock\)/);
  assert.match(patch,/match-lock-centered/);
  assert.match(css,/\.activity-column > \.match-lock\.match-lock-centered/);
  assert.doesNotMatch(css,/width:\s*100vw/);
});

test('Career Hub cache key and loader include the hotfix',async()=>{
  const html=await read('career.html');
  const loader=await read('src/pages/career/career-loader-v3.js');
  assert.match(html,/career-loader-v3\.js\?v=20260811-12/);
  assert.match(loader,/career-match-choice-feedback\.js\?v=20260811-2/);
  assert.match(loader,/career-match-hub-fix\.css\?v=20260811-2/);
});
