import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const loader = readFileSync(new URL('../src/pages/career/career-loader-v3.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../career.html', import.meta.url), 'utf8');

test('live career loader imports gameplay depth modules', () => {
  assert.match(loader, /career-match-gameplay-depth\.js/);
  assert.match(loader, /career-match-gameplay-depth-ui\.js/);
});

test('career html busts loader cache for gameplay depth deploy', () => {
  assert.match(html, /career-loader-v3\.js\?v=20260812-4/);
});
