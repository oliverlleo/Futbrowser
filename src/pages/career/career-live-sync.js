import { getCareerMetaHub } from './career-meta-service.js?v=20260811-5';

if (typeof document !== 'undefined' && !document.querySelector('link[data-career-pitch]')) {
  const pitchCss = document.createElement('link');
  pitchCss.rel = 'stylesheet';
  pitchCss.href = 'src/pages/career/career-pitch.css?v=20260811-5';
  pitchCss.dataset.careerPitch = 'true';
  document.head.appendChild(pitchCss);
}

const money = value => new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL', maximumFractionDigits: 0
}).format(Number(value || 0));

let timer = null;
let running = false;
let pitchTimer = null;

async function syncActivityEconomy() {
  if (running) return;
  const grid = document.getElementById('activityGrid');
  if (!grid) return;
  running = true;
  try {
    const hub = await getCareerMetaHub();
    const byKey = new Map((hub?.activities || []).map(item => [item.key, item]));
    grid.querySelectorAll('[data-activity]').forEach(card => {
      const item = byKey.get(card.dataset.activity);
      const existing = card.querySelector('.activity-price');
      const expected = Number(item?.cash_cost || 0) > 0
        ? `cost:${Number(item.cash_cost)}`
        : Number(item?.cash_reward || 0) > 0
          ? `reward:${Number(item.cash_reward)}`
          : '';
      if (card.dataset.economyBadge === expected) return;
      existing?.remove();
      card.classList.remove('sponsored-activity');
      card.dataset.economyBadge = expected;
      if (!item) return;
      if (Number(item.cash_cost || 0) > 0) {
        card.insertAdjacentHTML('afterbegin', `<span class="activity-price cost"><i data-lucide="wallet"></i>${money(item.cash_cost)}</span>`);
      } else if (Number(item.cash_reward || 0) > 0) {
        card.insertAdjacentHTML('afterbegin', `<span class="activity-price reward"><i data-lucide="badge-dollar-sign"></i>+ ${money(item.cash_reward)}</span>`);
        card.classList.add('sponsored-activity');
      }
    });
    if (window.lucide) window.lucide.createIcons({ strokeWidth: 1.8 });
  } catch (error) {
    console.error('Falha ao sincronizar economia das atividades:', error);
  } finally {
    running = false;
  }
}

function scheduleSync() {
  window.clearTimeout(timer);
  timer = window.setTimeout(syncActivityEconomy, 80);
}

function lineupLine(position) {
  const value = String(position || '').toLowerCase();
  if (value.includes('goleiro')) return 'gk';
  if (value.includes('zagueiro') || value.includes('lateral')) return 'def';
  if (value.includes('volante') || value.includes('meio') || value.includes('meia')) return 'mid';
  return 'att';
}

function styleProbablePitch() {
  const pitch = document.querySelector('#clubProfileContent .probable-lineup');
  if (!pitch) return;
  pitch.classList.add('football-pitch');
  const rows = { att: [], mid: [], def: [], gk: [] };
  pitch.querySelectorAll('.lineup-player').forEach(player => {
    const descriptor = player.querySelector('small')?.textContent || '';
    const position = descriptor.split('·')[0]?.trim();
    const line = lineupLine(position);
    player.classList.remove('pitch-att', 'pitch-mid', 'pitch-def', 'pitch-gk');
    player.classList.add(`pitch-${line}`);
    rows[line].push(player);
  });
  const rowNumber = { att: 1, mid: 2, def: 3, gk: 4 };
  Object.entries(rows).forEach(([line, players]) => {
    players.forEach((player, index) => {
      const center = Math.round(((index + 1) * 13) / (players.length + 1));
      const start = Math.max(1, Math.min(11, center - 1));
      player.style.gridRow = String(rowNumber[line]);
      player.style.gridColumn = `${start} / span 2`;
    });
  });
}

function schedulePitch() {
  window.clearTimeout(pitchTimer);
  pitchTimer = window.setTimeout(styleProbablePitch, 30);
}

function isolateActivityGrid() {
  const current = document.getElementById('activityGrid');
  if (!current || current.dataset.observerSafe === 'true') return current;
  const replacement = current.cloneNode(false);
  replacement.dataset.observerSafe = 'true';
  current.replaceWith(replacement);
  return replacement;
}

function init() {
  const grid = isolateActivityGrid();
  if (grid) {
    new MutationObserver(scheduleSync).observe(grid, { childList: true });
    scheduleSync();
  }
  const club = document.getElementById('clubProfileContent');
  if (club) {
    new MutationObserver(schedulePitch).observe(club, { childList: true, subtree: true });
    schedulePitch();
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
else init();
