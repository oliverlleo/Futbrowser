import { supabase } from './supabase-client.js';

function throwRpcError(error, fallback) {
  if (!error) return;
  throw new Error(error.message || error.details || fallback);
}

export async function getManagerOnboarding() {
  const { data, error } = await supabase.rpc('get_manager_onboarding');
  throwRpcError(error, 'Não foi possível carregar o modo Manager.');
  return data;
}

export async function createManagerProfile({ displayName, nationality, profileType }) {
  const { data, error } = await supabase.rpc('create_manager_profile', {
    p_display_name: displayName,
    p_nationality: nationality,
    p_profile_type: profileType
  });
  throwRpcError(error, 'Não foi possível criar seu Manager.');
  return data;
}

export async function acceptManagerJob(clubId) {
  const { data, error } = await supabase.rpc('accept_manager_job', {
    p_club_id: clubId
  });
  throwRpcError(error, 'Não foi possível aceitar a proposta.');
  return data;
}

export async function getManagerHub() {
  const { data, error } = await supabase.rpc('get_manager_hub');
  throwRpcError(error, 'Não foi possível carregar a Central do Manager.');
  return data;
}

export async function saveManagerTactics(formation, playStyle) {
  const { data, error } = await supabase.rpc('set_manager_tactics', {
    p_formation: formation,
    p_play_style: playStyle
  });
  throwRpcError(error, 'Não foi possível salvar a tática.');
  return data;
}

export async function saveManagerTraining(focus, intensity) {
  const { data, error } = await supabase.rpc('set_manager_training_plan', {
    p_focus: focus,
    p_intensity: intensity
  });
  throwRpcError(error, 'Não foi possível salvar o treino.');
  return data;
}

export async function saveManagerLineup(starterIds) {
  const { data, error } = await supabase.rpc('set_manager_lineup', {
    p_starters: starterIds
  });
  throwRpcError(error, 'Não foi possível salvar a escalação.');
  return data;
}

export async function playManagerMatch(approach = 'balanced') {
  const { data, error } = await supabase.rpc('play_manager_match', {
    p_approach: approach
  });
  throwRpcError(error, 'Não foi possível concluir a partida do Manager.');
  return data;
}
