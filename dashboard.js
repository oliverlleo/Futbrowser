import { supabase, getCurrentSession } from './authService.js';

const root = document.documentElement;

// Função para aplicar tema (Dia/Noite baseado na hora ou preferência)
function getSavedTheme() {
  const stored = localStorage.getItem("futbrowser_theme");
  if (stored === "dark" || stored === "light") return stored;

  const loginTheme = localStorage.getItem("theme");
  if (loginTheme === "dark" || loginTheme === "light") return loginTheme;

  // Lógica Dia/Noite baseada na hora para compatibilidade
  const hora = new Date().getHours();
  if (hora >= 18 || hora < 6) return "dark";

  return "light";
}

function applyTheme() {
  root.setAttribute("data-theme", getSavedTheme());
}

function fixLogoSize() {
  const logo = document.querySelector(".brand-logo");
  const brand = document.querySelector(".brand");

  if (!logo || !brand) return;

  logo.addEventListener("error", () => {
    brand.classList.add("use-fallback");
  });

  logo.addEventListener("load", () => {
    if (logo.naturalWidth < 120 || logo.naturalHeight < 24) {
      brand.classList.add("use-fallback");
    }
  });
}

async function saveChosenPath(role) {
  const normalizedRole = String(role || "").trim().toLowerCase();

  if (!["jogador", "tecnico", "presidente"].includes(normalizedRole)) {
    return;
  }

  // Verificar se o usuário está logado
  const session = await getCurrentSession();
  if (!session) {
    mostrarToast('Você precisa estar logado para escolher um caminho.', 'error');
    window.location.href = 'index.html';
    return;
  }

  document.body.classList.add("path-saving");
  mostrarToast(`Salvando sua escolha como ${normalizedRole.toUpperCase()}...`, 'info');

  try {
    // Atualizar no Supabase
    const { error } = await supabase
        .from('usuarios')
        .update({ caminho: normalizedRole })
        .eq('id', session.user.id);

    if (error) throw error;

    // Atualizar no LocalStorage para uso no Front (Opcional, mas mantém a lógica do usuário)
    const profileStorageKey = `futbrowser_profile_${session.user.id}`;
    let profile = {};
    try {
      profile = JSON.parse(localStorage.getItem(profileStorageKey) || "{}");
    } catch {
      profile = {};
    }
    profile.caminho = normalizedRole;
    profile.role = normalizedRole;
    profile.modoJogo = normalizedRole;
    profile.firstPathChosenAt = profile.firstPathChosenAt || new Date().toISOString();
    localStorage.setItem(profileStorageKey, JSON.stringify(profile));
    localStorage.setItem("futbrowser_selected_path", normalizedRole);

    mostrarToast('Caminho escolhido com sucesso!', 'success');

    // Determina a proxima rota baseada na escolha
    const nextRoute = {
      jogador: "jogador.html",
      tecnico: "tecnico.html",
      presidente: "presidente.html"
    }[normalizedRole];

    // Redireciona (pode comentar isso caso as rotas nao existam ainda)
    setTimeout(() => {
      // window.location.href = nextRoute;
      mostrarToast(`Indo para: ${nextRoute} (rota não implementada ainda)`, 'info');
      document.body.classList.remove("path-saving");
    }, 2000);

  } catch (error) {
    console.error('Erro ao salvar caminho:', error);
    mostrarToast('Erro ao salvar escolha. Tente novamente.', 'error');
    document.body.classList.remove("path-saving");
  }
}

function selectCard(role) {
  document.querySelectorAll(".path-card").forEach(card => {
    card.classList.toggle("selected", card.dataset.role === role);
  });
}

function bindEvents() {
  document.querySelectorAll(".path-card").forEach(card => {
    card.addEventListener("click", event => {
      const clickedButton = event.target.closest(".choose-btn");
      if (!clickedButton) {
        selectCard(card.dataset.role);
      }
    });

    card.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectCard(card.dataset.role);
      }
    });
  });

  document.querySelectorAll(".choose-btn").forEach(button => {
    button.addEventListener("click", event => {
      event.stopPropagation();
      saveChosenPath(button.dataset.role);
    });
  });
}

function preventBrokenImageText() {
  document.querySelectorAll(".path-image img").forEach(img => {
    img.addEventListener("error", () => {
      img.removeAttribute("alt");
      img.setAttribute("aria-hidden", "true");
      img.style.visibility = "hidden";
    });
  });
}

// Sistema de Toast mantido do código anterior para feedback amigável
function mostrarToast(mensagem, tipo = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;
    toast.innerText = mensagem;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (container.contains(toast)) {
                container.removeChild(toast);
            }
        }, 400);
    }, 3000);
}

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
    applyTheme();
    fixLogoSize();
    preventBrokenImageText();
    bindEvents();

    if (window.lucide) {
      window.lucide.createIcons({
        strokeWidth: 1.8
      });
    }

    // Verifica sessão imediatamente
    const session = await getCurrentSession();
    if (!session) {
        window.location.href = 'index.html'; // Redirecionar se não estiver logado
    }
});
