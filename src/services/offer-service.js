import { supabase } from './supabase-client.js';

export async function getCareerOnboardingState() {
  const { data, error } = await supabase.rpc('get_career_onboarding_state');
  if (error) throw new Error(error.message);
  return data;
}

export async function generateInitialOffers() {
  const { data, error } = await supabase.rpc('generate_initial_offers');
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
