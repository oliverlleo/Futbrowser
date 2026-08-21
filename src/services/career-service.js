import { supabase } from './supabase-client.js';

function throwRpcError(error, fallback) {
  if (!error) return;
  const message = error.message || error.details || fallback;
  throw new Error(message || fallback);
}

async function sharedCareerHubRequest() {
  if (typeof window === 'undefined') {
    const { data, error } = await supabase.rpc('get_career_hub');
    throwRpcError(error, 'Não foi possível carregar a carreira.');
    return data;
  }
  if (!window.__futbrowserCareerHubRequest) {
    window.__futbrowserCareerHubRequest = supabase.rpc('get_career_hub')
      .then(({ data, error }) => {
        throwRpcError(error, 'Não foi possível carregar a carreira.');
        return data;
      })
      .finally(() => {
        queueMicrotask(() => { window.__futbrowserCareerHubRequest = null; });
      });
  }
  return window.__futbrowserCareerHubRequest;
}

export async function getCareerHub() {
  return sharedCareerHubRequest();
}

async function softCareerReview(rpcName) {
  const { data, error } = await supabase.rpc(rpcName);
  if (error) {
    console.warn(`[Career review] ${rpcName}:`, error.message || error);
    return { ok: false, data: null, error };
  }
  return { ok: true, data, error: null };
}

export async function reviewCareerProgressionContext() {
  // Ordering matters: a due club move must become effective before the club
  // evaluates an internal promotion, and only then should the market scout the
  // player's new sporting context.
  const pendingMove = await softCareerReview('review_career_pending_move');
  const promotion = await softCareerReview('review_career_promotion');
  const market = await softCareerReview('review_career_market_interest');
  return { pendingMove, promotion, market };
}

export async function performCareerActivity(activityKey, intensity = 'normal', duration = 60) {
  const { data, error } = await supabase.rpc('perform_career_activity', {
    p_activity_key: activityKey,
    p_intensity: intensity,
    p_duration: duration
  });
  throwRpcError(error, 'Não foi possível concluir a atividade.');
  return data;
}

export async function advanceCareerPeriod() {
  const { data, error } = await supabase.rpc('advance_career_period');
  throwRpcError(error, 'Não foi possível avançar o período.');
  return data;
}

export async function resolveCareerEvent(eventId, choiceKey) {
  const { data, error } = await supabase.rpc('resolve_career_event', {
    p_event_id: eventId,
    p_choice_key: choiceKey
  });
  throwRpcError(error, 'Não foi possível registrar sua decisão.');
  return data;
}
