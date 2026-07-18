import { supabase } from './supabase-client.js';

export { supabase };
// Cadastro de usuário
export async function signUpUser(email, password, username) {
  const { data, error } = await supabase.auth.signUp({
    email: email,
    password: password,
    options: {
      data: {
        nome_de_usuario: username
      }
    }
  });

  if (error) {
    throw new Error(error.message);
  }
  return data;
}

// Login de usuário
export async function signInUser(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email,
    password: password,
  });

  if (error) {
    throw new Error(error.message);
  }
  return data;
}

// Recuperação de senha
export async function resetPassword(email) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/reset-password.html',
  });

  if (error) {
    throw new Error(error.message);
  }
  return data;
}

// Verificar sessão atual
export async function getCurrentSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}
