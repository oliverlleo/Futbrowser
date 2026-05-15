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

    if (normalizedRole === "jogador") {
      setTimeout(() => {
        document.body.classList.remove("path-saving");
        showPlayerCreationScreen();
      }, 450);
      return;
    }

    const nextRoute = {
      tecnico: "tecnico.html",
      presidente: "presidente.html"
    }[normalizedRole];

    setTimeout(() => {
      mostrarToast(`Caminho salvo. Próxima tela futura: ${nextRoute}`, 'info');
      document.body.classList.remove("path-saving");
    }, 900);

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


const playerCreationState = {
  position: "Atacante",
  archetype: "Finalizador",
  attributes: {
    "Finalização": 78,
    "Físico": 68,
    "Passe": 62,
    "Marcação": 45,
    "Velocidade": 82,
    "Visão de jogo": 70
  }
};

const positionText = {
  Atacante: {
    preview: "Atacante",
    description: "Focado em gols e movimentação ofensiva. Sua missão é balançar as redes.",
    style: "Ofensivo e objetivo"
  },
  Meia: {
    preview: "Meia",
    description: "Controle o ritmo da partida, crie jogadas e conecte defesa e ataque.",
    style: "Criativo e cerebral"
  },
  Zagueiro: {
    preview: "Zagueiro",
    description: "Proteja sua área, vença duelos e seja a segurança do time.",
    style: "Seguro e dominante"
  },
  Goleiro: {
    preview: "Goleiro",
    description: "Defenda o gol, lidere a linha defensiva e salve partidas difíceis.",
    style: "Frio e decisivo"
  }
};

const archetypeText = {
  Driblador: "Explosão, controle de bola e coragem para quebrar linhas no um contra um.",
  Finalizador: "Instinto goleador e posicionamento letal. Sempre pronto para decidir o jogo.",
  Criador: "Visão de jogo, passe e leitura para deixar companheiros na cara do gol.",
  Raçudo: "Intensidade, entrega física e espírito competitivo em todos os lances."
};

const attributePresets = {
  "Atacante:Finalizador": { "Finalização": 78, "Físico": 68, "Passe": 62, "Marcação": 45, "Velocidade": 82, "Visão de jogo": 70 },
  "Atacante:Driblador": { "Finalização": 70, "Físico": 60, "Passe": 66, "Marcação": 42, "Velocidade": 86, "Visão de jogo": 74 },
  "Atacante:Criador": { "Finalização": 67, "Físico": 58, "Passe": 78, "Marcação": 44, "Velocidade": 76, "Visão de jogo": 84 },
  "Atacante:Raçudo": { "Finalização": 70, "Físico": 82, "Passe": 58, "Marcação": 58, "Velocidade": 76, "Visão de jogo": 62 },
  "Meia:Finalizador": { "Finalização": 70, "Físico": 62, "Passe": 78, "Marcação": 52, "Velocidade": 72, "Visão de jogo": 80 },
  "Meia:Driblador": { "Finalização": 64, "Físico": 58, "Passe": 76, "Marcação": 50, "Velocidade": 82, "Visão de jogo": 82 },
  "Meia:Criador": { "Finalização": 58, "Físico": 56, "Passe": 86, "Marcação": 54, "Velocidade": 70, "Visão de jogo": 88 },
  "Meia:Raçudo": { "Finalização": 58, "Físico": 78, "Passe": 72, "Marcação": 72, "Velocidade": 68, "Visão de jogo": 76 },
  "Zagueiro:Finalizador": { "Finalização": 52, "Físico": 82, "Passe": 58, "Marcação": 82, "Velocidade": 62, "Visão de jogo": 62 },
  "Zagueiro:Driblador": { "Finalização": 45, "Físico": 76, "Passe": 64, "Marcação": 78, "Velocidade": 72, "Visão de jogo": 66 },
  "Zagueiro:Criador": { "Finalização": 42, "Físico": 74, "Passe": 76, "Marcação": 80, "Velocidade": 60, "Visão de jogo": 76 },
  "Zagueiro:Raçudo": { "Finalização": 40, "Físico": 88, "Passe": 58, "Marcação": 86, "Velocidade": 64, "Visão de jogo": 60 },
  "Goleiro:Finalizador": { "Finalização": 35, "Físico": 76, "Passe": 58, "Marcação": 68, "Velocidade": 56, "Visão de jogo": 70 },
  "Goleiro:Driblador": { "Finalização": 30, "Físico": 70, "Passe": 64, "Marcação": 66, "Velocidade": 68, "Visão de jogo": 72 },
  "Goleiro:Criador": { "Finalização": 28, "Físico": 70, "Passe": 76, "Marcação": 68, "Velocidade": 56, "Visão de jogo": 82 },
  "Goleiro:Raçudo": { "Finalização": 25, "Físico": 84, "Passe": 58, "Marcação": 74, "Velocidade": 58, "Visão de jogo": 68 }
};

function showPlayerCreationScreen() {
  document.querySelector('.world-status')?.classList.add('hidden');
  document.querySelector('.paths')?.classList.add('hidden');
  document.querySelector('.notice')?.classList.add('hidden');
  document.querySelector('.details')?.classList.add('hidden');
  document.querySelector('.bottom-message')?.classList.add('hidden');
  document.querySelector('.creation-status')?.classList.remove('hidden');
  document.querySelector('.player-create')?.classList.remove('hidden');

  const title = document.querySelector('.title-block h1');
  const subtitle = document.querySelector('.title-block p');
  if (title) title.textContent = 'Criar seu jogador';
  if (subtitle) subtitle.textContent = 'Monte seu atleta e comece sua carreira no futebol.';

  updatePlayerCreationPreview();

  if (window.lucide) {
    window.lucide.createIcons({ strokeWidth: 1.8 });
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updatePlayerCreationPreview() {
  const position = playerCreationState.position;
  const archetype = playerCreationState.archetype;
  const presetKey = `${position}:${archetype}`;
  playerCreationState.attributes = attributePresets[presetKey] || attributePresets['Atacante:Finalizador'];

  const positionInfo = positionText[position] || positionText.Atacante;
  document.getElementById('previewPosition').textContent = positionInfo.preview;
  document.getElementById('previewDescription').textContent = positionInfo.description;
  document.getElementById('styleDescription').textContent = archetypeText[archetype] || archetypeText.Finalizador;
  document.getElementById('summaryPosition').textContent = `${position} (${archetype})`;
  document.getElementById('summaryStyle').textContent = positionInfo.style;

  const nation = document.getElementById('playerNation')?.value || 'Brasil';
  const summaryNation = document.getElementById('summaryNation');
  if (summaryNation) summaryNation.textContent = nation === 'Brasil' ? '🇧🇷 Brasil' : nation;

  const grid = document.getElementById('attributesGrid');
  if (grid) {
    grid.innerHTML = Object.entries(playerCreationState.attributes).map(([name, value]) => `
      <div class="attribute-row">
        <span>${name}</span>
        <strong>${value}</strong>
        <em><b style="width:${value}%"></b></em>
      </div>
    `).join('');
  }
}

function bindPlayerCreationEvents() {
  document.querySelectorAll('.position-options .option-pill').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.position-options .option-pill').forEach(item => item.classList.remove('active'));
      button.classList.add('active');
      playerCreationState.position = button.dataset.position;
      updatePlayerCreationPreview();
    });
  });

  document.querySelectorAll('.archetype-option').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.archetype-option').forEach(item => item.classList.remove('active'));
      button.classList.add('active');
      playerCreationState.archetype = button.dataset.archetype;
      updatePlayerCreationPreview();
    });
  });

  ['playerNation', 'playerAge', 'playerFoot', 'playerHeight', 'playerWeight'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', updatePlayerCreationPreview);
  });

  document.getElementById('createPlayerBtn')?.addEventListener('click', createPlayerCharacter);
}

async function createPlayerCharacter() {
  const session = await getCurrentSession();
  if (!session) {
    mostrarToast('Sessão expirada. Faça login novamente.', 'error');
    window.location.href = 'index.html';
    return;
  }

  const playerData = {
    user_id: session.user.id,
    nome: document.getElementById('playerName')?.value?.trim() || 'Jogador',
    apelido: document.getElementById('playerNickname')?.value?.trim() || '',
    idade: Number(document.getElementById('playerAge')?.value || 18),
    nacionalidade: document.getElementById('playerNation')?.value || 'Brasil',
    pe_dominante: document.getElementById('playerFoot')?.value || 'Direito',
    altura: document.getElementById('playerHeight')?.value || '1,78 m',
    peso: document.getElementById('playerWeight')?.value || '72 kg',
    posicao: playerCreationState.position,
    arquetipo: playerCreationState.archetype,
    atributos: playerCreationState.attributes,
    created_at: new Date().toISOString()
  };

  if (!playerData.nome) {
    mostrarToast('Informe o nome do jogador.', 'error');
    return;
  }

  mostrarToast('Criando jogador...', 'info');
  document.body.classList.add('path-saving');

  try {
    // Mantém o perfil do usuário atualizado.
    await supabase
      .from('usuarios')
      .update({ caminho: 'jogador' })
      .eq('id', session.user.id);

    // Tenta salvar em uma tabela de jogadores, se ela já existir no banco.
    // Se ainda não existir, o LocalStorage mantém os dados para não travar o fluxo visual.
    const { error } = await supabase
      .from('jogadores')
      .insert(playerData);

    if (error) {
      console.warn('Tabela jogadores não disponível ou erro ao salvar jogador:', error);
    }

    localStorage.setItem(`futbrowser_player_${session.user.id}`, JSON.stringify(playerData));
    mostrarToast('Jogador criado com sucesso!', 'success');

    setTimeout(() => {
      document.body.classList.remove('path-saving');
      mostrarToast('Próxima tela futura: jogador.html', 'info');
      // window.location.href = 'jogador.html';
    }, 900);
  } catch (error) {
    console.error('Erro ao criar jogador:', error);
    localStorage.setItem(`futbrowser_player_${session.user.id}`, JSON.stringify(playerData));
    mostrarToast('Jogador salvo localmente. Verifique a tabela no banco depois.', 'info');
    document.body.classList.remove('path-saving');
  }
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
    bindPlayerCreationEvents();

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
