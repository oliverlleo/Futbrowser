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

function applyTheme() {
  const hour = new Date().getHours();
  document.documentElement.setAttribute('data-theme', hour >= 18 || hour < 6 ? 'dark' : 'light');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatCurrency(value) {
  const number = Number(value || 0);
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(number);
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value, options = {}) {
  const date = parseDate(value);
  if (!date) return '—';
  return new Intl.DateTimeFormat('pt-BR', options).format(date);
}

function relationClass(value) {
  if (['Excelente', 'Boa'].includes(value)) return 'good';
  if (['Delicada', 'Alta', 'Muito alta'].includes(value)) return 'warn';
  if (['Tensa', 'Muito ruim'].includes(value)) return 'bad';
  return '';
}

function readinessLabel(value) {
  const number = Number(value || 0);
  if (number >= 85) return 'Excelente';
  if (number >= 70) return 'Boa';
  if (number >= 55) return 'Atenção';
  return 'Baixa';
}

function setProgress(id, value) {
  const element = document.getElementById(id);
  if (element) element.style.width = `${Math.max(0, Math.min(100, Number(value || 0)))}%`;
}

function setBusy(busy) {
  state.busy = busy;
  document.body.classList.toggle('career-busy', busy);
  document.querySelectorAll('button').forEach(button => {
    if (button.dataset.allowBusy === 'true') return;
    if (busy) {
      button.dataset.wasDisabled = button.disabled ? 'true' : 'false';
      button.disabled = true;
    } else if (button.dataset.wasDisabled === 'false') {
      button.disabled = false;
      delete button.dataset.wasDisabled;
    } else {
      delete button.dataset.wasDisabled;
    }
  });
}

function refreshIcons() {
  if (window.lucide) window.lucide.createIcons({ strokeWidth: 1.8 });
}

function mountLogout() {
  const resourceCards = document.querySelector('.resource-cards');
  if (!resourceCards || document.getElementById('logoutBtn')) return;

  const button = document.createElement('button');
  button.id = 'logoutBtn';
  button.type = 'button';
  button.className = 'resource-card';
  button.innerHTML = '<i data-lucide="log-out"></i><div><span>Conta</span><strong>Sair</strong></div>';
  button.addEventListener('click', async () => {
    if (state.busy) return;
    setBusy(true);
    try {
      await signOutUser();
      window.location.replace('index.html');
    } catch (error) {
      console.error(error);
      showToast(null, 'Não foi possível sair da conta.', 'error');
      setBusy(false);
    }
  });
  resourceCards.appendChild(button);
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
      window.setTimeout(() => window.location.replace('dashboard.html'), 1100);
    }
  } finally {
    if (!quiet) setBusy(false);
  }
}

function renderIdentity() {
  const { player, club, coach, contract, state: career } = state.hub;
  const avatar = player.avatar ? (player.avatar.includes('.') ? player.avatar : `${player.avatar}.webp`) : 'avatar1.webp';
  const avatarEl = document.getElementById('careerAvatar');
  avatarEl.src = `img/avatar/${avatar}`;
  avatarEl.onerror = () => { avatarEl.src = 'img/avatar/avatar1.webp'; };

  const crest = document.getElementById('clubCrest');
  crest.src = club.shield_url || 'img/clubs/default.png';
  crest.onerror = () => {
    crest.style.display = 'none';
    crest.parentElement.textContent = club.name?.substring(0, 3).toUpperCase() || 'CLB';
    crest.parentElement.style.fontWeight = '950';
    crest.parentElement.style.color = 'var(--green-2)';
  };

  document.getElementById('playerName').textContent = player.nickname || player.name;
  document.getElementById('playerPosition').textContent = player.position;
  document.getElementById('playerAge').textContent = player.age;
  document.getElementById('playerArchetype').textContent = player.archetype;
  document.getElementById('clubName').textContent = club.name;
  document.getElementById('clubStyle').textContent = club.play_style;
  document.getElementById('clubFormation').textContent = club.formation;
  document.getElementById('squadRole').textContent = career.hierarchy || contract.squad_role;
  document.getElementById('coachName').textContent = coach.name;
  document.getElementById('coachProfile').textContent = coach.profile;
  document.getElementById('nextMatchDate').textContent = formatDate(career.next_match_date, { weekday: 'short', day: '2-digit', month: '2-digit' });
  document.getElementById('topCash').textContent = formatCurrency(career.cash);
}

function renderCondition() {
  const career = state.hub.state;
  document.getElementById('energyValue').textContent = `${career.energy}%`;
  document.getElementById('fatigueValue').textContent = `${career.fatigue}%`;
  document.getElementById('readinessValue').textContent = `${career.readiness} · ${readinessLabel(career.readiness)}`;
  document.getElementById('injuryRisk').textContent = career.injury_risk;
  document.getElementById('formState').textContent = career.form;
  document.getElementById('pressureState').textContent = `Pressão ${career.pressure}`;
  document.getElementById('injuryStatusText').textContent = career.injury_days > 0
    ? `${career.injury_label || 'Em recuperação'} · ${career.injury_days} dia${career.injury_days > 1 ? 's' : ''}`
    : 'Sem restrições médicas';
  setProgress('energyBar', career.energy);
  setProgress('fatigueBar', career.fatigue);
  setProgress('readinessBar', career.readiness);
}

function renderAgenda() {
  const career = state.hub.state;
  const currentPeriod = Number(career.period || 0);
  const date = parseDate(career.date);
  document.getElementById('todayLabel').textContent = date
    ? new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }).format(date)
    : '—';
  document.getElementById('periodBadge').textContent = PERIODS[currentPeriod] || '—';

  const session = state.hub.current_session;
  const slots = document.getElementById('daySlots');
  slots.innerHTML = PERIODS.map((period, index) => {
    const isCurrent = index === currentPeriod;
    const isPast = index < currentPeriod;
    let title = isPast ? 'Período concluído' : 'Período livre';
    let description = isPast ? 'As decisões deste período já fazem parte da sua semana.' : 'Você decide como usar esse tempo.';
    let icon = index === 0 ? 'sunrise' : index === 1 ? 'sun' : 'moon';

    if (isCurrent && session) {
      title = session.title;
      description = `Atividade do treinador · carga ${String(session.load || '').toLowerCase()}`;
      icon = 'users-round';
    } else if (isCurrent) {
      title = 'Sua escolha';
      description = 'Escolha uma atividade ou deixe o período passar.';
    }

    return `<div class="day-slot ${isCurrent ? 'current' : ''} ${isPast ? 'past' : ''}">
      <span class="day-slot-icon"><i data-lucide="${icon}"></i></span>
      <div><strong>${period} · ${escapeHtml(title)}</strong><span>${escapeHtml(description)}</span></div>
    </div>`;
  }).join('');

  const advance = document.getElementById('advancePeriodBtn');
  advance.classList.toggle('hidden', Boolean(session) || state.hub.match_locked);
  advance.disabled = Boolean(session) || state.hub.match_locked;

  const week = document.getElementById('weekStrip');
  week.innerHTML = (state.hub.week || []).map((day, index) => {
    const title = day.is_match_day ? 'JOGO' : day.morning?.title?.replace('Treino coletivo · ', '') || 'Livre';
    return `<div class="week-day ${index === 0 ? 'today' : ''} ${day.is_match_day ? 'match' : ''}">
      <strong>${DOW[Number(day.dow)] || ''}</strong><span>${escapeHtml(day.label)}</span>
      ${day.is_match_day ? '<i>⚽</i>' : `<small>${escapeHtml(title)}</small>`}
    </div>`;
  }).join('');

  const objective = career.weekly_objective || {};
  document.getElementById('objectiveTitle').textContent = objective.title || 'Construir sua semana';
  document.getElementById('objectiveDescription').textContent = objective.description || 'Equilibre evolução, recuperação e ambiente até o próximo compromisso.';
}

function renderCurrentActivityArea() {
  const session = state.hub.current_session;
  const matchLocked = Boolean(state.hub.match_locked);
  document.getElementById('matchLock').classList.toggle('hidden', !matchLocked);

  const teamPanel = document.getElementById('teamSessionPanel');
  const freePanel = document.getElementById('freeActivityPanel');

  if (matchLocked) {
    teamPanel.classList.add('hidden');
    freePanel.classList.add('hidden');
    return;
  }

  if (session) {
    teamPanel.classList.remove('hidden');
    freePanel.classList.add('hidden');
    document.getElementById('teamSessionTitle').textContent = session.title;
    document.getElementById('teamSessionDescription').textContent = session.description;
    document.getElementById('teamLoadChip').textContent = `Carga ${session.load}`;
  } else {
    teamPanel.classList.add('hidden');
    freePanel.classList.remove('hidden');
    renderActivities();
  }
}

function renderActivities() {
  const list = (state.hub.activities || []).filter(item => item.category === state.category);
  const grid = document.getElementById('activityGrid');
  grid.innerHTML = list.map(activity => `
    <button class="activity-card" type="button" data-activity="${escapeHtml(activity.key)}" ${activity.disabled_reason ? 'disabled' : ''}>
      <div class="activity-card-head"><span class="activity-card-icon"><i data-lucide="${escapeHtml(activity.icon)}"></i></span><span class="activity-load">Carga ${escapeHtml(activity.load)}</span></div>
      <strong>${escapeHtml(activity.title)}</strong>
      <p>${escapeHtml(activity.description)}</p>
      <div class="activity-meta">
        ${activity.supports_intensity ? '<span>Intensidade ajustável</span>' : ''}
        ${activity.supports_duration ? '<span>Tempo ajustável</span>' : ''}
      </div>
      ${activity.disabled_reason ? `<p class="activity-disabled">${escapeHtml(activity.disabled_reason)}</p>` : ''}
    </button>
  `).join('');

  grid.querySelectorAll('[data-activity]').forEach(button => {
    button.addEventListener('click', () => openActivity(button.dataset.activity));
  });
}

function renderEnvironment() {
  const environment = state.hub.state.environment || {};
  const entries = [
    ['coach', 'Treinador', 'clipboard-list'],
    ['locker_room', 'Vestiário', 'users-round'],
    ['fans', 'Torcida', 'megaphone'],
    ['media', 'Mídia', 'newspaper'],
    ['board', 'Diretoria', 'building-2'],
    ['agent', 'Empresário', 'briefcase-business'],
    ['public_image', 'Imagem pública', 'badge-check'],
    ['personal_life', 'Vida pessoal', 'heart']
  ];

  document.getElementById('environmentList').innerHTML = entries.map(([key, label, icon]) => {
    const value = environment[key] || 'Estável';
    return `<div class="environment-item"><div class="environment-name"><i data-lucide="${icon}"></i><span>${label}</span></div><strong class="environment-state ${relationClass(value)}">${escapeHtml(value)}</strong></div>`;
  }).join('');
}

function renderSkills() {
  const skills = state.hub.skills || [];
  const visible = state.showAllSkills ? skills : skills.slice(0, 8);
  document.getElementById('skillList').innerHTML = visible.map(skill => `
    <div class="skill-item">
      <div class="skill-row"><strong>${escapeHtml(skill.label)}</strong><span>${Number(skill.level)}</span></div>
      <small>${escapeHtml(skill.category)} · influencia ${escapeHtml(skill.parent_attribute)}</small>
      <div class="skill-progress"><b style="width:${Math.max(0, Math.min(100, Number(skill.progress || 0)))}%"></b></div>
    </div>`).join('');
  document.getElementById('toggleSkillsBtn').textContent = state.showAllSkills ? 'Ver menos' : 'Ver todas';
}

function renderRecent() {
  const actions = state.hub.recent_actions || [];
  const target = document.getElementById('recentActions');
  if (!actions.length) {
    target.innerHTML = '<div class="recent-empty">Sua semana está começando. As decisões tomadas aparecerão aqui.</div>';
    return;
  }
  target.innerHTML = actions.map(action => `<div class="recent-action"><strong>${escapeHtml(action.title)}</strong><span>${escapeHtml(action.result_summary)}</span></div>`).join('');
}

function renderMail() {
  const unread = Number(state.hub.unread_messages || 0);
  document.getElementById('unreadMailCount').textContent = unread;
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

function openActivity(activityKey) {
  const activity = (state.hub.activities || []).find(item => item.key === activityKey);
  if (!activity || activity.disabled_reason) return;
  state.selectedActivity = activity;
  state.intensity = 'normal';
  state.duration = Number(activity.base_duration || 60);

  document.getElementById('activityModalCategory').textContent = CATEGORY_NAMES[activity.category] || 'Atividade';
  document.getElementById('activityModalTitle').textContent = activity.title;
  document.getElementById('activityModalDescription').textContent = activity.description;
  document.getElementById('activityModalIcon').setAttribute('data-lucide', activity.icon || 'circle-play');
  document.getElementById('intensitySection').classList.toggle('hidden', !activity.supports_intensity);
  document.getElementById('durationSection').classList.toggle('hidden', !activity.supports_duration);
  document.getElementById('modalEnergy').textContent = `${state.hub.state.energy}%`;
  document.getElementById('modalFatigue').textContent = `${state.hub.state.fatigue}%`;
  document.getElementById('modalNextMatch').textContent = formatDate(state.hub.state.next_match_date, { weekday: 'short', day: '2-digit', month: '2-digit' });

  document.querySelectorAll('[data-intensity]').forEach(button => button.classList.toggle('active', button.dataset.intensity === 'normal'));
  document.querySelectorAll('[data-duration]').forEach(button => button.classList.toggle('active', Number(button.dataset.duration) === state.duration));

  const modal = document.getElementById('activityModal');
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  refreshIcons();
}

function closeActivity() {
  const modal = document.getElementById('activityModal');
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
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
    console.error(error);
    showToast('Atividade', error.message || 'A atividade não pôde ser concluída.', 'error');
  } finally {
    setBusy(false);
  }
}

async function executeTeamAction(actionKey) {
  if (state.busy) return;
  setBusy(true);
  try {
    const result = await performCareerActivity(actionKey, 'normal', 60);
    showToast('Treino coletivo', result?.summary || 'Decisão registrada.', result?.injured ? 'error' : 'success');
    await loadHub({ quiet: true });
  } catch (error) {
    console.error(error);
    showToast('Treino coletivo', error.message || 'Não foi possível registrar a decisão.', 'error');
  } finally {
    setBusy(false);
  }
}

async function advancePeriod() {
  if (state.busy) return;
  setBusy(true);
  try {
    const result = await advanceCareerPeriod();
    if (result?.match_pending) {
      showToast('Dia de jogo', result.message, 'info');
    } else {
      showToast(null, result?.message || 'O tempo avançou.', 'info');
    }
    await loadHub({ quiet: true });
  } catch (error) {
    console.error(error);
    showToast('Agenda', error.message || 'Não foi possível avançar o período.', 'error');
  } finally {
    setBusy(false);
  }
}

function renderDecision() {
  const event = state.hub.pending_event;
  const modal = document.getElementById('decisionModal');
  if (!event) {
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    return;
  }

  document.getElementById('decisionSource').textContent = event.source || 'Decisão';
  document.getElementById('decisionTitle').textContent = event.title;
  document.getElementById('decisionBody').textContent = event.body;
  const options = document.getElementById('decisionOptions');
  options.innerHTML = (event.choices || []).map(choice => `<button type="button" class="decision-option" data-choice="${escapeHtml(choice.key)}">${escapeHtml(choice.label)}</button>`).join('');
  options.querySelectorAll('[data-choice]').forEach(button => button.addEventListener('click', () => chooseDecision(event.id, button.dataset.choice)));
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  refreshIcons();
}

async function chooseDecision(eventId, choiceKey) {
  if (state.busy) return;
  document.getElementById('decisionModal').classList.add('hidden');
  setBusy(true);
  try {
    const result = await resolveCareerEvent(eventId, choiceKey);
    showToast('Decisão registrada', result?.result || 'Sua escolha terá consequências.', 'info');
    await loadHub({ quiet: true });
  } catch (error) {
    console.error(error);
    showToast('Decisão', error.message || 'Não foi possível registrar sua escolha.', 'error');
    await loadHub({ quiet: true });
  } finally {
    setBusy(false);
  }
}

function bindUi() {
  document.querySelectorAll('.activity-tab').forEach(button => {
    button.addEventListener('click', () => {
      state.category = button.dataset.category;
      document.querySelectorAll('.activity-tab').forEach(tab => tab.classList.toggle('active', tab === button));
      renderActivities();
      refreshIcons();
    });
  });

  document.querySelectorAll('[data-team-action]').forEach(button => {
    button.addEventListener('click', () => executeTeamAction(button.dataset.teamAction));
  });

  document.querySelectorAll('[data-close-modal="activity"]').forEach(button => button.addEventListener('click', closeActivity));
  document.getElementById('activityModal').addEventListener('click', event => { if (event.target.id === 'activityModal') closeActivity(); });
  document.getElementById('confirmActivityBtn').addEventListener('click', executeActivity);
  document.getElementById('advancePeriodBtn').addEventListener('click', advancePeriod);
  document.getElementById('toggleSkillsBtn').addEventListener('click', () => { state.showAllSkills = !state.showAllSkills; renderSkills(); });

  document.querySelectorAll('[data-intensity]').forEach(button => button.addEventListener('click', () => {
    state.intensity = button.dataset.intensity;
    document.querySelectorAll('[data-intensity]').forEach(item => item.classList.toggle('active', item === button));
  }));
  document.querySelectorAll('[data-duration]').forEach(button => button.addEventListener('click', () => {
    state.duration = Number(button.dataset.duration);
    document.querySelectorAll('[data-duration]').forEach(item => item.classList.toggle('active', item === button));
  }));

  document.getElementById('openInboxFromCareer').addEventListener('click', () => {
    const inboxButton = document.getElementById('gameInboxButton');
    if (inboxButton) inboxButton.click();
    else showToast(null, 'A caixa de entrada ainda está carregando.', 'info');
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !document.getElementById('activityModal').classList.contains('hidden')) closeActivity();
  });
}

async function init() {
  applyTheme();
  bindUi();
  const session = await getCurrentSession();
  if (!session) {
    window.location.replace('index.html');
    return;
  }

  mountLogout();
  try {
    await mountGameInbox();
  } catch (error) {
    console.error('Falha ao montar caixa de entrada:', error);
  }
  await loadHub();
  refreshIcons();
}

document.addEventListener('DOMContentLoaded', init);
