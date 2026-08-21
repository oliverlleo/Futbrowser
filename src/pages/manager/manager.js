import { supabase } from '../../services/supabase-client.js';
import { getCurrentSession } from '../../services/auth-service.js';
import { showToast } from '../../components/toast/toast.js';

const $ = (id) => document.getElementById(id);
const typeFromUrl = new URLSearchParams(window.location.search).get('type');

function escapeHtml(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function formatMoney(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(amount) : '—';
}

function showOnly(sectionId) {
  ['managerLoading', 'managerError', 'managerSetup', 'managerOffers', 'managerHub'].forEach(id => $(id)?.classList.add('hidden'));
  $(sectionId)?.classList.remove('hidden');
}

function renderOffers(offers) {
  showOnly('managerOffers');
  const container = $('managerOfferList');
  if (!offers.length) {
    container.innerHTML = '<div class="manager-panel">Nenhuma proposta de clube disponível neste momento.</div>';
    return;
  }
  container.innerHTML = offers.map(club => `
    <article class="manager-panel manager-offer">
      <img src="${escapeHtml(club.shield_url || 'img/clubs/default.svg')}" alt="Escudo de ${escapeHtml(club.name)}" onerror="this.src='img/clubs/default.svg'" />
      <div><p class="eyebrow">Divisão ${escapeHtml(club.division_level ?? '—')}</p><h2>${escapeHtml(club.name)}</h2></div>
      <p>${escapeHtml(club.city || 'Cidade não informada')} · Reputação ${escapeHtml(club.reputation ?? '—')}</p>
      <p>${escapeHtml(club.formation || '4-3-3')} · ${escapeHtml(club.play_style || 'Equilibrado')}</p>
      <p>Orçamento: ${formatMoney(club.transfer_budget)} · Folha: ${formatMoney(club.wage_budget)}</p>
      <button type="button" data-club-id="${escapeHtml(club.id)}">Aceitar proposta</button>
    </article>
  `).join('');
  container.querySelectorAll('button[data-club-id]').forEach(button => button.addEventListener('click', () => acceptJob(button)));
}

async function acceptJob(button) {
  button.disabled = true;
  button.textContent = 'Assinando…';
  try {
    const { data, error } = await supabase.rpc('accept_manager_job', { p_club_id: button.dataset.clubId });
    if (error) throw error;
    showToast(null, 'Carreira manager iniciada.', 'success');
    renderHub(data);
  } catch (error) {
    showToast(null, error.message || 'Não foi possível aceitar a proposta.', 'error');
    button.disabled = false;
    button.textContent = 'Aceitar proposta';
  }
}

function renderHub(hub) {
  showOnly('managerHub');
  const profile = hub.profile || {};
  const career = hub.career || {};
  const club = hub.club || {};
  const squad = hub.squad || [];
  $('managerModeLabel').textContent = profile.profile_type === 'presidente' ? 'Presidente' : 'Técnico';
  $('managerDisplayName').textContent = profile.display_name || 'Manager';
  $('managerClubMeta').textContent = `${club.name || 'Clube'} · ${career.formation || '4-3-3'} · ${career.play_style || 'Equilibrado'} · ${career.career_date || 'Hoje'}`;
  $('managerClubShield').src = club.shield_url || 'img/clubs/default.svg';
  $('managerClubShield').onerror = () => { $('managerClubShield').src = 'img/clubs/default.svg'; };
  $('managerMetrics').innerHTML = [
    ['Confiança da diretoria', `${career.board_confidence ?? '—'}%`],
    ['Apoio do vestiário', `${career.locker_room_support ?? '—'}%`],
    ['Orçamento de transferências', formatMoney(career.transfer_budget)],
    ['Folha comprometida', formatMoney(career.wage_committed)]
  ].map(([label, value]) => `<article class="manager-metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>Estado atual</small></article>`).join('');
  $('managerSquadCount').textContent = `${squad.length} jogadores`;
  $('managerSquad').innerHTML = squad.length ? squad.map(player => `
    <article class="squad-player"><strong>${escapeHtml(player.name)}</strong><span>${escapeHtml(player.primary_position || '—')} · OVR ${escapeHtml(player.ovr ?? '—')}</span><span class="${player.is_starter ? 'starter' : ''}">${player.is_starter ? 'Titular' : 'Reserva'} · Moral ${escapeHtml(player.morale ?? '—')}</span></article>
  `).join('') : '<div class="manager-squad-empty">Elenco ainda não carregado.</div>';
}

async function loadManager() {
  showOnly('managerLoading');
  $('managerError')?.classList.add('hidden');
  try {
    const session = await getCurrentSession();
    if (!session) { window.location.href = 'index.html'; return; }

    const { data: hub, error: hubError } = await supabase.rpc('get_manager_hub');
    if (!hubError && hub?.career) { renderHub(hub); return; }

    $('managerType').value = ['tecnico', 'presidente'].includes(typeFromUrl) ? typeFromUrl : 'tecnico';
    const { data: offers, error: offersError } = await supabase.rpc('get_manager_job_offers');
    if (!offersError) {
      renderOffers(offers || []);
      return;
    }
    if ((offersError.message || '').toLowerCase().includes('crie seu perfil')) {
      showOnly('managerSetup');
      return;
    }
    throw offersError;
  } catch (error) {
    console.error('Erro no modo manager:', error);
    showOnly('managerError');
    $('managerError').textContent = error.message || 'Não foi possível carregar o modo manager.';
  }
}

$('managerProfileForm')?.addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    const { error } = await supabase.rpc('create_manager_profile', {
      p_display_name: $('managerName').value.trim(),
      p_nationality: $('managerNationality').value.trim(),
      p_profile_type: $('managerType').value
    });
    if (error) throw error;
    showToast(null, 'Perfil criado. Escolha sua primeira oportunidade.', 'success');
    await loadManager();
  } catch (error) {
    showToast(null, error.message || 'Não foi possível criar o perfil.', 'error');
  } finally {
    button.disabled = false;
  }
});

$('refreshManagerBtn')?.addEventListener('click', loadManager);
loadManager();
