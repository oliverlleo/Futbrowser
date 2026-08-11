import { supabase } from '../../services/supabase-client.js';

const MAX_ROUNDS = 3;

const state = {
  mounted: false,
  observer: null,
  modalObserver: null,
  modalWasHidden: true,
  syncTimer: null,
  switching: false,
  switchingTo: null,
  switchTimer: null
};

function activeOfferId() {
  return document.querySelector('.fm-offer-card.active')?.dataset.id || null;
}

function colorForPatience(value) {
  if (value < 30) return 'var(--danger)';
  if (value < 60) return '#f59e0b';
  return 'var(--green)';
}

async function getLiveOfferState(offerId) {
  if (!offerId) return null;

  const [{ data: offer, error: offerError }, { data: history, error: historyError }] = await Promise.all([
    supabase
      .from('player_offers')
      .select('id, status, round, internal_tolerance, current_terms')
      .eq('id', offerId)
      .single(),
    supabase
      .from('player_offer_history')
      .select('round, response_action, remaining_flexibility')
      .eq('offer_id', offerId)
      .order('round', { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  if (offerError) throw offerError;
  if (historyError) throw historyError;

  return {
    ...offer,
    latest_action: history?.response_action || null,
    latest_history_round: history?.round ?? null,
    latest_history_patience: history?.remaining_flexibility ?? null
  };
}

function patchPatienceModal(live) {
  const modal = document.getElementById('signModal');
  if (!modal || modal.classList.contains('hidden')) return;

  const meter = modal.querySelector('.patience-meter');
  if (!meter) return;

  const patience = Math.max(0, Math.min(100, Number(live.internal_tolerance ?? 0)));
  const color = colorForPatience(patience);
  const headerRow = meter.firstElementChild;
  const value = headerRow?.querySelector('span:last-child');
  const icon = headerRow?.querySelector('svg, i');
  const bar = meter.querySelector('.fm-progress > div');

  if (value) {
    value.textContent = `${patience}%`;
    value.style.color = color;
  }
  if (icon) icon.style.color = color;
  if (bar) {
    bar.style.width = `${patience}%`;
    bar.style.background = color;
    bar.style.boxShadow = `0 0 10px ${color}`;
  }

  meter.dataset.liveOfferId = live.id;
  meter.dataset.liveRound = String(live.round ?? 0);
}

function patchNegotiationButton(live) {
  const button = document.getElementById('btnPreviewNegotiate');
  if (!button) return;

  const agreementReached = live.latest_action === 'accepted'
    && Number(live.latest_history_round) === Number(live.round);
  const exhausted = Number(live.round) >= MAX_ROUNDS;
  const closed = !['new', 'reviewed', 'negotiating', 'countered'].includes(live.status);
  const disabled = agreementReached || exhausted || closed;

  button.disabled = disabled;
  button.style.opacity = disabled ? '0.55' : '';

  if (agreementReached) {
    button.title = 'O clube já aceitou os termos atuais. Assine ou recuse a proposta.';
    button.setAttribute('aria-disabled', 'true');
  } else if (exhausted) {
    button.title = 'Limite de 3 rodadas atingido';
    button.setAttribute('aria-disabled', 'true');
  } else if (closed) {
    button.title = 'Negociação encerrada';
    button.setAttribute('aria-disabled', 'true');
  } else {
    button.removeAttribute('title');
    button.removeAttribute('aria-disabled');
  }
}

async function syncCurrentNegotiation() {
  const offerId = activeOfferId();
  if (!offerId) return;

  try {
    const live = await getLiveOfferState(offerId);
    if (!live || activeOfferId() !== offerId) return;

    patchNegotiationButton(live);
    patchPatienceModal(live);
  } catch (error) {
    console.error('Erro ao sincronizar estado da negociação:', error);
  }
}

function scheduleSync(delay = 40) {
  window.clearTimeout(state.syncTimer);
  state.syncTimer = window.setTimeout(syncCurrentNegotiation, delay);
}

function unlockSelectionWhenReady(offerId) {
  window.clearInterval(state.switchTimer);
  const startedAt = Date.now();

  state.switchTimer = window.setInterval(() => {
    const selected = activeOfferId();
    if (selected === offerId || Date.now() - startedAt > 6000) {
      window.clearInterval(state.switchTimer);
      state.switching = false;
      state.switchingTo = null;
      scheduleSync(0);
    }
  }, 60);
}

function installSelectionGuard() {
  document.addEventListener('click', event => {
    const card = event.target.closest?.('.fm-offer-card');
    if (!card) return;

    const offerId = card.dataset.id;
    if (!offerId) return;

    if (state.switching && state.switchingTo !== offerId) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    if (!state.switching) {
      state.switching = true;
      state.switchingTo = offerId;
      unlockSelectionWhenReady(offerId);
    }
  }, true);

  document.addEventListener('click', event => {
    if (event.target.closest?.('#btnPreviewNegotiate')) {
      scheduleSync(0);
    }
  });
}

function installPanelObserver() {
  const panel = document.getElementById('contractPanel');
  if (!panel || state.observer) return;

  state.observer = new MutationObserver(() => scheduleSync());
  state.observer.observe(panel, { childList: true, subtree: true });
  scheduleSync(0);
}

function resetSharedModalButton() {
  const modal = document.getElementById('signModal');
  const button = document.getElementById('btnConfirmSign');
  if (!modal || !button || modal.classList.contains('hidden')) return;

  // offers-ui reutiliza o mesmo botão para negociar/assinar. Depois de um
  // envio bem-sucedido ele ficava disabled para sempre. Reativamos apenas na
  // transição de fechado -> aberto; durante uma requisição em andamento não
  // tocamos no botão.
  button.disabled = false;
  button.removeAttribute('aria-disabled');
  button.style.opacity = '';
  button.style.pointerEvents = '';
}

function installModalResetObserver() {
  const modal = document.getElementById('signModal');
  if (!modal || state.modalObserver) return;

  state.modalWasHidden = modal.classList.contains('hidden');
  state.modalObserver = new MutationObserver(mutations => {
    if (!mutations.some(mutation => mutation.type === 'attributes' && mutation.attributeName === 'class')) return;

    const isHidden = modal.classList.contains('hidden');
    if (state.modalWasHidden && !isHidden) {
      resetSharedModalButton();
      scheduleSync(0);
    }
    state.modalWasHidden = isHidden;
  });

  state.modalObserver.observe(modal, { attributes: true, attributeFilter: ['class'] });
}

export function mountNegotiationStateSync() {
  if (state.mounted) return;
  if (!window.location.pathname.toLowerCase().includes('dashboard')) return;

  state.mounted = true;
  installSelectionGuard();
  installPanelObserver();
  installModalResetObserver();
}
