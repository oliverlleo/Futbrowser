import { bootstrapCareerCompetitions, getCareerCompetitionHub } from './career-competition-service.js?v=20260812-1';

const esc = value => String(value ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
const $ = id => document.getElementById(id);

const state = {
  data: null,
  competition: null,
  round: null,
  tab: 'overview',
  loading: false,
  mounted: false
};

function ensureCss() {
  if (document.querySelector('link[data-career-competition-css]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'src/pages/career/career-competition-center.css?v=20260812-1';
  link.dataset.careerCompetitionCss = '1';
  document.head.appendChild(link);
}

function crest(club = {}) { return club?.crest || 'img/logo.png'; }
function money(value) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(value || 0)); }
function date(value) { if (!value) return '—'; const d = new Date(`${value}T12:00:00`); return Number.isNaN(d.getTime()) ? '—' : new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(d); }
function fullDate(value) { if (!value) return '—'; const d = new Date(`${value}T12:00:00`); return Number.isNaN(d.getTime()) ? '—' : new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }).format(d); }
function stageLabel(stage) {
  return ({ round64: '1ª fase', round32: '2ª fase', round16: 'Oitavas', quarterfinal: 'Quartas', semifinal: 'Semifinal', final: 'Final', league: 'Liga' })[stage] || String(stage || 'Fase');
}
function score(fixture) {
  if (fixture?.status !== 'completed') return '<strong class="comp-score pending">×</strong>';
  const penalties = fixture.home_penalties != null && fixture.away_penalties != null
    ? `<small>(${fixture.home_penalties}–${fixture.away_penalties} p.)</small>` : '';
  return `<strong class="comp-score">${fixture.home_goals} <i>×</i> ${fixture.away_goals}</strong>${penalties}`;
}
function clubLine(club, side = '') {
  if (!club?.id) return `<div class="comp-club ${side} placeholder"><span class="comp-crest placeholder"></span><b>A definir</b></div>`;
  return `<div class="comp-club ${side}"><img class="comp-crest" src="${esc(crest(club))}" alt=""><b>${esc(club.short_name || club.name)}</b></div>`;
}

function mount() {
  if (state.mounted) return;
  state.mounted = true;
  ensureCss();
  const agenda = document.querySelector('.agenda-column');
  if (agenda) {
    const card = document.createElement('article');
    card.id = 'careerCompetitionTeaser';
    card.className = 'career-panel card-shell competition-teaser';
    card.innerHTML = `
      <header class="panel-heading compact"><div><span class="panel-icon competition-icon"><i data-lucide="trophy"></i></span><div><h2>Competições</h2><p>Calendário, tabela, chave e líderes</p></div></div><button type="button" class="competition-open-icon" aria-label="Abrir competições"><i data-lucide="arrow-up-right"></i></button></header>
      <div id="competitionTeaserBody" class="competition-teaser-body"><span class="competition-skeleton"></span></div>
      <button id="openCompetitionCenter" type="button" class="secondary-action competition-open"><i data-lucide="trophy"></i><span>Abrir central de competições</span></button>`;
    const panels = agenda.querySelectorAll(':scope > article');
    if (panels.length >= 2) panels[1].after(card); else agenda.appendChild(card);
    card.querySelector('#openCompetitionCenter')?.addEventListener('click', openCenter);
    card.querySelector('.competition-open-icon')?.addEventListener('click', openCenter);
  }

  document.body.insertAdjacentHTML('beforeend', `
    <div id="competitionOverlay" class="competition-overlay hidden" aria-hidden="true">
      <section class="competition-shell" role="dialog" aria-modal="true" aria-label="Central de competições">
        <header class="competition-head">
          <div class="competition-head-copy"><span>CARREIRA · TEMPORADA</span><h1>Central de Competições</h1><p>Acompanhe cada rodada, a sua campanha e a disputa individual.</p></div>
          <button id="closeCompetitionCenter" class="competition-close" type="button" aria-label="Fechar"><i data-lucide="x"></i></button>
        </header>
        <div class="competition-toolbar"><div id="competitionSelector" class="competition-selector"></div><div id="competitionSeasonMeta" class="competition-season-meta"></div></div>
        <nav class="competition-tabs" aria-label="Seções da competição">
          <button type="button" data-comp-tab="overview" class="active"><i data-lucide="layout-dashboard"></i><span>Visão geral</span></button>
          <button type="button" data-comp-tab="calendar"><i data-lucide="calendar-range"></i><span>Calendário</span></button>
          <button type="button" data-comp-tab="standings"><i data-lucide="list-ordered"></i><span>Classificação</span></button>
          <button type="button" data-comp-tab="bracket"><i data-lucide="git-fork"></i><span>Chave</span></button>
          <button type="button" data-comp-tab="leaders"><i data-lucide="medal"></i><span>Líderes</span></button>
          <button type="button" data-comp-tab="prizes"><i data-lucide="gift"></i><span>Prêmios</span></button>
        </nav>
        <main id="competitionContent" class="competition-content"><div class="competition-loading"><span></span><strong>Carregando temporada…</strong></div></main>
      </section>
    </div>`);

  $('closeCompetitionCenter')?.addEventListener('click', closeCenter);
  $('competitionOverlay')?.addEventListener('click', event => { if (event.target === $('competitionOverlay')) closeCenter(); });
  document.querySelectorAll('[data-comp-tab]').forEach(button => button.addEventListener('click', () => {
    state.tab = button.dataset.compTab;
    document.querySelectorAll('[data-comp-tab]').forEach(item => item.classList.toggle('active', item === button));
    renderContent();
  }));
  window.lucide?.createIcons({ strokeWidth: 1.8 });
}

export async function bootstrapCompetitionWorld() {
  try { return await bootstrapCareerCompetitions(); }
  catch (error) { console.error('Falha ao preparar competições.', error); return null; }
}

async function load(code = state.competition, round = null) {
  if (state.loading) return;
  state.loading = true;
  try {
    const data = await getCareerCompetitionHub(code || null, round == null ? null : Number(round));
    state.data = data;
    state.competition = data?.selected?.code || code;
    state.round = Number(data?.selected?.viewed_round ?? data?.selected?.current_round ?? round ?? 1);
    renderTeaser();
    renderToolbar();
    renderContent();
  } catch (error) {
    console.error(error);
    const teaser = $('competitionTeaserBody');
    if (teaser) teaser.innerHTML = `<div class="competition-inline-error"><strong>Competições indisponíveis</strong><span>${esc(error.message || error)}</span></div>`;
    const content = $('competitionContent');
    if (content) content.innerHTML = `<div class="competition-empty"><i data-lucide="triangle-alert"></i><strong>Não foi possível carregar a competição.</strong><p>${esc(error.message || error)}</p><button id="retryCompetitionLoad" type="button">Tentar novamente</button></div>`;
    $('retryCompetitionLoad')?.addEventListener('click', () => load(code, round));
  } finally {
    state.loading = false;
    window.lucide?.createIcons({ strokeWidth: 1.8 });
  }
}

function renderTeaser() {
  const target = $('competitionTeaserBody');
  const d = state.data;
  if (!target || !d) return;
  if (d.assignment?.competition_ready === false) {
    target.innerHTML = `<div class="competition-teaser-title"><div><span>Base do clube</span><strong>Aguardando promoção</strong></div><em>Base</em></div><div class="competition-mini-empty">Você ainda não está inscrito em uma equipe de competição. A promoção para Sub-17, Sub-18 ou Sub-20 define o próximo calendário.</div>`;
    return;
  }
  const next = d.next_fixture;
  const loadData = d.last_match_load || {};
  const nextStage = next ? (next.stage === 'league' ? `Rodada ${next.round}` : stageLabel(next.stage)) : (d.selected?.format === 'knockout' ? 'Fase' : `Rodada ${d.selected?.current_round || '—'}`);
  target.innerHTML = `
    <div class="competition-teaser-title"><div><span>${esc(next?.competition || d.selected?.short_name || 'Temporada')}</span><strong>${esc(nextStage)}</strong></div>${d.selected?.division_level ? `<em>Série ${String.fromCharCode(64 + Number(d.selected.division_level))}</em>` : '<em>Base</em>'}</div>
    ${next ? `<div class="competition-next-mini"><span>${date(next.date)}</span>${clubLine(next.home, 'home')}<b>×</b>${clubLine(next.away, 'away')}</div>` : '<div class="competition-mini-empty">Temporada concluída.</div>'}
    ${loadData.label ? `<div class="competition-load-mini"><span>Último jogo: <b>${esc(loadData.label)}</b></span><small>−${Number(loadData.energy_loss || 0)} energia · +${Number(loadData.fatigue_gain || 0)} estafa</small></div>` : ''}`;
}

function renderToolbar() {
  const d = state.data;
  if (!d) return;
  const selector = $('competitionSelector');
  if (selector) selector.innerHTML = (d.competitions || []).map(item => `<button type="button" data-comp-code="${esc(item.code)}" class="${item.code === d.selected?.code ? 'active' : ''}"><span>${esc(item.short_name)}</span>${item.format === 'knockout' ? '<small>Copa</small>' : item.division_level ? `<small>Série ${String.fromCharCode(64 + Number(item.division_level))}</small>` : '<small>Base</small>'}</button>`).join('');
  document.querySelectorAll('[data-comp-code]').forEach(button => button.addEventListener('click', () => { state.round = null; load(button.dataset.compCode, null); }));
  const meta = $('competitionSeasonMeta');
  if (meta) meta.innerHTML = d.assignment?.competition_ready === false ? '<span>Base</span><b>Desenvolvimento</b>' : `<span>${d.selected?.season_year || '—'}</span><b>${d.selected?.status === 'completed' ? 'Encerrada' : 'Em andamento'}</b>`;
}

function fixtureCard(fixture, { compact = false } = {}) {
  return `<article class="competition-fixture ${fixture.is_player_match ? 'user-match' : ''} ${fixture.status === 'completed' ? 'completed' : ''} ${compact ? 'compact' : ''}">
    <div class="competition-fixture-meta"><span>${fullDate(fixture.date)}</span><small>${fixture.stage === 'league' ? `Rodada ${fixture.round}` : stageLabel(fixture.stage)}</small></div>
    <div class="competition-fixture-match">${clubLine(fixture.home, 'home')}<div class="competition-fixture-score">${score(fixture)}</div>${clubLine(fixture.away, 'away')}</div>
    ${fixture.is_player_match ? '<div class="competition-you-badge">SEU CLUBE</div>' : ''}
  </article>`;
}

function renderOverview() {
  const d = state.data;
  if (d.assignment?.competition_ready === false) {
    return `<div class="competition-overview-grid"><section class="competition-block competition-next-block"><header><span>SITUAÇÃO ATUAL</span><b>Base do clube</b></header><div class="competition-empty compact"><strong>Aguardando promoção esportiva</strong><p>O contrato é com a base. O calendário oficial só começa quando o jogador é promovido para uma equipe Sub-17, Sub-18 ou Sub-20.</p></div></section></div>`;
  }
  const next = d.next_fixture;
  const loadData = d.last_match_load || {};
  const topRows = (d.standings || []).slice(0, 5);
  const scorers = (d.leaders?.scorers || []).slice(0, 5);
  return `<div class="competition-overview-grid">
    <section class="competition-block competition-next-block"><header><span>PRÓXIMO COMPROMISSO</span><b>${esc(next?.competition || d.selected?.short_name || 'Competição')}</b></header>${next ? fixtureCard({ ...next, status: 'scheduled', is_player_match: true }) : '<div class="competition-empty compact"><strong>Temporada concluída</strong><p>Não há mais jogos agendados nesta temporada.</p></div>'}</section>
    <section class="competition-block"><header><span>SUA POSIÇÃO</span><b>${d.selected?.format === 'league' ? 'Tabela' : 'Mata-mata'}</b></header>${d.selected?.format === 'league' ? renderMiniStandings(topRows, d.player_club?.id) : renderMiniBracket(d.bracket || [], d.player_club?.id)}</section>
    <section class="competition-block"><header><span>ARTILHARIA</span><b>Top 5</b></header>${renderLeaderList(scorers, 'goals')}</section>
    <section class="competition-block match-load-block"><header><span>CARGA DO ÚLTIMO JOGO</span><b>${esc(loadData.label || 'Sem jogo recente')}</b></header>${loadData.label ? `<div class="match-load-meter"><strong>${Number(loadData.intensity || 0).toFixed(2).replace('.', ',')}×</strong><span>intensidade física</span></div><div class="match-load-effects"><div><b>−${Number(loadData.energy_loss || 0)}</b><span>Energia</span></div><div><b>+${Number(loadData.fatigue_gain || 0)}</b><span>Estafa</span></div><div><b>${Number(loadData.recovery_days || 0)}d</b><span>Recuperação</span></div></div>` : '<div class="competition-empty compact"><p>A carga aparecerá depois da próxima partida.</p></div>'}</section>
  </div>`;
}

function renderMiniStandings(rows, playerClub) {
  if (!rows.length) return '<div class="competition-empty compact"><p>A classificação começa quando a bola rolar.</p></div>';
  return `<div class="mini-standings">${rows.map(row => `<div class="${row.club_id === playerClub ? 'you' : ''}"><b>${row.position}</b><img src="${esc(row.crest || 'img/logo.png')}" alt=""><span>${esc(row.short_name || row.name)}</span><strong>${row.points} pts</strong></div>`).join('')}</div>`;
}
function renderMiniBracket(rows, playerClub) {
  const active = [...rows].reverse().find(item => item.status === 'completed' && (item.home?.id === playerClub || item.away?.id === playerClub)) || rows.find(item => item.status !== 'completed' && (item.home?.id === playerClub || item.away?.id === playerClub));
  return active ? `<div class="mini-bracket"><span>${stageLabel(active.stage)}</span>${fixtureCard({ ...active, is_player_match: true }, { compact: true })}</div>` : '<div class="competition-empty compact"><p>A chave está sendo definida.</p></div>';
}

function renderCalendar() {
  const rows = state.data?.calendar || [];
  if (!rows.length) return empty('calendar-x-2', 'Nenhum jogo no calendário', state.data?.assignment?.competition_ready === false ? 'O calendário aparece quando houver promoção para uma equipe de competição.' : 'Os compromissos aparecerão assim que a temporada for montada.');
  const byMonth = new Map();
  for (const row of rows) { const key = String(row.date || '').slice(0, 7); if (!byMonth.has(key)) byMonth.set(key, []); byMonth.get(key).push(row); }
  return `<div class="competition-calendar">${[...byMonth.entries()].map(([month, fixtures]) => { const d = new Date(`${month}-15T12:00:00`); const label = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(d); return `<section><h3>${esc(label)}</h3><div class="competition-fixture-list">${fixtures.map(fixture => fixtureCard({ ...fixture, is_player_match: true }, { compact: true })).join('')}</div></section>`; }).join('')}</div>`;
}

function renderStandings() {
  const d = state.data;
  if (d.assignment?.competition_ready === false) return empty('list-ordered', 'Sem competição ativa', 'A classificação começa depois da promoção para uma equipe de competição.');
  if (d.selected?.format !== 'league') return empty('git-fork', 'Essa competição é mata-mata', 'Abra a aba Chave para acompanhar o caminho até a final.');
  const rows = d.standings || [];
  if (!rows.length) return empty('list-ordered', 'Classificação ainda vazia', 'A tabela será preenchida com os resultados da temporada.');
  const promotion = Number(d.selected?.promotion_slots || 0), relegation = Number(d.selected?.relegation_slots || 0), total = rows.length;
  return `<div class="competition-table-wrap"><table class="competition-table"><thead><tr><th>#</th><th>Clube</th><th>J</th><th>V</th><th>E</th><th>D</th><th>GP</th><th>GC</th><th>SG</th><th>Pts</th></tr></thead><tbody>${rows.map(row => {
    const zone = promotion && row.position <= promotion ? 'promotion' : relegation && row.position > total - relegation ? 'relegation' : '';
    return `<tr class="${row.club_id === d.player_club?.id ? 'you' : ''} ${zone}"><td><span class="table-position">${row.position}</span></td><td><div class="table-club"><img src="${esc(row.crest || 'img/logo.png')}" alt=""><span>${esc(row.name)}</span>${row.club_id === d.player_club?.id ? '<em>VOCÊ</em>' : ''}</div></td><td>${row.played}</td><td>${row.wins}</td><td>${row.draws}</td><td>${row.losses}</td><td>${row.gf}</td><td>${row.ga}</td><td>${row.gd}</td><td><strong>${row.points}</strong></td></tr>`;
  }).join('')}</tbody></table><div class="competition-zones">${promotion ? '<span class="promotion">Acesso</span>' : ''}${relegation ? '<span class="relegation">Rebaixamento</span>' : ''}</div></div>`;
}

function renderBracket() {
  const d = state.data;
  if (d.assignment?.competition_ready === false) return empty('git-fork', 'Sem competição ativa', 'A chave aparece depois da promoção para uma equipe de competição.');
  if (d.selected?.format !== 'knockout') return empty('list-ordered', 'Essa competição é por pontos', 'Abra a aba Classificação para acompanhar a campanha.');
  const rows = d.bracket || [];
  if (!rows.length) return empty('git-fork', 'Chave ainda não definida', 'Os confrontos aparecerão quando a competição for criada.');
  const groups = new Map(); for (const row of rows) { if (!groups.has(row.stage)) groups.set(row.stage, []); groups.get(row.stage).push(row); }
  return `<div class="competition-bracket">${[...groups.entries()].map(([stage, fixtures]) => `<section class="bracket-stage"><header><span>${stageLabel(stage)}</span><small>${fixtures.length} jogo${fixtures.length > 1 ? 's' : ''}</small></header><div>${fixtures.map(fixture => fixtureCard({ ...fixture, is_player_match: fixture.home?.id === d.player_club?.id || fixture.away?.id === d.player_club?.id }, { compact: true })).join('')}</div></section>`).join('')}</div>`;
}

function renderLeaderList(rows, metric) {
  if (!rows?.length) return '<div class="competition-empty compact"><p>A disputa ainda não tem números.</p></div>';
  return `<div class="competition-leader-list">${rows.map((row, index) => `<div class="${row.is_user ? 'you' : ''}"><span>${index + 1}</span><img src="${esc(row.crest || 'img/logo.png')}" alt=""><div><strong>${esc(row.name)}</strong><small>${esc(row.club)}</small></div><b>${Number(row[metric] || 0)}</b></div>`).join('')}</div>`;
}
function renderLeaders() {
  if (state.data?.assignment?.competition_ready === false) return empty('medal', 'Sem líderes ainda', 'Artilharia e assistências começam depois da promoção para uma equipe de competição.');
  const leaders = state.data?.leaders || {};
  return `<div class="competition-leaders-grid"><section class="competition-block"><header><span>ARTILHARIA</span><b>Gols</b></header>${renderLeaderList(leaders.scorers || [], 'goals')}</section><section class="competition-block"><header><span>ASSISTÊNCIAS</span><b>Passes para gol</b></header>${renderLeaderList(leaders.assists || [], 'assists')}</section></div>`;
}

function renderPrizes() {
  const d = state.data, s = d?.selected || {}, rewards = d?.rewards || [];
  if (d?.assignment?.competition_ready === false) return empty('gift', 'Sem premiação ativa', 'Prêmios de competição passam a existir quando o jogador entra em uma equipe Sub-17, Sub-18 ou Sub-20.');
  return `<div class="competition-prizes"><section class="competition-prize-hero"><span>PREMIAÇÃO DA TEMPORADA</span><h2>${esc(s.name || 'Competição')}</h2><p>Prêmios são proporcionais ao nível da competição. Na base, a recompensa é simbólica; no profissional, ela cresce sem substituir salário e contratos.</p></section><div class="competition-prize-grid"><article><i data-lucide="trophy"></i><span>Campeão</span><strong>${money(s.champion_reward)}</strong></article><article><i data-lucide="goal"></i><span>Artilheiro</span><strong>${money(s.top_scorer_reward)}</strong></article><article><i data-lucide="wand-sparkles"></i><span>Líder de assistências</span><strong>${money(s.top_assist_reward)}</strong></article></div><section class="competition-earned"><header><span>CONQUISTAS RECEBIDAS</span><b>${rewards.length}</b></header>${rewards.length ? rewards.map(item => `<div><i data-lucide="badge-check"></i><span><strong>${esc(item.title)}</strong><small>${date(item.awarded_on)}</small></span><b>${item.amount ? money(item.amount) : 'Conquista'}</b></div>`).join('') : '<div class="competition-empty compact"><p>As conquistas desta temporada aparecerão aqui quando forem definidas.</p></div>'}</section></div>`;
}

function renderRound() {
  const d = state.data, viewed = Number(d?.selected?.viewed_round ?? d?.selected?.current_round ?? 1), max = Number(d?.selected?.max_round || viewed);
  return `<div class="competition-round-head"><button id="competitionPrevRound" type="button" ${viewed <= 1 ? 'disabled' : ''}><i data-lucide="chevron-left"></i></button><div><span>${d.selected?.format === 'league' ? 'RODADA' : 'FASE'}</span><strong>${viewed} de ${max}</strong></div><button id="competitionNextRound" type="button" ${viewed >= max ? 'disabled' : ''}><i data-lucide="chevron-right"></i></button></div><div class="competition-fixture-list round-list">${(d.round_fixtures || []).map(fixture => fixtureCard(fixture)).join('') || '<div class="competition-empty compact"><p>Nenhum jogo nesta rodada.</p></div>'}</div>`;
}

function empty(icon, title, copy) { return `<div class="competition-empty"><i data-lucide="${icon}"></i><strong>${esc(title)}</strong><p>${esc(copy)}</p></div>`; }

function renderContent() {
  const target = $('competitionContent');
  if (!target || !state.data) return;
  const tab = state.tab;
  target.innerHTML = tab === 'overview' ? renderOverview() : tab === 'calendar' ? renderCalendar() : tab === 'standings' ? renderStandings() : tab === 'bracket' ? renderBracket() : tab === 'leaders' ? renderLeaders() : renderPrizes();
  if (tab === 'overview' && state.data?.selected && state.data?.assignment?.competition_ready !== false) {
    target.insertAdjacentHTML('beforeend', `<section class="competition-block competition-round-block"><header><span>RODADA / FASE EXIBIDA</span><b>${esc(state.data.selected.short_name || '')}</b></header>${renderRound()}</section>`);
  }
  $('competitionPrevRound')?.addEventListener('click', () => load(state.competition, Math.max(1, state.round - 1)));
  $('competitionNextRound')?.addEventListener('click', () => load(state.competition, Math.min(Number(state.data?.selected?.max_round || state.round + 1), state.round + 1)));
  window.lucide?.createIcons({ strokeWidth: 1.8 });
}

async function openCenter() {
  mount();
  $('competitionOverlay')?.classList.remove('hidden');
  $('competitionOverlay')?.setAttribute('aria-hidden', 'false');
  document.body.classList.add('competition-open-body');
  if (!state.data) await load();
}
function closeCenter() {
  $('competitionOverlay')?.classList.add('hidden');
  $('competitionOverlay')?.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('competition-open-body');
}

mount();
load();
document.addEventListener('career:hub-rendered', () => { if (!state.loading) load(state.competition, null); });

export { openCenter as openCareerCompetitionCenter };