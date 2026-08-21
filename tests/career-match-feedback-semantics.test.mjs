import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('non-shot action labels reflect chance instead of promising success', async () => {
  const balance = await read('src/pages/career/career-match-action-balance-v4.js');
  const depth = await read('src/pages/career/career-match-gameplay-depth-v2.js');
  assert.doesNotMatch(balance, /next\.chanceLabel='Sucesso'/);
  assert.doesNotMatch(depth, /c\.chanceLabel=c\.tags\.includes\('shot'\)\?'Gol':'Sucesso'/);
  assert.match(balance, /next\.chanceLabel=labelForChance\(model\.chance\)/);
  assert.match(depth, /c\.successChance>=72\?'Favorável'/);
});

test('match feedback distinguishes a goal from a saved or blocked shot', async () => {
  const runtime = await read('src/pages/career/career-match-runtime-v3.js');
  assert.match(runtime, /shot\?\.goal/);
  assert.match(runtime, /NO ALVO, MAS DEFENDIDO/);
  assert.match(runtime, /FINALIZAÇÃO BLOQUEADA/);
  assert.match(runtime, /FINALIZAÇÃO DESPERDIÇADA/);
});
