import { getCareerMetaHub } from './career-meta-service.js?v=20260811-5';

const money = value => new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL', maximumFractionDigits: 0
}).format(Number(value || 0));

let timer = null;
let running = false;

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
      card.querySelector('.activity-price')?.remove();
      card.classList.remove('sponsored-activity');
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

function init() {
  const grid = document.getElementById('activityGrid');
  if (!grid) return;
  new MutationObserver(scheduleSync).observe(grid, { childList: true });
  scheduleSync();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
else init();
