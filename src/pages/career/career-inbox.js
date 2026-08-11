import { supabase } from '../../services/supabase-client.js';
import { showToast } from '../../components/toast/toast.js';

const BUTTON_ID = 'gameInboxButton';
const MODAL_ID = 'careerInboxModal';
const STYLE_ID = 'career-inbox-styles';
const POLL_MS = 4000;

const state = {
  mounted: false,
  playerId: null,
  messages: [],
  known: new Set(),
  initialized: false,
  selectedId: null,
  timer: null
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
  }).format(date);
}

function sourceName(message) {
  if (message.metadata?.kind === 'medical') return 'Departamento médico';
  if (message.metadata?.kind === 'coach_reaction') return 'Treinador';
  if (message.metadata?.kind === 'salary') return 'Financeiro do clube';
  if (message.message_type === 'negotiation_response') return message.base_clubs?.name || 'Diretoria do clube';
  return message.base_clubs?.name || 'Carreira';
}

function categoryLabel(message) {
  if (message.metadata?.kind === 'medical') return 'Saúde';
  if (message.metadata?.kind === 'coach_reaction') return 'Treinador';
  if (message.metadata?.kind === 'salary') return 'Financeiro';
  if (message.metadata?.event === 'club_welcome') return 'Clube';
  if (message.message_type === 'negotiation_response') return 'Negociação';
  if (message.message_type === 'offer') return 'Proposta';
  return 'Carreira';
}

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #${BUTTON_ID}.mail-resource-card{position:relative;width:190px;cursor:pointer;text-align:left;color:var(--text);appearance:none}
    #${BUTTON_ID}.mail-resource-card svg{color:var(--green-2)!important;stroke:currentColor;fill:none}
    .career-mail-badge{position:absolute;top:7px;right:8px;min-width:21px;height:21px;padding:0 6px;display:grid;place-items:center;border:2px solid var(--card-solid);border-radius:999px;background:#ef4444;color:#fff;font-size:10px;font-weight:950}.career-mail-badge.empty{display:none}
    .career-inbox-overlay{position:fixed;inset:0;z-index:150000;display:grid;place-items:center;padding:18px;background:rgba(7,15,25,.64);backdrop-filter:blur(8px)}.career-inbox-overlay.hidden{display:none!important}
    .career-inbox-panel{width:min(1000px,calc(100vw - 28px));height:min(680px,calc(100vh - 32px));display:grid;grid-template-rows:auto 1fr;overflow:hidden;border:1px solid var(--line);border-radius:17px;background:var(--card-solid);color:var(--text);box-shadow:0 30px 90px rgba(5,12,22,.42)}
    .career-inbox-header{min-height:76px;padding:15px 19px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line);background:linear-gradient(135deg,rgba(56,201,31,.10),transparent 55%)}.career-inbox-heading{display:flex;align-items:center;gap:12px}.career-inbox-heading>span{width:40px;height:40px;display:grid;place-items:center;border-radius:11px;background:rgba(56,201,31,.11);color:var(--green-2)}.career-inbox-heading h2{font-size:19px;font-weight:950}.career-inbox-heading p{margin-top:3px;color:var(--muted);font-size:10px;font-weight:700}.career-inbox-close{width:36px;height:36px;display:grid;place-items:center;border:1px solid var(--line);border-radius:9px;background:transparent;color:var(--muted);cursor:pointer}
    .career-inbox-body{min-height:0;display:grid;grid-template-columns:330px minmax(0,1fr)}.career-inbox-list{min-height:0;padding:11px;overflow:auto;border-right:1px solid var(--line);background:rgba(127,127,127,.025)}.career-inbox-detail{min-height:0;padding:24px 28px;overflow:auto}
    .career-mail-item{width:100%;margin-bottom:8px;padding:12px;display:grid;grid-template-columns:9px minmax(0,1fr);gap:9px;border:1px solid var(--line);border-radius:10px;background:var(--card-solid);color:var(--text);text-align:left;cursor:pointer}.career-mail-item:hover,.career-mail-item.active{border-color:rgba(56,201,31,.5);background:rgba(56,201,31,.045)}.career-mail-dot{width:7px;height:7px;margin-top:5px;border-radius:50%;background:transparent}.career-mail-item.unread .career-mail-dot{background:var(--green-2);box-shadow:0 0 9px rgba(56,201,31,.5)}.career-mail-source{display:block;color:var(--green-2);font-size:9px;font-weight:950;text-transform:uppercase;letter-spacing:.06em}.career-mail-subject{display:block;margin-top:4px;font-size:11px;line-height:1.35;font-weight:850}.career-mail-item.unread .career-mail-subject{font-weight:950}.career-mail-time{display:block;margin-top:6px;color:var(--muted);font-size:9px;font-weight:700}
    .career-mail-kicker{display:inline-flex;padding:6px 9px;border-radius:999px;background:rgba(56,201,31,.09);color:var(--green-2);font-size:9px;font-weight:950;text-transform:uppercase;letter-spacing:.06em}.career-mail-title{margin-top:13px;font-size:28px;line-height:1.08;font-weight:950;letter-spacing:-.035em}.career-mail-from{margin-top:6px;color:var(--muted);font-size:10px;font-weight:700}.career-mail-body{margin-top:24px;white-space:pre-line;font-size:13px;line-height:1.7;font-weight:650}.career-mail-meta{margin-top:20px;padding:12px;border:1px solid var(--line);border-radius:10px;background:rgba(127,127,127,.025);color:var(--muted);font-size:10px;font-weight:750}.career-mail-empty{height:100%;display:grid;place-items:center;text-align:center;color:var(--muted);font-size:11px;font-weight:750}
    @media(max-width:720px){.career-inbox-body{grid-template-columns:1fr;grid-template-rows:210px 1fr}.career-inbox-list{border-right:0;border-bottom:1px solid var(--line)}.career-inbox-detail{padding:18px}.career-inbox-panel{height:calc(100vh - 20px)}}
  `;
  document.head.appendChild(style);
}

async function resolvePlayer() {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return null;
  const { data, error } = await supabase
    .from('jogadores')
    .select('id')
    .eq('user_id', auth.user.id)
    .maybeSingle();
  if (error) throw error;
  state.playerId = data?.id || null;
  return state.playerId;
}

async function fetchMessages() {
  const playerId = state.playerId || await resolvePlayer();
  if (!playerId) return [];
  const { data, error } = await supabase
    .from('player_messages')
    .select('id,player_id,offer_id,club_id,message_type,subject,body,metadata,is_read,created_at,base_clubs(name)')
    .eq('player_id', playerId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return data || [];
}

function updateBadge() {
  const unread = state.messages.filter(item => !item.is_read).length;
  const badge = document.querySelector(`#${BUTTON_ID} .career-mail-badge`);
  const strong = document.querySelector(`#${BUTTON_ID} strong`);
  if (badge) {
    badge.textContent = unread > 99 ? '99+' : String(unread);
    badge.classList.toggle('empty', unread === 0);
  }
  if (strong) strong.textContent = unread ? `${unread} não lido${unread > 1 ? 's' : ''}` : 'Caixa de entrada';
  const teaser = document.getElementById('unreadMailCount');
  if (teaser) teaser.textContent = unread;
}

function mountButton() {
  const host = document.querySelector('.resource-cards');
  if (!host) return;
  if (document.getElementById(BUTTON_ID)) return;

  const button = document.createElement('button');
  button.id = BUTTON_ID;
  button.type = 'button';
  button.className = 'resource-card mail-resource-card';
  button.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 5h16v14H4z"></path><path d="m4 7 8 6 8-6"></path></svg><div><span>E-mail</span><strong>Caixa de entrada</strong></div><b class="career-mail-badge empty">0</b>';
  button.addEventListener('click', openInbox);
  host.insertBefore(button, host.firstChild);
}

function createModal() {
  if (document.getElementById(MODAL_ID)) return;
  const modal = document.createElement('div');
  modal.id = MODAL_ID;
  modal.className = 'career-inbox-overlay hidden';
  modal.innerHTML = `<section class="career-inbox-panel" role="dialog" aria-modal="true" aria-label="Caixa de entrada da carreira">
    <header class="career-inbox-header"><div class="career-inbox-heading"><span><svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 5h16v14H4z"></path><path d="m4 7 8 6 8-6"></path></svg></span><div><h2>Caixa de entrada</h2><p>Clube, treinador, médico, empresário e sua vida profissional</p></div></div><button class="career-inbox-close" type="button" aria-label="Fechar"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6 6 18"></path></svg></button></header>
    <div class="career-inbox-body"><div class="career-inbox-list" id="careerInboxList"></div><div class="career-inbox-detail" id="careerInboxDetail"></div></div>
  </section>`;
  modal.querySelector('.career-inbox-close').addEventListener('click', closeInbox);
  modal.addEventListener('click', event => { if (event.target === modal) closeInbox(); });
  document.body.appendChild(modal);
}

function renderList() {
  const list = document.getElementById('careerInboxList');
  if (!list) return;
  if (!state.messages.length) {
    list.innerHTML = '<div class="career-mail-empty">Nenhuma mensagem ainda.</div>';
    return;
  }
  list.innerHTML = state.messages.map(message => `
    <button type="button" class="career-mail-item ${message.is_read ? '' : 'unread'} ${message.id === state.selectedId ? 'active' : ''}" data-mail-id="${escapeHtml(message.id)}">
      <span class="career-mail-dot"></span>
      <span><span class="career-mail-source">${escapeHtml(sourceName(message))}</span><span class="career-mail-subject">${escapeHtml(message.subject)}</span><span class="career-mail-time">${escapeHtml(formatDate(message.created_at))}</span></span>
    </button>`).join('');
  list.querySelectorAll('[data-mail-id]').forEach(button => button.addEventListener('click', () => selectMessage(button.dataset.mailId)));
}

function renderDetail(message) {
  const detail = document.getElementById('careerInboxDetail');
  if (!detail) return;
  if (!message) {
    detail.innerHTML = '<div class="career-mail-empty">Selecione uma mensagem.</div>';
    return;
  }
  const meta = message.metadata || {};
  const extra = meta.kind === 'salary' && meta.amount
    ? `<div class="career-mail-meta">Crédito registrado: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(meta.amount))}</div>`
    : '';
  detail.innerHTML = `<span class="career-mail-kicker">${escapeHtml(categoryLabel(message))}</span><h3 class="career-mail-title">${escapeHtml(message.subject)}</h3><div class="career-mail-from">De: ${escapeHtml(sourceName(message))} · ${escapeHtml(formatDate(message.created_at))}</div><div class="career-mail-body">${escapeHtml(message.body)}</div>${extra}`;
}

async function markRead(message) {
  if (!message || message.is_read) return;
  message.is_read = true;
  updateBadge();
  renderList();
  const { error } = await supabase.rpc('mark_player_message_read', { p_message_id: message.id });
  if (error) console.error('Erro ao marcar e-mail como lido:', error);
}

async function selectMessage(id) {
  const message = state.messages.find(item => item.id === id);
  if (!message) return;
  state.selectedId = id;
  renderList();
  renderDetail(message);
  await markRead(message);
}

async function refresh({ notify = true } = {}) {
  try {
    const messages = await fetchMessages();
    const fresh = state.initialized ? messages.filter(message => !state.known.has(message.id)) : [];
    state.messages = messages;
    messages.forEach(message => state.known.add(message.id));
    state.initialized = true;
    updateBadge();
    renderList();
    if (state.selectedId) renderDetail(messages.find(item => item.id === state.selectedId));
    if (notify && fresh.length) showToast('Novo e-mail', fresh[0].subject, 'info');
  } catch (error) {
    console.error('Erro ao atualizar e-mails da carreira:', error);
  }
}

async function openInbox() {
  document.getElementById(MODAL_ID)?.classList.remove('hidden');
  await refresh({ notify: false });
  const candidate = state.messages.find(message => !message.is_read) || state.messages[0];
  if (candidate) await selectMessage(candidate.id);
  else renderDetail(null);
}

function closeInbox() {
  document.getElementById(MODAL_ID)?.classList.add('hidden');
}

export async function mountCareerInbox() {
  if (state.mounted) return;
  if (!window.location.pathname.toLowerCase().includes('career')) return;
  ensureStyles();
  mountButton();
  createModal();
  await refresh({ notify: false });
  const welcome = state.messages.find(message => !message.is_read && message.metadata?.event === 'club_welcome');
  if (welcome) showToast('Novo e-mail', welcome.subject, 'info');
  state.mounted = true;
  window.clearInterval(state.timer);
  state.timer = window.setInterval(() => refresh({ notify: true }), POLL_MS);
}
