import { showToast } from '../../components/toast/toast.js';
import {
  getCareerMetaHub,
  getCareerTeamProfile,
  getCareerPlayerHistory,
  chooseCareerShirtNumber
} from './career-meta-service.js?v=20260811-6';

const ui = {
  hub: null,
  team: null,
  history: null,
  playerTab: 'profile',
  teamTab: 'lineup',
  selectedActivityKey: null,
  loadingHub: false,
  loadingTeam: false,
  activityObserver: null,
  decisionObserver: null
};

const $ = id => document.getElementById(id);
const q = selector => document.querySelector(selector);
const qa = selector => [...document.querySelectorAll(selector)];
const YOUTH_SQUADS = new Set(['u15', 'u17', 'u18', 'u20']);

const EMPTY_STATS = () => ({
  games: 0, starts: 0, goals: 0, assists: 0,
  wins: 0, draws: 0, losses: 0, minutes: 0, avg_rating: null
});

function currentCareerStage() {
  const level = ui.hub?.club?.squad_level || ui.hub?.state?.sporting_squad_level;
  if (level === 'first_team') return 'professional';
  if (YOUTH_SQUADS.has(level)) return 'academy';
  return ui.hub?.contract?.club_scope === 'first_team' ? 'professional' : 'academy';
}

function emptyHistory() {
  return {
    current_stage: currentCareerStage(),
    stages: { academy: EMPTY_STATS(), professional: EMPTY_STATS() },
    national: { u15: EMPTY_STATS(), u17: EMPTY_STATS(), u20: EMPTY_STATS(), senior: EMPTY_STATS() },
    honours: [],
    callups: [],
    seasons: []
  };
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function money(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(`${value}T12:00:00`);
  return Number.isNaN(d.getTime()) ? String(value) : new Intl.DateTimeFormat('pt-BR').format(d);
}

function refreshIcons() {
  if (window.lucide) window.lucide.createIcons({ strokeWidth: 1.8 });
}

function relationTone(score) {
  const n = Number(score || 0);
  if (n >= 75) return 'excellent';
  if (n >= 60) return 'good';
  if (n >= 42) return 'neutral';
  if (n >= 28) return 'warning';
  return 'bad';
}

function selectionLabel(status) {
  if (status === 'starter') return 'Titular';
  if (status === 'bench') return 'Banco';
  return 'Fora da relação';
}

function selectionIcon(status) {
  if (status === 'starter') return 'badge-check';
  if (status === 'bench') return 'armchair';
  return 'circle-off';
}

function coachImage(name) {
  const slug = String(name || 'default').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_');
  return `img/coaches/${slug}.png`;
}

function ensureStyle() {
  if (document.querySelector('link[data-career-profile-v2]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'src/pages/career/career-profile-v2.css?v=20260811-6';
  link.dataset.careerProfileV2 = 'true';
  document.head.appendChild(link);
}

function ensureModals() {
  if (!$('playerProfileModal')) {
    document.body.insertAdjacentHTML('beforeend', `
      <div id="playerProfileModal" class="meta-overlay hidden" aria-hidden="true">
        <section class="meta-modal" role="dialog" aria-modal="true" aria-label="Perfil do jogador">
          <button class="meta-close" type="button" data-meta-close="player"><i data-lucide="x"></i></button>
          <div id="playerProfileContent"></div>
        </section>
      </div>`);
  }
  if (!$('clubProfileModal')) {
    document.body.insertAdjacentHTML('beforeend', `
      <div id="clubProfileModal" class="meta-overlay hidden" aria-hidden="true">
        <section class="meta-modal meta-modal-xl" role="dialog" aria-modal="true" aria-label="Informações do clube">
          <button class="meta-close" type="button" data-meta-close="club"><i data-lucide="x"></i></button>
          <div id="clubProfileContent"></div>
        </section>
      </div>`);
  }
  if (!$('shirtNumberModal')) {
    document.body.insertAdjacentHTML('beforeend', `
      <div id="shirtNumberModal" class="meta-overlay hidden" aria-hidden="true">
        <section class="meta-modal shirt-modal" role="dialog" aria-modal="true" aria-label="Escolha do número da camisa">
          <div id="shirtNumberContent"></div>
        </section>
      </div>`);
  }
}

async function loadHub({ history = false } = {}) {
  if (ui.loadingHub) return ui.hub;
  ui.loadingHub = true;
  try {
    ui.hub = await getCareerMetaHub();
    if (history) ui.history = (await getCareerPlayerHistory()) || emptyHistory();
    decorateIdentity();
    decorateActivities();
    if (ui.hub?.shirt?.required) openShirtChooser(true);
    return ui.hub;
  } finally {
    ui.loadingHub = false;
  }
}

async function loadTeam() {
  if (ui.loadingTeam) return ui.team;
  ui.loadingTeam = true;
  try {
    ui.team = await getCareerTeamProfile();
    return ui.team;
  } finally {
    ui.loadingTeam = false;
  }
}

function decorateIdentity() {
  const player = q('.identity-player');
  const club = q('.identity-club');
  const coach = $('coachName');
  if (player) { player.classList.add('meta-clickable'); player.title = 'Abrir perfil completo do jogador'; }
  if (club) { club.classList.add('meta-clickable'); club.title = 'Abrir clube, escalação e relações'; }
  if (coach) { coach.classList.add('meta-clickable-text'); coach.title = 'Abrir informações do treinador'; }

  let chips = q('.career-meta-chips');
  if (!chips && player) {
    chips = document.createElement('div');
    chips.className = 'career-meta-chips';
    player.appendChild(chips);
  }
  if (chips && ui.hub) {
    chips.innerHTML = `
      <span><i data-lucide="shirt"></i>${ui.hub.player?.shirt_number ? `#${ui.hub.player.shirt_number}` : 'Sem número'}</span>
      <span><i data-lucide="star"></i>Fama ${Number(ui.hub.state?.fame || 0)}</span>
      <span><i data-lucide="users"></i>${Number(ui.hub.state?.fanbase || 0).toLocaleString('pt-BR')}</span>`;
    refreshIcons();
  }
}

function decorateActivities() {
  if (!ui.hub?.activities) return;
  const map = new Map(ui.hub.activities.map(item => [item.key, item]));
  qa('#activityGrid [data-activity]').forEach(card => {
    const item = map.get(card.dataset.activity);
    if (!item) return;
    const old = card.querySelector('.activity-price');
    const cost = Number(item.cash_cost || 0);
    const reward = Number(item.cash_reward || 0);
    const signature = `${cost}:${reward}`;
    if (old?.dataset.signature === signature) return;
    old?.remove();
    card.classList.remove('sponsored-activity');
    if (cost > 0) {
      card.insertAdjacentHTML('afterbegin', `<span class="activity-price cost" data-signature="${signature}"><i data-lucide="wallet"></i>${money(cost)}</span>`);
    } else if (reward > 0) {
      card.insertAdjacentHTML('afterbegin', `<span class="activity-price reward" data-signature="${signature}"><i data-lucide="badge-dollar-sign"></i>+ ${money(reward)}</span>`);
      card.classList.add('sponsored-activity');
    }
  });
  refreshIcons();
}

function renderMeter(score, label) {
  const n = Math.max(0, Math.min(100, Number(score || 0)));
  return `<div class="relation-meter ${relationTone(n)}"><div class="relation-meter-head"><span>${escapeHtml(label)}</span><strong>${n}/100</strong></div><div class="relation-track"><b style="width:${n}%"></b></div></div>`;
}

function playerHero() {
  const p = ui.hub?.player || {};
  return `<div class="meta-hero player-hero">
    <img src="img/avatar/${escapeHtml(p.avatar || 'avatar1.webp')}" onerror="this.onerror=null;this.src='img/avatar/avatar1.webp'" alt="Avatar">
    <div><span class="meta-kicker">PERFIL DO JOGADOR</span><h2>${escapeHtml(p.nickname || p.name || 'Jogador')}</h2><p>${escapeHtml(p.position || '—')} · ${escapeHtml(p.archetype || '—')} · ${p.age || '—'} anos</p></div>
    <div class="meta-hero-badges"><div><small>OVR</small><strong>${p.ovr ?? '—'}</strong></div><div><small>CAMISA</small><strong>${p.shirt_number ? `#${p.shirt_number}` : '—'}</strong></div></div>
  </div>
  <nav class="meta-tabbar">
    <button data-player-tab="profile" class="${ui.playerTab === 'profile' ? 'active' : ''}">Perfil</button>
    <button data-player-tab="stats" class="${ui.playerTab === 'stats' ? 'active' : ''}">Estatísticas</button>
    <button data-player-tab="development" class="${ui.playerTab === 'development' ? 'active' : ''}">Desenvolvimento</button>
    <button data-player-tab="history" class="${ui.playerTab === 'history' ? 'active' : ''}">Histórico & troféus</button>
  </nav>`;
}
function renderProfileTab() {
  const hub = ui.hub || {};
  const s = hub.state || {};
  const sel = hub.selection || {};
  return `<div class="profile-grid">
    <section class="meta-card"><h3><i data-lucide="id-card"></i>Identidade esportiva</h3><div class="meta-stat-grid">
      <div><span>Papel</span><strong>${escapeHtml(hub.contract?.squad_role || '—')}</strong></div>
      <div><span>Camisa</span><strong>${hub.player?.shirt_number ? `#${hub.player.shirt_number}` : 'Não escolhida'}</strong></div>
      <div><span>Fama</span><strong>${Number(s.fame || 0)}/100</strong></div>
      <div><span>Torcedores</span><strong>${Number(s.fanbase || 0).toLocaleString('pt-BR')}</strong></div>
      <div><span>Forma</span><strong>${escapeHtml(s.form || '—')}</strong></div>
      <div><span>Prontidão</span><strong>${Number(s.readiness || 0)}</strong></div>
    </div>${!hub.player?.shirt_number ? '<button id="chooseShirtFromProfile" class="meta-primary" type="button"><i data-lucide="shirt"></i>Escolher número</button>' : ''}</section>
    <section class="meta-card"><h3><i data-lucide="clipboard-check"></i>Próximo jogo</h3><div class="selection-card ${sel.status || 'out'}"><i data-lucide="${selectionIcon(sel.status)}"></i><div><span>${sel.locked ? 'DECISÃO DO TREINADOR' : 'PROJEÇÃO ATUAL'}</span><strong>${selectionLabel(sel.status)}</strong><p>${escapeHtml(sel.reason || 'A avaliação muda durante a semana.')}</p></div></div><small class="meta-note">${sel.locked ? 'A lista já foi fechada.' : 'Treino, forma, condição, relação e concorrência ainda podem alterar a decisão.'}</small></section>
    <section class="meta-card"><h3><i data-lucide="banknote"></i>Contrato</h3><div class="meta-stat-grid"><div><span>Clube</span><strong>${escapeHtml(hub.club?.name || '—')}</strong></div><div><span>Salário</span><strong>${money(hub.contract?.monthly_wage)}</strong></div><div><span>Duração</span><strong>${hub.contract?.duration_seasons || '—'} temp.</strong></div><div><span>Saldo</span><strong>${money(s.cash)}</strong></div></div></section>
    <section class="meta-card"><h3><i data-lucide="user-round-check"></i>Treinador</h3>${renderMeter(s.coach_relation_score, hub.coach?.name || 'Treinador')}<button id="openCoachFromProfile" class="meta-link-button" type="button">Abrir perfil do treinador <i data-lucide="arrow-right"></i></button></section>
  </div>`;
}

function statCard(title, stats, active = false, tag = '') {
  const st = { ...EMPTY_STATS(), ...(stats || {}) };
  return `<article class="stage-stat-card ${active ? 'active' : ''}"><div class="stage-tag"><span>${escapeHtml(title)}</span>${tag ? `<b>${escapeHtml(tag)}</b>` : ''}</div><div class="big-stat-row"><div><strong>${st.games}</strong><span>Jogos</span></div><div><strong>${st.goals}</strong><span>Gols</span></div><div><strong>${st.assists}</strong><span>Assist.</span></div></div><div class="record-line"><span><b>${st.wins}</b>Vitórias</span><span><b>${st.draws}</b>Empates</span><span><b>${st.losses}</b>Derrotas</span></div><div class="secondary-stats"><div><strong>${st.starts}</strong>Titular</div><div><strong>${Number(st.minutes || 0).toLocaleString('pt-BR')}</strong>Minutos</div><div><strong>${st.avg_rating == null ? '—' : Number(st.avg_rating).toFixed(1)}</strong>Nota média</div></div></article>`;
}

function renderStatsTab() {
  const h = ui.history || emptyHistory();
  const national = h.national || {};
  return `<div class="meta-card meta-card-wide"><h3><i data-lucide="chart-no-axes-combined"></i>Números da carreira</h3><p class="meta-note">Base e profissional ficam separados para sempre. Quando você subir, seus números da base viram histórico e a carreira profissional começa do zero.</p><div class="stats-stage-grid" style="margin-top:12px">
    ${statCard('Base', h.stages?.academy, h.current_stage === 'academy', h.current_stage === 'academy' ? 'FASE ATUAL' : 'HISTÓRICO')}
    ${statCard('Profissional', h.stages?.professional, h.current_stage === 'professional', h.current_stage === 'professional' ? 'FASE ATUAL' : 'CARREIRA')}
    ${statCard('Seleções', h.national_total, false, 'TODAS')}
  </div></div>
  <div class="meta-card meta-card-wide"><h3><i data-lucide="flag"></i>Seleções</h3><div class="national-stack">
    ${['u15','u17','u20','senior'].map(level => { const st = { ...EMPTY_STATS(), ...(national[level] || {}) }; const label = level === 'senior' ? 'Principal' : level.toUpperCase(); return `<div class="national-row"><strong>${label}</strong><div><b>${st.games}</b><span>Jogos</span></div><div><b>${st.goals}</b><span>Gols</span></div><div><b>${st.assists}</b><span>Assist.</span></div><div><b>${st.wins}</b><span>Vit.</span></div><div><b>${st.draws}</b><span>Emp.</span></div><div><b>${st.losses}</b><span>Der.</span></div></div>`; }).join('')}
  </div><small class="meta-note">Convocações Sub-15, Sub-17, Sub-20 e Principal possuem histórico próprio. A categoria depende da idade e do desempenho quando a comissão observar você.</small></div>`;
}

function renderDevelopmentTab() {
  const attrs = ui.hub?.player?.attributes || {};
  const skills = ui.hub?.skills || [];
  return `<div class="profile-grid"><section class="meta-card"><h3><i data-lucide="gauge"></i>Atributos principais</h3><div class="attribute-grid">${Object.entries(attrs).map(([key,val]) => `<div class="attribute-tile"><span>${escapeHtml(key)}</span><strong>${Number(val || 0)}</strong><em><b style="width:${Math.min(100,Number(val || 0))}%"></b></em></div>`).join('')}</div></section><section class="meta-card"><h3><i data-lucide="trending-up"></i>Especialidades</h3><div class="profile-skill-list">${skills.map(skill => `<div class="profile-skill"><div><strong>${escapeHtml(skill.label)}</strong><span>${escapeHtml(skill.category)} · influencia ${escapeHtml(skill.parent_attribute)}</span></div><b>${Number(skill.level || 0)}</b><em><i style="width:${Math.max(0,Math.min(100,Number(skill.progress || 0)))}%"></i></em><small>${Number(skill.progress || 0)}% para o próximo nível</small></div>`).join('')}</div></section><p class="meta-footnote meta-card-wide"><i data-lucide="mail"></i>Os relatórios semanal e mensal continuam registrando o que evoluiu e o que piorou.</p></div>`;
}

function renderHonours(list, kind) {
  const items = (list || []).filter(item => item.honour_type === kind);
  if (!items.length) return '<div class="empty-history">Ainda não há conquistas registradas nesta categoria.</div>';
  return `<div class="honour-list">${items.map(item => `<article class="honour-item"><span class="honour-icon"><i data-lucide="${kind === 'team_title' ? 'trophy' : 'medal'}"></i></span><div><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.competition || item.stage_label || '')}${item.level ? ` · ${escapeHtml(item.level.toUpperCase())}` : ''}</span></div><small>${escapeHtml(item.season_label || formatDate(item.awarded_on))}</small></article>`).join('')}</div>`;
}

function renderHistoryTab() {
  const h = ui.history || emptyHistory();
  const callups = h.callups || [];
  return `<div class="honours-grid"><section class="honour-section"><h3><i data-lucide="trophy"></i>Títulos coletivos</h3>${renderHonours(h.honours,'team_title')}</section><section class="honour-section"><h3><i data-lucide="medal"></i>Prêmios individuais</h3>${renderHonours(h.honours,'individual_award')}</section></div>
  <section class="meta-card" style="margin-top:10px"><h3><i data-lucide="flag"></i>Histórico de convocações</h3>${callups.length ? `<div class="callup-timeline">${callups.map(c => `<article class="callup-item"><i data-lucide="badge-check"></i><div><strong>Seleção ${escapeHtml(String(c.level || '').toUpperCase())}</strong><span>${escapeHtml(c.competition || c.reason || 'Convocação')}</span></div><small>${formatDate(c.callup_date)}</small></article>`).join('')}</div>` : '<div class="empty-history" style="margin-top:11px">Ainda não houve convocação para seleção de base.</div>'}</section>
  <section class="meta-card" style="margin-top:10px"><h3><i data-lucide="history"></i>Fases da carreira</h3><p class="meta-note">Os jogos ficam gravados com a fase em que aconteceram. Subir da base para o profissional não apaga gols, assistências, resultados, títulos ou prêmios anteriores.</p></section>`;
}

function renderPlayerModal() {
  const host = $('playerProfileContent');
  if (!host || !ui.hub) return;
  let body = renderProfileTab();
  if (ui.playerTab === 'stats') body = renderStatsTab();
  if (ui.playerTab === 'development') body = renderDevelopmentTab();
  if (ui.playerTab === 'history') body = renderHistoryTab();
  host.innerHTML = playerHero() + `<div class="meta-tab-content">${body}</div>`;
  qa('[data-player-tab]').forEach(btn => btn.addEventListener('click', async () => {
    ui.playerTab = btn.dataset.playerTab;
    if ((ui.playerTab === 'stats' || ui.playerTab === 'history') && !ui.history) ui.history = (await getCareerPlayerHistory()) || emptyHistory();
    renderPlayerModal();
  }));
  $('chooseShirtFromProfile')?.addEventListener('click', () => openShirtChooser(false));
  $('openCoachFromProfile')?.addEventListener('click', () => { closeMeta('player'); openTeam('coach'); });
  refreshIcons();
}

async function openPlayer(tab = 'profile') {
  ui.playerTab = tab;
  await loadHub({ history: tab === 'stats' || tab === 'history' });
  renderPlayerModal();
  $('playerProfileModal')?.classList.remove('hidden');
  refreshIcons();
}

function teamHero() {
  const c = ui.team?.club || {};
  return `<div class="meta-hero"><img src="${escapeHtml(c.shield_url || 'img/logo.png')}" onerror="this.onerror=null;this.src='img/logo.png'" alt="Escudo"><div><span class="meta-kicker">CLUBE ATUAL</span><h2>${escapeHtml(c.name || 'Clube')}</h2><p>${escapeHtml(c.city || '')} · ${escapeHtml(c.formation || '—')} · ${escapeHtml(c.play_style || '—')}</p></div><div class="meta-hero-badges"><div><small>OVR</small><strong>${c.ovr ?? '—'}</strong></div><div><small>REP.</small><strong>${c.reputation ?? '—'}</strong></div></div></div><nav class="meta-tabbar"><button data-team-tab="lineup" class="${ui.teamTab === 'lineup' ? 'active' : ''}">Escalação provável</button><button data-team-tab="relations" class="${ui.teamTab === 'relations' ? 'active' : ''}">Elenco & relações</button><button data-team-tab="coach" class="${ui.teamTab === 'coach' ? 'active' : ''}">Treinador</button></nav>`;
}

function renderLineupTab() {
  const t = ui.team || {};
  const proj = t.player_projection || {};
  const starters = (t.roster || []).filter(p => p.probable_starter).map(p => ({...p}));
  if (proj.status === 'starter') starters.push({ name:t.player?.name,position:t.player?.position,ovr:t.player?.ovr,number:t.player?.shirt_number,playerUser:true });
  return `<div class="team-layout-view"><section class="selection-banner ${proj.status || 'out'}"><i data-lucide="${selectionIcon(proj.status)}"></i><div><span>${proj.locked ? 'CONVOCAÇÃO FECHADA' : 'PROJEÇÃO DA COMISSÃO'}</span><strong>${selectionLabel(proj.status)}</strong><p>${escapeHtml(proj.reason || '')}</p></div></section><div class="lineup-header"><div><span>Formação</span><strong>${escapeHtml(t.club?.formation || '—')}</strong></div><p>${proj.locked ? 'A lista já foi fechada.' : 'Pode mudar até a véspera com treino, lesões, forma e acontecimentos da semana.'}</p></div><div class="probable-lineup">${starters.map(p => `<article class="lineup-player ${p.playerUser ? 'is-user' : ''}"><span class="shirt-mini">${p.number ? `#${p.number}` : '—'}</span><div><strong>${escapeHtml(p.name)}</strong><small>${escapeHtml(p.position)} · OVR ${p.ovr ?? '—'}</small></div>${p.playerUser ? '<b>VOCÊ</b>' : ''}</article>`).join('')}</div></div>`;
}

function renderRelationsTab() {
  const roster = ui.team?.roster || [];
  return `<div class="relations-list">${roster.map(p => `<article class="teammate-row ${p.rivalry ? 'rival' : ''}"><div class="teammate-avatar">#${p.number || '—'}</div><div class="teammate-main"><div><strong>${escapeHtml(p.name)}</strong>${p.rivalry ? '<b class="rival-badge">RIVAL</b>' : ''}</div><small>${escapeHtml(p.position)} · OVR ${p.ovr} · ${p.base_starter ? 'Titular' : 'Reserva'}</small><div class="mini-relation"><i style="width:${Number(p.relation_score || 50)}%"></i></div></div><div class="teammate-relation"><span>Relação</span><strong>${escapeHtml(p.relation || 'Estável')}</strong><small>${Number(p.relation_score || 50)}/100</small></div></article>`).join('')}</div>`;
}

function renderCoachTab() {
  const coach = ui.team?.coach || {};
  const impacts = coach.impacts || {};
  return `<div class="coach-profile-view"><section class="coach-profile-head"><img src="${coachImage(coach.name)}" onerror="this.onerror=null;this.src='img/avatar/avatar4.webp'" alt="Treinador"><div><span class="meta-kicker">TREINADOR</span><h3>${escapeHtml(coach.name || '—')}</h3><p>Perfil ${escapeHtml(coach.profile || '—')}</p></div></section><section class="meta-card">${renderMeter(coach.relation_score,'Relação com você')}<p class="meta-note">Essa relação participa da decisão esportiva junto com treino, forma, condição e hierarquia.</p></section><section class="meta-card"><h3><i data-lucide="clipboard-list"></i>Impactos da comissão</h3><div class="coach-impact-list">${Object.entries(impacts).map(([k,v]) => `<div>${escapeHtml(k.replaceAll('_',' '))}: <strong>${escapeHtml(v)}</strong></div>`).join('')}</div></section></div>`;
}

function renderTeamModal() {
  const host = $('clubProfileContent');
  if (!host || !ui.team) return;
  let body = renderLineupTab();
  if (ui.teamTab === 'relations') body = renderRelationsTab();
  if (ui.teamTab === 'coach') body = renderCoachTab();
  host.innerHTML = teamHero() + `<div class="meta-tab-content">${body}</div>`;
  qa('[data-team-tab]').forEach(btn => btn.addEventListener('click', () => { ui.teamTab = btn.dataset.teamTab; renderTeamModal(); }));
  refreshIcons();
}

async function openTeam(tab = 'lineup') {
  ui.teamTab = tab;
  await loadTeam();
  renderTeamModal();
  $('clubProfileModal')?.classList.remove('hidden');
  refreshIcons();
}

function renderShirtChooser(required) {
  const host = $('shirtNumberContent');
  const numbers = ui.hub?.shirt?.available_numbers || [];
  if (!host) return;
  host.innerHTML = `<div class="shirt-choice-head"><div class="shirt-jersey"><i data-lucide="shirt"></i><strong>?</strong></div><div><span class="meta-kicker">ROUPEIRO DO CLUBE</span><h2>Escolha seu número</h2><p>${required ? 'Você chegou ao limite. Escolha um número para continuar.' : 'Você pode escolher agora ou deixar para depois.'}</p></div></div><div class="shirt-rule"><i data-lucide="info"></i><span>Só aparecem números realmente elegíveis para sua situação e livres no elenco.</span></div><div class="shirt-number-grid">${numbers.map(n => `<button type="button" data-shirt-number="${n}">${n}</button>`).join('')}</div><div class="shirt-actions"><button id="randomShirtBtn" class="meta-secondary" type="button"><i data-lucide="shuffle"></i>Escolher disponível aleatório</button>${required ? '' : '<button id="closeShirtBtn" class="meta-ghost" type="button">Decidir depois</button>'}</div>`;
  qa('[data-shirt-number]').forEach(btn => btn.addEventListener('click', () => confirmShirt(Number(btn.dataset.shirtNumber))));
  $('randomShirtBtn')?.addEventListener('click', () => confirmShirt(null));
  $('closeShirtBtn')?.addEventListener('click', () => closeShirt(false));
  refreshIcons();
}

function openShirtChooser(required = false) {
  if (ui.hub?.player?.shirt_number) return;
  renderShirtChooser(required);
  const modal = $('shirtNumberModal');
  if (!modal) return;
  modal.dataset.required = required ? 'true' : 'false';
  modal.classList.remove('hidden');
  document.body.classList.toggle('shirt-choice-locked', required);
}

async function confirmShirt(number) {
  qa('#shirtNumberContent button').forEach(b => b.disabled = true);
  try {
    const result = await chooseCareerShirtNumber(number);
    showToast('Camisa confirmada', `Você vai usar a camisa ${result.number}.`, 'success');
    ui.hub = await getCareerMetaHub();
    closeShirt(true);
    decorateIdentity();
  } catch (error) {
    showToast('Número de camisa', error.message || 'Não foi possível confirmar.', 'error');
    qa('#shirtNumberContent button').forEach(b => b.disabled = false);
  }
}

function closeShirt(force = false) {
  const modal = $('shirtNumberModal');
  if (!modal) return;
  if (modal.dataset.required === 'true' && !force) return;
  modal.classList.add('hidden');
  document.body.classList.remove('shirt-choice-locked');
}

function closeMeta(kind) {
  $(kind === 'player' ? 'playerProfileModal' : 'clubProfileModal')?.classList.add('hidden');
}

function decisionImage(event) {
  const source = String(event?.source || '').toLowerCase();
  if (source.includes('treinador')) return coachImage(ui.hub?.coach?.name);
  if (source.includes('companheiro') || source.includes('rival')) return 'img/avatar/avatar4.webp';
  return ui.hub?.club?.shield_url || 'img/logo.png';
}

async function enhanceDecisionModal() {
  const modal = $('decisionModal');
  if (!modal || modal.classList.contains('hidden')) return;
  const body = modal.querySelector('.career-modal-body');
  if (!body || body.querySelector('.decision-scene')) return;
  try {
    ui.hub = await getCareerMetaHub();
    const event = ui.hub?.pending_event;
    if (!event) return;
    body.insertAdjacentHTML('afterbegin', `<div class="decision-scene"><div class="decision-scene-image"><img src="${escapeHtml(decisionImage(event))}" onerror="this.onerror=null;this.src='img/logo.png'" alt="${escapeHtml(event.source)}"></div><div><span>EVENTO DA SEMANA</span><strong>${escapeHtml(event.source)}</strong><small>${escapeHtml(event.title)}</small></div></div>`);
    refreshIcons();
  } catch (error) {
    console.error('Falha ao enriquecer evento:', error);
  }
}

function injectActivityModalPrice(card) {
  const key = card?.dataset?.activity;
  const item = ui.hub?.activities?.find(a => a.key === key);
  if (!item) return;
  setTimeout(() => {
    const desc = $('activityModalDescription');
    if (!desc) return;
    desc.parentElement?.querySelector('.activity-modal-price')?.remove();
    const cost = Number(item.cash_cost || 0);
    const reward = Number(item.cash_reward || 0);
    if (cost > 0) desc.insertAdjacentHTML('afterend', `<div class="activity-modal-price cost">Custo desta atividade: <strong>${money(cost)}</strong></div>`);
    else if (reward > 0) desc.insertAdjacentHTML('afterend', `<div class="activity-modal-price reward">Recompensa desta oportunidade: <strong>${money(reward)}</strong></div>`);
  }, 0);
}

function bind() {
  q('.identity-player')?.addEventListener('click', event => { if (!event.target.closest('button,a')) openPlayer('profile'); });
  q('.identity-club')?.addEventListener('click', event => { if (!event.target.closest('button,a')) openTeam('lineup'); });
  $('coachName')?.addEventListener('click', event => { event.stopPropagation(); openTeam('coach'); });
  document.addEventListener('click', event => {
    const close = event.target.closest('[data-meta-close]');
    if (close) closeMeta(close.dataset.metaClose);
    const card = event.target.closest('#activityGrid [data-activity]');
    if (card) injectActivityModalPrice(card);
  }, true);
  $('playerProfileModal')?.addEventListener('click', e => { if (e.target.id === 'playerProfileModal') closeMeta('player'); });
  $('clubProfileModal')?.addEventListener('click', e => { if (e.target.id === 'clubProfileModal') closeMeta('club'); });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (!$('playerProfileModal')?.classList.contains('hidden')) closeMeta('player');
    if (!$('clubProfileModal')?.classList.contains('hidden')) closeMeta('club');
    if (!$('shirtNumberModal')?.classList.contains('hidden') && $('shirtNumberModal')?.dataset.required !== 'true') closeShirt(false);
  });
}

function installSafeObservers() {
  const grid = $('activityGrid');
  if (grid && !ui.activityObserver) {
    // Só observa substituição dos cards DIRETOS. Alterações internas de preço/ícone não disparam o observer.
    ui.activityObserver = new MutationObserver(records => {
      if (records.some(record => record.target === grid)) decorateActivities();
    });
    ui.activityObserver.observe(grid, { childList: true });
  }
  const decision = $('decisionModal');
  if (decision && !ui.decisionObserver) {
    // Só observa abrir/fechar do modal. Não observa subtree, evitando loop com a cena que inserimos.
    ui.decisionObserver = new MutationObserver(() => {
      if (!decision.classList.contains('hidden')) enhanceDecisionModal();
      else decision.querySelector('.decision-scene')?.remove();
    });
    ui.decisionObserver.observe(decision, { attributes: true, attributeFilter: ['class'] });
  }
}

async function init() {
  ensureStyle();
  ensureModals();
  bind();
  installSafeObservers();
  try {
    await loadHub();
    decorateActivities();
    if (!$('decisionModal')?.classList.contains('hidden')) enhanceDecisionModal();
  } catch (error) {
    console.error('Falha ao carregar perfil da carreira:', error);
  }
  refreshIcons();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
else init();