import { showToast } from '../../components/toast/toast.js';
import { getCareerMetaHub, getCareerTeamProfile, chooseCareerShirtNumber } from './career-meta-service.js?v=20260811-5';

const meta = {
  hub: null,
  team: null,
  playerTab: 'profile',
  teamTab: 'lineup',
  selectedActivityKey: null,
  loading: false
};

const $ = id => document.getElementById(id);
const q = selector => document.querySelector(selector);
const qa = selector => [...document.querySelectorAll(selector)];

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function refreshIcons() {
  if (window.lucide) window.lucide.createIcons({ strokeWidth: 1.8 });
}

function money(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(value || 0));
}

function coachImage(name) {
  const slug = String(name || 'default').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_');
  return `img/coaches/${slug}.png`;
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
  return status === 'starter' ? 'Titular' : status === 'bench' ? 'Banco' : 'Fora da relação';
}

function selectionIcon(status) {
  return status === 'starter' ? 'badge-check' : status === 'bench' ? 'armchair' : 'circle-off';
}

function ensureModals() {
  if (!$('playerProfileModal')) {
    document.body.insertAdjacentHTML('beforeend', `
      <div id="playerProfileModal" class="meta-overlay hidden" aria-hidden="true">
        <section class="meta-modal meta-modal-wide" role="dialog" aria-modal="true" aria-label="Perfil do jogador">
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

async function refreshMeta({ team = false } = {}) {
  if (meta.loading) return meta.hub;
  meta.loading = true;
  try {
    meta.hub = await getCareerMetaHub();
    if (team) meta.team = await getCareerTeamProfile();
    decorateActivities();
    decorateIdentity();
    if (meta.hub?.shirt?.required) openShirtChooser(true);
    return meta.hub;
  } finally {
    meta.loading = false;
  }
}

function decorateIdentity() {
  const player = q('.identity-player');
  const club = q('.identity-club');
  const coach = $('coachName');
  if (player) {
    player.classList.add('meta-clickable');
    player.title = 'Abrir perfil do jogador';
  }
  if (club) {
    club.classList.add('meta-clickable');
    club.title = 'Abrir informações do clube e escalação provável';
  }
  if (coach) {
    coach.classList.add('meta-clickable-text');
    coach.title = 'Abrir perfil do treinador';
  }

  let chips = q('.career-meta-chips');
  if (!chips && q('.identity-player')) {
    chips = document.createElement('div');
    chips.className = 'career-meta-chips';
    q('.identity-player').appendChild(chips);
  }
  if (chips && meta.hub) {
    chips.innerHTML = `
      <span><i data-lucide="shirt"></i>${meta.hub.player?.shirt_number ? `#${meta.hub.player.shirt_number}` : 'Sem número'}</span>
      <span><i data-lucide="star"></i>Fama ${Number(meta.hub.state?.fame || 0)}</span>
      <span><i data-lucide="users"></i>${Number(meta.hub.state?.fanbase || 0).toLocaleString('pt-BR')}</span>`;
    refreshIcons();
  }
}

function decorateActivities() {
  if (!meta.hub?.activities) return;
  const map = new Map(meta.hub.activities.map(item => [item.key, item]));
  qa('#activityGrid [data-activity]').forEach(card => {
    const item = map.get(card.dataset.activity);
    if (!item) return;
    card.querySelector('.activity-price')?.remove();
    if (Number(item.cash_cost || 0) > 0) {
      card.insertAdjacentHTML('afterbegin', `<span class="activity-price cost"><i data-lucide="wallet"></i>${money(item.cash_cost)}</span>`);
    } else if (Number(item.cash_reward || 0) > 0) {
      card.insertAdjacentHTML('afterbegin', `<span class="activity-price reward"><i data-lucide="badge-dollar-sign"></i>+ ${money(item.cash_reward)}</span>`);
      card.classList.add('sponsored-activity');
    }
  });
  refreshIcons();
}

function renderMeter(score, label = '') {
  const n = Math.max(0, Math.min(100, Number(score || 0)));
  return `<div class="relation-meter ${relationTone(n)}">
    <div class="relation-meter-head"><span>${escapeHtml(label)}</span><strong>${n}/100</strong></div>
    <div class="relation-track"><b style="width:${n}%"></b></div>
  </div>`;
}

function playerHero() {
  const hub = meta.hub || {};
  const p = hub.player || {};
  const s = hub.state || {};
  const shirt = p.shirt_number ? `#${p.shirt_number}` : '—';
  return `<div class="meta-hero player-hero">
    <img src="img/avatar/${escapeHtml(p.avatar || 'avatar1.webp')}" onerror="this.src='img/avatar/avatar1.webp'" alt="Avatar">
    <div class="meta-hero-copy"><span class="meta-kicker">PERFIL DO JOGADOR</span><h2>${escapeHtml(p.nickname || p.name || 'Jogador')}</h2><p>${escapeHtml(p.position)} · ${escapeHtml(p.archetype)} · ${p.age || '—'} anos</p></div>
    <div class="meta-hero-badges"><div><small>OVR</small><strong>${p.ovr ?? '—'}</strong></div><div><small>CAMISA</small><strong>${shirt}</strong></div></div>
  </div>
  <div class="meta-tabbar">
    <button data-player-tab="profile" class="${meta.playerTab === 'profile' ? 'active' : ''}">Perfil</button>
    <button data-player-tab="development" class="${meta.playerTab === 'development' ? 'active' : ''}">Desenvolvimento</button>
    <button data-player-tab="career" class="${meta.playerTab === 'career' ? 'active' : ''}">Carreira</button>
  </div>`;
}

function renderPlayerProfileTab() {
  const hub = meta.hub || {};
  const s = hub.state || {};
  const selection = hub.selection || {};
  return `<div class="profile-grid">
    <section class="meta-card">
      <h3><i data-lucide="id-card"></i>Identidade esportiva</h3>
      <div class="meta-stat-grid">
        <div><span>Papel</span><strong>${escapeHtml(hub.contract?.squad_role || '—')}</strong></div>
        <div><span>Camisa</span><strong>${hub.player?.shirt_number ? `#${hub.player.shirt_number}` : 'Não escolhida'}</strong></div>
        <div><span>Fama</span><strong>${Number(s.fame || 0)}/100</strong></div>
        <div><span>Torcedores</span><strong>${Number(s.fanbase || 0).toLocaleString('pt-BR')}</strong></div>
        <div><span>Forma</span><strong>${escapeHtml(s.form || '—')}</strong></div>
        <div><span>Prontidão</span><strong>${Number(s.readiness || 0)}</strong></div>
      </div>
      ${!hub.player?.shirt_number ? '<button id="chooseShirtFromProfile" class="meta-primary" type="button"><i data-lucide="shirt"></i>Escolher número da camisa</button>' : ''}
    </section>
    <section class="meta-card">
      <h3><i data-lucide="clipboard-check"></i>Próximo jogo</h3>
      <div class="selection-card ${selection.status || 'out'}">
        <i data-lucide="${selectionIcon(selection.status)}"></i>
        <div><span>${selection.locked ? 'DECISÃO DO TREINADOR' : 'PROJEÇÃO ATUAL'}</span><strong>${selectionLabel(selection.status)}</strong><p>${escapeHtml(selection.reason || 'A avaliação muda com sua semana.')}</p></div>
      </div>
      <small class="meta-note">${selection.locked ? 'A convocação deste jogo já foi fechada.' : 'A projeção pode mudar com treino, forma, relação com o treinador, recuperação e decisões fora de campo.'}</small>
    </section>
    <section class="meta-card meta-card-wide">
      <h3><i data-lucide="user-round-check"></i>Relação com o treinador</h3>
      ${renderMeter(s.coach_relation_score, meta.hub?.coach?.name || 'Treinador')}
      <button id="openCoachFromProfile" class="meta-link-button" type="button">Ver perfil do treinador e critérios da comissão <i data-lucide="arrow-right"></i></button>
    </section>
  </div>`;
}

function renderDevelopmentTab() {
  const hub = meta.hub || {};
  const attrs = hub.player?.attributes || {};
  const skills = hub.skills || [];
  return `<div class="development-inside-profile">
    <section class="meta-card">
      <h3><i data-lucide="gauge"></i>Atributos principais</h3>
      <div class="attribute-grid">${Object.entries(attrs).map(([key, val]) => `<div class="attribute-tile"><span>${escapeHtml(key)}</span><strong>${Number(val || 0)}</strong><em><b style="width:${Math.min(100, Number(val || 0))}%"></b></em></div>`).join('')}</div>
    </section>
    <section class="meta-card">
      <h3><i data-lucide="trending-up"></i>Especialidades</h3>
      <div class="profile-skill-list">${skills.map(skill => `<div class="profile-skill"><div><strong>${escapeHtml(skill.label)}</strong><span>${escapeHtml(skill.category)} · influencia ${escapeHtml(skill.parent_attribute)}</span></div><b>${Number(skill.level || 0)}</b><em><i style="width:${Math.max(0, Math.min(100, Number(skill.progress || 0)))}%"></i></em><small>${Number(skill.progress || 0)}% para o próximo nível</small></div>`).join('')}</div>
    </section>
    <p class="meta-footnote"><i data-lucide="mail"></i>Ao completar 7 dias e 30 dias, você recebe por e-mail um relatório comparando evolução e pontos que pioraram.</p>
  </div>`;
}

function renderCareerTab() {
  const hub = meta.hub || {};
  const s = hub.state || {};
  return `<div class="profile-grid">
    <section class="meta-card"><h3><i data-lucide="banknote"></i>Contrato</h3><div class="meta-stat-grid"><div><span>Salário</span><strong>${money(hub.contract?.monthly_wage)}</strong></div><div><span>Duração</span><strong>${hub.contract?.duration_seasons || '—'} temp.</strong></div><div><span>Saldo</span><strong>${money(s.cash)}</strong></div><div><span>Hierarquia</span><strong>${escapeHtml(s.hierarchy || '—')}</strong></div></div></section>
    <section class="meta-card"><h3><i data-lucide="megaphone"></i>Exposição</h3>${renderMeter(s.fame, 'Fama')}<div class="fanbase-big"><i data-lucide="users"></i><div><span>Torcedores acompanhando</span><strong>${Number(s.fanbase || 0).toLocaleString('pt-BR')}</strong></div></div><p class="meta-note">Quanto maior a fama e o público, mais provável que atitudes fora de campo virem comentário, notícia ou oportunidade comercial.</p></section>
    <section class="meta-card meta-card-wide"><h3><i data-lucide="activity"></i>Condição</h3><div class="meta-stat-grid"><div><span>Energia</span><strong>${s.energy}%</strong></div><div><span>Estafa</span><strong>${s.fatigue}%</strong></div><div><span>Risco físico</span><strong>${escapeHtml(s.injury_risk || '—')}</strong></div><div><span>Pressão</span><strong>${escapeHtml(s.pressure || '—')}</strong></div></div></section>
  </div>`;
}

function renderPlayerModal() {
  const host = $('playerProfileContent');
  if (!host || !meta.hub) return;
  const body = meta.playerTab === 'development' ? renderDevelopmentTab() : meta.playerTab === 'career' ? renderCareerTab() : renderPlayerProfileTab();
  host.innerHTML = playerHero() + `<div class="meta-tab-content">${body}</div>`;
  qa('[data-player-tab]').forEach(btn => btn.addEventListener('click', () => { meta.playerTab = btn.dataset.playerTab; renderPlayerModal(); }));
  $('chooseShirtFromProfile')?.addEventListener('click', () => openShirtChooser(false));
  $('openCoachFromProfile')?.addEventListener('click', () => { closeMeta('player'); openTeam('coach'); });
  refreshIcons();
}

async function openPlayer(tab = 'profile') {
  meta.playerTab = tab;
  await refreshMeta();
  ensureModals();
  renderPlayerModal();
  const modal = $('playerProfileModal');
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
}

function teamHero() {
  const t = meta.team || {};
  const c = t.club || {};
  return `<div class="meta-hero team-hero">
    <img src="${escapeHtml(c.shield_url || 'img/logo.png')}" onerror="this.src='img/logo.png'" alt="Escudo">
    <div class="meta-hero-copy"><span class="meta-kicker">CLUBE ATUAL</span><h2>${escapeHtml(c.name || 'Clube')}</h2><p>${escapeHtml(c.city || '')} · ${escapeHtml(c.formation || '—')} · ${escapeHtml(c.play_style || '—')}</p></div>
    <div class="meta-hero-badges"><div><small>OVR</small><strong>${c.ovr ?? '—'}</strong></div><div><small>REPUTAÇÃO</small><strong>${c.reputation ?? '—'}</strong></div></div>
  </div>
  <div class="meta-tabbar"><button data-team-tab="lineup" class="${meta.teamTab === 'lineup' ? 'active' : ''}">Escalação provável</button><button data-team-tab="relations" class="${meta.teamTab === 'relations' ? 'active' : ''}">Elenco & relações</button><button data-team-tab="coach" class="${meta.teamTab === 'coach' ? 'active' : ''}">Treinador</button></div>`;
}

function renderLineupTab() {
  const t = meta.team || {};
  const proj = t.player_projection || {};
  const starters = (t.roster || []).filter(p => p.probable_starter);
  if (proj.status === 'starter') starters.push({ name: t.player?.name, position: t.player?.position, ovr: t.player?.ovr, number: t.player?.shirt_number, playerUser: true, relation: 'Você' });
  return `<div class="team-layout-view">
    <section class="selection-banner ${proj.status}"><i data-lucide="${selectionIcon(proj.status)}"></i><div><span>${proj.locked ? 'CONVOCAÇÃO FECHADA' : 'PROJEÇÃO DA COMISSÃO'}</span><strong>${selectionLabel(proj.status)}</strong><p>${escapeHtml(proj.reason || '')}</p></div></section>
    <div class="lineup-header"><div><span>Formação</span><strong>${escapeHtml(t.club?.formation || '—')}</strong></div><p>${proj.locked ? 'A lista já foi fechada para este jogo.' : 'Pode mudar até a véspera conforme treino, forma, lesão, comportamento e relação com a comissão.'}</p></div>
    <div class="probable-lineup">${starters.map(p => `<div class="lineup-player ${p.playerUser ? 'is-user' : ''}"><span class="shirt-mini">${p.number ? `#${p.number}` : '—'}</span><div><strong>${escapeHtml(p.name)}</strong><small>${escapeHtml(p.position)} · OVR ${p.ovr ?? '—'}</small></div>${p.playerUser ? '<b>VOCÊ</b>' : ''}</div>`).join('')}</div>
  </div>`;
}

function renderRelationsTab() {
  const roster = meta.team?.roster || [];
  return `<div class="relations-list">${roster.map(p => `<article class="teammate-row ${p.rivalry ? 'rival' : ''}">
    <div class="teammate-avatar"><span>#${p.number || '—'}</span></div>
    <div class="teammate-main"><div><strong>${escapeHtml(p.name)}</strong>${p.rivalry ? '<b class="rival-badge">RIVAL</b>' : ''}</div><small>${escapeHtml(p.position)} · OVR ${p.ovr} · ${p.base_starter ? 'Titular-base' : 'Reserva'}</small><div class="mini-relation"><i style="width:${Number(p.relation_score || 50)}%"></i></div></div>
    <div class="teammate-relation"><span>Relação</span><strong>${escapeHtml(p.relation || 'Estável')}</strong><small>${Number(p.relation_score || 50)}/100</small></div>
  </article>`).join('')}</div><p class="meta-footnote"><i data-lucide="swords"></i>Jogadores que disputam sua posição começam mais competitivos. Uma relação pode virar rivalidade por eventos e escolhas — e também pode esfriar.</p>`;
}

function impactLabel(key, value) {
  const map = {
    preferred_style: 'Estilo preferido', preferred_archetype: 'Arquétipo preferido', preferred_formation: 'Formação preferida', tolerance_to_bad_games: 'Tolerância a atuações ruins',
    technical_evolution_bonus: 'Evolução técnica', physical_evolution_penalty: 'Evolução física', general_evolution_bonus: 'Evolução geral', morale_penalty_on_failure: 'Moral após falhas', tactical_evolution_bonus: 'Evolução tática', creative_freedom_penalty: 'Liberdade criativa', morale_initial_bonus: 'Moral inicial'
  };
  const label = map[key] || key.replaceAll('_', ' ');
  if (typeof value === 'number') return `${label}: ${value > 0 ? '+' : ''}${value}${key.includes('evolution') ? '%' : ''}`;
  return `${label}: ${String(value)}`;
}

function renderCoachTab() {
  const coach = meta.team?.coach || {};
  const impacts = coach.impacts || {};
  return `<div class="coach-profile-view">
    <section class="coach-profile-head"><img src="${coachImage(coach.name)}" onerror="this.src='img/avatar/avatar4.webp'" alt="Treinador"><div><span class="meta-kicker">TREINADOR</span><h3>${escapeHtml(coach.name || '—')}</h3><p>Perfil ${escapeHtml(coach.profile || '—')}</p></div></section>
    <section class="meta-card">${renderMeter(coach.relation_score, 'Relação com você')}<p class="meta-note">Essa relação entra na disputa por titularidade. Para um jogador contratado como Titular ou Estrela, cair até ficar fora do banco exige uma sequência realmente ruim: ausências, baixa confiança, má forma ou problema médico.</p></section>
    <section class="meta-card"><h3><i data-lucide="clipboard-list"></i>Como ele trabalha</h3><div class="coach-impact-list">${Object.entries(impacts).map(([k,v]) => `<div><span>${escapeHtml(impactLabel(k,v))}</span></div>`).join('')}</div></section>
    <p class="meta-footnote"><i data-lucide="messages-square"></i>Conversas com o treinador podem surgir durante a semana. Não existe resposta perfeita: cada postura troca alguma coisa por outra.</p>
  </div>`;
}

function renderTeamModal() {
  const host = $('clubProfileContent');
  if (!host || !meta.team) return;
  const body = meta.teamTab === 'relations' ? renderRelationsTab() : meta.teamTab === 'coach' ? renderCoachTab() : renderLineupTab();
  host.innerHTML = teamHero() + `<div class="meta-tab-content">${body}</div>`;
  qa('[data-team-tab]').forEach(btn => btn.addEventListener('click', () => { meta.teamTab = btn.dataset.teamTab; renderTeamModal(); }));
  refreshIcons();
}

async function openTeam(tab = 'lineup') {
  meta.teamTab = tab;
  ensureModals();
  await refreshMeta({ team: true });
  renderTeamModal();
  const modal = $('clubProfileModal');
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
}

function renderShirtChooser(required) {
  const host = $('shirtNumberContent');
  const shirt = meta.hub?.shirt || {};
  const numbers = shirt.available_numbers || [];
  host.innerHTML = `<div class="shirt-choice-head"><div class="shirt-jersey"><i data-lucide="shirt"></i><strong>?</strong></div><div><span class="meta-kicker">ROUPEIRO DO CLUBE</span><h2>Escolha seu número</h2><p>${required ? 'Você chegou à véspera/jogo sem definir a camisa. Nenhuma outra ação continua até escolher.' : 'Escolha agora ou deixe para mais tarde. Na véspera, a decisão passa a ser obrigatória.'}</p></div></div>
    <div class="shirt-rule"><i data-lucide="info"></i><span>Os números ocupados pelo elenco não aparecem. Números tradicionais só ficam disponíveis quando estão vagos e seu papel no elenco dá prioridade suficiente.</span></div>
    <div class="shirt-number-grid">${numbers.map(n => `<button type="button" data-shirt-number="${n}">${n}</button>`).join('')}</div>
    <div class="shirt-actions"><button id="randomShirtBtn" class="meta-secondary" type="button"><i data-lucide="shuffle"></i>Escolher um disponível aleatoriamente</button>${required ? '' : '<button id="closeShirtBtn" class="meta-ghost" type="button">Decidir depois</button>'}</div>`;
  qa('[data-shirt-number]').forEach(btn => btn.addEventListener('click', () => confirmShirt(Number(btn.dataset.shirtNumber))));
  $('randomShirtBtn')?.addEventListener('click', () => confirmShirt(null));
  $('closeShirtBtn')?.addEventListener('click', () => closeShirt(false));
  refreshIcons();
}

function openShirtChooser(required = false) {
  ensureModals();
  if (meta.hub?.player?.shirt_number) return;
  renderShirtChooser(required);
  const modal = $('shirtNumberModal');
  modal.dataset.required = required ? 'true' : 'false';
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.toggle('shirt-choice-locked', required);
}

async function confirmShirt(number) {
  const buttons = qa('#shirtNumberContent button');
  buttons.forEach(b => b.disabled = true);
  try {
    const result = await chooseCareerShirtNumber(number);
    showToast('Camisa confirmada', `Você vai usar a camisa ${result.number}.`, 'success');
    await refreshMeta({ team: true });
    closeShirt(true);
    decorateIdentity();
  } catch (error) {
    console.error(error);
    showToast('Número de camisa', error.message || 'Não foi possível confirmar o número.', 'error');
    buttons.forEach(b => b.disabled = false);
  }
}

function closeShirt(force = false) {
  const modal = $('shirtNumberModal');
  if (!modal) return;
  const required = modal.dataset.required === 'true';
  if (required && !force) return;
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('shirt-choice-locked');
}

function closeMeta(kind) {
  const modal = kind === 'player' ? $('playerProfileModal') : $('clubProfileModal');
  modal?.classList.add('hidden');
  modal?.setAttribute('aria-hidden', 'true');
}

function decisionImage(event) {
  const source = String(event?.source || '').toLowerCase();
  if (source.includes('treinador') || source.includes(String(meta.hub?.coach?.name || '').toLowerCase())) return coachImage(meta.hub?.coach?.name);
  if (source.includes('rival') || source.includes('companheiro')) return 'img/avatar/avatar4.webp';
  if (source.includes('torcida') || source.includes('mídia') || source.includes('notícia') || source.includes('redes') || source.includes('patrocin')) return meta.hub?.club?.shield_url || 'img/logo.png';
  return meta.hub?.club?.shield_url || 'img/logo.png';
}

async function enhanceDecisionModal() {
  const modal = $('decisionModal');
  if (!modal || modal.classList.contains('hidden')) return;
  try {
    const hub = await getCareerMetaHub();
    if (hub) meta.hub = hub;
    const event = meta.hub?.pending_event;
    const body = modal.querySelector('.career-modal-body');
    if (!event || !body || body.querySelector('.decision-scene')) return;
    body.insertAdjacentHTML('afterbegin', `<div class="decision-scene"><div class="decision-scene-image"><img src="${escapeHtml(decisionImage(event))}" onerror="this.src='img/logo.png'" alt="${escapeHtml(event.source)}"></div><div><span>EVENTO DA SEMANA</span><strong>${escapeHtml(event.source)}</strong><small>${escapeHtml(event.title)}</small></div></div>`);
    refreshIcons();
  } catch (error) {
    console.error('Falha ao enriquecer evento:', error);
  }
}

function bindInteractions() {
  q('.identity-player')?.addEventListener('click', event => {
    if (event.target.closest('button,a')) return;
    openPlayer('profile');
  });
  q('.identity-club')?.addEventListener('click', event => {
    if (event.target.closest('button,a')) return;
    openTeam('lineup');
  });
  $('coachName')?.addEventListener('click', event => {
    event.stopPropagation();
    openTeam('coach');
  });
  qa('[data-meta-close]').forEach(btn => btn.addEventListener('click', () => closeMeta(btn.dataset.metaClose)));
  $('playerProfileModal')?.addEventListener('click', e => { if (e.target.id === 'playerProfileModal') closeMeta('player'); });
  $('clubProfileModal')?.addEventListener('click', e => { if (e.target.id === 'clubProfileModal') closeMeta('club'); });

  document.addEventListener('click', event => {
    const card = event.target.closest('[data-activity]');
    if (!card) return;
    meta.selectedActivityKey = card.dataset.activity;
    const item = meta.hub?.activities?.find(a => a.key === meta.selectedActivityKey);
    if (!item) return;
    setTimeout(() => {
      const desc = $('activityModalDescription');
      if (!desc) return;
      desc.parentElement?.querySelector('.activity-modal-price')?.remove();
      if (Number(item.cash_cost || 0) > 0) desc.insertAdjacentHTML('afterend', `<div class="activity-modal-price cost"><i data-lucide="wallet"></i>Custo desta atividade: <strong>${money(item.cash_cost)}</strong></div>`);
      if (Number(item.cash_reward || 0) > 0) desc.insertAdjacentHTML('afterend', `<div class="activity-modal-price reward"><i data-lucide="badge-dollar-sign"></i>Recompensa desta oportunidade: <strong>${money(item.cash_reward)}</strong></div>`);
      refreshIcons();
    }, 30);
  }, true);

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (!$('playerProfileModal')?.classList.contains('hidden')) closeMeta('player');
    if (!$('clubProfileModal')?.classList.contains('hidden')) closeMeta('club');
    if (!$('shirtNumberModal')?.classList.contains('hidden') && $('shirtNumberModal')?.dataset.required !== 'true') closeShirt(false);
  });
}

function installObservers() {
  const activityGrid = $('activityGrid');
  if (activityGrid) {
    new MutationObserver(() => decorateActivities()).observe(activityGrid, { childList: true, subtree: true });
  }
  const decision = $('decisionModal');
  if (decision) {
    new MutationObserver(() => {
      if (!decision.classList.contains('hidden')) enhanceDecisionModal();
      else decision.querySelector('.decision-scene')?.remove();
    }).observe(decision, { attributes: true, attributeFilter: ['class'], childList: true, subtree: true });
  }
}

async function init() {
  ensureModals();
  bindInteractions();
  installObservers();
  try {
    await refreshMeta({ team: false });
    if (meta.hub?.shirt?.required) openShirtChooser(true);
  } catch (error) {
    console.error('Falha ao carregar extensões da carreira:', error);
  }
  refreshIcons();
}

document.addEventListener('DOMContentLoaded', init);
