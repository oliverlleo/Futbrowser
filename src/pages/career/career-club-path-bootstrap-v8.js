import { supabase } from '../../services/supabase-client.js';

await import('./career-club-path-v8.js?v=20260813-1');

try {
  const { data, error } = await supabase.rpc('get_career_hub');
  if (error) throw error;
  const shown = document.getElementById('clubName')?.textContent?.trim();
  const actual = data?.club?.name?.trim();
  const renderedClub = shown && shown !== '—' && shown !== 'Clube' && shown !== 'Carregando...';
  if (renderedClub && actual && shown !== actual) {
    window.location.reload();
  } else if (data) {
    document.dispatchEvent(new CustomEvent('career:hub-rendered', { detail: data }));
  }
} catch (error) {
  console.warn('[Club path] sincronização inicial indisponível:', error?.message || error);
}
