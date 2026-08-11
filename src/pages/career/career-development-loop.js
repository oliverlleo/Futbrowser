import { supabase } from '../../services/supabase-client.js';

let cached = null;
let pending = null;

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function ensureStyle() {
  if (document.querySelector('link[data-career-development-loop]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'src/pages/career/career-development-loop.css?v=20260811-1';
  link.dataset.careerDevelopmentLoop = 'true';
  document.head.appendChild(link);
}

async function loadDevelopment(force = false) {
  if (cached && !force) return cached;
  if (pending) return pending;
  pending = supabase.rpc('get_career_development_status')
    .then(({ data, error }) => {
      if (error) throw error;
      cached = data;
      return data;
    })
    .finally(() => { pending = null; });
  return pending;
}

function impactText(weights = {}) {
  const entries = Object.entries(weights || {}).filter(([, weight]) => Number(weight) > 0);
  if (!entries.length) return 'desenvolvimento específico';
  return entries.map(([name, weight]) => `${name} ${Math.round(Number(weight) * 100)}%`).join(' · ');
}

function statusClass(code) {
  return ['evolving','maintained','low_stimulus','losing_rhythm','recovering'].includes(code) ? code : 'maintained';
}

function qualityCard(label, value = {}) {
  const load = Number(value.recent_load || 0);
  const loadLabel = load >= 4 ? 'Carga recente alta' : load >= 2 ? 'Carga recente moderada' : 'Carga recente controlada';
  return `<div class="dev-quality-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value.label || '—')}</strong><small>${loadLabel}</small></div>`;
}

function renderDevelopment(payload) {
  const host = document.querySelector('#playerProfileContent .meta-tab-content');
  const active = document.querySelector('#playerProfileContent [data-player-tab="development"].active');
  if (!host || !active || !payload) return;

  const attrs = payload.attributes || {};
  const skills = Array.isArray(payload.skills) ? payload.skills : [];
  const quality = payload.training_quality || {};
  const focus = payload.recommended_focus;

  host.innerHTML = `
    <div class="development-overview meta-card">
      <div><span class="meta-kicker">DESENVOLVIMENTO DINÂMICO</span><h3>Seu corpo e suas habilidades respondem à rotina</h3><p>Treino gera estímulo, recuperação melhora a absorção e áreas abandonadas por tempo suficiente começam a perder ritmo. Descanso normal não causa regressão.</p></div>
      ${focus ? `<div class="dev-focus"><span>FOCO SUGERIDO</span><strong>${escapeHtml(focus.label)}</strong><small>${escapeHtml(focus.status || '')}</small></div>` : ''}
    </div>
    <div class="dev-quality-grid meta-card-wide">
      ${qualityCard('Físico', quality.physical)}
      ${qualityCard('Velocidade', quality.speed)}
      ${qualityCard('Técnico', quality.technical)}
      ${qualityCard('Tático', quality.tactical)}
    </div>
    <div class="profile-grid">
      <section class="meta-card">
        <h3><i data-lucide="gauge"></i>Atributos principais</h3>
        <div class="attribute-grid">${Object.entries(attrs).map(([key, item]) => {
          const value = Number(item?.value || 0);
          const progress = Math.max(0, Math.min(100, Number(item?.progress || 0)));
          const floor = Number(item?.baseline_value || value);
          return `<div class="attribute-tile"><span>${escapeHtml(key)}</span><strong>${value}</strong><em><b style="width:${progress}%"></b></em><small>${Math.round(progress)}% até o próximo ponto · piso da fase ${floor}</small></div>`;
        }).join('')}</div>
      </section>
      <section class="meta-card">
        <h3><i data-lucide="activity"></i>Especialidades</h3>
        <div class="profile-skill-list">${skills.map(skill => {
          const status = skill.status || {};
          const progress = Math.max(0, Math.min(100, Number(skill.progress || 0)));
          return `<div class="profile-skill dev-skill ${statusClass(status.code)}">
            <div><strong>${escapeHtml(skill.label)}</strong><span>${escapeHtml(skill.category)} · ${escapeHtml(impactText(skill.attribute_impacts))}</span></div>
            <b>${Number(skill.level || 0)}</b>
            <span class="dev-status ${statusClass(status.code)}">${escapeHtml(status.label || 'Mantida')}</span>
            <em><i style="width:${progress}%"></i></em>
            <small>${Math.round(progress)}% para o próximo nível · ${Number(status.days_since_stimulus || 0)} dia(s) desde o último estímulo</small>
          </div>`;
        }).join('')}</div>
      </section>
      <p class="meta-footnote meta-card-wide"><i data-lucide="mail"></i>Os relatórios semanal e mensal agora registram avanço, regressão e áreas que estão ficando sem estímulo.</p>
    </div>`;

  if (window.lucide) window.lucide.createIcons({ strokeWidth: 1.8 });
}

async function hydrateIfVisible(force = false) {
  const active = document.querySelector('#playerProfileContent [data-player-tab="development"].active');
  if (!active) return;
  try {
    renderDevelopment(await loadDevelopment(force));
  } catch (error) {
    // Enquanto a migration ainda não estiver aplicada, mantém a aba antiga funcional.
    console.warn('[Career development] status avançado indisponível:', error?.message || error);
  }
}

ensureStyle();

document.addEventListener('click', event => {
  const developmentTab = event.target.closest?.('[data-player-tab="development"]');
  const playerOpen = event.target.closest?.('.identity-player');
  if (!developmentTab && !playerOpen) return;
  queueMicrotask(() => hydrateIfVisible(Boolean(developmentTab)));
});

window.addEventListener('career:updated', () => {
  cached = null;
  hydrateIfVisible(true);
});
