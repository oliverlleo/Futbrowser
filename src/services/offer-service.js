import { supabase } from './supabase-client.js';
import { getCurrentSession } from './auth-service.js';
import {
  MAX_NEGOTIATION_ROUNDS,
  normalizeTolerance,
  validateNegotiationRequest
} from '../utils/offer-validation.js';

export async function getCareerOnboardingState() {
  const { data, error } = await supabase.rpc('get_career_onboarding_state');
  if (error) throw new Error(error.message);
  return data;
}

export async function generateInitialOffers() {
  const { error } = await supabase.rpc('generate_initial_offers');
  if (error) throw new Error(error.message);
}

export async function getPlayerProfile() {
  const session = await getCurrentSession();
  if (!session) throw new Error('Sessão expirada.');

  const { data, error } = await supabase
    .from('jogadores')
    .select('id, nome, idade, posicao, posicao_secundaria, arquetipo, avatar, atributos')
    .eq('user_id', session.user.id)
    .single();

  if (error) throw new Error(error.message);

  if (data.atributos) {
    const { data: ovr, error: ovrError } = await supabase.rpc('calculate_player_ovr', {
      p_atributos: data.atributos
    });
    if (ovrError) throw new Error(ovrError.message);
    data.ovr = ovr ?? 50;
  } else {
    data.ovr = 50;
  }

  return data;
}

let cachedData = {
  offers: [],
  clubs: [],
  coaches: [],
  academies: [],
  players: []
};

function throwQueryError(label, error) {
  if (error) throw new Error(`${label}: ${error.message}`);
}

function normalizeOffer(offer) {
  if (!offer) return offer;
  return {
    ...offer,
    current_terms: offer.current_terms || offer.initial_terms || {},
    internal_tolerance: normalizeTolerance(offer.internal_tolerance, {
      emergency: Boolean(offer.is_emergency)
    })
  };
}

function syncCachedOffer(offer) {
  if (!offer?.id) return;
  const normalized = normalizeOffer(offer);
  const index = cachedData.offers.findIndex(item => item.id === normalized.id);
  if (index >= 0) cachedData.offers[index] = { ...cachedData.offers[index], ...normalized };
  else cachedData.offers.push(normalized);
}

async function loadClubsDataBatch(clubIds, offers = cachedData.offers) {
  const ids = [...new Set((clubIds || []).filter(Boolean))];

  if (ids.length === 0) {
    cachedData = {
      offers: (offers || []).map(normalizeOffer),
      clubs: [],
      coaches: [],
      academies: [],
      players: []
    };
    return;
  }

  const clubsResult = await supabase
    .from('base_clubs')
    .select('id, name, city, shield_url, reputation, formation, play_style, coach_id, base_terms')
    .in('id', ids);
  throwQueryError('Erro ao carregar clubes', clubsResult.error);

  const clubs = clubsResult.data || [];
  const coachIds = [...new Set(clubs.map(club => club.coach_id).filter(Boolean))];

  const [coachesResult, academiesResult, playersResult] = await Promise.all([
    coachIds.length > 0
      ? supabase.from('base_coaches').select('id, name, profile, impacts').in('id', coachIds)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from('base_academy_profiles')
      .select('club_id, physical, speed, technical, recovery, tactical')
      .in('club_id', ids),
    supabase
      .from('base_ai_players')
      .select('id, club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter')
      .in('club_id', ids)
  ]);

  throwQueryError('Erro ao carregar treinadores', coachesResult.error);
  throwQueryError('Erro ao carregar academias', academiesResult.error);
  throwQueryError('Erro ao carregar elencos', playersResult.error);

  cachedData = {
    offers: (offers || []).map(normalizeOffer),
    clubs,
    coaches: coachesResult.data || [],
    academies: academiesResult.data || [],
    players: playersResult.data || []
  };
}

async function getOfferRecord(offerId) {
  // Nunca usa o cache como fonte de verdade para rodada, termos ou paciência.
  // Esses campos mudam a cada negociação e precisam vir do banco.
  const { data, error } = await supabase
    .from('player_offers')
    .select(`
      id,
      player_id,
      club_id,
      status,
      round,
      is_emergency,
      internal_tolerance,
      initial_terms,
      current_terms,
      compatibility_breakdown,
      snapshot_data,
      expires_at
    `)
    .eq('id', offerId)
    .single();

  if (error) throw new Error(error.message);
  const normalized = normalizeOffer(data);
  syncCachedOffer(normalized);
  return normalized;
}

function normalizeHistory(history) {
  return (history || []).map(item => ({
    ...item,
    player_proposal: item.player_proposal || item.requested_terms || {},
    club_response: item.club_response || item.club_response_terms || {}
  }));
}

function enrichCompetitors(competitors, roster) {
  return (competitors || []).map(competitor => {
    const rosterPlayer = roster.find(player =>
      (competitor.id && player.id === competitor.id) ||
      (
        player.name === competitor.name &&
        player.primary_position === competitor.primary_position
      )
    );

    return rosterPlayer ? { ...competitor, ...rosterPlayer } : competitor;
  });
}

export async function getActiveOffers() {
  const player = await getPlayerProfile();

  const { data, error } = await supabase
    .from('player_offers')
    .select(`
      id,
      status,
      round,
      is_emergency,
      club_id,
      internal_tolerance,
      initial_terms,
      current_terms,
      compatibility_breakdown,
      snapshot_data,
      expires_at,
      base_clubs:base_clubs!player_offers_club_id_fkey ( id, name, city, shield_url, reputation, formation, play_style )
    `)
    .eq('player_id', player.id)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  const offers = (data || []).map(normalizeOffer);
  await loadClubsDataBatch(offers.map(offer => offer.club_id), offers);
  return offers;
}

export async function getOfferDetails(offerId) {
  // Busca em paralelo, mas ambos são dados atuais do banco. O registro direto
  // serve como fallback e também sincroniza o cache usado pela UI.
  const [detailsResult, offerRecord] = await Promise.all([
    supabase.rpc('get_offer_details', { p_offer_id: offerId }),
    getOfferRecord(offerId)
  ]);

  const { data, error } = detailsResult;
  if (error) throw new Error(error.message);
  if (!data?.offer) throw new Error('Dossiê da oferta não foi retornado pelo backend.');

  const clubId = data.offer.club_id || offerRecord?.club_id || data.club?.id;
  if (!clubId) throw new Error('A oferta não possui clube associado.');

  const hasClubInCache = cachedData.clubs.some(club => club.id === clubId);
  if (!hasClubInCache) {
    const offers = [
      ...cachedData.offers.filter(offer => offer.id !== offerId),
      offerRecord
    ];
    await loadClubsDataBatch([clubId], offers);
  }

  const clubData = cachedData.clubs.find(club => club.id === clubId);
  if (!clubData) throw new Error('Clube da oferta não encontrado.');

  const coachData = cachedData.coaches.find(coach => coach.id === clubData.coach_id);
  const academyData = cachedData.academies.find(academy => academy.club_id === clubId);
  const roster = cachedData.players.filter(player => player.club_id === clubId);
  const history = normalizeHistory(data.history);
  const isEmergency = Boolean(data.offer.is_emergency ?? offerRecord?.is_emergency);

  data.offer = {
    ...offerRecord,
    ...data.offer,
    club_id: clubId,
    current_terms: data.offer.current_terms || offerRecord?.current_terms || {},
    is_emergency: isEmergency,
    // A RPC é a fonte preferida; o registro direto é apenas fallback.
    internal_tolerance: normalizeTolerance(
      data.offer.internal_tolerance ?? offerRecord?.internal_tolerance,
      { emergency: isEmergency }
    ),
    history
  };

  syncCachedOffer(data.offer);

  data.history = history;
  data.snapshot_data = data.snapshot_data || data.snapshot || offerRecord?.snapshot_data || {};
  data.snapshot = data.snapshot || data.snapshot_data;
  data.compatibility_breakdown =
    data.compatibility_breakdown || offerRecord?.compatibility_breakdown || {};

  data.club = {
    ...data.club,
    id: clubData.id,
    name: clubData.name,
    city: clubData.city,
    shield_url: clubData.shield_url,
    reputation: clubData.reputation,
    formation: clubData.formation,
    style: clubData.play_style,
    play_style: clubData.play_style,
    base_terms: clubData.base_terms
  };

  data.coach = {
    ...data.coach,
    id: coachData?.id,
    name: coachData?.name || data.coach?.name || 'Treinador não informado',
    profile: coachData?.profile || data.coach?.profile || 'Não informado',
    impacts: coachData?.impacts || data.coach?.impacts || {}
  };

  data.academy = {
    ...data.academy,
    club_id: academyData?.club_id,
    physical: academyData?.physical,
    speed: academyData?.speed,
    technical: academyData?.technical,
    recovery: academyData?.recovery,
    tactical: academyData?.tactical
  };

  data.roster = roster;
  data.competitors = enrichCompetitors(data.competitors, roster);

  return data;
}

export async function negotiateOffer(offerId, requestedTerms) {
  // Valida a rodada atual do banco, não uma cópia antiga em memória.
  const currentOffer = await getOfferRecord(offerId);
  const sanitizedTerms = validateNegotiationRequest(
    requestedTerms,
    currentOffer?.round ?? 0
  );

  const { data, error } = await supabase.rpc('negotiate_offer', {
    p_offer_id: offerId,
    p_requested_terms: sanitizedTerms
  });
  if (error) throw new Error(error.message);

  // Atualiza o cache imediatamente para qualquer componente aberto (e-mail,
  // painel e guard de rodadas) enxergar a mesma rodada/paciência.
  await getOfferRecord(offerId);
  return data;
}

export async function acceptOffer(offerId) {
  const { data, error } = await supabase.rpc('accept_offer', {
    p_offer_id: offerId
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function rejectOffer(offerId) {
  const selected = await getOfferRecord(offerId);
  const activeOffers = cachedData.offers.filter(offer =>
    ['new', 'reviewed', 'negotiating', 'countered'].includes(offer.status)
  );
  if (selected?.is_emergency && activeOffers.length <= 1) {
    throw new Error('A oferta emergencial é sua última oportunidade e não pode ser recusada.');
  }

  const { data, error } = await supabase.rpc('reject_offer', {
    p_offer_id: offerId
  });
  if (error) throw new Error(error.message);
  return data;
}

export { MAX_NEGOTIATION_ROUNDS };

// O HTML legado da área de criação possui tags não fechadas. Até a marcação ser
// substituída por componentes, reposicionamos o botão para garantir uma árvore
// DOM estável e impedir que o layout da dica engula a ação principal.

function guardNegotiationRoundInUi() {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;
  const panel = document.getElementById('contractPanel');
  if (!panel || panel.dataset.roundGuard === 'true') return;

  const sync = () => {
    const activeCard = document.querySelector('.fm-offer-card.active');
    const activeOffer = cachedData.offers.find(offer => offer.id === activeCard?.dataset.id);
    const button = panel.querySelector('#btnPreviewNegotiate');
    if (!button || !activeOffer) return;

    const exhausted = Number(activeOffer.round) >= MAX_NEGOTIATION_ROUNDS;
    button.disabled = exhausted;
    button.style.opacity = exhausted ? '0.55' : '';
    if (exhausted) {
      button.setAttribute('aria-disabled', 'true');
      button.title = 'Limite de 3 rodadas atingido';
    } else {
      button.removeAttribute('aria-disabled');
      button.removeAttribute('title');
    }
  };

  new MutationObserver(sync).observe(panel, { childList: true, subtree: true });
  panel.dataset.roundGuard = 'true';
  sync();
}

function repairLegacyCreateActionCard() {
  if (typeof document === 'undefined') return;
  const article = document.querySelector('.create-action-card');
  const tip = article?.querySelector('.coach-tip');
  const button = article?.querySelector('#createPlayerBtn');
  if (!article || !tip || !button || !tip.contains(button)) return;
  article.appendChild(button);
  article.dataset.domRepaired = 'true';
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      repairLegacyCreateActionCard();
      guardNegotiationRoundInUi();
    }, { once: true });
  } else {
    repairLegacyCreateActionCard();
    guardNegotiationRoundInUi();
  }
}
