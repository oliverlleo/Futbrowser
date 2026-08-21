import { supabase } from '../../services/supabase-client.js';

function throwRpc(error, fallback) {
  if (!error) return;
  throw new Error(error.message || error.details || fallback);
}

export async function bootstrapCareerCompetitions() {
  const { data, error } = await supabase.rpc('bootstrap_career_competitions');
  throwRpc(error, 'Não foi possível preparar o calendário de competições.');
  return data;
}

export async function getCareerCompetitionHub(competitionCode = null, round = null) {
  const { data, error } = await supabase.rpc('get_career_competition_hub', {
    p_competition_code: competitionCode,
    p_round: round
  });
  throwRpc(error, 'Não foi possível carregar a central de competições.');
  return data;
}

export async function setCareerCompetitionPriority(priority) {
  const { data, error } = await supabase.rpc('set_career_competition_priority', {
    p_priority: priority
  });
  throwRpc(error, 'Não foi possível salvar o foco competitivo.');
  return data;
}
