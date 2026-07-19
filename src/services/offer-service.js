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
  return data;
}

export async function getOfferDetails(offerId) {
  const { data, error } = await supabase.rpc('get_offer_details', { p_offer_id: offerId });
  if (error) throw new Error(error.message);
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
