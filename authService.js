import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabaseUrl = 'https://aqbikkjvosxvlysbzpvr.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFxYmlra2p2b3N4dmx5c2J6cHZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NzA4NDcsImV4cCI6MjA5NDM0Njg0N30.lVY-rcbQnizN7g0v3PLoNichblf80f-b4IKhojxCc3Q'
const supabase = createClient(supabaseUrl, supabaseKey)

export { supabase }

// Cadastro de usuário
export async function signUpUser(email, password, username) {
  const { data, error } = await supabase.auth.signUp({
    email: email,
    password: password,
    options: {
      data: {
        username: username
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
