// ============================================================
// Futbrowser — Login / Cadastro / Recuperação
// ============================================================
// Integração com Supabase Auth.
// Fluxo:
//   1. Cadastro  → supabase.auth.signUp → trigger cria row em "usuarios"
//   2. Login     → supabase.auth.signInWithPassword
//   3. Pós-login → consulta "usuarios.caminho"
//      • caminho NULL  → redireciona para escolha-caminho.html
//      • caminho SET   → redireciona para {caminho}.html
// ============================================================

// ---------- Tema automático (dia / noite) ----------
function aplicarTema() {
  const hora = new Date().getHours();
  document.body.className = hora >= 18 || hora < 6 ? "night" : "day";
}

// ---------- Animações de entrada ----------
function animarEntradaInicial() {
  const animacoes = [
    {
      el: document.querySelector(".brand"),
      keyframes: [
        { opacity: 0, transform: "translateY(-10px)" },
        { opacity: 1, transform: "translateY(0)" }
      ],
      options: { duration: 520, easing: "cubic-bezier(.2,.8,.2,1)", fill: "both" }
    },
    {
      el: document.querySelector(".menu"),
      keyframes: [
        { opacity: 0 },
        { opacity: 1 }
      ],
      options: { duration: 520, delay: 80, easing: "ease-out", fill: "both" }
    },
    {
      el: document.querySelector(".hero"),
      keyframes: [
        { opacity: 0 },
        { opacity: 1 }
      ],
      options: { duration: 650, delay: 120, easing: "ease-out", fill: "both" }
    },
    {
      el: document.querySelector(".login-card"),
      keyframes: [
        { opacity: 0, transform: "translateY(18px)" },
        { opacity: 1, transform: "translateY(0)" }
      ],
      options: { duration: 620, delay: 160, easing: "cubic-bezier(.2,.8,.2,1)", fill: "both" }
    }
  ];

  animacoes.forEach(({ el, keyframes, options }) => {
    if (el) el.animate(keyframes, options);
  });

  document.querySelectorAll(".role").forEach((card, index) => {
    card.animate(
      [
        { opacity: 0, transform: "translateY(12px)" },
        { opacity: 1, transform: "translateY(0)" }
      ],
      {
        duration: 420,
        delay: 280 + index * 70,
        easing: "cubic-bezier(.2,.8,.2,1)",
        fill: "both"
      }
    );
  });
}

// ---------- Troca de tela (login / cadastro / recuperar) ----------
function animarTrocaTela(nome) {
  const ativaAtual = document.querySelector(".form-screen.active");
  const proxima = document.getElementById("screen-" + nome);

  if (!proxima || ativaAtual === proxima) return;

  const card = document.querySelector(".login-card");

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.screen === nome);
  });

  if (card) {
    card.animate(
      [
        { boxShadow: "0 0 0 1px rgba(46,179,65,0.10), 0 20px 48px rgba(0,0,0,.16)" },
        { boxShadow: "0 0 0 1px rgba(46,179,65,0.32), 0 0 24px rgba(46,179,65,.16), 0 20px 48px rgba(0,0,0,.16)" },
        { boxShadow: "0 0 0 1px rgba(46,179,65,0.10), 0 20px 48px rgba(0,0,0,.16)" }
      ],
      {
        duration: 430,
        easing: "cubic-bezier(.2,.8,.2,1)"
      }
    );
  }

  const entrada = [
    { opacity: 0, transform: "translateX(18px)" },
    { opacity: 1, transform: "translateX(0)" }
  ];

  const saida = [
    { opacity: 1, transform: "translateX(0)" },
    { opacity: 0, transform: "translateX(-18px)" }
  ];

  if (ativaAtual) {
    const animacaoSaida = ativaAtual.animate(saida, {
      duration: 180,
      easing: "cubic-bezier(.4,0,.2,1)",
      fill: "both"
    });

    animacaoSaida.onfinish = () => {
      ativaAtual.classList.remove("active");
      proxima.classList.add("active");

      proxima.animate(entrada, {
        duration: 280,
        easing: "cubic-bezier(.2,.8,.2,1)",
        fill: "both"
      });
    };
  } else {
    proxima.classList.add("active");
    proxima.animate(entrada, {
      duration: 280,
      easing: "cubic-bezier(.2,.8,.2,1)",
      fill: "both"
    });
  }
}

function mostrarTela(nome) {
  animarTrocaTela(nome);
}

// ---------- Micro-animações ----------
function animarBotoes() {
  document.querySelectorAll(".btn, .tab, .forgot").forEach((botao) => {
    botao.addEventListener("pointerdown", () => {
      botao.animate(
        [
          { transform: "scale(1)" },
          { transform: "scale(0.985)" },
          { transform: "scale(1)" }
        ],
        {
          duration: 150,
          easing: "ease-out"
        }
      );
    });
  });
}

function animarInputs() {
  document.querySelectorAll(".input input").forEach((input) => {
    const caixa = input.closest(".input");

    input.addEventListener("focus", () => {
      caixa.animate(
        [
          { boxShadow: "0 0 0 rgba(41,168,58,0)" },
          { boxShadow: "0 0 0 3px rgba(41,168,58,.14)" }
        ],
        {
          duration: 180,
          easing: "ease-out",
          fill: "forwards"
        }
      );
    });

    input.addEventListener("blur", () => {
      caixa.animate(
        [
          { boxShadow: "0 0 0 3px rgba(41,168,58,.14)" },
          { boxShadow: "0 0 0 rgba(41,168,58,0)" }
        ],
        {
          duration: 180,
          easing: "ease-out",
          fill: "forwards"
        }
      );
    });
  });
}

// ============================================================
// Feedback visual inline — mostra msg de erro/sucesso no form
// ============================================================
function mostrarFeedback(formEl, mensagem, tipo) {
  // tipo: "erro" | "sucesso"
  let fb = formEl.querySelector(".form-feedback");
  if (!fb) {
    fb = document.createElement("div");
    fb.className = "form-feedback";
    // Insere antes do primeiro campo
    const primeiroField = formEl.querySelector(".field");
    if (primeiroField) {
      formEl.insertBefore(fb, primeiroField);
    } else {
      formEl.prepend(fb);
    }
  }

  fb.textContent = mensagem;
  fb.className = "form-feedback " + (tipo === "erro" ? "feedback-erro" : "feedback-sucesso");
  fb.style.display = "block";

  fb.animate(
    [
      { opacity: 0, transform: "translateY(-6px)" },
      { opacity: 1, transform: "translateY(0)" }
    ],
    { duration: 260, easing: "ease-out", fill: "both" }
  );
}

function limparFeedback(formEl) {
  const fb = formEl.querySelector(".form-feedback");
  if (fb) fb.style.display = "none";
}

// ============================================================
// Supabase — Login
// ============================================================
async function fazerLogin(email, senha, botao) {
  botao.disabled = true;
  botao.textContent = "ENTRANDO...";

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email,
    password: senha
  });

  if (error) {
    botao.disabled = false;
    botao.textContent = "ENTRAR";

    let msg = "Erro ao fazer login. Tente novamente.";
    if (error.message.includes("Invalid login")) {
      msg = "E-mail ou senha incorretos.";
    } else if (error.message.includes("Email not confirmed")) {
      msg = "Confirme seu e-mail antes de entrar.";
    }
    mostrarFeedback(botao.closest("form"), msg, "erro");
    return;
  }

  // Login OK — verificar caminho
  await verificarCaminhoERedirecionar(data.user.id);
}

// ============================================================
// Supabase — Cadastro
// ============================================================
async function fazerCadastro(usuario, email, senha, botao) {
  botao.disabled = true;
  botao.textContent = "CRIANDO CONTA...";

  const { data, error } = await supabase.auth.signUp({
    email: email,
    password: senha,
    options: {
      data: {
        username: usuario
      }
    }
  });

  if (error) {
    botao.disabled = false;
    botao.textContent = "CADASTRAR MINHA CONTA";

    let msg = "Erro ao criar conta. Tente novamente.";
    if (error.message.includes("already registered")) {
      msg = "Este e-mail já está cadastrado.";
    } else if (error.message.includes("Password")) {
      msg = "A senha deve ter pelo menos 6 caracteres.";
    }
    mostrarFeedback(botao.closest("form"), msg, "erro");
    return;
  }

  // Se o Supabase exigir confirmação de e-mail, o session pode ser null
  if (!data.session) {
    botao.disabled = false;
    botao.textContent = "CADASTRAR MINHA CONTA";
    mostrarFeedback(
      botao.closest("form"),
      "Conta criada! Verifique seu e-mail para ativar sua conta.",
      "sucesso"
    );
    return;
  }

  // Cadastro + auto-login OK → redirecionar para escolha de caminho
  await verificarCaminhoERedirecionar(data.user.id);
}

// ============================================================
// Supabase — Recuperar senha
// ============================================================
async function recuperarSenha(email, botao) {
  botao.disabled = true;
  botao.textContent = "ENVIANDO...";

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + "/index.html"
  });

  botao.disabled = false;
  botao.textContent = "ENVIAR RECUPERAÇÃO";

  if (error) {
    mostrarFeedback(botao.closest("form"), "Erro ao enviar recuperação. Verifique o e-mail.", "erro");
    return;
  }

  mostrarFeedback(
    botao.closest("form"),
    "Instruções de recuperação enviadas para seu e-mail!",
    "sucesso"
  );
}

// ============================================================
// Verificar caminho do usuário e redirecionar
// ============================================================
async function verificarCaminhoERedirecionar(userId) {
  const { data: perfil, error } = await supabase
    .from("usuarios")
    .select("caminho")
    .eq("id", userId)
    .single();

  if (error) {
    // Se der erro ao buscar perfil, mandar para escolha mesmo assim
    console.warn("Erro ao buscar perfil:", error.message);
    window.location.href = "escolha-caminho.html";
    return;
  }

  const caminho = perfil?.caminho;

  if (caminho && ["jogador", "tecnico", "presidente"].includes(caminho)) {
    // Cache local
    localStorage.setItem("futbrowser_selected_path", caminho);
    window.location.href = caminho + ".html";
  } else {
    window.location.href = "escolha-caminho.html";
  }
}

// ============================================================
// Verificar sessão existente ao carregar a página
// ============================================================
async function verificarSessaoExistente() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    // Usuário já logado — redirecionar
    await verificarCaminhoERedirecionar(session.user.id);
  }
}

// ============================================================
// Inicializar eventos de formulário (agora com Supabase)
// ============================================================
function inicializarEventos() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => mostrarTela(tab.dataset.screen));
  });

  document.getElementById("btnCreateAccount").addEventListener("click", () => {
    mostrarTela("cadastro");
  });

  document.getElementById("btnForgot").addEventListener("click", () => {
    mostrarTela("recuperar");
  });

  document.getElementById("btnBackLoginFromCadastro").addEventListener("click", () => {
    mostrarTela("login");
  });

  document.getElementById("btnBackLoginFromForgot").addEventListener("click", () => {
    mostrarTela("login");
  });

  document.querySelectorAll("[data-toggle-password]").forEach((botao) => {
    botao.addEventListener("click", () => {
      const input = document.getElementById(botao.dataset.togglePassword);
      input.type = input.type === "password" ? "text" : "password";

      botao.animate(
        [
          { transform: "scale(1)" },
          { transform: "scale(1.12)" },
          { transform: "scale(1)" }
        ],
        {
          duration: 180,
          easing: "ease-out"
        }
      );
    });
  });

  // ---- FORM: Login ----
  document.getElementById("loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    limparFeedback(event.target);

    const email = document.getElementById("loginEmail").value.trim();
    const senha = document.getElementById("loginSenha").value;

    if (!email || !senha) {
      mostrarFeedback(event.target, "Preencha e-mail e senha.", "erro");
      return;
    }

    const botao = event.target.querySelector(".btn-primary");
    botao.animate(
      [
        { transform: "translateY(0)" },
        { transform: "translateY(-2px)" },
        { transform: "translateY(0)" }
      ],
      { duration: 220, easing: "ease-out" }
    );

    await fazerLogin(email, senha, botao);
  });

  // ---- FORM: Cadastro ----
  document.getElementById("cadastroForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    limparFeedback(event.target);

    const aceiteCadastro = document.getElementById("aceiteCadastro");
    if (aceiteCadastro && !aceiteCadastro.checked) {
      aceiteCadastro.animate(
        [
          { transform: "translateX(0)" },
          { transform: "translateX(-4px)" },
          { transform: "translateX(4px)" },
          { transform: "translateX(0)" }
        ],
        { duration: 220, easing: "ease-out" }
      );
      mostrarFeedback(event.target, "Você precisa aceitar os termos para criar sua conta.", "erro");
      return;
    }

    const usuario = document.getElementById("cadastroUsuario").value.trim();
    const email = document.getElementById("cadastroEmail").value.trim();
    const senha = document.getElementById("cadastroSenha").value;
    const confirma = document.getElementById("cadastroConfirmaSenha").value;

    if (!usuario || !email || !senha) {
      mostrarFeedback(event.target, "Preencha todos os campos.", "erro");
      return;
    }

    if (senha !== confirma) {
      mostrarFeedback(event.target, "As senhas não coincidem.", "erro");
      return;
    }

    if (senha.length < 6) {
      mostrarFeedback(event.target, "A senha deve ter pelo menos 6 caracteres.", "erro");
      return;
    }

    const botao = event.target.querySelector(".btn-primary");
    botao.animate(
      [
        { transform: "translateY(0)" },
        { transform: "translateY(-2px)" },
        { transform: "translateY(0)" }
      ],
      { duration: 220, easing: "ease-out" }
    );

    await fazerCadastro(usuario, email, senha, botao);
  });

  // ---- FORM: Recuperar senha ----
  document.getElementById("recuperarForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    limparFeedback(event.target);

    const email = document.getElementById("recuperarEmail").value.trim();

    if (!email) {
      mostrarFeedback(event.target, "Informe seu e-mail.", "erro");
      return;
    }

    const botao = event.target.querySelector(".btn-primary");
    await recuperarSenha(email, botao);
  });
}

// ---------- Boot ----------
aplicarTema();
inicializarEventos();
animarEntradaInicial();
animarBotoes();
animarInputs();

// Verificar se já está logado
verificarSessaoExistente();

// ============================================================
// Modal: Sobre o Jogo
// ============================================================
function inicializarModalSobre() {
  const btnAbrir = document.getElementById("btnSobreJogo");
  const modal = document.getElementById("sobreModal");
  const btnFechar = document.getElementById("btnFecharSobre");

  if (!btnAbrir || !modal || !btnFechar) return;

  function abrirModal() {
    modal.classList.add("active");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");

    const caixa = modal.querySelector(".modal-box");
    if (caixa) {
      caixa.animate(
        [
          { opacity: 0, transform: "translateY(14px) scale(0.98)" },
          { opacity: 1, transform: "translateY(0) scale(1)" }
        ],
        {
          duration: 260,
          easing: "cubic-bezier(.2,.8,.2,1)",
          fill: "both"
        }
      );
    }
  }

  function fecharModal() {
    const caixa = modal.querySelector(".modal-box");

    if (caixa) {
      const animacao = caixa.animate(
        [
          { opacity: 1, transform: "translateY(0) scale(1)" },
          { opacity: 0, transform: "translateY(10px) scale(0.985)" }
        ],
        {
          duration: 180,
          easing: "ease-out",
          fill: "both"
        }
      );

      animacao.onfinish = () => {
        modal.classList.remove("active");
        modal.setAttribute("aria-hidden", "true");
        document.body.classList.remove("modal-open");
      };
    } else {
      modal.classList.remove("active");
      modal.setAttribute("aria-hidden", "true");
      document.body.classList.remove("modal-open");
    }
  }

  btnAbrir.addEventListener("click", abrirModal);
  btnFechar.addEventListener("click", fecharModal);

  modal.addEventListener("click", (event) => {
    if (event.target === modal) fecharModal();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal.classList.contains("active")) {
      fecharModal();
    }
  });
}

inicializarModalSobre();

// ============================================================
// Modais extras (Ajuda, Termos, Privacidade)
// ============================================================
function inicializarModaisExtras() {
  const mapa = [
    ["btnAjuda", "ajudaModal"],
    ["btnTermosUso", "termosModal"],
    ["btnPoliticaPrivacidade", "privacidadeModal"]
  ];

  function abrirModal(modal) {
    modal.classList.add("active");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");

    const caixa = modal.querySelector(".modal-box");
    if (caixa) {
      caixa.animate(
        [
          { opacity: 0, transform: "translateY(14px) scale(0.98)" },
          { opacity: 1, transform: "translateY(0) scale(1)" }
        ],
        {
          duration: 260,
          easing: "cubic-bezier(.2,.8,.2,1)",
          fill: "both"
        }
      );
    }
  }

  function fecharModal(modal) {
    const caixa = modal.querySelector(".modal-box");

    if (caixa) {
      const animacao = caixa.animate(
        [
          { opacity: 1, transform: "translateY(0) scale(1)" },
          { opacity: 0, transform: "translateY(10px) scale(0.985)" }
        ],
        {
          duration: 180,
          easing: "ease-out",
          fill: "both"
        }
      );

      animacao.onfinish = () => {
        modal.classList.remove("active");
        modal.setAttribute("aria-hidden", "true");
        document.body.classList.remove("modal-open");
      };
    } else {
      modal.classList.remove("active");
      modal.setAttribute("aria-hidden", "true");
      document.body.classList.remove("modal-open");
    }
  }

  mapa.forEach(([botaoId, modalId]) => {
    const botao = document.getElementById(botaoId);
    const modal = document.getElementById(modalId);

    if (!botao || !modal) return;

    botao.addEventListener("click", () => abrirModal(modal));

    modal.addEventListener("click", (event) => {
      if (event.target === modal) fecharModal(modal);
    });
  });

  document.querySelectorAll("[data-close-modal]").forEach((botao) => {
    botao.addEventListener("click", () => {
      const modal = document.getElementById(botao.dataset.closeModal);
      if (modal) fecharModal(modal);
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;

    document.querySelectorAll(".modal-overlay.active").forEach((modal) => {
      fecharModal(modal);
    });
  });
}

inicializarModaisExtras();

// ============================================================
// Data-open-modal genérico
// ============================================================
function inicializarAberturaPorDataModal() {
  document.querySelectorAll("[data-open-modal]").forEach((botao) => {
    botao.addEventListener("click", () => {
      const modal = document.getElementById(botao.dataset.openModal);
      if (!modal) return;

      modal.classList.add("active");
      modal.setAttribute("aria-hidden", "false");
      document.body.classList.add("modal-open");

      const caixa = modal.querySelector(".modal-box");
      if (caixa) {
        caixa.animate(
          [
            { opacity: 0, transform: "translateY(14px) scale(0.98)" },
            { opacity: 1, transform: "translateY(0) scale(1)" }
          ],
          {
            duration: 260,
            easing: "cubic-bezier(.2,.8,.2,1)",
            fill: "both"
          }
        );
      }
    });
  });
}

// ============================================================
// Trailer do modal Sobre
// ============================================================
function inicializarTrailerSobre() {
  const btnSobre = document.getElementById("btnSobreJogo");
  const modal = document.getElementById("sobreModal");
  const video = document.getElementById("trailerFutbrowser");

  if (!btnSobre || !modal || !video) return;

  btnSobre.addEventListener("click", () => {
    video.currentTime = 0;
    video.muted = true;
    video.play().catch(() => {});
  });

  video.addEventListener("ended", () => {
    video.pause();

    if (Number.isFinite(video.duration) && video.duration > 0) {
      video.currentTime = Math.max(video.duration - 0.04, 0);
    }
  });

  const observarFechamento = new MutationObserver(() => {
    if (!modal.classList.contains("active")) {
      video.pause();
    }
  });

  observarFechamento.observe(modal, { attributes: true, attributeFilter: ["class"] });
}

inicializarAberturaPorDataModal();
inicializarTrailerSobre();

// ============================================================
// Cards de função (visual na tela de login)
// ============================================================
function inicializarCardsDeFuncao() {
  document.querySelectorAll("[data-role-card]").forEach((card) => {
    card.addEventListener("click", () => {
      document.querySelectorAll("[data-role-card]").forEach((item) => {
        item.classList.remove("selected");
      });

      card.classList.add("selected");

      card.animate(
        [
          { transform: "translateY(-3px) scale(1)" },
          { transform: "translateY(-3px) scale(1.015)" },
          { transform: "translateY(-3px) scale(1)" }
        ],
        {
          duration: 220,
          easing: "ease-out"
        }
      );
    });

    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        card.click();
      }
    });
  });
}

inicializarCardsDeFuncao();
