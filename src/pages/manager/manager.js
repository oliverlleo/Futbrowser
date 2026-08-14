import { supabase } from '../../services/supabase-client.js';
import { showToast } from '../../components/toast/toast.js';
import {
  getManagerOnboarding,
  createManagerProfile,
  acceptManagerJob,
  getManagerHub,
  saveManagerTactics,
  saveManagerTraining,
  saveManagerLineup
} from '../../services/manager-service.js';

const $ = id => document.getElementById(id);
const esc = value => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const dateFmt = new Intl.DateTimeFormat('pt-BR');

const PROFILE_INFO = {
  estrategico: '<strong>Estratégico:</strong> identidade focada em leitura de jogo, formação e preparação do adversário.',
  gestor: '<strong>Gestor de grupo:</strong> identidade focada em comunicação, hierarquia e ambiente do vestiário.',
  desenvolvedor: '<strong>Desenvolvedor:</strong> identidade focada em evolução de atletas e uso de jogadores jovens.',
  disciplinador: '<strong>Disciplinador:</strong> identidade focada em intensidade, organização e cobrança do elenco.'
};

let currentHub = null;
let currentOnboarding = null;
let selectedStarters = new Set();

function applyTheme() {
  const hour = new Date().getHours();
  document.documentElement.dataset.theme = hour >= 18 || hour < 6 ? 'dark' : 'light';
}

function setLoading(active) {
  $('managerLoading')?.classList.toggle('hidden', !active);
}

function showOnly(target) {
  $('managerOnboarding')?.classList.toggle('hidden', target !== 'onboarding');
  $('managerHub')?.classList.toggle('hidden', target !== 'hub');
}

function notify(message, type = 'info') {
  showToast(null, message, type);
}

function setPageCopy(title, subtitle) {
  if ($('managerPageTitle')) $('managerPageTitle').textContent = title;
  if ($('managerPageSubtitle')) $('managerPageSubtitle').textContent = subtitle;
}

function renderProfileExplanation() {
  const value = $('managerProfileType')?.value || 'estrategico';
  if ($('profileExplanation')) $('profileExplanation').innerHTML = PROFILE_INFO[value] || PROFILE_INFO.estrategico;
}

function populateProfile(profile) {
  if (!profile) return;
  if ($('managerName')) $('managerName').value = profile.display_name || '';
  if ($('managerNationality')) $('managerNationality').value = profile.nationality || '';
  if ($('managerProfileType')) $('managerProfileType').value = profile.profile_type || 'estrategico';
  renderProfileExplanation();
}

function renderOffers(state) {
  currentOnboarding = state;
  populateProfile(state?.profile);
  const hasProfile = Boolean(state?.profile);
  $('managerOffersSection')?.classList.toggle('hidden', !hasProfile);
  if (!hasProfile) return;

  const offers = state?.offers || [];
  const root = $('managerOffers');
  if (!root) return;

  if (!offers.length) {
    root.innerHTML = '<article class="manager-offer card-shell"><h3>Nenhuma proposta disponível</h3><p class="manager-offer-project">Não encontramos clubes elegíveis para iniciar esta carreira.</p></article>';
    return;
  }

  root.innerHTML = offers.map(offer => `
    <article class="manager-offer card-shell">
      <div class="manager-offer-header">
        <img class="manager-offer-crest" src="${esc(offer.shield_url || 'img/logo.png')}" alt="Escudo ${esc(offer.name)}" />
        <div><h3>${esc(offer.name)}</h3><div class="city">${esc(offer.city || '—')}</div></div>
      </div>
      <div class="manager-offer-meta">
        <div><span>Divisão</span><strong>Série ${offer.division_level === 3 ? 'C' : 'D'}</strong></div>
        <div><span>Reputação</span><strong>${esc(offer.reputation)}/5</strong></div>
        <div><span>Elenco</span><strong>${esc(offer.squad_size)} atletas</strong></div>
        <div><span>OVR médio</span><strong>${esc(offer.average_ovr ?? '—')}</strong></div>
        <div><span>Formação</span><strong>${esc(offer.formation || '4-3-3')}</strong></div>
        <div><span>Estilo</span><strong>${esc(offer.play_style || 'Equilibrado')}</strong></div>
      </div>
      <p class="manager-offer-project">${esc(offer.project)}</p>
      <button class="primary-action" type="button" data-accept-manager-job="${esc(offer.club_id)}"><i data-lucide="briefcase-business"></i> Aceitar trabalho</button>
    </article>
  `).join('');

  root.querySelectorAll('[data-accept-manager-job]').forEach(button => {
    button.addEventListener('click', () => handleAcceptJob(button));
  });
  window.lucide?.createIcons({ strokeWidth: 1.8 });
}

async function handleAcceptJob(button) {
  const clubId = button.dataset.acceptManagerJob;
  if (!clubId || button.disabled) return;
  button.disabled = true;
  const original = button.innerHTML;
  button.textContent = 'Assinando...';
  try {
    const hub = await acceptManagerJob(clubId);
    notify('Contrato assinado. Sua carreira Manager começou.', 'success');
    renderHub(hub);
  } catch (error) {
    console.error(error);
    notify(error.message || 'Erro ao aceitar proposta.', 'error');
    button.disabled = false;
    button.innerHTML = original;
    window.lucide?.createIcons({ strokeWidth: 1.8 });
  }
}

function percent(id, barId, value) {
  const normalized = Math.max(0, Math.min(100, Number(value) || 0));
  if ($(id)) $(id).textContent = `${normalized}%`;
  if ($(barId)) $(barId).style.width = `${normalized}%`;
}

function profileLabel(type) {
  return {
    estrategico: 'ESTRATÉGICO',
    gestor: 'GESTOR DE GRUPO',
    desenvolvedor: 'DESENVOLVEDOR',
    disciplinador: 'DISCIPLINADOR'
  }[type] || 'MANAGER';
}

function renderSquad(squad) {
  selectedStarters = new Set((squad || []).filter(player => player.is_starter).map(player => player.id));
  const body = $('managerSquadBody');
  if (!body) return;
  body.innerHTML = (squad || []).map(player => `
    <tr>
      <td><input type="checkbox" data-starter-id="${esc(player.id)}" ${player.is_starter ? 'checked' : ''} aria-label="Escalar ${esc(player.name)}" /></td>
      <td><div class="player-cell"><span class="shirt-number">${esc(player.squad_number ?? '—')}</span><div><span class="player-name">${esc(player.name)}</span><span class="player-secondary">${esc(player.age)} anos · ${esc(player.archetype || 'Equilibrado')}</span></div></div></td>
      <td>${esc(player.primary_position)}</td>
      <td><span class="ovr-pill">${esc(player.ovr)}</span></td>
      <td><span class="state-pill">${esc(player.morale)}</span></td>
      <td><span class="state-pill">${esc(player.form)}</span></td>
      <td>${esc(player.squad_role)}</td>
    </tr>
  `).join('');

  body.querySelectorAll('[data-starter-id]').forEach(input => {
    input.addEventListener('change', () => {
      if (input.checked) selectedStarters.add(input.dataset.starterId);
      else selectedStarters.delete(input.dataset.starterId);
      updateStarterCount();
    });
  });
  updateStarterCount();
}

function updateStarterCount() {
  const count = selectedStarters.size;
  if ($('starterCount')) $('starterCount').textContent = `${count}/11`;
  if ($('saveLineupBtn')) $('saveLineupBtn').disabled = count !== 11;
}

function renderHub(hub) {
  currentHub = hub;
  showOnly('hub');
  setPageCopy('Central do Manager', 'Elenco, tática, treino e recursos esportivos em uma carreira independente.');

  const profile = hub?.profile || {};
  const career = hub?.career || {};
  const club = hub?.club || {};

  $('hubManagerName').textContent = profile.display_name || 'Manager';
  $('managerProfileLabel').textContent = profileLabel(profile.profile_type);
  $('hubManagerMeta').textContent = `${profile.nationality || '—'} · Reputação ${profile.reputation ?? 0}/100`;
  $('hubClubName').textContent = club.name || '—';
  $('hubClubMeta').textContent = `${club.city || '—'} · ${career.formation || club.formation || '4-3-3'} · ${career.play_style || 'Equilibrado'}`;
  $('hubClubCrest').src = club.shield_url || 'img/logo.png';
  $('hubCareerDate').textContent = career.career_date ? dateFmt.format(new Date(`${career.career_date}T12:00:00`)) : '—';

  percent('boardConfidence', 'boardConfidenceBar', career.board_confidence);
  percent('lockerSupport', 'lockerSupportBar', career.locker_room_support);
  percent('fanApproval', 'fanApprovalBar', career.fan_approval);
  percent('mediaPressure', 'mediaPressureBar', career.media_pressure);

  $('transferBudget').textContent = money.format(Number(career.transfer_budget || 0));
  const wageAvailable = Math.max(0, Number(career.wage_budget || 0) - Number(career.wage_committed || 0));
  $('wageAvailable').textContent = money.format(wageAvailable);
  $('wageCommitted').textContent = `${money.format(Number(career.wage_committed || 0))} comprometidos de ${money.format(Number(career.wage_budget || 0))}`;
  $('clubDivision').textContent = club.division_level ? `Série ${club.division_level === 1 ? 'A' : club.division_level === 2 ? 'B' : club.division_level === 3 ? 'C' : 'D'}` : '—';
  $('clubReputation').textContent = `${club.reputation ?? '—'}/5`;

  $('managerFormation').value = career.formation || '4-3-3';
  $('managerPlayStyle').value = career.play_style || 'Equilibrado';
  $('managerTrainingFocus').value = career.training_focus || 'Equilibrado';
  $('managerTrainingIntensity').value = career.training_intensity || 'Normal';
  renderSquad(hub?.squad || []);
  window.lucide?.createIcons({ strokeWidth: 1.8 });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function handleProfileSubmit(event) {
  event.preventDefault();
  const button = event.submitter || event.currentTarget.querySelector('button[type="submit"]');
  if (button) button.disabled = true;
  try {
    const state = await createManagerProfile({
      displayName: $('managerName').value,
      nationality: $('managerNationality').value,
      profileType: $('managerProfileType').value
    });
    notify('Manager criado. Agora escolha seu primeiro clube.', 'success');
    renderOffers(state);
    $('managerOffersSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    console.error(error);
    notify(error.message || 'Erro ao criar Manager.', 'error');
  } finally {
    if (button) button.disabled = false;
  }
}

async function handleSaveLineup() {
  if (selectedStarters.size !== 11) return;
  const button = $('saveLineupBtn');
  button.disabled = true;
  try {
    renderHub(await saveManagerLineup([...selectedStarters]));
    notify('Escalação salva com 11 titulares.', 'success');
  } catch (error) {
    console.error(error);
    notify(error.message || 'Erro ao salvar escalação.', 'error');
    updateStarterCount();
  }
}

async function handleSaveTactics() {
  const button = $('saveTacticsBtn');
  button.disabled = true;
  try {
    renderHub(await saveManagerTactics($('managerFormation').value, $('managerPlayStyle').value));
    notify('Tática atualizada.', 'success');
  } catch (error) {
    console.error(error);
    notify(error.message || 'Erro ao salvar tática.', 'error');
  } finally {
    button.disabled = false;
  }
}

async function handleSaveTraining() {
  const button = $('saveTrainingBtn');
  button.disabled = true;
  try {
    renderHub(await saveManagerTraining($('managerTrainingFocus').value, $('managerTrainingIntensity').value));
    notify('Plano de treino atualizado.', 'success');
  } catch (error) {
    console.error(error);
    notify(error.message || 'Erro ao salvar treino.', 'error');
  } finally {
    button.disabled = false;
  }
}

function bindEvents() {
  $('managerProfileType')?.addEventListener('change', renderProfileExplanation);
  $('managerProfileForm')?.addEventListener('submit', handleProfileSubmit);
  $('saveLineupBtn')?.addEventListener('click', handleSaveLineup);
  $('saveTacticsBtn')?.addEventListener('click', handleSaveTactics);
  $('saveTrainingBtn')?.addEventListener('click', handleSaveTraining);
}

async function init() {
  applyTheme();
  bindEvents();
  renderProfileExplanation();
  window.lucide?.createIcons({ strokeWidth: 1.8 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    window.location.href = 'index.html';
    return;
  }

  try {
    const state = await getManagerOnboarding();
    currentOnboarding = state;
    if (state?.career?.status === 'active') {
      renderHub(await getManagerHub());
    } else {
      showOnly('onboarding');
      setPageCopy('Construa sua carreira à beira do campo', 'Crie seu Manager, escolha um projeto e assuma o futebol do clube.');
      renderOffers(state);
    }
  } catch (error) {
    console.error(error);
    showOnly('onboarding');
    notify(error.message || 'Não foi possível iniciar o modo Manager.', 'error');
  } finally {
    setLoading(false);
  }
}

init();
