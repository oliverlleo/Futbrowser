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

// Sair apenas desta sessão/dispositivo.
export async function signOutUser() {
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) {
    throw new Error(error.message);
  }
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

function isDashboardPage() {
  const pathname = window.location.pathname.toLowerCase();
  return pathname.endsWith('/dashboard.html') || pathname.endsWith('dashboard.html');
}

async function mountDashboardLogoutControl() {
  if (!isDashboardPage()) return;
  if (document.getElementById('logoutBtn')) return;

  const session = await getCurrentSession();
  if (!session) return;

  const resourceCards = document.querySelector('.resource-cards');
  if (!resourceCards) return;

  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'logoutBtn';
  button.className = 'resource-card';
  button.setAttribute('aria-label', 'Sair da conta');
  button.title = 'Sair da conta';
  button.style.cursor = 'pointer';
  button.style.border = '1px solid var(--line)';
  button.style.color = 'var(--text)';
  button.style.background = 'var(--card)';
  button.innerHTML = `
    <i data-lucide="log-out"></i>
    <div>
      <span>Conta:</span>
      <strong>Sair</strong>
    </div>
  `;

  button.addEventListener('click', async () => {
    if (button.disabled) return;

    button.disabled = true;
    button.style.opacity = '0.65';

    try {
      await signOutUser();
      window.location.replace('index.html');
    } catch (error) {
      console.error('Erro ao sair da conta:', error);
      button.disabled = false;
      button.style.opacity = '1';
      window.alert('Não foi possível sair da conta. Tente novamente.');
    }
  });

  resourceCards.appendChild(button);

  if (window.lucide) {
    window.lucide.createIcons({ strokeWidth: 1.8 });
  }
}

async function mountDashboardGameInbox() {
  if (!isDashboardPage()) return;
  const session = await getCurrentSession();
  if (!session) return;

  const { mountGameInbox } = await import('../components/mail/inbox.js');
  await mountGameInbox();
}

async function mountDashboardNegotiationSync() {
  if (!isDashboardPage()) return;
  const session = await getCurrentSession();
  if (!session) return;

  const { mountNegotiationStateSync } = await import('../components/negotiation/state-sync.js');
  mountNegotiationStateSync();
}

async function runDashboardControl(label, mount) {
  try {
    await mount();
  } catch (error) {
    // Cada controle é independente: uma falha no e-mail, por exemplo, nunca
    // deve desativar logout nem as proteções do fluxo de negociação.
    console.error(`Erro ao montar ${label}:`, error);
  }
}

async function mountDashboardControls() {
  if (!isDashboardPage()) return;

  await Promise.all([
    runDashboardControl('logout do dashboard', mountDashboardLogoutControl),
    runDashboardControl('caixa de entrada do dashboard', mountDashboardGameInbox),
    runDashboardControl('sincronização de negociação', mountDashboardNegotiationSync)
  ]);
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountDashboardControls);
  } else {
    mountDashboardControls();
  }
}
