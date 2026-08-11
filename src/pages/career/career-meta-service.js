import { supabase } from '../../services/supabase-client.js';

function throwRpc(error, fallback) {
  if (!error) return;
  throw new Error(error.message || error.details || fallback);
}

export async function getCareerMetaHub() {
  const { data, error } = await supabase.rpc('get_career_hub');
  throwRpc(error, 'Não foi possível carregar o perfil da carreira.');
  return data;
}

export async function getCareerTeamProfile() {
  const { data, error } = await supabase.rpc('get_career_team_profile');
  throwRpc(error, 'Não foi possível carregar o clube.');
  return data;
}

export async function getCareerPlayerHistory() {
  const { data, error } = await supabase.rpc('get_player_career_history');
  if (error) {
    // Mantém o perfil utilizável durante rollout de migration/cache do PostgREST.
    const message = String(error.message || error.details || '');
    if (message.includes('get_player_career_history') || message.includes('schema cache')) return null;
    throwRpc(error, 'Não foi possível carregar o histórico da carreira.');
  }
  return data;
}

export async function chooseCareerShirtNumber(number = null) {
  const { data, error } = await supabase.rpc('choose_squad_number', { p_number: number });
  throwRpc(error, 'Não foi possível confirmar o número da camisa.');
  return data;
}
