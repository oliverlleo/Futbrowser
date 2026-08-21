import { supabase } from '../../services/supabase-client.js';
import { showToast } from '../../components/toast/toast.js';

let managerNavigationInProgress = false;

async function persistManagerPath(userId) {
  const { error } = await supabase
    .from('usuarios')
    .update({ caminho: 'manager' })
    .eq('id', userId);

  if (error) throw error;
}

async function enterManager(button) {
  if (managerNavigationInProgress) return;
  managerNavigationInProgress = true;
  if (button) button.disabled = true;

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!user) {
      window.location.href = 'index.html';
      return;
    }

    await persistManagerPath(user.id);
    window.location.href = 'manager.html';
  } catch (error) {
    console.error('Erro ao selecionar o modo Manager:', error);
    showToast(null, 'Não foi possível abrir o modo Manager.', 'error');
    managerNavigationInProgress = false;
    if (button) button.disabled = false;
  }
}

// O dashboard de Jogador é um runtime grande e já estabilizado. O Manager entra
// por este adaptador isolado para não alterar o fluxo de criação/ofertas do atleta.
document.addEventListener('click', event => {
  const button = event.target.closest?.('.choose-btn[data-role="manager"]');
  if (!button) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  enterManager(button);
}, true);

// Retoma uma carreira Manager já escolhida. Valores antigos são normalizados
// apenas como compatibilidade de dados existentes; não voltam a existir na UI.
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('usuarios')
      .select('caminho')
      .eq('id', user.id)
      .single();

    if (error) throw error;

    if (data?.caminho === 'manager') {
      window.location.replace('manager.html');
      return;
    }

    if (data?.caminho === 'tecnico' || data?.caminho === 'presidente') {
      await persistManagerPath(user.id);
      window.location.replace('manager.html');
    }
  } catch (error) {
    console.warn('Não foi possível resolver automaticamente o caminho Manager.', error);
  }
});
