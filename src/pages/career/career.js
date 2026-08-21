import { supabase } from '../../services/supabase-client.js';
import { getCurrentSession } from '../../services/auth-service.js';
import { showToast } from '../../components/toast/toast.js';

const $ = (id) => document.getElementById(id);

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function safeAsset(value, fallback) {
  const candidate = String(value || '').trim();
  if (!candidate || candidate.startsWith('javascript:')) return fallback;
  return candidate;
}

function formatMoney(value) {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(amount)
    : '—';
}

function formatDate(value) {
  if (!value) return 'A definir';
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleDateString('pt-BR');
}

function sessionLabel(session) {
  if (!session) return 'Sem sessão registrada';
  if (typeof session === 'string') return session;
  return session.title || session.label || session.description || session.activity || 'Sessão do clube';
}

function showLoading(visible) {
  $('careerLoading')?.classList.toggle('hidden', !visible);
}

function showError(message) {
  const error = $('careerError');
  if (!error) return;
  error.textContent = message;
  error.classList.remove('hidden');
}

function renderHub(hub) {
  const player = hub.player || {};
  const club = hub.club || {};
  const coach = hub.coach || {};
  const state = hub.state || {};
  const contract = hub.contract || {};

  $('careerContent')?.classList.remove('hidden');
  $('careerDate').textContent = `${formatDate(state.date)} · período ${Number(state.period || 0) + 1}`;
  $('playerName').textContent = player.nickname ? `${player.name} “${player.nickname}”` : (player.name || 'Jogador');
  $('playerMeta').textContent = `${player.age || '—'} anos · ${player.position || 'Posição não informada'} · ${player.archetype || 'Arquétipo não informado'} · OVR ${player.ovr ?? '—'}`;
  $('playerAvatar').src = safeAsset(player.avatar ? `img/avatar/${player.avatar.includes('.') ? player.avatar : `${player.avatar}.webp`}` : '', 'img/avatar/avatar1.webp');
  $('playerAvatar').onerror = () => { $('playerAvatar').src = 'img/avatar/avatar1.webp'; };

  $('clubName').textContent = club.name || contract.club_name || 'Clube não informado';
  $('clubMeta').textContent = `${club.squad_level || state.sporting_squad_level || contract.club_scope || 'Categoria não informada'} · ${contract.squad_role || 'Função não informada'} · ${coach.name || 'Comissão técnica'}`;
  $('clubShield').src = safeAsset(club.shield_url, 'img/clubs/default.svg');
  $('clubShield').alt = `Escudo de ${club.name || 'clube'}`;
  $('clubShield').onerror = () => { $('clubShield').src = 'img/clubs/default.svg'; };

  const energy = Math.max(0, Math.min(100, Number(state.energy) || 0));
  $('energyValue').textContent = `${energy}%`;
  $('energyBar').style.width = `${energy}%`;
  $('cashValue').textContent = formatMoney(state.cash);
  $('trustValue').textContent = state.trust || '—';
  $('coachRelation').textContent = `Relação com ${coach.name || 'treinador'}: ${state.coach_relation_score ?? '—'}`;
  $('nextMatch').textContent = formatDate(state.next_match_date);
  $('readinessValue').textContent = `Prontidão: ${state.readiness ?? '—'} · risco ${state.injury_risk || '—'}`;
  $('weeklyObjective').textContent = `Objetivo semanal: ${state.weekly_objective || 'Nenhum definido'}`;
  $('matchLock').textContent = hub.match_locked ? 'Partida bloqueada' : 'Agenda aberta';
  $('currentSession').textContent = `Sessão atual: ${sessionLabel(hub.current_session)}`;

  renderWeek(hub.week || [], state.next_match_date);
  renderActivities(hub.activities || []);
  renderSelection(hub.selection, hub.shirt);
  renderEvent(hub.pending_event, hub.recent_actions || [], hub.unread_messages || 0);
}

function renderWeek(week, matchDate) {
  const container = $('weekSchedule');
  if (!container) return;
  container.innerHTML = week.length
    ? week.map(day => `
      <div class="week-day ${day.is_match_day ? 'match' : ''}">
        <strong>${escapeHtml(day.label || formatDate(day.date))}</strong>
        <span>${day.is_match_day ? 'Partida' : escapeHtml(sessionLabel(day.morning))}</span>
      </div>
    `).join('')
    : '<div class="pending-event">Agenda ainda não disponível.</div>';
}

function renderActivities(activities) {
  const container = $('activitiesList');
  if (!container) return;
  if (!activities.length) {
    container.innerHTML = '<div class="pending-event">Nenhuma ação disponível neste período.</div>';
    return;
  }
  container.innerHTML = activities.map(activity => {
    const disabled = Boolean(activity.disabled_reason);
    const duration = Number(activity.base_duration) || Number(activity.duration_minutes) || 30;
    const intensity = activity.supports_intensity === false ? 'medium' : 'medium';
    return `
      <article class="activity-card">
        <h3>${escapeHtml(activity.title || activity.key)}</h3>
        <p>${escapeHtml(activity.description || 'Ação de desenvolvimento.')}</p>
        <small>${escapeHtml(activity.load || '')} · ${duration} min${activity.cash_reward ? ` · recompensa ${formatMoney(activity.cash_reward)}` : ''}</small>
        <button type="button" data-activity-key="${escapeHtml(activity.key)}" data-duration="${duration}" data-intensity="${intensity}" ${disabled ? 'disabled' : ''}>
          ${escapeHtml(activity.disabled_reason || 'Executar ação')}
        </button>
      </article>
    `;
  }).join('');

  container.querySelectorAll('button[data-activity-key]').forEach(button => {
    button.addEventListener('click', () => executeActivity(button));
  });
}

async function executeActivity(button) {
  button.disabled = true;
  const originalText = button.textContent;
  button.textContent = 'Executando…';
  try {
    const { error } = await supabase.rpc('perform_career_activity', {
      p_activity_key: button.dataset.activityKey,
      p_intensity: button.dataset.intensity || 'medium',
      p_duration: Number(button.dataset.duration) || 30
    });
    if (error) throw error;
    showToast(null, 'Ação concluída. O estado da carreira foi atualizado.', 'success');
    await loadHub();
  } catch (error) {
    showToast(null, error.message || 'Não foi possível executar a ação.', 'error');
    button.disabled = false;
    button.textContent = originalText;
  }
}

function renderSelection(selection = {}, shirt = {}) {
  const status = selection?.status || (selection?.locked ? 'Definida' : 'Projeção');
  $('selectionStatus').textContent = status;
  $('selectionSummary').innerHTML = `
    <strong>${escapeHtml(selection?.reason || 'A comissão ainda está avaliando sua escalação.')}</strong>
    <span>Pontuação projetada: ${escapeHtml(selection?.score ?? '—')} · ${selection?.match_date ? `partida em ${escapeHtml(formatDate(selection.match_date))}` : 'data a definir'}</span>
  `;
  const notice = $('shirtNotice');
  const shirtCard = $('shirtCard');
  if (shirt?.required || (shirt?.available_numbers?.length && !shirt.number)) {
    notice?.classList.remove('hidden');
    shirtCard?.classList.remove('hidden');
    if (shirtCard) shirtCard.textContent = shirt.number
      ? `Número de camisa atual: ${shirt.number}.`
      : `Escolha um número antes da próxima partida. Disponíveis: ${(shirt.available_numbers || []).join(', ') || 'a definir'}.`;
  } else {
    notice?.classList.add('hidden');
    shirtCard?.classList.add('hidden');
  }
}

function renderEvent(event, recentActions, unread) {
  $('unreadMessages').textContent = `${unread} ${unread === 1 ? 'mensagem' : 'mensagens'}`;
  $('pendingEvent').innerHTML = event
    ? `<strong>${escapeHtml(event.title || 'Evento pendente')}</strong><p>${escapeHtml(event.body || 'Você tem uma decisão pendente.')}</p>`
    : 'Nenhum evento pendente.';
  $('recentActions').innerHTML = recentActions.length
    ? recentActions.map(action => `<div class="recent-action"><strong>${escapeHtml(action.title || action.activity_key || 'Ação')}</strong><span>${escapeHtml(action.result_summary || action.category || '')}</span></div>`).join('')
    : '<div class="pending-event">Nenhuma ação registrada ainda.</div>';
}

async function loadHub() {
  showLoading(true);
  $('careerError')?.classList.add('hidden');
  try {
    const session = await getCurrentSession();
    if (!session) {
      window.location.href = 'index.html';
      return;
    }
    const { data, error } = await supabase.rpc('get_career_hub');
    if (error) throw error;
    if (!data?.contract || !data?.state) {
      window.location.href = 'dashboard.html';
      return;
    }
    renderHub(data);
  } catch (error) {
    console.error('Erro ao carregar hub de carreira:', error);
    showError(error.message || 'Não foi possível carregar sua carreira.');
  } finally {
    showLoading(false);
  }
}

$('refreshCareerBtn')?.addEventListener('click', loadHub);
loadHub();
