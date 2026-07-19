import {
  generateInitialOffers,
  getOfferDetails,
  negotiateOffer,
  acceptOffer,
  rejectOffer,
  getActiveOffers,
  getPlayerProfile
} from '../../services/offer-service.js';
import { showToast } from '../../components/toast/toast.js';

let activeOffers = [];
let currentDossier = null;
let selectedOfferId = null;
let currentPlayer = null;
let tabsBound = false;

const CLOSED_STATUSES = new Set(['accepted', 'rejected', 'withdrawn', 'expired']);
const ROLE_ORDER = ['Promessa', 'Reserva', 'Rotação', 'Titular'];

const money = (value) => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0
}).format(Number(value || 0));

const number = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const text = (value, fallback = 'Não informado') => {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
};

const getClubImage = (name) => {
  if (!name) return '';
  const slug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return `img/clubs/${slug}.png`;
};

const getCoachImage = (name) => {
  if (!name) return 'img/avatar/avatar4.webp';
  const slug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return `img/coaches/${slug}.png`;
};

const crestMarkup = (clubName, className = 'club-crest') => {
  const initials = text(clubName, 'FC')
    .replace(/Sub-18/gi, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
  return `<span class="crest-wrap ${className}">
    <img src="${getClubImage(clubName)}" alt="Escudo do ${text(clubName)}" onerror="this.hidden=true;this.nextElementSibling.hidden=false">
    <span class="crest-fallback" hidden>${initials}</span>
  </span>`;
};

const stars = (value, max = 5) => {
  const total = Math.max(0, Math.min(max, Math.round(number(value))));
  return `<span class="rating-stars" aria-label="${total} de ${max} estrelas">${'★'.repeat(total)}<em>${'★'.repeat(max - total)}</em></span>`;
};

const statusInfo = (offer) => {
  if (offer?.is_emergency) return { label: 'Emergencial', className: 'emergency' };
  const map = {
    new: ['Interessado', 'positive'],
    reviewed: ['Em observação', 'neutral'],
    negotiating: ['Negociando', 'warning'],
    countered: ['Contraproposta', 'warning'],
    accepted: ['Contrato aceito', 'positive'],
    rejected: ['Recusada', 'negative'],
    withdrawn: ['Retirada', 'negative'],
    expired: ['Expirada', 'muted']
  };
  const [label, className] = map[offer?.status] || [text(offer?.status, 'Nova'), 'neutral'];
  return { label, className };
};

const compatibility = (source) => {
  const breakdown = source?.compatibility_breakdown || source || {};
  return Math.max(0, Math.min(100, number(
    breakdown.total ?? breakdown.compatibility_total ?? breakdown.compatibility ?? source?.compatibility,
    0
  )));
};

const interestLevel = (score) => {
  if (score >= 75) return { label: 'Alta', className: 'positive' };
  if (score >= 50) return { label: 'Média', className: 'warning' };
  return { label: 'Baixa', className: 'negative' };
};

const postureLabel = (offer, dossier = null) => {
  const history = dossier?.history || [];
  const stance = history[0]?.after_stance || history[0]?.stance_after;
  if (stance) return text(stance);
  const score = compatibility(offer);
  if (score >= 80) return 'Muito interessado';
  if (score >= 60) return 'Interessado';
  if (score >= 40) return 'Cauteloso';
  return 'Pouco interesse';
};

const academyPercent = (starsValue, recovery = false) => {
  const value = number(starsValue, 2);
  if (recovery) return ({ 1: -5, 2: 0, 3: 5, 4: 10, 5: 15 })[value] ?? 0;
  return ({ 1: -5, 2: 0, 3: 4, 4: 8, 5: 12 })[value] ?? 0;
};

export async function initOffersPhase(state = {}) {
  document.body.classList.add('stage2-active');
  document.querySelector('.creation-status')?.classList.remove('hidden');
  document.querySelector('.player-create')?.classList.add('hidden');
  document.querySelector('.player-offers')?.classList.remove('hidden');
  document.querySelector('.final-splash')?.classList.add('hidden');
  document.querySelector('.world-status')?.classList.add('hidden');
  document.querySelector('.paths')?.classList.add('hidden');
  document.querySelector('.notice')?.classList.add('hidden');
  document.querySelector('.details')?.classList.add('hidden');
  document.querySelector('.bottom-message')?.classList.add('hidden');

  const title = document.querySelector('.title-block h1');
  const subtitle = document.querySelector('.title-block p');
  if (title) title.textContent = 'Escolha seu primeiro clube';
  if (subtitle) subtitle.textContent = 'Entre em um clube de base e comece sua jornada no futebol.';

  const firstResourceLabel = document.querySelector('.resource-card span');
  if (firstResourceLabel) firstResourceLabel.textContent = 'Dificuldade:';

  const statusItems = document.querySelectorAll('.creation-status .status-item');
  statusItems[0]?.classList.add('completed');
  statusItems[0]?.classList.remove('active');
  document.getElementById('stage2Indicator')?.classList.add('active');

  try {
    if (!state.offers_generated) await generateInitialOffers();
    currentPlayer = await getPlayerProfile();
    await loadOffers();
    bindTabs();
    bindFooter();
  } catch (error) {
    console.error(error);
    showToast(null, error?.message || 'Erro ao carregar as propostas.', 'error');
    renderLoadError(error);
  }
}

function renderLoadError(error) {
  const list = document.getElementById('offersList');
  if (!list) return;
  list.innerHTML = `<div class="stage2-empty">
    <i data-lucide="triangle-alert"></i>
    <strong>Não foi possível carregar as propostas</strong>
    <span>${text(error?.message, 'Tente atualizar a página.')}</span>
  </div>`;
  window.lucide?.createIcons({ strokeWidth: 1.8 });
}

async function loadOffers() {
  activeOffers = await getActiveOffers();
  document.getElementById('offersCount').textContent = String(activeOffers.length);

  if (!activeOffers.length) {
    renderLoadError(new Error('Nenhuma proposta encontrada.'));
    return;
  }

  renderOffersSidebar(activeOffers);
  const selectedStillExists = activeOffers.some((offer) => offer.id === selectedOfferId);
  if (!selectedStillExists) {
    const preferred = activeOffers.find((offer) => !CLOSED_STATUSES.has(offer.status)) || activeOffers[0];
    selectedOfferId = preferred.id;
  }
  await selectOffer(selectedOfferId);
}

function renderOffersSidebar(offers) {
  const list = document.getElementById('offersList');
  list.innerHTML = offers.map((offer) => {
    const club = offer.base_clubs || {};
    const score = compatibility(offer);
    const interest = interestLevel(score);
    const status = statusInfo(offer);
    const terms = offer.current_terms || {};
    const ovr = number(offer.snapshot_data?.club_ovr, number(club.ovr, 0));
    const isSelected = offer.id === selectedOfferId;

    return `<button type="button" class="proposal-card ${isSelected ? 'active' : ''} ${CLOSED_STATUSES.has(offer.status) ? 'closed' : ''}" data-offer-id="${offer.id}">
      ${crestMarkup(club.name, 'proposal-crest')}
      <span class="proposal-main">
        <span class="proposal-name-row"><strong>${text(club.name).replace(/\s+Sub-18$/i, '')}</strong><span class="interest-pill ${interest.className}">${interest.label}</span></span>
        <span class="proposal-rating">${stars(club.reputation || Math.round(ovr / 12))}<small>OVR ${ovr || '—'}</small></span>
        <span class="proposal-meta">Função: <b>${text(terms.squad_role, 'Promessa')}</b></span>
        <span class="proposal-status ${status.className}">Status: ${status.label}</span>
      </span>
      <i data-lucide="chevron-right" class="proposal-arrow"></i>
    </button>`;
  }).join('');

  list.querySelectorAll('[data-offer-id]').forEach((button) => {
    button.addEventListener('click', () => selectOffer(button.dataset.offerId));
  });
  window.lucide?.createIcons({ strokeWidth: 1.8 });
}

async function selectOffer(offerId) {
  selectedOfferId = offerId;
  renderOffersSidebar(activeOffers);
  const dossier = document.getElementById('offerDossier');
  const contract = document.getElementById('contractSidebar');
  dossier?.classList.add('stage2-loading');
  contract?.classList.add('stage2-loading');
  dossier?.classList.remove('hidden');
  contract?.classList.remove('hidden');

  try {
    const details = await getOfferDetails(offerId);
    const listOffer = activeOffers.find((offer) => offer.id === offerId) || {};
    currentDossier = normalizeDossier(details, listOffer);
    renderDossierOverview();
    renderDossierSquad();
    renderDossierAcademy();
    renderDossierCoach();
    renderContractPanel();
    updateScoutTip();
  } catch (error) {
    console.error(error);
    showToast(null, error?.message || 'Erro ao abrir o dossiê.', 'error');
  } finally {
    dossier?.classList.remove('stage2-loading');
    contract?.classList.remove('stage2-loading');
  }
}

function normalizeDossier(details = {}, listOffer = {}) {
  const clubFromList = listOffer.base_clubs || {};
  const club = {
    ...clubFromList,
    ...(details.club || {})
  };
  club.city = club.city || clubFromList.city || 'Cidade não informada';
  club.reputation = club.reputation || clubFromList.reputation || 3;
  club.formation = club.formation || clubFromList.formation;
  club.style = club.style || club.play_style || clubFromList.play_style;

  const offer = {
    ...listOffer,
    ...(details.offer || {}),
    id: details.offer?.id || listOffer.id,
    current_terms: details.offer?.current_terms || listOffer.current_terms || {},
    compatibility_breakdown: details.compatibility_breakdown || listOffer.compatibility_breakdown || {},
    snapshot_data: details.snapshot || listOffer.snapshot_data || {}
  };

  return {
    ...details,
    offer,
    club,
    coach: details.coach || {},
    academy: {
      ...(offer.snapshot_data?.academy || {}),
      ...(details.academy || {})
    },
    roster: Array.isArray(details.roster) ? details.roster : [],
    competitors: Array.isArray(details.competitors) ? details.competitors : [],
    history: Array.isArray(details.history) ? details.history : [],
    compatibility_breakdown: offer.compatibility_breakdown,
    snapshot: offer.snapshot_data
  };
}

function bindTabs() {
  if (tabsBound) return;
  tabsBound = true;
  document.querySelectorAll('#dossierTabs button').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('#dossierTabs button').forEach((item) => item.classList.toggle('active', item === button));
      document.querySelectorAll('.dossier-content .tab-pane').forEach((pane) => {
        const active = pane.id === button.dataset.target;
        pane.classList.toggle('hidden', !active);
        pane.classList.toggle('active', active);
      });
    });
  });
}

function bindFooter() {
  const back = document.getElementById('stage2BackButton');
  if (back && !back.dataset.bound) {
    back.dataset.bound = 'true';
    back.addEventListener('click', () => showToast(null, 'A criação do jogador já foi concluída.', 'info'));
  }
}

function renderDossierOverview() {
  const { club, coach, academy, competitors, snapshot, offer } = currentDossier;
  const terms = offer.current_terms;
  const score = compatibility(currentDossier.compatibility_breakdown);
  const starters = competitors.filter((player) => player.is_starter);
  const reserves = competitors.filter((player) => !player.is_starter);
  const academyValues = [academy.physical, academy.speed, academy.technical, academy.recovery, academy.tactical].filter((v) => Number.isFinite(Number(v)));
  const academyAverage = academyValues.length ? academyValues.reduce((a, b) => a + Number(b), 0) / academyValues.length : 3;
  const supporters = Math.max(800, number(club.reputation, 3) * 600);

  document.getElementById('dossierOverview').innerHTML = `
    <div class="overview-grid">
      <section class="club-summary-card">
        <div class="club-summary-head">
          ${crestMarkup(club.name, 'dossier-crest')}
          <div><h3>${text(club.name).replace(/\s+Sub-18$/i, '')}</h3><p>${text(club.city)}</p></div>
        </div>
        <dl class="club-facts">
          <div><dt>Reputação</dt><dd>${stars(club.reputation)}</dd></div>
          <div><dt>Projeto da base</dt><dd><span class="value-pill positive">${number(club.reputation) >= 4 ? 'Referência' : 'Regional'}</span></dd></div>
          <div><dt>Torcida estimada</dt><dd>${supporters.toLocaleString('pt-BR')}</dd></div>
          <div><dt>OVR do elenco</dt><dd>${number(club.ovr || snapshot.club_ovr, 0) || '—'}</dd></div>
        </dl>
      </section>

      <section class="club-tactics-card">
        <div class="tactic-copy"><span>Estilo de jogo</span><strong>${text(club.style, 'Equilibrado')}</strong><small>${styleDescription(club.style)}</small></div>
        <div class="tactic-copy align-right"><span>Formação titular</span><strong>${text(club.formation, '4-3-3')}</strong><small>${formationDescription(club.formation)}</small></div>
        <div class="mini-pitch style-pitch">${pitchDots(8)}</div>
        <div class="mini-pitch formation-pitch">${pitchDots(11)}</div>
      </section>

      <section class="competition-card">
        <header><h3>Elenco e concorrência</h3><span class="competition-level">${text(snapshot.competition_level, 'Média')}</span></header>
        <div class="competition-stats">
          <div><span>Sua posição</span><strong>${text(currentPlayer?.posicao)}</strong></div>
          <div><span>Vagas</span><strong>${number(snapshot.slots_needed, 1)}</strong></div>
          <div><span>Chance de atuar</span><strong>${text(snapshot.chance_of_play, 'Média')}</strong></div>
          <div><span>Hierarquia</span><strong>${text(snapshot.estimated_hierarchy, terms.squad_role)}</strong></div>
        </div>
        <div class="competitor-table">
          <div class="competitor-row competitor-head"><span>Concorrência direta</span><span>OVR</span><span>Idade</span><span>Status</span></div>
          ${[...starters, ...reserves].slice(0, 4).map((player) => `<div class="competitor-row"><span>${text(player.name)}</span><strong>${number(player.ovr)}</strong><span>${number(player.age)} anos</span><em class="${player.is_starter ? 'positive' : 'neutral'}">${player.is_starter ? 'Titular' : 'Reserva'}</em></div>`).join('') || '<div class="competitor-empty">Nenhum concorrente direto encontrado.</div>'}
        </div>
      </section>

      <section class="academy-mini-card">
        <header><h3>Academia</h3><span>${stars(academyAverage)}</span></header>
        <dl>
          <div><dt>Nível da academia</dt><dd>${academyAverage >= 4 ? 'Muito boa' : academyAverage >= 3 ? 'Boa' : 'Em evolução'}</dd></div>
          <div><dt>Especialidade</dt><dd>${academySpecialty(academy)}</dd></div>
          <div><dt>Recuperação</dt><dd>${academyPercent(academy.recovery, true) >= 10 ? 'Excelente' : 'Regular'}</dd></div>
        </dl>
        <div class="development-bonus"><i data-lucide="badge-check"></i><div><strong>Bônus por desenvolvimento</strong><span>Até +${Math.max(...academyValues.map((v) => academyPercent(v)), 0)}% nos atributos favorecidos</span></div></div>
      </section>

      <section class="coach-mini-card">
        <img src="${getCoachImage(coach.name)}" alt="${text(coach.name, 'Treinador')}" onerror="this.src='img/avatar/avatar4.webp'">
        <div class="coach-mini-info"><span>Treinador</span><h3>${text(coach.name)}</h3><p>Perfil: <strong>${text(coach.profile || coach.impacts?.profile, coachProfileFromImpacts(coach.impacts))}</strong></p><p>Gestão de jovens ${stars(coachYouthRating(coach.impacts))}</p></div>
      </section>
    </div>`;
  window.lucide?.createIcons({ strokeWidth: 1.8 });
}

function renderDossierSquad() {
  const roster = currentDossier.roster;
  const competitors = new Set(currentDossier.competitors.map((player) => player.name));
  const starters = roster.filter((player) => player.is_starter);
  const reserves = roster.filter((player) => !player.is_starter);

  const playerRows = (players) => players.map((player) => `<div class="squad-table-row ${competitors.has(player.name) ? 'direct-competitor' : ''}">
    <span class="squad-ovr">${number(player.ovr)}</span>
    <span class="squad-name"><strong>${text(player.name)}</strong><small>${text(player.archetype, 'Equilibrado')}</small></span>
    <span>${text(player.primary_position)}</span>
    <span>${number(player.age)} anos</span>
    <span>${text(player.squad_role, player.is_starter ? 'Titular' : 'Reserva')}</span>
  </div>`).join('');

  document.getElementById('dossierSquad').innerHTML = `
    <section class="squad-comparison-summary">
      <div><span>Formação</span><strong>${text(currentDossier.club.formation)}</strong></div>
      <div><span>Vagas na posição</span><strong>${number(currentDossier.snapshot.slots_needed, 1)}</strong></div>
      <div><span>Concorrência</span><strong>${text(currentDossier.snapshot.competition_level, 'Média')}</strong></div>
      <div><span>Chance inicial</span><strong>${text(currentDossier.snapshot.chance_of_play, 'Média')}</strong></div>
    </section>
    <section class="squad-section"><h3><i data-lucide="users"></i> Titulares</h3><div class="squad-table">${playerRows(starters)}</div></section>
    <section class="squad-section"><h3><i data-lucide="user-round-search"></i> Banco e promessas</h3><div class="squad-table">${playerRows(reserves)}</div></section>`;
  window.lucide?.createIcons({ strokeWidth: 1.8 });
}

function renderDossierAcademy() {
  const academy = currentDossier.academy;
  const areas = [
    ['Físico', academy.physical, 'Força e resistência', false],
    ['Velocidade', academy.speed, 'Velocidade, aceleração e agilidade', false],
    ['Técnica', academy.technical, 'Passe, domínio e drible', false],
    ['Recuperação', academy.recovery, 'Energia e recuperação futura', true],
    ['Tática', academy.tactical, 'Visão, posicionamento e decisões', false]
  ];

  document.getElementById('dossierAcademy').innerHTML = `
    <div class="academy-grid">
      ${areas.map(([label, level, attributes, recovery]) => {
        const pct = academyPercent(level, recovery);
        return `<article class="academy-area-card"><header><span>${label}</span>${stars(level)}</header><strong class="${pct >= 0 ? 'positive-text' : 'negative-text'}">${pct >= 0 ? '+' : ''}${pct}%</strong><p>${attributes}</p><div class="academy-progress"><b style="width:${Math.max(0, number(level) * 20)}%"></b></div></article>`;
      }).join('')}
    </div>
    <section class="academy-detail-box"><i data-lucide="sparkles"></i><div><h3>Impacto no seu desenvolvimento</h3><p>${academyNarrative(academy)}</p></div></section>`;
  window.lucide?.createIcons({ strokeWidth: 1.8 });
}

function renderDossierCoach() {
  const { coach, club } = currentDossier;
  const impacts = coach.impacts || {};
  const entries = Object.entries(impacts).filter(([key]) => !key.startsWith('preferred_'));
  document.getElementById('dossierCoach').innerHTML = `
    <div class="coach-profile-layout">
      <section class="coach-profile-card">
        <img src="${getCoachImage(coach.name)}" alt="${text(coach.name)}" onerror="this.src='img/avatar/avatar4.webp'">
        <div><span>Treinador da base</span><h2>${text(coach.name)}</h2><p>Perfil <strong>${text(coach.profile, coachProfileFromImpacts(impacts))}</strong></p></div>
      </section>
      <section class="coach-tactic-box"><div><span>Formação preferida</span><strong>${text(impacts.preferred_formation, club.formation)}</strong></div><div><span>Estilo</span><strong>${text(impacts.preferred_style, club.style)}</strong></div><p>${styleDescription(club.style)}</p></section>
    </div>
    <h3 class="subsection-heading"><i data-lucide="activity"></i> Bônus e exigências</h3>
    <div class="coach-impact-grid">
      ${entries.map(([key, value]) => `<div class="coach-impact"><span>${humanize(key)}</span><strong class="${String(value).startsWith('-') ? 'negative-text' : 'positive-text'}">${formatImpact(value)}</strong></div>`).join('') || '<p class="muted-copy">Os impactos serão definidos pelo perfil do treinador.</p>'}
    </div>
    <section class="academy-detail-box"><i data-lucide="clipboard-list"></i><div><h3>Como você jogará neste clube</h3><p>${styleImpactForPlayer(club.style, currentPlayer?.posicao)}</p></div></section>`;
  window.lucide?.createIcons({ strokeWidth: 1.8 });
}

function renderContractPanel() {
  const { offer, history, compatibility_breakdown: breakdown, snapshot } = currentDossier;
  const terms = offer.current_terms || {};
  const closed = CLOSED_STATUSES.has(offer.status);
  const score = compatibility(breakdown);
  const roundsRemaining = Math.max(0, 3 - number(offer.round));
  const posture = postureLabel(offer, currentDossier);

  document.getElementById('contractPanel').innerHTML = `
    <section class="contract-summary-box">
      <h3>Resumo da proposta</h3>
      ${contractLine('Salário mensal', money(terms.monthly_wage))}
      ${contractLine('Duração do contrato', `${number(terms.duration_seasons)} temporadas`)}
      ${contractLine('Bônus de assinatura', money(terms.signing_bonus))}
      ${contractLine('Multa rescisória', money(terms.release_clause))}
      ${contractLine('Função prometida', text(terms.squad_role))}
      ${contractLine('Chance de jogo', text(snapshot.chance_of_play, 'Média'))}
      ${contractLine('Postura do clube', posture)}
    </section>

    <section class="negotiation-round"><span>Rodada de negociação</span><strong>${Math.min(3, number(offer.round) + 1)} / 3</strong></section>

    <section class="history-box"><h3>Histórico da negociação</h3>${renderHistory(history, terms)}</section>

    <section class="compatibility-box">
      <div class="compatibility-ring" style="--compat:${score * 3.6}deg"><strong>${score}%</strong></div>
      <div class="compatibility-factors">
        <h3>Compatibilidade</h3>
        ${factorLine('Estilo de jogo', breakdown.style_score ?? breakdown.play_style_score)}
        ${factorLine('Chance real de atuar', breakdown.position_score ?? breakdown.position_need_score)}
        ${factorLine('Arquétipo', breakdown.archetype_score)}
        ${factorLine('Treinador', breakdown.coach_score)}
      </div>
    </section>

    ${!closed ? negotiationEditor(terms) : ''}

    <div class="contract-actions">
      ${closed ? `<button class="contract-closed-button" disabled>${statusInfo(offer).label}</button>` : `
        <button type="button" class="negotiate-main-button" id="btnToggleNegotiation"><i data-lucide="arrow-right-left"></i><span>Negociar termos<small>Fazer contraproposta</small></span></button>
        <div class="contract-secondary-actions">
          <button type="button" class="sign-contract-button" id="btnAcceptOffer"><i data-lucide="pen-line"></i><span>Assinar contrato<small>Aceitar proposta</small></span></button>
          <button type="button" class="reject-contract-button" id="btnRejectOffer"><i data-lucide="x"></i><span>Recusar proposta<small>Explorar outras opções</small></span></button>
        </div>`}
    </div>`;

  wireContractActions();
  window.lucide?.createIcons({ strokeWidth: 1.8 });
}

function contractLine(label, value) {
  return `<div class="contract-summary-line"><span>${label}</span><strong>${value}</strong></div>`;
}

function factorLine(label, value) {
  const numeric = number(value, 0);
  return `<div class="compat-factor"><i data-lucide="circle-check"></i><span>${label}</span><strong>${numeric}</strong></div>`;
}

function renderHistory(history, terms) {
  const items = [...history].reverse();
  const initial = `<div class="history-entry"><i></i><span>Proposta inicial do clube</span><strong>${money(terms.monthly_wage)}</strong></div>`;
  return initial + items.slice(-3).map((entry) => `<div class="history-entry"><i></i><span>Rodada ${number(entry.round)} · ${humanize(entry.response_action)}</span><strong>${number(entry.negotiation_cost)} pts</strong></div>`).join('');
}

function negotiationEditor(terms) {
  const currentRoleIndex = Math.max(0, ROLE_ORDER.indexOf(terms.squad_role));
  const validRoles = ROLE_ORDER.slice(currentRoleIndex, Math.min(ROLE_ORDER.length, currentRoleIndex + 3));
  return `<section class="negotiation-editor hidden" id="negotiationEditor">
    <h3>Ajustar contraproposta</h3>
    <label><span>Salário</span><select id="inputWage"><option value="${terms.monthly_wage}">Manter ${money(terms.monthly_wage)}</option><option value="${Math.round(number(terms.monthly_wage) * 1.1)}">+10% · ${money(number(terms.monthly_wage) * 1.1)}</option><option value="${Math.round(number(terms.monthly_wage) * 1.2)}">+20% · ${money(number(terms.monthly_wage) * 1.2)}</option></select></label>
    <label><span>Duração</span><select id="inputDuration">${[1, 2, 3].map((value) => `<option value="${value}" ${value === number(terms.duration_seasons) ? 'selected' : ''}>${value} temporada${value > 1 ? 's' : ''}</option>`).join('')}</select></label>
    <label><span>Multa</span><select id="inputClause"><option value="${terms.release_clause}">Manter ${money(terms.release_clause)}</option><option value="${Math.round(number(terms.release_clause) * .75)}">Reduzir 25%</option><option value="${Math.round(number(terms.release_clause) * .5)}">Reduzir 50%</option></select></label>
    <label><span>Função</span><select id="inputRole">${validRoles.map((role) => `<option value="${role}" ${role === terms.squad_role ? 'selected' : ''}>${role}</option>`).join('')}</select></label>
    <button type="button" id="btnSubmitNegotiation" class="submit-negotiation-button">Enviar contraproposta</button>
  </section>`;
}

function wireContractActions() {
  document.getElementById('btnToggleNegotiation')?.addEventListener('click', () => {
    document.getElementById('negotiationEditor')?.classList.toggle('hidden');
  });
  document.getElementById('btnSubmitNegotiation')?.addEventListener('click', openNegotiationModal);
  document.getElementById('btnAcceptOffer')?.addEventListener('click', openAcceptModal);
  document.getElementById('btnRejectOffer')?.addEventListener('click', openRejectModal);
}

function openNegotiationModal() {
  const terms = currentDossier.offer.current_terms;
  const requested = {
    monthly_wage: number(document.getElementById('inputWage')?.value, terms.monthly_wage),
    duration_seasons: number(document.getElementById('inputDuration')?.value, terms.duration_seasons),
    release_clause: number(document.getElementById('inputClause')?.value, terms.release_clause),
    squad_role: text(document.getElementById('inputRole')?.value, terms.squad_role),
    signing_bonus: terms.signing_bonus
  };
  if (JSON.stringify(requested) === JSON.stringify(terms)) {
    showToast(null, 'Altere pelo menos um termo para negociar.', 'warning');
    return;
  }

  const modal = document.getElementById('signModal');
  document.querySelector('#signModal .modal-header h2').textContent = 'Enviar contraproposta';
  document.querySelector('#signModal .modal-warning').classList.add('hidden');
  document.getElementById('signModalBody').innerHTML = comparisonMarkup(terms, requested);
  const confirm = document.getElementById('btnConfirmSign');
  confirm.textContent = 'Enviar exigências';
  confirm.onclick = async () => {
    confirm.disabled = true;
    confirm.textContent = 'Processando...';
    try {
      const result = await negotiateOffer(selectedOfferId, requested);
      modal.classList.add('hidden');
      const action = result?.action || result?.response_action;
      if (action === 'accepted') showToast(null, 'O clube aceitou suas exigências.', 'success');
      else if (action === 'countered') showToast(null, 'O clube enviou uma contraproposta.', 'warning');
      else showToast(null, 'O clube retirou a proposta.', 'error');
      await loadOffers();
    } catch (error) {
      showToast(null, error?.message || 'A negociação falhou.', 'error');
    } finally {
      confirm.disabled = false;
      confirm.textContent = 'Enviar exigências';
    }
  };
  document.getElementById('btnCancelSign').onclick = () => modal.classList.add('hidden');
  modal.classList.remove('hidden');
}

function comparisonMarkup(current, requested) {
  return `<div class="modal-comparison-grid">
    <section><h4>Oferta atual</h4>${contractLine('Salário', money(current.monthly_wage))}${contractLine('Duração', `${current.duration_seasons} temporadas`)}${contractLine('Multa', money(current.release_clause))}${contractLine('Função', current.squad_role)}</section>
    <section class="highlight"><h4>Sua solicitação</h4>${contractLine('Salário', money(requested.monthly_wage))}${contractLine('Duração', `${requested.duration_seasons} temporadas`)}${contractLine('Multa', money(requested.release_clause))}${contractLine('Função', requested.squad_role)}</section>
  </div>`;
}

function openAcceptModal() {
  const modal = document.getElementById('signModal');
  const terms = currentDossier.offer.current_terms;
  document.querySelector('#signModal .modal-header h2').textContent = 'Assinar contrato';
  document.querySelector('#signModal .modal-warning').classList.remove('hidden');
  document.getElementById('signModalBody').innerHTML = `<div class="sign-club-preview">${crestMarkup(currentDossier.club.name, 'modal-crest')}<div><h3>${text(currentDossier.club.name)}</h3><p>${text(terms.squad_role)} · ${compatibility(currentDossier.compatibility_breakdown)}% de compatibilidade</p></div></div>${comparisonMarkup(terms, terms)}`;
  const confirm = document.getElementById('btnConfirmSign');
  confirm.textContent = 'Assinar e iniciar carreira';
  confirm.onclick = async () => {
    confirm.disabled = true;
    confirm.textContent = 'Assinando...';
    try {
      await acceptOffer(selectedOfferId);
      modal.classList.add('hidden');
      showToast(null, 'Contrato assinado com sucesso.', 'success');
      await showFinalSplash();
    } catch (error) {
      showToast(null, error?.message || 'Não foi possível assinar.', 'error');
    } finally {
      confirm.disabled = false;
      confirm.textContent = 'Assinar e iniciar carreira';
    }
  };
  document.getElementById('btnCancelSign').onclick = () => modal.classList.add('hidden');
  modal.classList.remove('hidden');
}

function openRejectModal() {
  const modal = document.getElementById('rejectModal');
  document.getElementById('rejectModalBody').innerHTML = `<div class="sign-club-preview">${crestMarkup(currentDossier.club.name, 'modal-crest')}<div><h3>${text(currentDossier.club.name)}</h3><p>Esta proposta será encerrada definitivamente.</p></div></div>`;
  document.getElementById('btnConfirmReject').onclick = async () => {
    const button = document.getElementById('btnConfirmReject');
    button.disabled = true;
    button.textContent = 'Recusando...';
    try {
      await rejectOffer(selectedOfferId);
      modal.classList.add('hidden');
      showToast(null, 'Proposta recusada.', 'info');
      selectedOfferId = null;
      await loadOffers();
    } catch (error) {
      showToast(null, error?.message || 'Não foi possível recusar.', 'error');
    } finally {
      button.disabled = false;
      button.textContent = 'Sim, recusar';
    }
  };
  document.getElementById('btnCancelReject').onclick = () => modal.classList.add('hidden');
  modal.classList.remove('hidden');
}

export async function showFinalSplash() {
  document.body.classList.remove('stage2-active');
  document.querySelector('.creation-status')?.classList.add('hidden');
  document.querySelector('.player-create')?.classList.add('hidden');
  document.querySelector('.player-offers')?.classList.add('hidden');
  document.querySelector('.final-splash')?.classList.remove('hidden');
  document.querySelector('.world-status')?.classList.add('hidden');
  document.querySelector('.paths')?.classList.add('hidden');
  document.querySelector('.notice')?.classList.add('hidden');
  document.querySelector('.details')?.classList.add('hidden');
  document.querySelector('.bottom-message')?.classList.add('hidden');

  try {
    const { supabase } = await import('../../services/supabase-client.js');
    const { data: { user } } = await supabase.auth.getUser();
    const { data: player } = await supabase.from('jogadores').select('id').eq('user_id', user.id).single();
    const { data: contract } = await supabase.from('player_contracts').select('*').eq('player_id', player.id).eq('status', 'active').single();
    const { data: club } = await supabase.from('base_clubs').select('*').eq('id', contract.club_id).single();
    const { data: coach } = await supabase.from('base_coaches').select('*').eq('id', club.coach_id).single();
    const { data: career } = await supabase.from('player_career_state').select('*').eq('player_id', player.id).single();
    document.getElementById('splashCard').innerHTML = `<div class="final-splash-card">${crestMarkup(club.name, 'final-crest')}<span>Contrato assinado</span><h2>Bem-vindo ao ${club.name}</h2><p>O treinador <strong>${coach.name}</strong> espera você para a primeira apresentação. Você chega como <strong>${contract.squad_role}</strong>.</p><div class="final-contract-grid">${contractLine('Salário', money(contract.monthly_wage))}${contractLine('Duração', `${contract.duration_seasons} temporadas`)}${contractLine('Confiança', `${career.trust}%`)}${contractLine('Moral', `${career.morale}%`)}${contractLine('Energia', `${career.energy}%`)}${contractLine('Compatibilidade', `${career.compatibility}%`)}</div><button class="negotiate-main-button" onclick="window.location.href='career.html'">Iniciar carreira</button></div>`;
  } catch (error) {
    console.error(error);
    showToast(null, 'Erro ao carregar o contrato assinado.', 'error');
  }
}

function updateScoutTip() {
  const tip = document.getElementById('scoutTipText');
  if (!tip || !currentDossier) return;
  const score = compatibility(currentDossier.compatibility_breakdown);
  tip.textContent = `${currentDossier.club.name.replace(/\s+Sub-18$/i, '')} oferece ${score >= 70 ? 'um projeto muito compatível' : 'um caminho com desafios'} para seu desenvolvimento.`;
}

function pitchDots(count) {
  return Array.from({ length: count }, (_, index) => `<i style="--i:${index}"></i>`).join('');
}

function formationDescription(formation) {
  const map = {
    '4-3-3': 'Amplitude e pressão ofensiva',
    '4-2-3-1': 'Controle entre linhas',
    '4-4-2': 'Duas linhas compactas'
  };
  return map[formation] || 'Estrutura equilibrada';
}

function styleDescription(style) {
  const map = {
    'Ofensivo': 'Pressão alta e muitas ações de ataque',
    'Contra-ataque': 'Transições rápidas e exploração de espaços',
    'Equilibrado': 'Distribuição estável de funções',
    'Pelas alas': 'Amplitude, velocidade e cruzamentos',
    'Posse de bola': 'Passe, domínio e controle do ritmo',
    'Recuado': 'Bloco baixo e segurança defensiva'
  };
  return map[style] || 'Modelo de jogo adaptável';
}

function styleImpactForPlayer(style, position) {
  return `${styleDescription(style)}. Como ${text(position)}, sua participação será influenciada diretamente por esse modelo, pela concorrência e pela função prometida no contrato.`;
}

function academySpecialty(academy) {
  const entries = [
    ['Físico', number(academy.physical)],
    ['Velocidade', number(academy.speed)],
    ['Técnica', number(academy.technical)],
    ['Recuperação', number(academy.recovery)],
    ['Tática', number(academy.tactical)]
  ];
  return entries.sort((a, b) => b[1] - a[1])[0]?.[0] || 'Formação geral';
}

function academyNarrative(academy) {
  const specialty = academySpecialty(academy);
  return `O principal diferencial desta academia é ${specialty.toLowerCase()}. A estrutura afeta diretamente a velocidade de evolução e a recuperação entre os jogos.`;
}

function coachProfileFromImpacts(impacts = {}) {
  if (impacts.technical_evolution_bonus) return 'Técnico';
  if (impacts.tactical_evolution_bonus && impacts.creative_freedom_penalty) return 'Teórico';
  if (impacts.physical_evolution_bonus) return 'Rígido';
  if (impacts.morale_initial_bonus) return 'Amigável';
  return 'Equilibrado';
}

function coachYouthRating(impacts = {}) {
  const positive = Object.values(impacts).filter((value) => number(value, 0) > 0).length;
  return Math.max(2, Math.min(5, positive + 2));
}

function humanize(value) {
  return text(value, '').replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatImpact(value) {
  if (typeof value === 'number') return `${value > 0 ? '+' : ''}${value}%`;
  return humanize(value);
}
