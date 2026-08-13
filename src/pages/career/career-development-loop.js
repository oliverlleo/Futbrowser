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
  link.href = 'src/pages/career/career-development-loop.css?v=20260812-4';
  link.dataset.careerDevelopmentLoop = 'true';
  document.head.appendChild(link);
}

async function rpc(name, args = undefined) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw error;
  return data;
}

async function loadDevelopment(force = false) {
  if (cached && !force) return cached;
  if (pending) return pending;
  pending = Promise.all([
    rpc('get_career_development_status'),
    rpc('get_career_gameplay_advice').catch(() => null),
    rpc('get_career_progression').catch(() => null)
  ]).then(([development, advice, progression]) => {
    cached = { development, advice, progression };
    return cached;
  }).finally(() => { pending = null; });
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

function performanceCard(label, value, suffix = '') {
  return `<div class="dev-performance-card"><span>${escapeHtml(label)}</span><strong>${Number(value || 0)}${suffix}</strong></div>`;
}

function recoveryFlags(recovery = {}) {
  const flags = [];
  if (recovery.injury_prevention_active) flags.push('Prevenção física ativa');
  if (recovery.mental_stability_active) flags.push('Estabilidade mental ativa');
  if (recovery.nutrition_active) flags.push('Nutrição ativa');
  if (Number(recovery.next_day_energy_boost || 0) > 0) flags.push(`+${recovery.next_day_energy_boost} energia no próximo dia`);
  if (Number(recovery.next_day_fatigue_recovery || 0) > 0) flags.push(`-${recovery.next_day_fatigue_recovery} estafa no próximo dia`);
  return flags;
}

function progressionCard(progression = {}) {
  const level = Number(progression.level || 1);
  const xp = Number(progression.xp || 0);
  const need = Math.max(1, Number(progression.xp_to_next || 400));
  const percent = level >= Number(progression.max_level || 100) ? 100 : Math.max(0, Math.min(100, Number(progression.xp_percent ?? (xp / need * 100))));
  const points = Number(progression.evolution_points || 0);
  const pointPercent = Number(progression.evolution_point_percent || 12);
  return `<section class="career-level-card meta-card-wide">
    <div class="career-level-copy"><span>NÍVEL DE CARREIRA</span><strong>Nível ${level}</strong><small>${xp}/${need} XP para o próximo nível</small></div>
    <div class="career-level-progress"><em><b style="width:${percent}%"></b></em><span>${Math.round(percent)}%</span></div>
    <div class="career-evolution-points"><span>Pontos de evolução</span><strong>${points}</strong><small>Cada ponto adiciona ${pointPercent}% de progresso ao atributo escolhido. Subir de nível não aumenta OVR sozinho.</small></div>
  </section>`;
}

function renderCareerLevelBadge(progression = {}) {
  if (!progression) return;
  const host = document.querySelector('.identity-player > div:last-child');
  if (!host) return;
  let badge = document.getElementById('careerLevelBadge');
  if (!badge) {
    badge = document.createElement('div');
    badge.id = 'careerLevelBadge';
    badge.className = 'career-level-badge';
    host.appendChild(badge);
  }
  const level = Number(progression.level || 1);
  const xp = Number(progression.xp || 0);
  const need = Math.max(1, Number(progression.xp_to_next || 400));
  const points = Number(progression.evolution_points || 0);
  badge.innerHTML = `<strong>Nv. ${level}</strong><span>${xp}/${need} XP</span>${points > 0 ? `<b>${points} pt. evolução</b>` : ''}`;
}

function enhanceSponsorCard(advice) {
  const sponsor = advice?.sponsor_opportunity;
  const card = document.querySelector('#activityGrid [data-activity="sponsor_event"]');
  if (!card || !sponsor) return;
  card.querySelector('.sponsor-profile-hint')?.remove();
  const label = sponsor.profile_data?.label || sponsor.profile || 'Marca';
  const fit = Number(sponsor.fit_score || 0);
  const node = document.createElement('div');
  node.className = 'sponsor-profile-hint';
  node.innerHTML = `<span>${escapeHtml(label)}</span><strong>Encaixe ${fit}/100</strong><small>${escapeHtml(sponsor.profile_data?.description || '')}</small>`;
  card.appendChild(node);
}

function renderDevelopment(bundle) {
  const payload = bundle?.development;
  const advice = bundle?.advice || {};
  const progression = bundle?.progression || {};
  const host = document.querySelector('#playerProfileContent .meta-tab-content');
  const active = document.querySelector('#playerProfileContent [data-player-tab="development"].active');
  if (!host || !active || !payload) return;

  const attrs = payload.attributes || {};
  const skills = Array.isArray(payload.skills) ? payload.skills : [];
  const quality = payload.training_quality || {};
  const focus = advice.coach_focus || payload.recommended_focus;
  const performance = advice.performance || {};
  const flags = recoveryFlags(advice.recovery || {});
  const evolutionPoints = Number(progression.evolution_points || 0);
  const pointPercent = Number(progression.evolution_point_percent || 12);

  host.innerHTML = `
    <div class="development-overview meta-card">
      <div><span class="meta-kicker">DESENVOLVIMENTO DINÂMICO</span><h3>Seu corpo e suas habilidades respondem à rotina e ao que acontece em campo</h3><p>Treino gera estímulo, recuperação melhora a absorção e partidas agora também desenvolvem, de forma limitada, as habilidades realmente usadas. O nível de carreira recompensa sua trajetória sem substituir a evolução técnica.</p></div>
      ${focus ? `<div class="dev-focus"><span>FOCO DA COMISSÃO</span><strong>${escapeHtml(focus.skill_label || focus.label)}</strong><small>${escapeHtml(focus.activity?.label || focus.status || '')}</small>${focus.reason ? `<p>${escapeHtml(focus.reason)}</p>` : ''}</div>` : ''}
    </div>
    ${progressionCard(progression)}
    <div class="dev-quality-grid meta-card-wide">
      ${qualityCard('Físico', quality.physical)}
      ${qualityCard('Velocidade', quality.speed)}
      ${qualityCard('Técnico', quality.technical)}
      ${qualityCard('Tático', quality.tactical)}
    </div>
    ${Object.keys(performance).length ? `<div class="dev-performance-grid meta-card-wide">
      ${performanceCard('Preparação', performance.preparation_score)}
      ${performanceCard('Frescor', performance.freshness)}
      ${performanceCard('Estabilidade mental', performance.mental_stability)}
      ${performanceCard('Contato físico', performance.duel_power)}
      ${performanceCard('Proteção de bola', performance.ball_shielding)}
      ${performanceCard('Jogo aéreo', performance.aerial_power)}
    </div>` : ''}
    ${flags.length ? `<div class="dev-recovery-flags meta-card-wide">${flags.map(flag => `<span>${escapeHtml(flag)}</span>`).join('')}</div>` : ''}
    <div class="profile-grid">
      <section class="meta-card">
        <h3><i data-lucide="gauge"></i>Atributos principais</h3>
        <div class="attribute-grid">${Object.entries(attrs).map(([key, item]) => {
          const value = Number(item?.value || 0);
          const progress = Math.max(0, Math.min(100, Number(item?.progress || 0)));
          const floor = Number(item?.baseline_value || value);
          const canSpend = evolutionPoints > 0 && value < 99;
          return `<div class="attribute-tile"><span>${escapeHtml(key)}</span><strong>${value}</strong><em><b style="width:${progress}%"></b></em><small>${Math.round(progress)}% até o próximo ponto · piso da fase ${floor}</small><button class="evolution-attribute-btn" type="button" data-evolution-attribute="${escapeHtml(key)}" ${canSpend ? '' : 'disabled'}>${canSpend ? `Usar 1 ponto · +${pointPercent}%` : value >= 99 ? 'Atributo no limite' : 'Sem pontos disponíveis'}</button></div>`;
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
      <p class="meta-footnote meta-card-wide"><i data-lucide="mail"></i>OVR continua vindo dos seis atributos principais. XP de carreira gera nível e pontos de evolução; treino, partidas e especialidades continuam sendo o caminho principal para transformar progresso em atributo real.</p>
    </div>`;

  if (window.lucide) window.lucide.createIcons({ strokeWidth: 1.8 });
}

async function hydrateIfVisible(force = false) {
  const active = document.querySelector('#playerProfileContent [data-player-tab="development"].active');
  if (!active) return;
  try {
    const bundle = await loadDevelopment(force);
    renderCareerLevelBadge(bundle?.progression);
    renderDevelopment(bundle);
  } catch (error) {
    console.warn('[Career development] status avançado indisponível:', error?.message || error);
  }
}

async function refreshProgressionSurface(force = false) {
  try {
    const bundle = await loadDevelopment(force);
    renderCareerLevelBadge(bundle?.progression);
    return bundle;
  } catch (error) {
    console.warn('[Career development] nível da carreira indisponível:', error?.message || error);
    return null;
  }
}

async function spendEvolutionPoint(button) {
  const attribute = button?.dataset?.evolutionAttribute;
  if (!attribute || button.disabled) return;
  button.disabled = true;
  const original = button.textContent;
  button.textContent = 'Aplicando…';
  try {
    await rpc('spend_career_evolution_point', { p_attribute: attribute });
    cached = null;
    const bundle = await refreshProgressionSurface(true);
    if (bundle) renderDevelopment(bundle);
    window.dispatchEvent(new CustomEvent('career:updated', { detail: { source: 'evolution_point', attribute } }));
  } catch (error) {
    button.disabled = false;
    button.textContent = original;
    console.warn('[Career development] não foi possível aplicar ponto de evolução:', error?.message || error);
  }
}

ensureStyle();
refreshProgressionSurface(false);

document.addEventListener('click', event => {
  const evolutionButton = event.target.closest?.('[data-evolution-attribute]');
  if (evolutionButton) {
    spendEvolutionPoint(evolutionButton);
    return;
  }
  const developmentTab = event.target.closest?.('[data-player-tab="development"]');
  const playerOpen = event.target.closest?.('.identity-player');
  if (!developmentTab && !playerOpen) return;
  queueMicrotask(() => hydrateIfVisible(Boolean(developmentTab)));
});

document.addEventListener('career:hub-rendered', () => {
  refreshProgressionSurface(false);
});

document.addEventListener('career:activities-rendered', () => {
  if (cached?.advice) enhanceSponsorCard(cached.advice);
  else loadDevelopment(false).then(bundle => enhanceSponsorCard(bundle?.advice)).catch(() => {});
});

window.addEventListener('career:updated', async () => {
  cached = null;
  const bundle = await refreshProgressionSurface(true);
  const active = document.querySelector('#playerProfileContent [data-player-tab="development"].active');
  if (active && bundle) renderDevelopment(bundle);
});