import { supabase } from './supabase-client.js';
import '../pages/career/career-inbox.js';

function installCareerDomGuard() {
  if (typeof document === 'undefined' || !window.location.pathname.toLowerCase().includes('career')) return;

  const ensureVisualAnchors = () => {
    const avatarWrap = document.querySelector('.player-avatar-wrap');
    if (avatarWrap && !document.getElementById('careerAvatar')) {
      const avatar = document.createElement('img');
      avatar.id = 'careerAvatar';
      avatar.src = 'img/avatar/avatar1.webp';
      avatar.alt = 'Avatar do jogador';
      avatarWrap.replaceChildren(avatar);
    }

    const crestWrap = document.querySelector('.club-crest-wrap');
    if (crestWrap && !document.getElementById('clubCrest')) {
      const crest = document.createElement('img');
      crest.id = 'clubCrest';
      crest.src = 'img/clubs/default.png';
      crest.alt = 'Escudo do clube';
      crestWrap.replaceChildren(crest);
    }
  };

  const startGuard = () => {
    ensureVisualAnchors();
    const root = document.getElementById('careerPage') || document.body;
    if (!root) return;

    const observer = new MutationObserver(() => ensureVisualAnchors());
    observer.observe(root, { childList: true, subtree: true });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startGuard, { once: true });
  } else {
    startGuard();
  }
}

installCareerDomGuard();

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
