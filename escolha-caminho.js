// ============================================================
// Futbrowser — Escolha de Caminho
// ============================================================
// Página exibida quando o usuário ainda não tem um caminho
// definido no banco. Ao escolher, salva no Supabase e
// redireciona para a tela do modo escolhido.
// ============================================================

const root = document.documentElement;

// ---------- Tema ----------
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

// ---------- Logo fallback ----------
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

// ---------- Imagens quebradas ----------
function preventBrokenImageText() {
  document.querySelectorAll(".path-image img").forEach(img => {
    img.addEventListener("error", () => {
      img.removeAttribute("alt");
      img.setAttribute("aria-hidden", "true");
      img.style.visibility = "hidden";
    });
  });
}

// ============================================================
// Auth guard — só pode acessar esta página estando logado
// Se não estiver logado, volta para index.html
// Se já tiver caminho, redireciona para a tela correta
// ============================================================
let currentUserId = null;

async function verificarAuth() {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    window.location.href = "index.html";
    return;
  }

  currentUserId = session.user.id;

  // Verificar se já tem caminho (caso abra esta página diretamente)
  const { data: perfil } = await supabase
    .from("usuarios")
    .select("caminho, nome_de_usuario")
    .eq("id", currentUserId)
    .single();

  if (perfil?.caminho && ["jogador", "tecnico", "presidente"].includes(perfil.caminho)) {
    // Já tem caminho — redireciona
    localStorage.setItem("futbrowser_selected_path", perfil.caminho);
    window.location.href = perfil.caminho + ".html";
    return;
  }

  // Exibir nome do usuário se quiser (futuro)
  // Mostrar a página (remover loading overlay se houver)
  document.body.classList.add("auth-ready");
}

// ============================================================
// Salvar caminho no Supabase + localStorage cache
// ============================================================
async function saveChosenPath(role) {
  const normalizedRole = String(role || "").trim().toLowerCase();

  if (!["jogador", "tecnico", "presidente"].includes(normalizedRole)) {
    return;
  }

  if (!currentUserId) {
    mostrarErro("Sessão expirada. Faça login novamente.");
    setTimeout(() => { window.location.href = "index.html"; }, 2000);
    return;
  }

  // Desabilitar todos os botões durante o save
  document.querySelectorAll(".choose-btn").forEach(btn => {
    btn.disabled = true;
  });

  document.body.classList.add("path-saving");

  // Salvar no Supabase
  const { error } = await supabase
    .from("usuarios")
    .update({ caminho: normalizedRole })
    .eq("id", currentUserId);

  if (error) {
    console.error("Erro ao salvar caminho:", error.message);
    document.body.classList.remove("path-saving");
    document.querySelectorAll(".choose-btn").forEach(btn => {
      btn.disabled = false;
    });
    mostrarErro("Erro ao salvar seu caminho. Tente novamente.");
    return;
  }

  // Cache local (apenas para otimização visual)
  localStorage.setItem("futbrowser_selected_path", normalizedRole);

  // Também atualizar qualquer cache local que existia antes
  const accountKey = localStorage.getItem("futbrowser_current_user") || "local";
  const profileStorageKey = `futbrowser_profile_${accountKey}`;
  try {
    const profile = JSON.parse(localStorage.getItem(profileStorageKey) || "{}");
    profile.caminho = normalizedRole;
    profile.role = normalizedRole;
    profile.modoJogo = normalizedRole;
    profile.firstPathChosenAt = profile.firstPathChosenAt || new Date().toISOString();
    localStorage.setItem(profileStorageKey, JSON.stringify(profile));
  } catch {}

  // Redirecionar para a tela do modo escolhido
  const nextRoute = {
    jogador: "jogador.html",
    tecnico: "tecnico.html",
    presidente: "presidente.html"
  }[normalizedRole];

  setTimeout(() => {
    window.location.href = nextRoute;
  }, 450);
}

// ============================================================
// Mostrar mensagem de erro na tela
// ============================================================
function mostrarErro(mensagem) {
  // Remove erro anterior se existir
  const existente = document.querySelector(".path-error-toast");
  if (existente) existente.remove();

  const toast = document.createElement("div");
  toast.className = "path-error-toast";
  toast.textContent = mensagem;
  document.body.appendChild(toast);

  toast.animate(
    [
      { opacity: 0, transform: "translateY(20px)" },
      { opacity: 1, transform: "translateY(0)" }
    ],
    { duration: 300, easing: "ease-out", fill: "both" }
  );

  setTimeout(() => {
    toast.animate(
      [
        { opacity: 1, transform: "translateY(0)" },
        { opacity: 0, transform: "translateY(20px)" }
      ],
      { duration: 300, easing: "ease-out", fill: "both" }
    ).onfinish = () => toast.remove();
  }, 4000);
}

// ============================================================
// Card selection + events
// ============================================================
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

// ---------- Boot ----------
applyTheme();
fixLogoSize();
preventBrokenImageText();
bindEvents();

if (window.lucide) {
  window.lucide.createIcons({
    strokeWidth: 1.8
  });
}

// Verificar autenticação ao carregar
verificarAuth();
