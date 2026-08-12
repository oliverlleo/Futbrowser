import { supabase } from '../../services/supabase-client.js';

function throwRpc(error, fallback) {
  if (!error) return;
  throw new Error(error.message || error.details || fallback);
}

function isMissingRpc(error, name) {
  const message = String(error?.message || error?.details || '');
  return message.includes(name) || message.includes('schema cache') || message.includes('Could not find the function');
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

export async function getCareerMatchContext() {
  const { data, error } = await supabase.rpc('get_career_match_context');
  if (error && isMissingRpc(error, 'get_career_match_context')) return null;
  throwRpc(error, 'Não foi possível preparar o contexto da partida.');
  return data;
}

export async function reconcileCareerMatchProgression() {
  const { data, error } = await supabase.rpc('reconcile_career_match_progression');
  if (error && isMissingRpc(error, 'reconcile_career_match_progression')) return null;
  throwRpc(error, 'Não foi possível reconciliar o avanço pós-partida.');
  return data;
}

export async function recordCareerMatchGameplay(payload = {}) {
  const args = {
    p_opponent: payload.opponent,
    p_competition: payload.competition,
    p_played: Boolean(payload.played),
    p_started: Boolean(payload.started),
    p_minutes: Number(payload.minutes || 0),
    p_goals: Number(payload.goals || 0),
    p_assists: Number(payload.assists || 0),
    p_rating: payload.rating == null ? null : Number(payload.rating),
    p_team_goals: Number(payload.teamGoals || 0),
    p_opponent_goals: Number(payload.opponentGoals || 0),
    p_metadata: payload.metadata || {}
  };

  const modern = await supabase.rpc('record_career_match_gameplay', args);
  if (!modern.error) {
    return { data: modern.data, transport: 'gameplay_rpc' };
  }
  if (!isMissingRpc(modern.error, 'record_career_match_gameplay')) {
    throwRpc(modern.error, 'Não foi possível registrar a partida.');
  }

  const legacy = await supabase.rpc('record_career_match_result', {
    p_opponent: args.p_opponent,
    p_competition: args.p_competition,
    p_played: args.p_played,
    p_started: args.p_started,
    p_minutes: args.p_minutes,
    p_goals: args.p_goals,
    p_assists: args.p_assists,
    p_rating: args.p_rating,
    p_team_goals: args.p_team_goals,
    p_opponent_goals: args.p_opponent_goals
  });
  throwRpc(legacy.error, 'Não foi possível registrar a partida.');

  const reconciliation = await reconcileCareerMatchProgression();
  return {
    data: legacy.data,
    transport: 'legacy_rpc',
    reconciliation
  };
}
