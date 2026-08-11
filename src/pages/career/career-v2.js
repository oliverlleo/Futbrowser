import { getCurrentSession, signOutUser } from '../../services/auth-service.js';
import { getCareerHub, performCareerActivity, advanceCareerPeriod, resolveCareerEvent } from '../../services/career-service.js';
import { showToast } from '../../components/toast/toast.js';
import { mountGameInbox } from '../../components/mail/inbox.js';

const state = {
  hub: null,
  category: 'training',
  selectedActivity: null,
  intensity: 'normal',
  duration: 60,
  showAllSkills: false,
  busy: false
};

const PERIODS = ['Manhã', 'Tarde', 'Noite'];
const DOW = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const CATEGORY_NAMES = {
  training: 'Treino individual',
  recovery: 'Recuperação',
  social: 'Vida pessoal',
  professional: 'Profissional'
};

const $ = id => document.getElementById(id);
const all = selector => [...document.querySelectorAll(selector)];

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function text(id, value) {
  const el = $(id);
  if (el) el.textContent = value ?? '—';
}

function toggle(id, hidden) {
  const el = $(id);
  if (el) el.classList.toggle('hidden', Boolean(hidden));
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL', maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value, options = {}) {
  const date = parseDate(value);
  return date ? new Intl.DateTimeFormat('pt-BR', options).format(date) : '—';
}

function refreshIcons() {
  if (window.lucide) window.lucide.createIcons({ strokeWidth: 1.8 });
}

function applyTheme() {
  const hour = new Date().getHours();
  document.documentElement.setAttribute('data-theme', hour >= 18 || hour < 6 ? 'dark' : 'light');
}

function setBusy(value) {
  state.busy = value;
  document.body.classList.toggle('career-busy', value);
}

function setProgress(id, value) {
  const el = $(id);
  if (el) el.style.width = `${Math.max(0, Math.min(100, Number(value || 0)))}%`;
}

function readinessLabel(value) {
  const n = Number(value || 0);
  if (n >= 85) return 'Excelente';
  if (n >= 70) return 'Boa';
  if (n >= 55) return 'Atenção';
  return 'Baixa';
}

function relationClass(value) {
  if (['Excelente', 'Boa'].includes(value)) return 'good';
  if (['Delicada', 'Alta', 'Muito alta'].includes(value)) return 'warn';
  if (['Tensa', 'Muito ruim'].includes(value)) return 'bad';
  return '';
}

function initials(name) {
  return String(name || 'Clube')
    .replace(/Sub-?18/gi, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase() || 'FC';
}

function crestDataUri(name) {
  const label = initials(name);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 112">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#43db2c"/><stop offset="1" stop-color="#188d12"/></linearGradient></defs>
    <path d="M48 3 88 17v34c0 27-16 45-40 58C24 96 8 78 8 51V17L48 3Z" fill="url(#g)" stroke="#fff" stroke-width="5"/>
    <path d="M48 12 79 23v28c0 21-12 36-31 47-19-11-31-26-31-47V23L48 12Z" fill="#0e2b18" opacity=".88"/>
    <text x="48" y="61" text-anchor="middle" font-family="Arial,sans-serif" font-size="27" font-weight="900" fill="#fff">${label}</text>
    <text x="48" y="79" text-anchor="middle" font-family="Arial,sans-serif" font-size="8" font-weight="700" letter-spacing="1.6" fill="#7cf268">FUTBROWSER</text>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function setImage(id, src, fallbackSrc) {
  const img = $(id);
  if (!img) return;
  img.onerror = null;
  img.style.display = '';
  img.src = src || fallbackSrc;
  img.onerror = () => {
    img.onerror = null;
    img.src = fallbackSrc;
  };
}

function renderIdentity() {
  const hub = state.hub || {};
  const player = hub.player || {};
  const club = hub.club || {};
  const coach = hub.coach || {};
  const contract = hub.contract || {};
  const career = hub.state || {};

  const avatarName = player.avatar
    ? (String(player.avatar).includes('.') ? player.avatar : `${player.avatar}.webp`)
    : 'avatar1.webp';

  setImage('careerAvatar', `img/avatar/${avatarName}`, 'img/avatar/avatar1.webp');
  setImage('clubCrest', club.shield_url, crestDataUri(club.name));

  text('playerName', player.nickname || player.name || 'Jogador');
  text('playerPosition', player.position || '—');
  text('playerAge', player.age ?? '—');
  text('playerArchetype', player.archetype || 'Jogador');
  text('clubName', club.name || 'Clube');
  text('clubStyle', club.play_style || '—');
  text('clubFormation', club.formation || '—');
  text('squadRole', career.hierarchy || contract.squad_role || '—');
  text('coachName', coach.name || '—');
  text('coachProfile', coach.profile || '—');
  text('nextMatchDate', formatDate(career.next_match_date, { weekday: 'short', day: '2-digit', month: '2-digit' }));
  text('topCash', formatCurrency(career.cash));
}

function renderCondition() {
  const career = state.hub?.state || {};
  text('energyValue', `${Number(career.energy || 0)}%`);
  text('fatigueValue', `${Number(career.fatigue || 0)}%`);
  text('readinessValue', `${Number(career.readiness || 0)} · ${readinessLabel(career.readiness)}`);
  text('injuryRisk', career.injury_risk || '—');
  text('formState', career.form || '—');
  text('pressureState', `Pressão ${career.pressure || '—'}`);
  text('injuryStatusText', career.injury_days > 0
    ? `${career.injury_label || 'Em recuperação'} · ${career.injury_days} dia${career.injury_days > 1 ? 's' : ''}`
    : 'Sem restrições médicas');
  setProgress('energyBar', career.energy);
  setProgress('fatigueBar', career.fatigue);
  setProgress('readinessBar', career.readiness);
}

function renderAgenda() {
  const career = state.hub?.state || {};
  const period = Number(career.period || 0);
  const date = parseDate(career.date);
  text('todayLabel', date
    ? new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }).format(date)
    : '—');
  text('periodBadge', PERIODS[period] || '—');

  const session = state.hub?.current_session;
  const slots = $('daySlots');
  if (slots) {
    slots.innerHTML = PERIODS.map((name, index) => {
      const current = index === period;
      const past = index < period;
      let title = past ? 'Período concluído' : 'Período livre';
      let description = past ? 'As decisões deste período já fazem parte da semana.' : 'Você decide como usar esse tempo.';
      let icon = index === 0 ? 'sunrise' : index === 1 ? 'sun' : 'moon';
      if (current && session) {
        title = session.title;
        description = `Atividade do treinador · carga ${String(session.load || '').toLowerCase()}`;
        icon = 'users-round';
      } else if (current) {
        title = 'Sua escolha';
        description = 'Escolha uma atividade ou deixe o período passar.';
      }
      return `<div class="day-slot ${current ? 'current' : ''} ${past ? 'past' : ''}">
        <span class="day-slot-icon"><i data-lucide="${icon}"></i></span>
        <div><strong>${name} · ${escapeHtml(title)}</strong><span>${escapeHtml(description)}</span></div>
      </div>`;
    }).join('');
  }

  const advance = $('advancePeriodBtn');
  if (advance) {
    const blocked = Boolean(session) || Boolean(state.hub?.match_locked);
    advance.classList.toggle('hidden', blocked);
    advance.disabled = blocked;
  }

  const week = $('weekStrip');
  if (week) {
    week.innerHTML = (state.hub?.week || []).map((day, index) => {
      const title = day.is_match_day ? 'JOGO' : day.morning?.title?.replace('Treino coletivo · ', '') || 'Livre';
      return `<div class="week-day ${index === 0 ? 'today' : ''} ${day.is_match_day ? 'match' : ''}">
        <strong>${DOW[Number(day.dow)] || ''}</strong><span>${escapeHtml(day.label)}</span>
        ${day.is_match_day ? '<i>⚽</i>' : `<small>${escapeHtml(title)}</small>`}
      </div>`;
    }).join('');
  }

  const objective = career.weekly_objective || {};
  text('objectiveTitle', objective.title || 'Construir sua semana');
  text('objectiveDescription', objective.description || 'Equilibre evolução, recuperação e ambiente até o próximo compromisso.');
}

function renderCurrentActivityArea() {
  const session = state.hub?.current_session;
  const matchLocked = Boolean(state.hub?.match_locked);
  toggle('matchLock', !matchLocked);
  const teamPanel = $('teamSessionPanel');
  const freePanel = $('freeActivityPanel');
  if (!teamPanel || !freePanel) return;

  if (matchLocked) {
    teamPanel.classList.add('hidden');
    freePanel.classList.add('hidden');
    return;
  }

  if (session) {
    teamPanel.classList.remove('hidden');
    freePanel.classList.add('hidden');
    text('teamSessionTitle', session.title);
    text('teamSessionDescription', session.description);
    text('teamLoadChip', `Carga ${session.load || '—'}`);
  } else {
    teamPanel.classList.add('hidden');
    freePanel.classList.remove('hidden');
    renderActivities();
  }
}

function renderActivities() {
  const grid = $('activityGrid');
  if (!grid) return;
  const list = (state.hub?.activities || []).filter(item => item.category === state.category);
  grid.innerHTML = list.map(activity => `
    <button class="activity-card" type="button" data-activity="${escapeHtml(activity.key)}" ${activity.disabled_reason ? 'disabled' : ''}>
      <div class="activity-card-head"><span class="activity-card-icon"><i data-lucide="${escapeHtml(activity.icon || 'circle')}"></i></span><span class="activity-load">Carga ${escapeHtml(activity.load || '—')}</span></div>
      <strong>${escapeHtml(activity.title)}</strong>
      <p>${escapeHtml(activity.description)}</p>
      <div class="activity-meta">${activity.supports_intensity ? '<span>Intensidade ajustável</span>' : ''}${activity.supports_duration ? '<span>Tempo ajustável</span>' : ''}</div>
      ${activity.disabled_reason ? `<p class="activity-disabled">${escapeHtml(activity.disabled_reason)}</p>` : ''}
    </button>`).join('');
  all('#activityGrid [data-activity]').forEach(button => button.addEventListener('click', () => openActivity(button.dataset.activity)));
}

function renderEnvironment() {
  const target = $('environmentList');
  if (!target) return;
  const env = state.hub?.state?.environment || {};
  const entries = [
    ['coach', 'Treinador', 'clipboard-list'], ['locker_room', 'Vestiário', 'users-round'],
    ['fans', 'Torcida', 'megaphone'], ['media', 'Mídia', 'newspaper'],
    ['board', 'Diretoria', 'building-2'], ['agent', 'Empresário', 'briefcase-business'],
    ['public_image', 'Imagem pública', 'badge-check'], ['personal_life', 'Vida pessoal', 'heart']
  ];
  target.innerHTML = entries.map(([key, label, icon]) => {
    const value = env[key] || 'Estável';
    return `<div class="environment-item"><div class="environment-name"><i data-lucide="${icon}"></i><span>${label}</span></div><strong class="environment-state ${relationClass(value)}">${escapeHtml(value)}</strong></div>`;
  }).join('');
}

function renderSkills() {
  const target = $('skillList');
  if (!target) return;
  const skills = state.hub?.skills || [];
  const visible = state.showAllSkills ? skills : skills.slice(0, 8);
  target.innerHTML = visible.map(skill => `
    <div class="skill-item"><div class="skill-row"><strong>${escapeHtml(skill.label)}</strong><span>${Number(skill.level || 0)}</span></div>
    <small>${escapeHtml(skill.category)} · influencia ${escapeHtml(skill.parent_attribute)}</small>
    <div class="skill-progress"><b style="width:${Math.max(0, Math.min(100, Number(skill.progress || 0)))}%"></b></div></div>`).join('');
  text('toggleSkillsBtn', state.showAllSkills ? 'Ver menos' : 'Ver todas');
}

function renderRecent() {
  const target = $('recentActions');
  if (!target) return;
  const actions = state.hub?.recent_actions || [];
  target.innerHTML = actions.length
    ? actions.map(action => `<div class="recent-action"><strong>${escapeHtml(action.title)}</strong><span>${escapeHtml(action.result_summary)}</span></div>`).join('')
    : '<div class="recent-empty">Sua semana está começando. As decisões tomadas aparecerão aqui.</div>';
}

function renderMail() {
  text('unreadMailCount', Number(state.hub?.unread_messages || 0));
}

function renderDecision() {
  const modal = $('decisionModal');
  if (!modal) return;
  const event = state.hub?.pending_event;
  if (!event) {
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    return;
  }
  text('decisionSource', event.source || 'Decisão');
  text('decisionTitle', event.title || 'Decisão');
  text('decisionBody', event.body || '');
  const options = $('decisionOptions');
  if (options) {
    options.innerHTML = (event.choices || []).map(choice => `<button type="button" class="decision-option" data-choice="${escapeHtml(choice.key)}">${escapeHtml(choice.label)}</button>`).join('');
    all('#decisionOptions [data-choice]').forEach(button => button.addEventListener('click', () => chooseDecision(event.id, button.dataset.choice)));
  }
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
}

function renderHub() {
  if (!state.hub) return;
  renderIdentity();
  renderCondition();
  renderAgenda();
  renderCurrentActivityArea();
  renderEnvironment();
  renderSkills();
  renderRecent();
  renderMail();
  renderDecision();
  refreshIcons();
}

async function loadHub({ quiet = false } = {}) {
  if (!quiet) setBusy(true);
  try {
    state.hub = await getCareerHub();
    renderHub();
  } catch (error) {
    console.error('Erro ao carregar Career Hub:', error);
    showToast('Carreira', error.message || 'Não foi possível carregar sua carreira.', 'error');
    if (/contrato ativo|estado da carreira|jogador não encontrado/i.test(error.message || '')) {
      window.setTimeout(() => window.location.replace('dashboard.html'), 1000);
    }
  } finally {
    if (!quiet) setBusy(false);
  }
}

function openActivity(key) {
  const activity = (state.hub?.activities || []).find(item => item.key === key);
  if (!activity || activity.disabled_reason) return;
  state.selectedActivity = activity;
  state.intensity = 'normal';
  state.duration = Number(activity.base_duration || 60);
  text('activityModalCategory', CATEGORY_NAMES[activity.category] || 'Atividade');
  text('activityModalTitle', activity.title);
  text('activityModalDescription', activity.description);
  $('activityModalIcon')?.setAttribute('data-lucide', activity.icon || 'circle-play');
  $('intensitySection')?.classList.toggle('hidden', !activity.supports_intensity);
  $('durationSection')?.classList.toggle('hidden', !activity.supports_duration);
  text('modalEnergy', `${state.hub?.state?.energy ?? 0}%`);
  text('modalFatigue', `${state.hub?.state?.fatigue ?? 0}%`);
  text('modalNextMatch', formatDate(state.hub?.state?.next_match_date, { weekday: 'short', day: '2-digit', month: '2-digit' }));
  all('[data-intensity]').forEach(button => button.classList.toggle('active', button.dataset.intensity === 'normal'));
  all('[data-duration]').forEach(button => button.classList.toggle('active', Number(button.dataset.duration) === state.duration));
  const modal = $('activityModal');
  if (modal) { modal.classList.remove('hidden'); modal.setAttribute('aria-hidden', 'false'); }
  refreshIcons();
}

function closeActivity() {
  const modal = $('activityModal');
  if (modal) { modal.classList.add('hidden'); modal.setAttribute('aria-hidden', 'true'); }
  state.selectedActivity = null;
}

async function executeActivity() {
  if (!state.selectedActivity || state.busy) return;
  const activity = state.selectedActivity;
  closeActivity();
  setBusy(true);
  try {
    const result = await performCareerActivity(activity.key, state.intensity, state.duration);
    showToast(activity.title, result?.summary || 'Atividade concluída.', result?.injured ? 'error' : 'success');
    await loadHub({ quiet: true });
  } catch (error) {
    console.error('Erro na atividade:', error);
    showToast('Atividade', error.message || 'A atividade não pôde ser concluída.', 'error');
  } finally { setBusy(false); }
}

async function executeTeamAction(key) {
  if (state.busy) return;
  setBusy(true);
  try {
    const result = await performCareerActivity(key, 'normal', 60);
    showToast('Treino coletivo', result?.summary || 'Decisão registrada.', result?.injured ? 'error' : 'success');
    await loadHub({ quiet: true });
  } catch (error) {
    console.error('Erro no treino coletivo:', error);
    showToast('Treino coletivo', error.message || 'Não foi possível registrar a decisão.', 'error');
  } finally { setBusy(false); }
}

async function advancePeriod() {
  if (state.busy) return;
  setBusy(true);
  try {
    const result = await advanceCareerPeriod();
    showToast(result?.match_pending ? 'Dia de jogo' : null, result?.message || 'O tempo avançou.', 'info');
    await loadHub({ quiet: true });
  } catch (error) {
    console.error('Erro ao avançar:', error);
    showToast('Agenda', error.message || 'Não foi possível avançar o período.', 'error');
  } finally { setBusy(false); }
}

async function chooseDecision(eventId, choiceKey) {
  if (state.busy) return;
  $('decisionModal')?.classList.add('hidden');
  setBusy(true);
  try {
    const result = await resolveCareerEvent(eventId, choiceKey);
    showToast('Decisão registrada', result?.result || 'Sua escolha terá consequências.', 'info');
    await loadHub({ quiet: true });
  } catch (error) {
    console.error('Erro na decisão:', error);
    showToast('Decisão', error.message || 'Não foi possível registrar sua escolha.', 'error');
    await loadHub({ quiet: true });
  } finally { setBusy(false); }
}

function mountLogout() {
  const holder = document.querySelector('.resource-cards');
  if (!holder || $('logoutBtn')) return;
  const button = document.createElement('button');
  button.id = 'logoutBtn';
  button.type = 'button';
  button.className = 'resource-card';
  button.innerHTML = '<i data-lucide="log-out"></i><div><span>Conta</span><strong>Sair</strong></div>';
  button.addEventListener('click', async () => {
    if (state.busy) return;
    setBusy(true);
    try { await signOutUser(); window.location.replace('index.html'); }
    catch (error) { showToast(null, 'Não foi possível sair da conta.', 'error'); setBusy(false); }
  });
  holder.appendChild(button);
}

function bindUi() {
  all('.activity-tab').forEach(button => button.addEventListener('click', () => {
    state.category = button.dataset.category;
    all('.activity-tab').forEach(tab => tab.classList.toggle('active', tab === button));
    renderActivities(); refreshIcons();
  }));
  all('[data-team-action]').forEach(button => button.addEventListener('click', () => executeTeamAction(button.dataset.teamAction)));
  all('[data-close-modal="activity"]').forEach(button => button.addEventListener('click', closeActivity));
  $('activityModal')?.addEventListener('click', event => { if (event.target.id === 'activityModal') closeActivity(); });
  $('confirmActivityBtn')?.addEventListener('click', executeActivity);
  $('advancePeriodBtn')?.addEventListener('click', advancePeriod);
  $('toggleSkillsBtn')?.addEventListener('click', () => { state.showAllSkills = !state.showAllSkills; renderSkills(); });
  all('[data-intensity]').forEach(button => button.addEventListener('click', () => {
    state.intensity = button.dataset.intensity;
    all('[data-intensity]').forEach(item => item.classList.toggle('active', item === button));
  }));
  all('[data-duration]').forEach(button => button.addEventListener('click', () => {
    state.duration = Number(button.dataset.duration);
    all('[data-duration]').forEach(item => item.classList.toggle('active', item === button));
  }));
  $('openInboxFromCareer')?.addEventListener('click', () => {
    const button = $('gameInboxButton');
    if (button) button.click(); else showToast(null, 'A caixa de entrada ainda está carregando.', 'info');
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !$('activityModal')?.classList.contains('hidden')) closeActivity();
  });
}

async function init() {
  applyTheme();
  bindUi();
  const session = await getCurrentSession();
  if (!session) { window.location.replace('index.html'); return; }
  mountLogout();
  try { await mountGameInbox(); } catch (error) { console.error('Falha ao montar caixa:', error); }
  await loadHub();
  refreshIcons();
}

document.addEventListener('DOMContentLoaded', init);
