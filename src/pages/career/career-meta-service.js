import { supabase } from '../../services/supabase-client.js';

function throwRpc(error, fallback) {
  if (!error) return;
  throw new Error(error.message || error.details || fallback);
}

async function sharedCareerHubRequest() {
  if (typeof window === 'undefined') {
    const { data, error } = await supabase.rpc('get_career_hub');
    throwRpc(error, 'Não foi possível carregar o perfil da carreira.');
    return data;
  }
  if (!window.__futbrowserCareerHubRequest) {
    window.__futbrowserCareerHubRequest = supabase.rpc('get_career_hub')
      .then(({ data, error }) => {
        throwRpc(error, 'Não foi possível carregar o perfil da carreira.');
        return data;
      })
      .finally(() => {
        queueMicrotask(() => { window.__futbrowserCareerHubRequest = null; });
      });
  }
  return window.__futbrowserCareerHubRequest;
}

export async function getCareerMetaHub() {
  return sharedCareerHubRequest();
}

export async function getCareerTeamProfile() {
  const { data, error } = await supabase.rpc('get_career_team_profile');
  throwRpc(error, 'Não foi possível carregar o clube.');
  return data;
}

export async function getCareerPlayerHistory() {
  const { data, error } = await supabase.rpc('get_player_career_history');
  if (error) {
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
