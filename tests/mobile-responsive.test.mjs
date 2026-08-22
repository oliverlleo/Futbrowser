import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const pages = ['index.html', 'dashboard.html', 'career.html', 'manager.html', 'reset-password.html'];

test('all HTML entry points load the shared mobile responsive layer', async () => {
  for (const page of pages) {
    const html = await read(page);
    assert.match(html, /src\/styles\/mobile-responsive-v1\.css\?v=20260822-1/);
  }
});

test('responsive layer preserves desktop by scoping layout changes to mobile breakpoints', async () => {
  const css = await read('src/styles/mobile-responsive-v1.css');
  assert.match(css, /@media \(max-width: 820px\)/);
  assert.match(css, /@media \(max-width: 560px\)/);
  assert.doesNotMatch(css, /^\.career-page\s*\{/m);
  assert.doesNotMatch(css, /^\.manager-page\s*\{/m);
});

test('mobile layer handles touch targets, safe areas, horizontal tables and full-screen modals', async () => {
  const css = await read('src/styles/mobile-responsive-v1.css');
  assert.match(css, /--fb-tap-size: 44px/);
  assert.match(css, /env\(--?safe-area-inset-top|env\(safe-area-inset-top\)/);
  assert.match(css, /\.squad-table-wrap[\s\S]*overflow-x: auto/);
  assert.match(css, /\.career-modal[\s\S]*max-height: calc\(100dvh - 8px\)/);
  assert.match(css, /\.match-choice-grid[\s\S]*grid-template-columns: 1fr !important/);
});

test('mobile layer keeps dense navigation and week/calendar components scrollable internally', async () => {
  const css = await read('src/styles/mobile-responsive-v1.css');
  assert.match(css, /\.activity-tabs[\s\S]*overflow-x: auto/);
  assert.match(css, /\.week-strip[\s\S]*overflow-x: auto/);
  assert.match(css, /\.competition-tabs[\s\S]*overflow-x: auto/);
});

test('Career loader reapplies the mobile layer after dynamic patches', async () => {
  const loader = await read('src/pages/career/career-loader-v3.js');
  assert.match(loader, /href\*="mobile-responsive-v1\.css"/);
  assert.match(loader, /document\.head\.appendChild\(mobileResponsive\)/);
});

test('narrow path cards reserve space for the floating icon', async () => {
  const css = await read('src/styles/mobile-responsive-v1.css');
  assert.match(css, /\.path-page \.path-card \.floating-icon[\s\S]*top: 98px/);
  assert.match(css, /\.path-page \.path-card \.path-content[\s\S]*padding-top: 52px/);
});

test('mobile club crest fallback hides empty image alt text', async () => {
  const css = await read('src/styles/mobile-responsive-v1.css');
  assert.match(css, /\.career-page \.club-crest-wrap img:not\(\[src\]\)/);
  assert.match(css, /\.manager-page \.manager-club-crest img\[src=""\]/);
});

test('preparation environment layout is class-based instead of inline rigid columns', async () => {
  const preparation = await read('src/pages/career/career-preparation-ui-v7.js');
  assert.match(preparation, /environment-item--trend/);
  assert.doesNotMatch(preparation, /item\.style\.gridTemplateColumns/);
});
