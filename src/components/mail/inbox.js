import { supabase } from '../../services/supabase-client.js';
import { showToast } from '../toast/toast.js';

const STYLE_ID = 'futbrowser-game-inbox-styles';
const MODAL_ID = 'gameInboxModal';
const BUTTON_ID = 'gameInboxButton';
const POLL_MS = 2000;
const ACTIVE_STATUSES = new Set(['new', 'reviewed', 'negotiating', 'countered']);

const state = {
  mounted: false,
  playerId: null,
  messages: [],
  knownIds: new Set(),
  initialized: false,
  pollTimer: null,
  selectedId: null,
  panelObserver: null
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatCurrency(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0
  }).format(number);
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function responseLabel(action) {
  if (action === 'accepted') return 'Termos aceitos';
  if (action === 'withdrawn') return 'Negociação encerrada';
  return 'Contraproposta';
}

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #${BUTTON_ID}.mail-resource-card{position:relative;width:218px;cursor:pointer;text-align:left;color:var(--text);appearance:none}
    #${BUTTON_ID}.mail-resource-card svg{color:var(--green-2)!important;stroke:currentColor;fill:none}
    .game-mail-badge{position:absolute;top:8px;right:9px;min-width:22px;height:22px;padding:0 6px;display:grid;place-items:center;border:2px solid var(--card-solid);border-radius:999px;background:#ef4444;color:#fff;font-size:11px;font-weight:950;box-shadow:0 4px 12px rgba(239,68,68,.28)}
    .game-mail-badge.is-empty{display:none}
    .game-inbox-overlay{position:fixed;inset:0;z-index:120000;display:grid;place-items:center;padding:20px;background:rgba(7,15,25,.62);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
    .game-inbox-overlay.hidden{display:none!important}
    .game-inbox-panel{width:min(1040px,calc(100vw - 36px));height:min(700px,calc(100vh - 48px));min-height:520px;display:grid;grid-template-rows:auto 1fr;overflow:hidden;border:1px solid var(--line);border-radius:18px;background:var(--card-solid);color:var(--text);box-shadow:0 30px 90px rgba(5,12,22,.38)}
    .game-inbox-header{min-height:78px;padding:16px 20px;display:flex;align-items:center;justify-content:space-between;gap:16px;border-bottom:1px solid var(--line);background:linear-gradient(135deg,rgba(56,201,31,.10),transparent 52%)}
    .game-inbox-heading{display:flex;align-items:center;gap:13px;min-width:0}.game-inbox-heading-icon{width:42px;height:42px;display:grid;place-items:center;flex:0 0 auto;border-radius:12px;background:rgba(56,201,31,.12);color:var(--green-2)}
    .game-inbox-heading-icon svg{width:23px;height:23px}.game-inbox-heading h2{margin:0;font-size:20px;font-weight:950;letter-spacing:-.025em}.game-inbox-heading p{margin:3px 0 0;color:var(--muted);font-size:12px;font-weight:700}
    .game-inbox-close{width:38px;height:38px;display:grid;place-items:center;border:1px solid var(--line);border-radius:10px;background:transparent;color:var(--muted);cursor:pointer}.game-inbox-close:hover{color:var(--text);background:rgba(127,127,127,.08)}
    .game-inbox-body{min-height:0;display:grid;grid-template-columns:340px minmax(0,1fr)}.game-inbox-list{min-height:0;padding:12px;overflow-y:auto;border-right:1px solid var(--line);background:rgba(127,127,127,.025)}
    .game-mail-item{width:100%;margin:0 0 9px;padding:13px 13px 12px;display:grid;grid-template-columns:10px minmax(0,1fr);gap:9px;border:1px solid var(--line);border-radius:12px;background:var(--card-solid);color:var(--text);text-align:left;cursor:pointer;transition:border-color .18s ease,transform .18s ease,background .18s ease}.game-mail-item:hover{border-color:rgba(56,201,31,.55);transform:translateY(-1px)}.game-mail-item.active{border-color:var(--green-2);background:rgba(56,201,31,.055)}.game-mail-item.unread .game-mail-subject{font-weight:950}
    .game-mail-dot{width:8px;height:8px;margin-top:5px;border-radius:50%;background:transparent}.game-mail-item.unread .game-mail-dot{background:var(--green-2);box-shadow:0 0 10px rgba(56,201,31,.45)}
    .game-mail-club{color:var(--green-2);font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.06em}.game-mail-subject{display:block;margin-top:4px;font-size:13px;line-height:1.3;font-weight:800}.game-mail-time{display:block;margin-top:7px;color:var(--muted);font-size:11px;font-weight:650}
    .game-inbox-detail{min-width:0;min-height:0;padding:24px 28px 28px;overflow-y:auto}.game-mail-empty{height:100%;display:grid;place-items:center;color:var(--muted);text-align:center;font-weight:750}
    .game-mail-detail-kicker{display:inline-flex;align-items:center;min-height:26px;padding:0 9px;border-radius:999px;background:rgba(56,201,31,.10);color:var(--green-2);font-size:10px;font-weight:950;text-transform:uppercase;letter-spacing:.07em}.game-mail-detail-title{margin:12px 0 5px;font-size:clamp(22px,2.4vw,30px);line-height:1.08;font-weight:950;letter-spacing:-.035em}.game-mail-detail-from{color:var(--muted);font-size:12px;font-weight:700}.game-mail-detail-body{margin:22px 0;color:var(--text);font-size:14px;line-height:1.65;font-weight:650}
    .game-mail-terms-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:16px}.game-mail-terms-card{padding:15px;border:1px solid var(--line);border-radius:12px;background:rgba(127,127,127,.035)}.game-mail-terms-card.response{border-color:rgba(56,201,31,.34);background:rgba(56,201,31,.055)}.game-mail-terms-card h4{margin:0 0 10px;font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.055em}
    .game-mail-term{min-height:31px;display:flex;justify-content:space-between;gap:16px;align-items:center;border-bottom:1px solid var(--line);font-size:12px}.game-mail-term:last-child{border-bottom:0}.game-mail-term span{color:var(--muted)}.game-mail-term strong{text-align:right;color:var(--text)}
    .game-mail-current-state{margin-top:14px;padding:12px 13px;border-radius:10px;border:1px solid rgba(56,201,31,.24);background:rgba(56,201,31,.055);font-size:12px;line-height:1.45;font-weight:800}.game-mail-current-state.warning{border-color:rgba(245,158,11,.28);background:rgba(245,158,11,.08)}
    .game-mail-actions{margin-top:22px;display:flex;flex-wrap:wrap;gap:10px}.game-mail-action{min-height:44px;padding:0 16px;display:inline-flex;align-items:center;justify-content:center;gap:8px;border:1px solid var(--line);border-radius:9px;background:transparent;color:var(--text);font-weight:900;cursor:pointer}.game-mail-action.primary{border-color:var(--green-2);background:linear-gradient(180deg,var(--green),var(--green-2));color:#fff;box-shadow:0 8px 20px rgba(56,201,31,.20)}
    .game-mail-history-shortcut{width:100%;min-height:58px;padding:11px 12px;display:flex;align-items:center;gap:10px;border:1px solid rgba(56,201,31,.28);border-radius:10px;background:rgba(56,201,31,.055);color:var(--text);text-align:left;cursor:pointer}.game-mail-history-shortcut svg{width:21px;height:21px;flex:0 0 auto;color:var(--green-2)}.game-mail-history-shortcut strong{display:block;font-size:12px;font-weight:950}.game-mail-history-shortcut span{display:block;margin-top:3px;color:var(--muted);font-size:11px;line-height:1.3}
    #contractPanel .fm-actions{position:sticky;bottom:0;z-index:5;margin-top:14px;padding:12px 0 4px;background:linear-gradient(180deg,transparent 0,var(--card) 18px,var(--card) 100%)}
    @media(max-width:760px){.game-inbox-panel{height:min(760px,calc(100vh - 24px));width:calc(100vw - 20px)}.game-inbox-body{grid-template-columns:1fr;grid-template-rows:210px minmax(0,1fr)}.game-inbox-list{border-right:0;border-bottom:1px solid var(--line)}.game-inbox-detail{padding:18px}.game-mail-terms-grid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
}

async function resolvePlayerId() {
  const { data: authData } = await supabase.auth.getUser();
  const user = authData?.user;
  if (!user) return null;

  const { data, error } = await supabase
    .from('jogadores')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) throw error;
  state.playerId = data?.id || null;
  return state.playerId;
}

async function fetchMessages() {
  const playerId = state.playerId || await resolvePlayerId();
  if (!playerId) return [];

  const { data: messages, error } = await supabase
    .from('player_messages')
    .select('id, player_id, offer_id, club_id, message_type, subject, body, metadata, is_read, created_at, base_clubs(name)')
    .eq('player_id', playerId)
    .order('created_at', { ascending: false })
    .limit(40);

  if (error) throw error;

  const offerIds = [...new Set((messages || []).map(message => message.offer_id).filter(Boolean))];
  let offerMap = new Map();

  if (offerIds.length > 0) {
    const { data: offers, error: offersError } = await supabase
      .from('player_offers')
      .select('id, status, round, internal_tolerance, current_terms')
      .in('id', offerIds);
    if (offersError) throw offersError;
    offerMap = new Map((offers || []).map(offer => [offer.id, offer]));
  }

  return (messages || []).map(message => ({
    ...message,
    offer_state: message.offer_id ? offerMap.get(message.offer_id) || null : null
  }));
}

function getClubName(message) {
  return message?.base_clubs?.name || 'Clube';
}

function getUnreadCount() {
  return state.messages.filter(message => !message.is_read).length;
}

function updateBadge() {
  const badge = document.querySelector(`#${BUTTON_ID} .game-mail-badge`);
  const count = getUnreadCount();
  if (!badge) return;
  badge.textContent = count > 99 ? '99+' : String(count);
  badge.classList.toggle('is-empty', count === 0);

  const strong = document.querySelector(`#${BUTTON_ID} strong`);
  if (strong) strong.textContent = count ? `${count} não lido${count > 1 ? 's' : ''}` : 'Caixa de entrada';
}

function mountTopButton() {
  const resourceCards = document.querySelector('.resource-cards');
  if (!resourceCards) return null;

  resourceCards.querySelectorAll('.resource-card').forEach(card => {
    if (card.id !== 'logoutBtn' && card.id !== BUTTON_ID) card.remove();
  });

  let button = document.getElementById(BUTTON_ID);
  if (!button) {
    button = document.createElement('button');
    button.id = BUTTON_ID;
    button.type = 'button';
    button.className = 'resource-card mail-resource-card';
    button.setAttribute('aria-label', 'Abrir caixa de entrada');
    button.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v14H4z"></path><path d="m4 7 8 6 8-6"></path></svg>
      <div><span>E-mail</span><strong>Caixa de entrada</strong></div>
      <b class="game-mail-badge is-empty">0</b>
    `;
    resourceCards.insertBefore(button, resourceCards.firstChild);
    button.addEventListener('click', () => openInbox());
  }

  return button;
}

function createModal() {
  let modal = document.getElementById(MODAL_ID);
  if (modal) return modal;

  modal = document.createElement('div');
  modal.id = MODAL_ID;
  modal.className = 'game-inbox-overlay hidden';
  modal.innerHTML = `
    <section class="game-inbox-panel" role="dialog" aria-modal="true" aria-label="Caixa de entrada">
      <header class="game-inbox-header">
        <div class="game-inbox-heading">
          <span class="game-inbox-heading-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 5h16v14H4z"></path><path d="m4 7 8 6 8-6"></path></svg></span>
          <div><h2>Caixa de entrada</h2><p>Clubes, empresário e decisões da sua carreira</p></div>
        </div>
        <button class="game-inbox-close" type="button" aria-label="Fechar caixa de entrada"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6 6 18"></path></svg></button>
      </header>
      <div class="game-inbox-body"><div class="game-inbox-list" id="gameInboxList"></div><div class="game-inbox-detail" id="gameInboxDetail"></div></div>
    </section>
  `;

  modal.querySelector('.game-inbox-close')?.addEventListener('click', closeInbox);
  modal.addEventListener('click', event => { if (event.target === modal) closeInbox(); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !modal.classList.contains('hidden')) closeInbox();
  });

  document.body.appendChild(modal);
  return modal;
}

function renderList() {
  const list = document.getElementById('gameInboxList');
  if (!list) return;

  if (state.messages.length === 0) {
    list.innerHTML = '<div class="game-mail-empty"><div>Nenhum e-mail ainda.<br><small>As respostas dos clubes aparecerão aqui.</small></div></div>';
    return;
  }

  list.innerHTML = state.messages.map(message => `
    <button class="game-mail-item ${message.is_read ? '' : 'unread'} ${message.id === state.selectedId ? 'active' : ''}" type="button" data-message-id="${escapeHtml(message.id)}">
      <span class="game-mail-dot"></span>
      <span><span class="game-mail-club">${escapeHtml(getClubName(message))}</span><span class="game-mail-subject">${escapeHtml(message.subject)}</span><span class="game-mail-time">${escapeHtml(formatDate(message.created_at))}</span></span>
    </button>
  `).join('');

  list.querySelectorAll('[data-message-id]').forEach(button => {
    button.addEventListener('click', () => selectMessage(button.dataset.messageId));
  });
}

function termsHtml(terms = {}) {
  return `
    <div class="game-mail-term"><span>Salário</span><strong>${escapeHtml(formatCurrency(terms.monthly_wage))}</strong></div>
    <div class="game-mail-term"><span>Papel no elenco</span><strong>${escapeHtml(terms.squad_role || '—')}</strong></div>
    <div class="game-mail-term"><span>Duração</span><strong>${terms.duration_seasons ? `${escapeHtml(terms.duration_seasons)} temp.` : '—'}</strong></div>
    <div class="game-mail-term"><span>Multa</span><strong>${escapeHtml(formatCurrency(terms.release_clause))}</strong></div>
    <div class="game-mail-term"><span>Bônus</span><strong>${escapeHtml(formatCurrency(terms.signing_bonus))}</strong></div>
  `;
}

function renderDetail(message) {
  const detail = document.getElementById('gameInboxDetail');
  if (!detail) return;

  if (!message) {
    detail.innerHTML = '<div class="game-mail-empty"><div>Selecione um e-mail para ler.</div></div>';
    return;
  }

  const metadata = message.metadata || {};
  const offerState = message.offer_state || null;
  const action = metadata.response_action;
  const round = Number(metadata.round || 0);
  const requested = metadata.requested_terms || {};
  const response = metadata.response_terms || {};
  const currentRound = Number(offerState?.round ?? round);
  const currentPatience = Number(offerState?.internal_tolerance ?? metadata.remaining_flexibility ?? 0);
  const isCurrentRound = Boolean(offerState && currentRound === round);
  const offerIsActive = Boolean(offerState && ACTIVE_STATUSES.has(offerState.status));
  const canNegotiate = action === 'countered' && isCurrentRound && offerIsActive && currentRound < 3;
  const canSign = action === 'accepted' && isCurrentRound && offerState?.status === 'countered';
  const signed = offerState?.status === 'accepted';

  let stateNote = '';
  if (signed) {
    stateNote = '<div class="game-mail-current-state">Contrato já assinado. Esta mensagem ficou apenas como histórico.</div>';
  } else if (!isCurrentRound && offerState) {
    stateNote = `<div class="game-mail-current-state warning">Este e-mail é da rodada ${round}. A negociação já está na rodada ${currentRound}/3 e a paciência atual do clube é ${currentPatience}%.</div>`;
  } else if (action === 'countered' && offerState) {
    stateNote = `<div class="game-mail-current-state">Situação atual: rodada ${currentRound}/3 · paciência do clube ${currentPatience}%.</div>`;
  }

  detail.innerHTML = `
    <span class="game-mail-detail-kicker">${escapeHtml(responseLabel(action))} · rodada ${round || '—'}/3</span>
    <h3 class="game-mail-detail-title">${escapeHtml(message.subject)}</h3>
    <div class="game-mail-detail-from">De: Diretoria do ${escapeHtml(getClubName(message))} · ${escapeHtml(formatDate(message.created_at))}</div>
    <p class="game-mail-detail-body">${escapeHtml(message.body)}</p>
    ${message.message_type === 'negotiation_response' ? `
      <div class="game-mail-terms-grid">
        <section class="game-mail-terms-card"><h4>Sua contraproposta</h4>${termsHtml(requested)}</section>
        <section class="game-mail-terms-card response"><h4>Resposta do clube</h4>${termsHtml(response)}</section>
      </div>
      ${stateNote}
    ` : ''}
    <div class="game-mail-actions">
      ${canNegotiate ? '<button class="game-mail-action primary" type="button" data-mail-action="negotiate">Negociar novamente</button>' : ''}
      ${canSign ? '<button class="game-mail-action primary" type="button" data-mail-action="sign">Revisar e assinar</button>' : ''}
      ${message.offer_id ? '<button class="game-mail-action" type="button" data-mail-action="open-offer">Abrir proposta atual</button>' : ''}
    </div>
  `;

  detail.querySelector('[data-mail-action="negotiate"]')?.addEventListener('click', () => openOfferAction(message.offer_id, 'negotiate'));
  detail.querySelector('[data-mail-action="sign"]')?.addEventListener('click', () => openOfferAction(message.offer_id, 'sign'));
  detail.querySelector('[data-mail-action="open-offer"]')?.addEventListener('click', () => openOfferAction(message.offer_id, 'open'));
}

async function markRead(message) {
  if (!message || message.is_read) return;

  message.is_read = true;
  updateBadge();
  renderList();

  const { error } = await supabase.rpc('mark_player_message_read', { p_message_id: message.id });
  if (error) console.error('Erro ao marcar e-mail como lido:', error);
}

async function selectMessage(messageId) {
  const message = state.messages.find(item => item.id === messageId);
  if (!message) return;
  state.selectedId = message.id;
  renderList();
  renderDetail(message);
  await markRead(message);
}

function waitUntil(predicate, timeout = 5000) {
  return new Promise(resolve => {
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const value = predicate();
      if (value || Date.now() - startedAt >= timeout) {
        window.clearInterval(timer);
        resolve(value || null);
      }
    }, 60);
  });
}

async function openOfferAction(offerId, action) {
  closeInbox();
  const escapedId = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(offerId) : offerId;
  let card = document.querySelector(`.fm-offer-card[data-id="${escapedId}"]`);

  if (!card) {
    showToast(null, 'Não encontrei esta proposta na lista atual.', 'error');
    return;
  }

  card.click();

  // Só continua quando a troca de clube terminou de verdade. Antes o botão do
  // e-mail podia clicar na ação da proposta anterior ainda presente no DOM.
  const activeCard = await waitUntil(() => document.querySelector(`.fm-offer-card.active[data-id="${escapedId}"]`));
  if (!activeCard) {
    showToast(null, 'A proposta não terminou de carregar. Tente novamente.', 'error');
    return;
  }

  if (action === 'open') {
    document.querySelector('.fm-center')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  const selector = action === 'negotiate' ? '#btnPreviewNegotiate' : '#btnAccept';
  const target = await waitUntil(() => {
    const button = document.querySelector(selector);
    return button && !button.disabled ? button : null;
  });

  if (target) target.click();
  else showToast(null, 'Esta ação não está mais disponível para a situação atual da proposta.', 'info');
}

function patchNegotiationPanel() {
  const panel = document.getElementById('contractPanel');
  if (!panel) return;

  const historyHeading = [...panel.querySelectorAll('h4')]
    .find(element => element.textContent?.trim().toLowerCase() === 'histórico da negociação');
  if (!historyHeading) return;

  const wrapper = historyHeading.parentElement;
  if (!wrapper || wrapper.dataset.mailShortcut === 'true') return;

  const activeOfferId = document.querySelector('.fm-offer-card.active')?.dataset.id || null;
  const roundText = panel.querySelector('.fm-contract-section strong[style*="var(--green)"]')?.textContent?.trim() || '';
  wrapper.dataset.mailShortcut = 'true';
  wrapper.innerHTML = `
    <button type="button" class="game-mail-history-shortcut">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 5h16v14H4z"></path><path d="m4 7 8 6 8-6"></path></svg>
      <span><strong>Respostas da negociação por e-mail</strong><span>${escapeHtml(roundText ? `Rodada ${roundText}. ` : '')}Abra a conversa deste clube.</span></span>
    </button>
  `;
  wrapper.querySelector('button')?.addEventListener('click', () => openInbox(activeOfferId));
}

function installNegotiationPanelObserver() {
  const panel = document.getElementById('contractPanel');
  if (!panel || state.panelObserver) return;
  state.panelObserver = new MutationObserver(() => patchNegotiationPanel());
  state.panelObserver.observe(panel, { childList: true, subtree: true });
  patchNegotiationPanel();
}

async function refreshInbox({ notifyNew = true } = {}) {
  try {
    const messages = await fetchMessages();
    const newMessages = state.initialized
      ? messages.filter(message => !state.knownIds.has(message.id))
      : [];

    state.messages = messages;
    messages.forEach(message => state.knownIds.add(message.id));
    state.initialized = true;

    updateBadge();
    renderList();
    if (state.selectedId) renderDetail(state.messages.find(message => message.id === state.selectedId));

    if (notifyNew && newMessages.length > 0) {
      const newest = newMessages[0];
      showToast('Novo e-mail', `${getClubName(newest)} respondeu à sua negociação.`, 'info');
    }
  } catch (error) {
    console.error('Erro ao atualizar caixa de entrada:', error);
  }
}

async function openInbox(offerId = null) {
  createModal().classList.remove('hidden');
  await refreshInbox({ notifyNew: false });

  const candidate = offerId
    ? state.messages.find(message => message.offer_id === offerId && !message.is_read)
      || state.messages.find(message => message.offer_id === offerId)
    : state.messages.find(message => !message.is_read) || state.messages[0];

  if (candidate) await selectMessage(candidate.id);
  else renderDetail(null);
}

function closeInbox() {
  document.getElementById(MODAL_ID)?.classList.add('hidden');
}

export async function mountGameInbox() {
  if (state.mounted) return;
  if (!window.location.pathname.toLowerCase().includes('dashboard')) return;

  ensureStyles();
  mountTopButton();
  createModal();
  installNegotiationPanelObserver();
  state.mounted = true;

  await refreshInbox({ notifyNew: false });
  state.pollTimer = window.setInterval(() => refreshInbox({ notifyNew: true }), POLL_MS);
}
