import { supabase } from './supabase-client.js';
import '../pages/career/career-profile-v2.js?v=20260811-6';

function throwRpcError(error, fallback) {
  if (!error) return;
  const message = error.message || error.details || fallback;
  throw new Error(message || fallback);
}

export async function getCareerHub() {
  const { data, error } = await supabase.rpc('get_career_hub');
  throwRpcError(error, 'Não foi possível carregar a carreira.');
  return data;
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
