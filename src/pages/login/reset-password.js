import { supabase } from '../../services/supabase-client.js';

const form = document.getElementById('resetForm');
const button = document.getElementById('resetButton');
const message = document.getElementById('resetMessage');

function setMessage(text, kind = '') {
  message.textContent = text;
  message.className = `reset-message ${kind}`.trim();
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const password = document.getElementById('newPassword')?.value || '';
  const confirmation = document.getElementById('confirmPassword')?.value || '';

  if (password.length < 8) {
    setMessage('A senha deve ter pelo menos 8 caracteres.', 'error');
    return;
  }
  if (password !== confirmation) {
    setMessage('As senhas não coincidem.', 'error');
    return;
  }

  button.disabled = true;
  setMessage('Salvando…');
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('O link de recuperação expirou. Solicite um novo link.');
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    setMessage('Senha atualizada. Você já pode voltar ao login.', 'success');
    form.reset();
  } catch (error) {
    setMessage(error.message || 'Não foi possível redefinir sua senha.', 'error');
  } finally {
    button.disabled = false;
  }
});
