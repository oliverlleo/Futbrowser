import { supabase, getCurrentSession } from '../../services/auth-service.js';
import { parseHeightMeters, parseWeightKg } from '../../utils/validators.js';
import { showToast } from '../../components/toast/toast.js';
import { createPlayer } from '../../services/player-service.js';

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
    showToast(null, 'Você precisa estar logado para escolher um caminho.', 'error');
    window.location.href = 'index.html';
    return;
  }

  document.body.classList.add("path-saving");
  showToast(null, `Salvando sua escolha como ${normalizedRole.toUpperCase()}...`, 'info');

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

    showToast(null, 'Caminho escolhido com sucesso!', 'success');

    if (normalizedRole === "jogador") {
      setTimeout(() => {
        document.body.classList.remove("path-saving");
        showPlayerCreationScreen();
      }, 450);
      return;
    } else if (normalizedRole === "tecnico" || normalizedRole === "presidente") {
      setTimeout(() => {
        document.body.classList.remove("path-saving");
        document.querySelector('.world-status')?.classList.add('hidden');
        document.querySelector('.paths')?.classList.add('hidden');
        document.querySelector('.notice')?.classList.add('hidden');
        document.querySelector('.details')?.classList.add('hidden');
        document.querySelector('.bottom-message')?.classList.add('hidden');
        showToast(null, 'Próxima tela futura: ' + normalizedRole + '.html', 'info');
      }, 450);
      return;
    }

    const nextRoute = {
      tecnico: "tecnico.html",
      presidente: "presidente.html"
    }[normalizedRole];

    setTimeout(() => {
      showToast(null, `Caminho salvo. Próxima tela futura: ${nextRoute}`, 'info');
      document.body.classList.remove("path-saving");
    }, 900);

  } catch (error) {
    console.error('Erro ao salvar caminho:', error);
    showToast(null, 'Erro ao salvar escolha. Tente novamente.', 'error');
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
  avatarIndex: 1,
  position: "Atacante",
  archetype: "Finalizador",
  baseAttributes: {},
  bodyModifiers: {},
  attributes: {}
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

const countries = ["Afeganistão", "África do Sul", "Albânia", "Alemanha", "Andorra", "Angola", "Antígua e Barbuda", "Arábia Saudita", "Argélia", "Argentina", "Armênia", "Austrália", "Áustria", "Azerbaijão", "Bahamas", "Bahrein", "Bangladesh", "Barbados", "Bélgica", "Belize", "Benim", "Bielorrússia", "Bolívia", "Bósnia e Herzegovina", "Botsuana", "Brasil", "Brunei", "Bulgária", "Burkina Faso", "Burundi", "Butão", "Cabo Verde", "Camarões", "Camboja", "Canadá", "Catar", "Cazaquistão", "Chade", "Chile", "China", "Chipre", "Colômbia", "Comores", "Congo", "Coreia do Norte", "Coreia do Sul", "Costa do Marfim", "Costa Rica", "Croácia", "Cuba", "Dinamarca", "Djibuti", "Dominica", "Egito", "El Salvador", "Emirados Árabes Unidos", "Equador", "Eritreia", "Eslováquia", "Eslovênia", "Espanha", "Estados Unidos", "Estônia", "Eswatini", "Etiópia", "Fiji", "Filipinas", "Finlândia", "França", "Gabão", "Gâmbia", "Gana", "Geórgia", "Granada", "Grécia", "Guatemala", "Guiana", "Guiné", "Guiné Equatorial", "Guiné-Bissau", "Haiti", "Honduras", "Hungria", "Iêmen", "Ilhas Marshall", "Ilhas Salomão", "Índia", "Indonésia", "Irã", "Iraque", "Irlanda", "Islândia", "Israel", "Itália", "Jamaica", "Japão", "Jordânia", "Kiribati", "Kosovo", "Kuwait", "Laos", "Lesoto", "Letônia", "Líbano", "Libéria", "Líbia", "Liechtenstein", "Lituânia", "Luxemburgo", "Macedônia do Norte", "Madagascar", "Malásia", "Malawi", "Maldivas", "Mali", "Malta", "Marrocos", "Maurício", "Mauritânia", "México", "Micronésia", "Moçambique", "Moldávia", "Mônaco", "Mongólia", "Montenegro", "Myanmar", "Namíbia", "Nauru", "Nepal", "Nicarágua", "Níger", "Nigéria", "Noruega", "Nova Zelândia", "Omã", "Países Baixos", "Palau", "Panamá", "Papua-Nova Guiné", "Paquistão", "Paraguai", "Peru", "Polônia", "Portugal", "Quênia", "Quirguistão", "Reino Unido", "República Centro-Africana", "República Democrática do Congo", "República Dominicana", "República Tcheca", "Romênia", "Ruanda", "Rússia", "Samoa", "San Marino", "Santa Lúcia", "São Cristóvão e Névis", "São Tomé e Príncipe", "São Vicente e Granadinas", "Seicheles", "Senegal", "Serra Leoa", "Sérvia", "Singapura", "Síria", "Somália", "Sri Lanka", "Sudão", "Sudão do Sul", "Suécia", "Suíça", "Suriname", "Tailândia", "Taiwan", "Tajiquistão", "Tanzânia", "Timor-Leste", "Togo", "Tonga", "Trinidad e Tobago", "Tunísia", "Turcomenistão", "Turquia", "Tuvalu", "Ucrânia", "Uganda", "Uruguai", "Uzbequistão", "Vanuatu", "Vaticano", "Venezuela", "Vietnã", "Zâmbia", "Zimbábue"];



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


function populateNationalitySelect() {
  const select = document.getElementById('playerNation');
  if (!select || select.dataset.loaded === 'true') return;

  const currentValue = select.value;
  const placeholder = '<option value="" selected>Selecione</option>';
  const options = countries
    .slice()
    .sort((a, b) => a.localeCompare(b, 'pt-BR'))
    .map(country => `<option value="${country}">${country}</option>`)
    .join('');

  select.innerHTML = placeholder + options;
  if (currentValue && countries.includes(currentValue)) select.value = currentValue;
  select.dataset.loaded = 'true';
}

function formatHeightInput(input) {
  const digits = input.value.replace(/\D/g, '').slice(0, 3);
  if (!digits) {
    input.value = '';
    return;
  }

  if (digits.length === 1) {
    input.value = digits;
    return;
  }

  input.value = `${digits[0]},${digits.slice(1)}`;
}

function normalizeHeightOnBlur(input) {
  const digits = input.value.replace(/\D/g, '').slice(0, 3);
  if (!digits) {
    input.value = '';
    return;
  }

  const padded = digits.padEnd(3, '0');
  input.value = `${padded[0]},${padded.slice(1)}`;
}

function formatWeightInput(input) {
  const digits = input.value.replace(/\D/g, '').slice(0, 3);
  input.value = digits ? `${digits} kg` : '';
}


let previewDebounceTimeout = null;
async function updatePlayerCreationPreview() {
  clearTimeout(previewDebounceTimeout);
  previewDebounceTimeout = setTimeout(async () => {
    const position = playerCreationState.position;
    const archetype = playerCreationState.archetype;
    const heightVal = document.getElementById('playerHeight')?.value || '';
    const weightVal = document.getElementById('playerWeight')?.value || '';

    // Parse strings so they are fully valid numerical representations just in case
    const pHeight = heightVal ? heightVal.replace(',', '.') : null;
    const pWeight = weightVal ? weightVal.replace(/\D/g, '') : null;

    try {
      const { data: attrData, error } = await supabase.rpc('calculate_player_attributes', {
          p_posicao: position,
          p_arquetipo: archetype,
          p_altura: pHeight,
          p_peso: pWeight
      });

      if (error) {
          console.error('Erro ao calcular atributos:', error);
          return;
      }

      playerCreationState.baseAttributes = attrData.base;
      playerCreationState.bodyModifiers = attrData.modifiers;
      playerCreationState.attributes = attrData.final;

      const positionInfo = positionText[position] || positionText.Atacante;
      document.getElementById('previewPosition').textContent = positionInfo.preview;
      document.getElementById('previewDescription').textContent = positionInfo.description;
      document.getElementById('styleDescription').textContent = archetypeText[archetype] || archetypeText.Finalizador;
      document.getElementById('summaryPosition').textContent = `${position} (${archetype})`;
      document.getElementById('summaryStyle').textContent = positionInfo.style;

      const nation = document.getElementById('playerNation')?.value || '';
      const summaryNation = document.getElementById('summaryNation');
      if (summaryNation) summaryNation.textContent = nation || 'A definir';

      const grid = document.getElementById('attributesGrid');
      if (grid) {
        grid.innerHTML = Object.entries(playerCreationState.attributes).map(([name, value]) => {
          const modifier = playerCreationState.bodyModifiers[name] || 0;
          const modClass = modifier > 0 ? 'positive' : modifier < 0 ? 'negative' : 'neutral';
          const modText = modifier > 0 ? `+${modifier}` : modifier < 0 ? `${modifier}` : '0';

          return `
            <div class="attribute-row">
              <span>${name} <small class="attr-mod ${modClass}">${modText}</small></span>
              <strong>${value}</strong>
              <em><b style="width:${value}%"></b></em>
            </div>
          `;
        }).join('');
      }
    } catch (err) {
        console.error("Failed to fetch preview from backend", err);
    }
  }, 300); // 300ms debounce
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

  const nationSelect = document.getElementById('playerNation');
  nationSelect?.addEventListener('change', updatePlayerCreationPreview);

  ['playerAge', 'playerFoot'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', updatePlayerCreationPreview);
  });

  const heightInput = document.getElementById('playerHeight');
  heightInput?.addEventListener('input', () => {
    formatHeightInput(heightInput);
    updatePlayerCreationPreview();
  });
  heightInput?.addEventListener('blur', () => {
    normalizeHeightOnBlur(heightInput);
    updatePlayerCreationPreview();
  });

  const weightInput = document.getElementById('playerWeight');
  weightInput?.addEventListener('input', () => {
    formatWeightInput(weightInput);
    updatePlayerCreationPreview();
  });
  weightInput?.addEventListener('blur', () => {
    formatWeightInput(weightInput);
    updatePlayerCreationPreview();
  });

const prevAvatarBtn = document.getElementById('prevAvatarBtn');
  const nextAvatarBtn = document.getElementById('nextAvatarBtn');
  const playerAvatarImg = document.getElementById('playerAvatarImg');

  let maxAvatars = 21; // Padrão caso não consiga descobrir

  // Descobre dinamicamente quantas imagens existem
  const checkAvatarExists = (index) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = `img/avatar/avatar${index}.webp`;
    });
  };

  const initAvatars = async () => {
    let current = 1;
    let foundMax = 0;
    while (current <= 1000) {
      const exists = await checkAvatarExists(current);
      if (exists) {
        foundMax = current;
        current++;
      } else {
        break;
      }
    }
    if (foundMax > 0) {
      maxAvatars = foundMax;
    }
  };

  // Inicia a busca assim que carregar
  initAvatars();

  const updateAvatarImage = () => {
    if (playerAvatarImg) {
      playerAvatarImg.src = `img/avatar/avatar${playerCreationState.avatarIndex}.webp`;
      // Ensure visibility is reset when a new image loads (in case it previously failed)
      playerAvatarImg.style.visibility = "visible";
      playerAvatarImg.setAttribute("alt", "Prévia do jogador");
      playerAvatarImg.removeAttribute("aria-hidden");
    }
  };

  prevAvatarBtn?.addEventListener('click', () => {
    playerCreationState.avatarIndex--;
    if (playerCreationState.avatarIndex < 1) {
      playerCreationState.avatarIndex = maxAvatars;
    }
    updateAvatarImage();
  });

  nextAvatarBtn?.addEventListener('click', () => {
    playerCreationState.avatarIndex++;
    if (playerCreationState.avatarIndex > maxAvatars) {
      playerCreationState.avatarIndex = 1;
    }
    updateAvatarImage();
  });

  document.getElementById('createPlayerBtn')?.addEventListener('click', createPlayerCharacter);
}

async function createPlayerCharacter() {
  const session = await getCurrentSession();
  if (!session) {
    showToast(null, 'Sessão expirada. Faça login novamente.', 'error');
    window.location.href = 'index.html';
    return;
  }

  const alturaBruta = document.getElementById('playerHeight')?.value || '';
  const pesoBruto = document.getElementById('playerWeight')?.value || '';

  const alturaFormatada = alturaBruta ? parseHeightMeters(alturaBruta) : null;
  const pesoFormatado = pesoBruto ? parseWeightKg(pesoBruto) : null;

  if (alturaBruta && !alturaFormatada) {
    showToast(null, 'Altura inválida. Use o formato 1,78.', 'error');
    return;
  }
  if (pesoBruto && !pesoFormatado) {
    showToast(null, 'Peso inválido. Use o formato 72 kg.', 'error');
    return;
  }

  const playerData = {
    avatar: `avatar${playerCreationState.avatarIndex}.webp`,
    nome: document.getElementById('playerName')?.value?.trim() || '',
    apelido: document.getElementById('playerNickname')?.value?.trim() || '',
    idade: Number(document.getElementById('playerAge')?.value || 18),
    naturalidade: document.getElementById('playerNation')?.value || '',
    nacionalidade: document.getElementById('playerNation')?.value || '',
    pe_dominante: document.getElementById('playerFoot')?.value || 'Direito',
    altura: alturaFormatada,
    peso: pesoFormatado,
    posicao: playerCreationState.position,
    arquetipo: playerCreationState.archetype
  };

  if (!playerData.nome) {
    showToast(null, 'Informe o nome do jogador.', 'error');
    return;
  }

  showToast(null, 'Criando jogador...', 'info');
  document.body.classList.add('path-saving');

  try {
    const novoJogadorId = await createPlayer(playerData);

    localStorage.setItem(`futbrowser_player_created`, 'true'); // Apenas flag
    showToast(null, 'Jogador criado com sucesso!', 'success');

    setTimeout(() => {
      document.body.classList.remove('path-saving');
      showToast(null, 'Próxima tela futura: jogador.html', 'info');
      // window.location.href = 'jogador.html';
    }, 900);
  } catch (error) {
    console.error('Erro ao criar jogador:', error);
    showToast(null, 'Erro ao criar jogador. O banco recusou a operação.', 'error');
    document.body.classList.remove('path-saving');
  }
}

  // showToast imported from component

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
    applyTheme();
    fixLogoSize();
    preventBrokenImageText();
    populateNationalitySelect();
    bindEvents();
    bindPlayerCreationEvents();
    updatePlayerCreationPreview();

    if (window.lucide) {
      window.lucide.createIcons({
        strokeWidth: 1.8
      });
    }
    // Verifica sessão imediatamente
    const session = await getCurrentSession();
    if (!session) {
        window.location.href = 'index.html'; // Redirecionar se não estiver logado
        return;
    }

    try {
        let caminho = null;

        // Tentar pegar do localStorage primeiro
        const profileStorageKey = `futbrowser_profile_${session.user.id}`;
        try {
            const profile = JSON.parse(localStorage.getItem(profileStorageKey) || "{}");
            if (profile.caminho) {
                caminho = profile.caminho;
            }
        } catch (e) {
            console.warn('Erro ao ler localStorage:', e);
        }

        // Se não tiver no localStorage, buscar do Supabase
        if (!caminho) {
            const { data, error } = await supabase
                .from('usuarios')
                .select('caminho')
                .eq('id', session.user.id)
                .single();

            if (!error && data && data.caminho) {
                caminho = data.caminho;
            }
        }

        if (caminho) {
            if (caminho === 'jogador') {
                showPlayerCreationScreen();
            } else if (caminho === 'tecnico' || caminho === 'presidente') {
                // If they have chosen another path, we can hide the paths section
                // or handle it gracefully.
                document.querySelector('.world-status')?.classList.add('hidden');
                document.querySelector('.paths')?.classList.add('hidden');
                document.querySelector('.notice')?.classList.add('hidden');
                document.querySelector('.details')?.classList.add('hidden');
                document.querySelector('.bottom-message')?.classList.add('hidden');
                showToast(null, 'Seu caminho atual é: ' + caminho.toUpperCase(), 'info');
            }
        }
    } catch (e) {
        console.error('Erro ao buscar caminho:', e);
    }
});
