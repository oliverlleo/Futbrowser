import { getCurrentSession, signOutUser } from '../../services/auth-service.js';
import {
  getCareerHub,
  performCareerActivity,
  advanceCareerPeriod,
  resolveCareerEvent
} from '../../services/career-service.js?v=20260811-7';
import { showToast } from '../../components/toast/toast.js';
import { mountCareerInbox } from './career-inbox.js?v=20260811-7';

const state = {
  hub: null,
  category: 'training',
  selectedActivity: null,
  intensity: 'normal',
  duration: 60,
  showAllSkills: false,
  busy: false,
  activityResultMode: false,
  decisionReplyMode: false
};

const PERIODS = ['Manhã', 'Tarde', 'Noite'];
const DOW = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const CATEGORY_NAMES = {
  training: 'Treino individual',
  recovery: 'Recuperação',
  social: 'Vida pessoal',
  professional: 'Profissional'
};

const CLUB_CRESTS = {
  'Academia Aurora Sub-18': 'img/clubs/academia_aurora_sub_18.png',
  'Atlético do Vale Sub-18': 'img/clubs/atletico_do_vale_sub_18.png',
  'Ferroviário Central Sub-18': 'img/clubs/ferroviario_central_sub_18.png',
  'Real Horizonte Sub-18': 'img/clubs/real_horizonte_sub_18.png',
  'União Litorânea Sub-18': 'img/clubs/uniao_litoranea_sub_18.png',
  'Academia Aurora': 'img/clubs/academia_aurora_sub_18.png',
  'Atlético do Vale': 'img/clubs/atletico_do_vale_sub_18.png',
  'Ferroviário Central': 'img/clubs/ferroviario_central_sub_18.png',
  'Real Horizonte': 'img/clubs/real_horizonte_sub_18.png',
  'União Litorânea': 'img/clubs/uniao_litoranea_sub_18.png'
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
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0
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
  state.busy = Boolean(value);
  document.body?.classList.toggle('career-busy', state.busy);
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

function setImage(id, src, fallbackSrc) {
  const img = $(id);
  if (!img) return;
  img.onerror = null;
  img.style.display = '';
  img.src = src || fallbackSrc;
  img.onerror = () => {
    img.onerror = null;
    if (fallbackSrc && img.src !== new URL(fallbackSrc, window.location.href).href) img.src = fallbackSrc;
  };
}

function clubCrestPath(club = {}) {
  return CLUB_CRESTS[club.name] || club.shield_url || 'img/logo.png';
}

function renderIdentity() {
  const hub = state.hub || {};
  const player = hub.player || {};
  const club = hub.club || {};
  const coach = hub.coach || {};
  const contract = hub.contract || {};
  const career = hub.state || {};
  const avatarName = player.avatar ? (String(player.avatar).includes('.') ? player.avatar : `${player.avatar}.webp`) : 'avatar1.webp';

  setImage('careerAvatar', `img/avatar/${avatarName}`, 'img/avatar/avatar1.webp');
  setImage('clubCrest', clubCrestPath(club), 'img/logo.png');
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
  text('injuryStatusText', career.injury_days > 0 ? `${career.injury_label || 'Em recuperação'} · ${career.injury_days} dia${career.injury_days > 1 ? 's' : ''}` : 'Sem restrições médicas');
  setProgress('energyBar', career.energy);
  setProgress('fatigueBar', career.fatigue);
  setProgress('readinessBar', career.readiness);
}

function renderAgenda() {
  const career = state.hub?.state || {};
  const period = Number(career.period || 0);
  const date = parseDate(career.date);
  text('todayLabel', date ? new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }).format(date) : '—');
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
      return `<div class="day-slot ${current ? 'current' : ''} ${past ? 'past' : ''}"><span class="day-slot-icon"><i data-lucide="${icon}"></i></span><div><strong>${name} · ${escapeHtml(title)}</strong><span>${escapeHtml(description)}</span></div></div>`;
    }).join('');
  }

  const advance = $('advancePeriodBtn');
  if (advance) {
    const blocked = Boolean(session) || Boolean(state.hub?.match_locked) || Boolean(state.hub?.pending_event);
    advance.classList.toggle('hidden', blocked);
    advance.disabled = blocked;
  }

  const week = $('weekStrip');
  if (week) {
    week.innerHTML = (state.hub?.week || []).map((day, index) => {
      const title = day.is_match_day ? 'JOGO' : day.morning?.title?.replace('Treino coletivo · ', '') || 'Livre';
      return `<div class="week-day ${index === 0 ? 'today' : ''} ${day.is_match_day ? 'match' : ''}"><strong>${DOW[Number(day.dow)] || ''}</strong><span>${escapeHtml(day.label)}</span>${day.is_match_day ? '<i>⚽</i>' : `<small>${escapeHtml(title)}</small>`}</div>`;
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
    const injured = Number(state.hub?.state?.injury_days || 0) > 0;
    all('[data-team-action]').forEach(button => {
      const heavy = ['team_training_normal', 'team_training_intense'].includes(button.dataset.teamAction);
      button.disabled = injured && heavy;
      button.title = button.disabled ? 'A equipe médica liberou apenas carga reduzida ou recuperação.' : '';
    });
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
      <strong>${escapeHtml(activity.title)}</strong><p>${escapeHtml(activity.description)}</p>
      <div class="activity-meta">${activity.supports_intensity ? '<span>Intensidade ajustável</span>' : ''}${activity.supports_duration ? '<span>Tempo ajustável</span>' : ''}</div>
      ${activity.disabled_reason ? `<p class="activity-disabled">${escapeHtml(activity.disabled_reason)}</p>` : ''}
    </button>`).join('');
  all('#activityGrid [data-activity]').forEach(button => button.addEventListener('click', () => openActivity(button.dataset.activity)));
  document.dispatchEvent(new CustomEvent('career:activities-rendered'));
}

function renderEnvironment() {
  const target = $('environmentList');
  if (!target) return;
  const env = state.hub?.state?.environment || {};
  const entries = [['coach','Treinador','clipboard-list'],['locker_room','Vestiário','users-round'],['fans','Torcida','megaphone'],['media','Mídia','newspaper'],['board','Diretoria','building-2'],['agent','Empresário','briefcase-business'],['public_image','Imagem pública','badge-check'],['personal_life','Vida pessoal','heart']];
  target.innerHTML = entries.map(([key,label,icon]) => { const value=env[key]||'Estável'; return `<div class="environment-item"><div class="environment-name"><i data-lucide="${icon}"></i><span>${label}</span></div><strong class="environment-state ${relationClass(value)}">${escapeHtml(value)}</strong></div>`; }).join('');
}

function renderRecent() {
  const target = $('recentActions');
  if (!target) return;
  const actions = state.hub?.recent_actions || [];
  target.innerHTML = actions.length ? actions.map(action => `<div class="recent-action"><strong>${escapeHtml(action.title)}</strong><span>${escapeHtml(action.result_summary)}</span></div>`).join('') : '<div class="recent-empty">Sua semana está começando. As decisões tomadas aparecerão aqui.</div>';
}

function renderMail() { text('unreadMailCount', Number(state.hub?.unread_messages || 0)); }

function renderDecision() {
  if (state.decisionReplyMode) return;
  const modal = $('decisionModal');
  if (!modal) return;
  const event = state.hub?.pending_event;
  if (!event) { modal.classList.add('hidden'); modal.setAttribute('aria-hidden','true'); return; }
  text('decisionSource', event.source || 'Decisão');
  text('decisionTitle', event.title || 'Decisão');
  text('decisionBody', event.body || '');
  const options = $('decisionOptions');
  if (options) {
    options.innerHTML = (event.choices || []).map(choice => `<button type="button" class="decision-option" data-choice="${escapeHtml(choice.key)}">${escapeHtml(choice.label)}</button>`).join('');
    all('#decisionOptions [data-choice]').forEach(button => button.addEventListener('click', () => chooseDecision(event.id, button.dataset.choice)));
  }
  document.querySelector('.decision-disclaimer')?.classList.remove('hidden');
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden','false');
  document.dispatchEvent(new CustomEvent('career:decision-opened'));
  refreshIcons();
}

function renderHub({ suppressDecision = false } = {}) {
  if (!state.hub) return;
  renderIdentity(); renderCondition(); renderAgenda(); renderCurrentActivityArea(); renderEnvironment(); renderRecent(); renderMail();
  if (!suppressDecision) renderDecision();
  document.dispatchEvent(new CustomEvent('career:hub-rendered', { detail: state.hub }));
  refreshIcons();
}

async function loadHub({ quiet = false, suppressDecision = false } = {}) {
  if (!quiet) setBusy(true);
  try {
    state.hub = await getCareerHub();
    renderHub({ suppressDecision });
    return state.hub;
  } catch (error) {
    console.error('Erro ao carregar Career Hub:', error);
    showToast('Carreira', error.message || 'Não foi possível carregar sua carreira.', 'error');
    if (/contrato ativo|estado da carreira|jogador não encontrado/i.test(error.message || '')) window.setTimeout(() => window.location.replace('dashboard.html'),1000);
    return null;
  } finally { if (!quiet) setBusy(false); }
}

function updateActivityContext() {
  const career = state.hub?.state || {};
  text('modalEnergy', `${Number(career.energy || 0)}%`);
  text('modalFatigue', `${Number(career.fatigue || 0)}%`);
  text('modalNextMatch', formatDate(career.next_match_date,{weekday:'short',day:'2-digit',month:'2-digit'}));
}

function resetActivityModalControls() {
  state.activityResultMode=false;
  document.querySelector('[data-close-modal="activity"].modal-cancel')?.classList.remove('hidden');
  const confirm=$('confirmActivityBtn');
  if(confirm){confirm.disabled=false;confirm.innerHTML='<i data-lucide="play"></i>Fazer atividade';}
}

function openActivity(key) {
  const activity=(state.hub?.activities||[]).find(item=>item.key===key);
  if(!activity||activity.disabled_reason||state.hub?.pending_event||state.busy)return;
  state.selectedActivity=activity;state.intensity='normal';state.duration=Number(activity.base_duration||60);resetActivityModalControls();
  text('activityModalCategory',CATEGORY_NAMES[activity.category]||'Atividade');text('activityModalTitle',activity.title);text('activityModalDescription',activity.description);
  $('activityModalIcon')?.setAttribute('data-lucide',activity.icon||'circle-play');
  $('intensitySection')?.classList.toggle('hidden',!activity.supports_intensity);$('durationSection')?.classList.toggle('hidden',!activity.supports_duration);updateActivityContext();
  all('[data-intensity]').forEach(button=>button.classList.toggle('active',button.dataset.intensity==='normal'));
  all('[data-duration]').forEach(button=>button.classList.toggle('active',Number(button.dataset.duration)===state.duration));
  const modal=$('activityModal');if(modal){modal.classList.remove('hidden');modal.setAttribute('aria-hidden','false');}
  document.dispatchEvent(new CustomEvent('career:activity-opened',{detail:{key}}));refreshIcons();
}

function showActivityResult(title, summary, injured=false) {
  state.activityResultMode=true;state.selectedActivity=null;
  text('activityModalCategory',injured?'ATIVIDADE INTERROMPIDA':'ATIVIDADE CONCLUÍDA');text('activityModalTitle',title||'Atividade');text('activityModalDescription',summary||'Atividade concluída.');
  $('activityModalIcon')?.setAttribute('data-lucide',injured?'triangle-alert':'circle-check-big');$('intensitySection')?.classList.add('hidden');$('durationSection')?.classList.add('hidden');updateActivityContext();
  document.querySelector('[data-close-modal="activity"].modal-cancel')?.classList.add('hidden');
  const confirm=$('confirmActivityBtn');if(confirm){confirm.disabled=false;confirm.innerHTML='<i data-lucide="arrow-right"></i>Continuar';}
  const modal=$('activityModal');if(modal){modal.classList.remove('hidden');modal.setAttribute('aria-hidden','false');}refreshIcons();
}

function closeActivity({showPendingDecision=true}={}) {
  const modal=$('activityModal');if(modal){modal.classList.add('hidden');modal.setAttribute('aria-hidden','true');}
  state.selectedActivity=null;state.activityResultMode=false;if(showPendingDecision)renderDecision();
}

async function executeActivity() {
  if(!state.selectedActivity||state.busy)return;
  const activity=state.selectedActivity;const confirm=$('confirmActivityBtn');setBusy(true);if(confirm){confirm.disabled=true;confirm.textContent='Concluindo...';}
  try{const result=await performCareerActivity(activity.key,state.intensity,state.duration);await loadHub({quiet:true,suppressDecision:true});showActivityResult(activity.title,result?.summary||'Atividade concluída.',Boolean(result?.injured));}
  catch(error){console.error('Erro na atividade:',error);showToast('Atividade',error.message||'A atividade não pôde ser concluída.','error');if(confirm){confirm.disabled=false;confirm.innerHTML='<i data-lucide="play"></i>Fazer atividade';refreshIcons();}}
  finally{setBusy(false);}
}

async function executeTeamAction(key) {
  if(state.busy||state.hub?.pending_event)return;setBusy(true);
  try{const result=await performCareerActivity(key,'normal',60);await loadHub({quiet:true,suppressDecision:true});showActivityResult('Treino coletivo',result?.summary||'Decisão registrada.',Boolean(result?.injured));}
  catch(error){console.error('Erro no treino coletivo:',error);showToast('Treino coletivo',error.message||'Não foi possível registrar a decisão.','error');}
  finally{setBusy(false);}
}

async function advancePeriod() {
  if(state.busy)return;setBusy(true);
  try{const result=await advanceCareerPeriod();await loadHub({quiet:true});showToast(result?.match_pending?'Dia de jogo':null,result?.message||'O tempo avançou.','info');}
  catch(error){console.error('Erro ao avançar:',error);showToast('Agenda',error.message||'Não foi possível avançar o período.','error');}
  finally{setBusy(false);}
}

function showDecisionReply(result) {
  state.decisionReplyMode=true;text('decisionSource',result?.reply_speaker||'Resposta');text('decisionTitle','Resposta');text('decisionBody',result?.reply||result?.result||'A conversa terminou.');
  const options=$('decisionOptions');if(options){options.innerHTML=`${result?.result?`<div class="decision-result-note">${escapeHtml(result.result)}</div>`:''}<button type="button" class="decision-option decision-continue" id="continueDecisionBtn">Continuar<i data-lucide="arrow-right"></i></button>`;$('continueDecisionBtn')?.addEventListener('click',closeDecisionReply);}
  document.querySelector('.decision-disclaimer')?.classList.add('hidden');refreshIcons();
}

function closeDecisionReply(){state.decisionReplyMode=false;const modal=$('decisionModal');modal?.classList.add('hidden');modal?.setAttribute('aria-hidden','true');renderDecision();}

async function chooseDecision(eventId,choiceKey){
  if(state.busy||state.decisionReplyMode)return;const buttons=all('#decisionOptions [data-choice]');buttons.forEach(button=>{button.disabled=true;});setBusy(true);
  try{const result=await resolveCareerEvent(eventId,choiceKey);await loadHub({quiet:true,suppressDecision:true});showDecisionReply(result);}
  catch(error){console.error('Erro na decisão:',error);buttons.forEach(button=>{button.disabled=false;});showToast('Decisão',error.message||'Não foi possível registrar sua escolha.','error');}
  finally{setBusy(false);}
}

function mountLogout(){
  const holder=document.querySelector('.resource-cards');if(!holder||$('logoutBtn'))return;
  const button=document.createElement('button');button.id='logoutBtn';button.type='button';button.className='resource-card';button.innerHTML='<i data-lucide="log-out"></i><div><span>Conta</span><strong>Sair</strong></div>';
  button.addEventListener('click',async()=>{if(state.busy)return;setBusy(true);try{await signOutUser();window.location.replace('index.html');}catch(error){console.error(error);showToast(null,'Não foi possível sair da conta.','error');setBusy(false);}});holder.appendChild(button);
}

function bindUi(){
  all('.activity-tab').forEach(button=>button.addEventListener('click',()=>{if(state.busy)return;state.category=button.dataset.category;all('.activity-tab').forEach(tab=>tab.classList.toggle('active',tab===button));renderActivities();refreshIcons();}));
  all('[data-team-action]').forEach(button=>button.addEventListener('click',()=>executeTeamAction(button.dataset.teamAction)));
  all('[data-close-modal="activity"]').forEach(button=>button.addEventListener('click',()=>{if(!state.busy)closeActivity();}));
  $('activityModal')?.addEventListener('click',event=>{if(event.target.id==='activityModal'&&!state.busy)closeActivity();});
  $('confirmActivityBtn')?.addEventListener('click',()=>{if(state.activityResultMode)closeActivity();else executeActivity();});
  $('advancePeriodBtn')?.addEventListener('click',advancePeriod);
  all('[data-intensity]').forEach(button=>button.addEventListener('click',()=>{if(state.busy)return;state.intensity=button.dataset.intensity;all('[data-intensity]').forEach(item=>item.classList.toggle('active',item===button));}));
  all('[data-duration]').forEach(button=>button.addEventListener('click',()=>{if(state.busy)return;state.duration=Number(button.dataset.duration);all('[data-duration]').forEach(item=>item.classList.toggle('active',item===button));}));
  $('openInboxFromCareer')?.addEventListener('click',()=>{if(state.busy)return;const button=$('gameInboxButton');if(button)button.click();else showToast(null,'A caixa de entrada ainda está carregando.','info');});
  document.addEventListener('keydown',event=>{if(event.key!=='Escape'||state.busy)return;if(!$('activityModal')?.classList.contains('hidden'))closeActivity();});
}

async function init(){
  applyTheme();bindUi();const session=await getCurrentSession();if(!session){window.location.replace('index.html');return;}mountLogout();
  try{await mountCareerInbox();}catch(error){console.error('Falha ao montar caixa da carreira:',error);}
  await loadHub();refreshIcons();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
