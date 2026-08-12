import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const pitch = fs.readFileSync('src/pages/career/career-team-pitch-v2.js', 'utf8');
const competition = fs.readFileSync('src/pages/career/career-competition-center.js', 'utf8');
const loader = fs.readFileSync('src/pages/career/career-loader-v3.js', 'utf8');

test('club lineup pitch renders after the async team DOM is actually created', () => {
  assert.match(pitch, /new MutationObserver/);
  assert.match(pitch, /observer\.observe\(host,\{childList:true,subtree:true\}\)/);
  assert.match(pitch, /renderAfterDomUpdate/);
  assert.doesNotMatch(pitch, /attempt>20/);
});

test('competition center opens from canonical server state instead of stale local state', () => {
  assert.match(competition, /state\.tab = 'overview'/);
  assert.match(competition, /state\.competition = null/);
  assert.match(competition, /state\.round = null/);
  assert.match(competition, /await load\(null, null\)/);
  assert.match(competition, /overlay\.classList\.contains\('hidden'\)/);
});

test('career loader busts cache for both stability fixes', () => {
  assert.match(loader, /career-team-pitch-v2\.js\?v=20260812-4/);
  assert.match(loader, /career-competition-center\.js\?v=20260812-4/);
});
