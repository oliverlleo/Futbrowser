const root = document.documentElement;
const ROLE_ROUTES = {
  jogador: "jogador.html",
  tecnico: "tecnico.html",
  presidente: "presidente.html"
};

function getSavedTheme() {
  const stored = localStorage.getItem("futbrowser_theme");
  if (stored === "dark" || stored === "light") return stored;

  const loginTheme = localStorage.getItem("theme");
  if (loginTheme === "dark" || loginTheme === "light") return loginTheme;

  if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }

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

function normalizeRole(role) {
  const normalizedRole = String(role || "").trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(ROLE_ROUTES, normalizedRole) ? normalizedRole : "";
}

function getFeedback() {
  return document.getElementById("pathFeedback");
}

function showFeedback(message, success = false) {
  const feedback = getFeedback();
  if (!feedback) return;

  feedback.textContent = message || "";
  feedback.classList.toggle("success", success);
}

function setSavingState(isSaving) {
  document.body.classList.toggle("path-saving", isSaving);
  document.querySelectorAll(".choose-btn").forEach(button => {
    button.disabled = isSaving;
    button.textContent = isSaving ? "Salvando..." : "Escolher caminho";
  });
}

function cacheChosenPath(role) {
  const normalizedRole = normalizeRole(role);
  if (!normalizedRole) return;

  localStorage.setItem("futbrowser_selected_path", normalizedRole);

  const accountRaw = localStorage.getItem("futbrowser_account");
  if (accountRaw) {
    try {
      const account = JSON.parse(accountRaw);
      account.caminho = normalizedRole;
      account.role = normalizedRole;
      account.modoJogo = normalizedRole;
      localStorage.setItem("futbrowser_account", JSON.stringify(account));
    } catch {}
  }
}

async function saveChosenPath(role) {
  const normalizedRole = normalizeRole(role);

  if (!normalizedRole) {
    showFeedback("Caminho inválido. Escolha Jogador, Técnico ou Presidente.");
    return;
  }

  setSavingState(true);
  showFeedback("");

  try {
    await window.FutbrowserSupabase.savePathForCurrentUser(normalizedRole);
    cacheChosenPath(normalizedRole);
    showFeedback("Caminho salvo com sucesso. Redirecionando...", true);

    setTimeout(() => {
      window.location.href = ROLE_ROUTES[normalizedRole];
    }, 450);
  } catch (error) {
    const message = error && error.message ? error.message : "Não foi possível salvar seu caminho.";
    showFeedback(message);
    setSavingState(false);
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

async function redirectIfPathAlreadyExists() {
  try {
    const user = await window.FutbrowserSupabase.getCurrentUser();

    if (!user) {
      window.location.href = "index.html";
      return;
    }

    const savedPath = await window.FutbrowserSupabase.getCurrentPath();
    if (savedPath) {
      window.location.href = ROLE_ROUTES[savedPath];
    }
  } catch (error) {
    const message = error && error.message ? error.message : "Não foi possível consultar seu perfil.";
    showFeedback(message);
  }
}

applyTheme();
fixLogoSize();
preventBrokenImageText();
bindEvents();
redirectIfPathAlreadyExists();

if (window.lucide) {
  window.lucide.createIcons({
    strokeWidth: 1.8
  });
}
