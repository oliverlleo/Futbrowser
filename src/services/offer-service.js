import { supabase } from './supabase-client.js';
import { getCurrentSession } from './auth-service.js';

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
    .select('id, nome, idade, posicao, arquetipo, avatar, atributos')
    .eq('user_id', session.user.id)
    .single();
    
  if (error) throw new Error(error.message);
  
  if (data.atributos) {
    const { data: ovr } = await supabase.rpc('calculate_player_ovr', { p_atributos: data.atributos });
    data.ovr = ovr || 50;
  } else {
    data.ovr = 50;
  }
  
  return data;
}

let cachedData = null;

async function loadClubsDataBatch(clubIds) {
  if (!clubIds || clubIds.length === 0) return;
  const ids = [...new Set(clubIds)];
  
  const { data: clubs } = await supabase.from('base_clubs').select('id, name, city, shield_url, reputation, formation, play_style, coach_id, base_terms').in('id', ids);
  const coachIds = clubs ? clubs.map(c => c.coach_id).filter(id => id) : [];
  const { data: coaches } = await supabase.from('base_coaches').select('id, name, profile, impacts').in('id', [...new Set(coachIds)]);
  const { data: academies } = await supabase.from('base_academy_profiles').select('club_id, physical, speed, technical, recovery, tactical').in('club_id', ids);
  const { data: players } = await supabase.from('base_ai_players').select('id, club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter').in('club_id', ids);
  
  cachedData = { 
      clubs: clubs || [], 
      coaches: coaches || [], 
      academies: academies || [], 
      players: players || [] 
  };
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
        current_terms,
        compatibility_breakdown,
        snapshot_data,
        base_clubs ( name, city, reputation, formation, play_style )
    `)
    .eq('player_id', player.id)
    .order('created_at', { ascending: false });
    
  if (error) throw new Error(error.message);
  
  if (data && data.length > 0) {
      await loadClubsDataBatch(data.map(o => o.club_id));
  }
  
  return data;
}

export async function getOfferDetails(offerId) {
  const { data, error } = await supabase.rpc('get_offer_details', { p_offer_id: offerId });
  if (error) throw new Error(error.message);
  
  if (cachedData && data && data.offer) {
     const club_id = data.offer.club_id;
     
     const clubData = cachedData.clubs.find(c => c.id === club_id) || {};
     const coachData = cachedData.coaches.find(c => c.id === clubData.coach_id) || {};
     const academyData = cachedData.academies.find(a => a.club_id === club_id) || {};
     const roster = cachedData.players.filter(p => p.club_id === club_id) || [];
     
     data.club = {
         ...data.club,
         id: clubData.id,
         name: clubData.name,
         city: clubData.city,
         shield_url: clubData.shield_url,
         reputation: clubData.reputation,
         formation: clubData.formation,
         style: clubData.play_style,
     };
     
     data.coach = {
         id: coachData.id,
         name: coachData.name,
         profile: coachData.profile,
         impacts: coachData.impacts
     };
     
     data.academy = {
         physical: academyData.physical,
         speed: academyData.speed,
         technical: academyData.technical,
         recovery: academyData.recovery,
         tactical: academyData.tactical
     };
     
     data.roster = roster;
     
     if (data.competitors) {
         data.competitors = data.competitors.map(comp => {
             const rosterPlayer = roster.find(p => p.id === comp.id);
             return rosterPlayer ? { ...comp, ...rosterPlayer } : comp;
         });
     }
  }
  
  return data;
}

export async function negotiateOffer(offerId, requestedTerms) {
  const { data, error } = await supabase.rpc('negotiate_offer', { 
    p_offer_id: offerId, 
    p_requested_terms: requestedTerms 
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function acceptOffer(offerId) {
  const { data, error } = await supabase.rpc('accept_offer', { p_offer_id: offerId });
  if (error) throw new Error(error.message);
  return data;
}

export async function rejectOffer(offerId) {
  const { data, error } = await supabase.rpc('reject_offer', { p_offer_id: offerId });
  if (error) throw new Error(error.message);
  return data;
}
