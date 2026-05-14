import { signUpUser, signInUser, resetPassword, getCurrentSession } from './authService.js';

  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const senha = document.getElementById('loginSenha').value;

    try {
      await signInUser(email, senha);
      alert('Login efetuado com sucesso!');
      window.location.href = 'dashboard.html'; // Substitua pela próxima tela
    } catch (error) {
      alert('Erro no login: ' + error.message);
    }
  });

  document.getElementById('cadastroForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('cadastroUsuario').value;
    const email = document.getElementById('cadastroEmail').value;
    const senha = document.getElementById('cadastroSenha').value;
    const confirmSenha = document.getElementById('cadastroConfirmaSenha').value;
    const aceite = document.getElementById('aceiteCadastro').checked;

    if (!aceite) {
      alert('Você deve aceitar os Termos e Políticas.');
      return;
    }

    if (senha !== confirmSenha) {
      alert('As senhas não conferem.');
      return;
    }

    try {
      await signUpUser(email, senha, username);
      alert('Cadastro realizado com sucesso! Verifique seu e-mail.');
      // Pode redirecionar ou trocar a aba para login
    } catch (error) {
      alert('Erro no cadastro: ' + error.message);
    }
  });

  const recuperarForm = document.getElementById('recuperarForm');
  if (recuperarForm) {
    recuperarForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('recEmail').value;
      try {
        await resetPassword(email);
        alert('E-mail de recuperação enviado!');
      } catch (error) {
        alert('Erro ao recuperar senha: ' + error.message);
      }
    });
  }

  // Verifica se o usuário já tem uma sessão
  getCurrentSession().then(session => {
    if(session) {
      window.location.href = 'dashboard.html'; // Redireciona caso já esteja logado
    }
  }).catch(e => console.error(e));
urrentSession } from './authService.js';

function aplicarTema() {
  const hora = new Date().getHours();
  document.body.className = hora >= 18 || hora < 6 ? "night" : "day";
}

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

  document.querySelectorAll("form").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();

      const aceiteCadastro = document.getElementById("aceiteCadastro");
      if (form.id === "cadastroForm" && aceiteCadastro && !aceiteCadastro.checked) {
        aceiteCadastro.animate(
          [
            { transform: "translateX(0)" },
            { transform: "translateX(-4px)" },
            { transform: "translateX(4px)" },
            { transform: "translateX(0)" }
          ],
          { duration: 220, easing: "ease-out" }
        );
        return;
      }

      const botao = form.querySelector(".btn-primary");
      if (!botao) return;

      botao.animate(
        [
          { transform: "translateY(0)" },
          { transform: "translateY(-2px)" },
          { transform: "translateY(0)" }
        ],
        {
          duration: 220,
          easing: "ease-out"
        }
      );
    });
  });
}

aplicarTema();
inicializarEventos();
animarEntradaInicial();
animarBotoes();
animarInputs();

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

