import { supabase, getCurrentSession } from "./authService.js";

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
  const normalizedRole = String(role || "")
    .trim()
    .toLowerCase();

  if (!["jogador", "tecnico", "presidente"].includes(normalizedRole)) {
    return;
  }

  // Verificar se o usuário está logado
  const session = await getCurrentSession();
  if (!session) {
    mostrarToast(
      "Você precisa estar logado para escolher um caminho.",
      "error",
    );
    window.location.href = "index.html";
    return;
  }

  document.body.classList.add("path-saving");
  mostrarToast(
    `Salvando sua escolha como ${normalizedRole.toUpperCase()}...`,
    "info",
  );

  try {
    // Atualizar no Supabase
    const { error } = await supabase
      .from("usuarios")
      .update({ caminho: normalizedRole })
      .eq("id", session.user.id);

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
    profile.firstPathChosenAt =
      profile.firstPathChosenAt || new Date().toISOString();
    localStorage.setItem(profileStorageKey, JSON.stringify(profile));
    localStorage.setItem("futbrowser_selected_path", normalizedRole);

    mostrarToast("Caminho escolhido com sucesso!", "success");

    // Exibe a seção de criação sem recarregar a página
    setTimeout(() => {
      toggleCreationSection(normalizedRole);
      document.body.classList.remove("path-saving");
    }, 1000);
  } catch (error) {
    console.error("Erro ao salvar caminho:", error);
    mostrarToast("Erro ao salvar escolha. Tente novamente.", "error");
    document.body.classList.remove("path-saving");
  }
}

function selectCard(role) {
  document.querySelectorAll(".path-card").forEach((card) => {
    card.classList.toggle("selected", card.dataset.role === role);
  });
}

function bindEvents() {
  document.querySelectorAll(".path-card").forEach((card) => {
    card.addEventListener("click", (event) => {
      const clickedButton = event.target.closest(".choose-btn");
      if (!clickedButton) {
        selectCard(card.dataset.role);
      }
    });

    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectCard(card.dataset.role);
      }
    });
  });

  document.querySelectorAll(".choose-btn").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      saveChosenPath(button.dataset.role);
    });
  });
}

function preventBrokenImageText() {
  document.querySelectorAll(".path-image img").forEach((img) => {
    img.addEventListener("error", () => {
      img.removeAttribute("alt");
      img.setAttribute("aria-hidden", "true");
      img.style.visibility = "hidden";
    });
  });
}

// Sistema de Toast mantido do código anterior para feedback amigável
function mostrarToast(mensagem, tipo = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast ${tipo}`;
  toast.innerText = mensagem;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("show");
  }, 10);

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => {
      if (container.contains(toast)) {
        container.removeChild(toast);
      }
    }, 400);
  }, 3000);
}

function toggleCreationSection(role) {
  // Ocultar seções de escolha de caminho
  const pathSelection = document.getElementById("path-selection");
  const pathNoticesNotice = document.getElementById("path-notices-notice");
  const pathNoticesDetails = document.getElementById("path-notices-details");
  const pathNoticesFooter = document.getElementById("path-notices-footer");
  const pathHero = document.getElementById("path-hero");

  if (pathSelection) pathSelection.style.display = "none";
  if (pathNoticesNotice) pathNoticesNotice.style.display = "none";
  if (pathNoticesDetails) pathNoticesDetails.style.display = "none";
  if (pathNoticesFooter) pathNoticesFooter.style.display = "none";
  if (pathHero) pathHero.style.display = "none";

  // Mostrar seção correta
  const allCreationSections = document.querySelectorAll(".creation-section");
  allCreationSections.forEach((section) => {
    section.style.display = "none";
  });

  const targetSection = document.getElementById(`section-create-${role}`);
  if (targetSection) {
    targetSection.style.display = "block";
  }
}

async function verificarCaminhoExistente(userId) {
  try {
    const { data, error } = await supabase
      .from("usuarios")
      .select("caminho")
      .eq("id", userId)
      .single();

    if (error) throw error;

    if (data && data.caminho) {
      toggleCreationSection(data.caminho);
    }
  } catch (error) {
    console.error("Erro ao verificar caminho:", error);
  }
}

function toggleCreationSection(role) {
  // Ocultar seções de escolha de caminho
  const pathSelection = document.getElementById("path-selection");
  const pathNoticesNotice = document.getElementById("path-notices-notice");
  const pathNoticesDetails = document.getElementById("path-notices-details");
  const pathNoticesFooter = document.getElementById("path-notices-footer");
  const pathHero = document.getElementById("path-hero");

  if (pathSelection) pathSelection.style.display = "none";
  if (pathNoticesNotice) pathNoticesNotice.style.display = "none";
  if (pathNoticesDetails) pathNoticesDetails.style.display = "none";
  if (pathNoticesFooter) pathNoticesFooter.style.display = "none";
  if (pathHero) pathHero.style.display = "none";

  // Mostrar seção correta
  const allCreationSections = document.querySelectorAll(".creation-section");
  allCreationSections.forEach((section) => {
    section.style.display = "none";
  });

  const targetSection = document.getElementById(`section-create-${role}`);
  if (targetSection) {
    targetSection.style.display = "block";
  }
}

async function verificarCaminhoExistente(userId) {
  try {
    const { data, error } = await supabase
      .from("usuarios")
      .select("caminho")
      .eq("id", userId)
      .single();

    if (error) throw error;

    if (data && data.caminho) {
      toggleCreationSection(data.caminho);
    }
  } catch (error) {
    console.error("Erro ao verificar caminho:", error);
  }
}

// Inicialização
document.addEventListener("DOMContentLoaded", async () => {
  applyTheme();
  fixLogoSize();
  preventBrokenImageText();
  bindEvents();

  if (window.lucide) {
    window.lucide.createIcons({
      strokeWidth: 1.8,
    });
  }

  // Verifica sessão imediatamente
  const session = await getCurrentSession();
  if (!session) {
    window.location.href = "index.html"; // Redirecionar se não estiver logado
    return;
  }

  // Verifica se já tem caminho e ajusta interface
  await verificarCaminhoExistente(session.user.id);
});
