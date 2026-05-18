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
    } else if (normalizedRole === "tecnico" || normalizedRole === "presidente") {
      setTimeout(() => {
        document.body.classList.remove("path-saving");
        document.querySelector('.world-status')?.classList.add('hidden');
        document.querySelector('.paths')?.classList.add('hidden');
        document.querySelector('.notice')?.classList.add('hidden');
        document.querySelector('.details')?.classList.add('hidden');
        document.querySelector('.bottom-message')?.classList.add('hidden');
        mostrarToast('Próxima tela futura: ' + normalizedRole + '.html', 'info');
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
  baseAttributes: {
    "Finalização": 78,
    "Físico": 68,
    "Passe": 62,
    "Marcação": 45,
    "Velocidade": 82,
    "Visão de jogo": 70
  },
  attributes: {
    "Finalização": 78,
    "Físico": 68,
    "Passe": 62,
    "Marcação": 45,
    "Velocidade": 82,
    "Visão de jogo": 70
  },
  bodyModifiers: {
    "Finalização": 0,
    "Físico": 0,
    "Passe": 0,
    "Marcação": 0,
    "Velocidade": 0,
    "Visão de jogo": 0
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

const countries = ["Afeganistão", "África do Sul", "Albânia", "Alemanha", "Andorra", "Angola", "Antígua e Barbuda", "Arábia Saudita", "Argélia", "Argentina", "Armênia", "Austrália", "Áustria", "Azerbaijão", "Bahamas", "Bahrein", "Bangladesh", "Barbados", "Bélgica", "Belize", "Benim", "Bielorrússia", "Bolívia", "Bósnia e Herzegovina", "Botsuana", "Brasil", "Brunei", "Bulgária", "Burkina Faso", "Burundi", "Butão", "Cabo Verde", "Camarões", "Camboja", "Canadá", "Catar", "Cazaquistão", "Chade", "Chile", "China", "Chipre", "Colômbia", "Comores", "Congo", "Coreia do Norte", "Coreia do Sul", "Costa do Marfim", "Costa Rica", "Croácia", "Cuba", "Dinamarca", "Djibuti", "Dominica", "Egito", "El Salvador", "Emirados Árabes Unidos", "Equador", "Eritreia", "Eslováquia", "Eslovênia", "Espanha", "Estados Unidos", "Estônia", "Eswatini", "Etiópia", "Fiji", "Filipinas", "Finlândia", "França", "Gabão", "Gâmbia", "Gana", "Geórgia", "Granada", "Grécia", "Guatemala", "Guiana", "Guiné", "Guiné Equatorial", "Guiné-Bissau", "Haiti", "Honduras", "Hungria", "Iêmen", "Ilhas Marshall", "Ilhas Salomão", "Índia", "Indonésia", "Irã", "Iraque", "Irlanda", "Islândia", "Israel", "Itália", "Jamaica", "Japão", "Jordânia", "Kiribati", "Kosovo", "Kuwait", "Laos", "Lesoto", "Letônia", "Líbano", "Libéria", "Líbia", "Liechtenstein", "Lituânia", "Luxemburgo", "Macedônia do Norte", "Madagascar", "Malásia", "Malawi", "Maldivas", "Mali", "Malta", "Marrocos", "Maurício", "Mauritânia", "México", "Micronésia", "Moçambique", "Moldávia", "Mônaco", "Mongólia", "Montenegro", "Myanmar", "Namíbia", "Nauru", "Nepal", "Nicarágua", "Níger", "Nigéria", "Noruega", "Nova Zelândia", "Omã", "Países Baixos", "Palau", "Panamá", "Papua-Nova Guiné", "Paquistão", "Paraguai", "Peru", "Polônia", "Portugal", "Quênia", "Quirguistão", "Reino Unido", "República Centro-Africana", "República Democrática do Congo", "República Dominicana", "República Tcheca", "Romênia", "Ruanda", "Rússia", "Samoa", "San Marino", "Santa Lúcia", "São Cristóvão e Névis", "São Tomé e Príncipe", "São Vicente e Granadinas", "Seicheles", "Senegal", "Serra Leoa", "Sérvia", "Singapura", "Síria", "Somália", "Sri Lanka", "Sudão", "Sudão do Sul", "Suécia", "Suíça", "Suriname", "Tailândia", "Taiwan", "Tajiquistão", "Tanzânia", "Timor-Leste", "Togo", "Tonga", "Trinidad e Tobago", "Tunísia", "Turcomenistão", "Turquia", "Tuvalu", "Ucrânia", "Uganda", "Uruguai", "Uzbequistão", "Vanuatu", "Vaticano", "Venezuela", "Vietnã", "Zâmbia", "Zimbábue"];

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

function parseHeightMeters(value) {
  const normalized = String(value || '').replace(',', '.').replace(/[^0-9.]/g, '');
  const meters = Number(normalized);
  return Number.isFinite(meters) && meters >= 1.1 && meters <= 2.3 ? meters : null;
}

function parseWeightKg(value) {
  const kg = Number(String(value || '').replace(/\D/g, ''));
  return Number.isFinite(kg) && kg >= 35 && kg <= 160 ? kg : null;
}

function emptyModifiers() {
  return {
    "Finalização": 0,
    "Físico": 0,
    "Passe": 0,
    "Marcação": 0,
    "Velocidade": 0,
    "Visão de jogo": 0
  };
}

function addWeight(map, key, value) {
  map[key] = (map[key] || 0) + value;
}

function distributePoints(total, weights) {
  const result = {};
  const entries = Object.entries(weights).filter(([, weight]) => weight > 0);
  const weightSum = entries.reduce((sum, [, weight]) => sum + weight, 0);
  if (!total || !entries.length || !weightSum) return result;

  const fractions = entries.map(([key, weight]) => {
    const exact = total * (weight / weightSum);
    const base = Math.floor(exact);
    result[key] = base;
    return { key, rest: exact - base };
  });

  let used = Object.values(result).reduce((sum, value) => sum + value, 0);
  fractions.sort((a, b) => b.rest - a.rest);

  for (const item of fractions) {
    if (used >= total) break;
    result[item.key] += 1;
    used += 1;
  }

  return result;
}

function calculateBodyModifiers(heightMeters, weightKg) {
  const modifiers = emptyModifiers();
  if (!heightMeters && !weightKg) return modifiers;

  const positiveWeights = {};
  const negativeWeights = {};
  let severity = 0;

  if (heightMeters) {
    if (heightMeters >= 1.93) {
      severity += 2;
      addWeight(positiveWeights, 'Físico', 3);
      addWeight(positiveWeights, 'Marcação', 2);
      addWeight(positiveWeights, 'Finalização', 2);
      addWeight(negativeWeights, 'Velocidade', 3);
      addWeight(negativeWeights, 'Passe', 1);
      addWeight(negativeWeights, 'Visão de jogo', 1);
    } else if (heightMeters >= 1.86) {
      severity += 1;
      addWeight(positiveWeights, 'Físico', 2);
      addWeight(positiveWeights, 'Marcação', 1);
      addWeight(positiveWeights, 'Finalização', 1);
      addWeight(negativeWeights, 'Velocidade', 2);
      addWeight(negativeWeights, 'Passe', 1);
    } else if (heightMeters <= 1.62) {
      severity += 2;
      addWeight(positiveWeights, 'Velocidade', 3);
      addWeight(positiveWeights, 'Passe', 2);
      addWeight(positiveWeights, 'Visão de jogo', 2);
      addWeight(negativeWeights, 'Físico', 3);
      addWeight(negativeWeights, 'Marcação', 2);
      addWeight(negativeWeights, 'Finalização', 1);
    } else if (heightMeters <= 1.70) {
      severity += 1;
      addWeight(positiveWeights, 'Velocidade', 2);
      addWeight(positiveWeights, 'Passe', 1);
      addWeight(positiveWeights, 'Visão de jogo', 1);
      addWeight(negativeWeights, 'Físico', 2);
      addWeight(negativeWeights, 'Marcação', 1);
    }
  }

  if (heightMeters && weightKg) {
    const bmi = weightKg / (heightMeters * heightMeters);

    if (bmi >= 29) {
      severity += 3;
      addWeight(positiveWeights, 'Físico', 3);
      addWeight(positiveWeights, 'Finalização', 3);
      addWeight(positiveWeights, 'Marcação', 1);
      addWeight(negativeWeights, 'Velocidade', 5);
      addWeight(negativeWeights, 'Passe', 1);
      addWeight(negativeWeights, 'Visão de jogo', 1);
    } else if (bmi >= 26) {
      severity += 2;
      addWeight(positiveWeights, 'Físico', 2);
      addWeight(positiveWeights, 'Finalização', 2);
      addWeight(positiveWeights, 'Marcação', 1);
      addWeight(negativeWeights, 'Velocidade', 3);
      addWeight(negativeWeights, 'Passe', 1);
      addWeight(negativeWeights, 'Visão de jogo', 1);
    } else if (bmi >= 24.5) {
      severity += 1;
      addWeight(positiveWeights, 'Físico', 2);
      addWeight(positiveWeights, 'Finalização', 1);
      addWeight(negativeWeights, 'Velocidade', 2);
      addWeight(negativeWeights, 'Visão de jogo', 1);
    } else if (bmi <= 18.5) {
      severity += 3;
      addWeight(positiveWeights, 'Velocidade', 4);
      addWeight(positiveWeights, 'Passe', 2);
      addWeight(positiveWeights, 'Visão de jogo', 1);
      addWeight(negativeWeights, 'Físico', 4);
      addWeight(negativeWeights, 'Finalização', 2);
      addWeight(negativeWeights, 'Marcação', 1);
    } else if (bmi <= 20.5) {
      severity += 2;
      addWeight(positiveWeights, 'Velocidade', 3);
      addWeight(positiveWeights, 'Passe', 1);
      addWeight(positiveWeights, 'Visão de jogo', 1);
      addWeight(negativeWeights, 'Físico', 3);
      addWeight(negativeWeights, 'Finalização', 1);
      addWeight(negativeWeights, 'Marcação', 1);
    } else if (bmi <= 21.5) {
      severity += 1;
      addWeight(positiveWeights, 'Velocidade', 2);
      addWeight(positiveWeights, 'Passe', 1);
      addWeight(negativeWeights, 'Físico', 2);
      addWeight(negativeWeights, 'Marcação', 1);
    }
  } else if (weightKg) {
    if (weightKg >= 90) {
      severity += 3;
      addWeight(positiveWeights, 'Físico', 2);
      addWeight(positiveWeights, 'Finalização', 2);
      addWeight(positiveWeights, 'Marcação', 1);
      addWeight(negativeWeights, 'Velocidade', 4);
      addWeight(negativeWeights, 'Passe', 1);
    } else if (weightKg >= 82) {
      severity += 2;
      addWeight(positiveWeights, 'Físico', 2);
      addWeight(positiveWeights, 'Finalização', 1);
      addWeight(negativeWeights, 'Velocidade', 2);
      addWeight(negativeWeights, 'Visão de jogo', 1);
    } else if (weightKg <= 60) {
      severity += 2;
      addWeight(positiveWeights, 'Velocidade', 3);
      addWeight(positiveWeights, 'Passe', 1);
      addWeight(negativeWeights, 'Físico', 3);
      addWeight(negativeWeights, 'Finalização', 1);
    }
  }

  const total = Math.max(0, Math.min(5, Math.round(severity)));
  if (!total) return modifiers;

  const positive = distributePoints(total, positiveWeights);
  const negative = distributePoints(total, negativeWeights);

  Object.entries(positive).forEach(([key, value]) => {
    modifiers[key] = (modifiers[key] || 0) + value;
  });

  Object.entries(negative).forEach(([key, value]) => {
    modifiers[key] = (modifiers[key] || 0) - value;
  });

  return modifiers;
}

function updatePlayerCreationPreview() {
  const position = playerCreationState.position;
  const archetype = playerCreationState.archetype;
  const presetKey = `${position}:${archetype}`;
  const baseAttributes = attributePresets[presetKey] || attributePresets['Atacante:Finalizador'];
  playerCreationState.baseAttributes = { ...baseAttributes };

  const heightMeters = parseHeightMeters(document.getElementById('playerHeight')?.value);
  const weightKg = parseWeightKg(document.getElementById('playerWeight')?.value);
  const bodyModifiers = calculateBodyModifiers(heightMeters, weightKg);
  playerCreationState.bodyModifiers = bodyModifiers;
  playerCreationState.attributes = Object.fromEntries(
    Object.entries(baseAttributes).map(([name, value]) => {
      const modifier = bodyModifiers[name] || 0;
      return [name, Math.max(1, Math.min(99, value + modifier))];
    })
  );

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
      const modifier = bodyModifiers[name] || 0;
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
    nome: document.getElementById('playerName')?.value?.trim() || '',
    apelido: document.getElementById('playerNickname')?.value?.trim() || '',
    idade: Number(document.getElementById('playerAge')?.value || 18),
    naturalidade: document.getElementById('playerNation')?.value || '',
    nacionalidade: document.getElementById('playerNation')?.value || '',
    pe_dominante: document.getElementById('playerFoot')?.value || 'Direito',
    altura: document.getElementById('playerHeight')?.value || '',
    peso: document.getElementById('playerWeight')?.value || '',
    posicao: playerCreationState.position,
    arquetipo: playerCreationState.archetype,
    atributos_base: playerCreationState.baseAttributes,
    modificadores_corpo: playerCreationState.bodyModifiers,
    atributos: playerCreationState.attributes,
    created_at: new Date().toISOString()
  };

  if (!playerData.nome) {
    mostrarToast('Informe o nome do jogador.', 'error');
    return;
  }

  const alturaPreenchida = Boolean(playerData.altura);
  const pesoPreenchido = Boolean(playerData.peso);
  if (alturaPreenchida && !parseHeightMeters(playerData.altura)) {
    mostrarToast('Altura inválida. Use o formato 1,78.', 'error');
    return;
  }
  if (pesoPreenchido && !parseWeightKg(playerData.peso)) {
    mostrarToast('Peso inválido. Use o formato 72 kg.', 'error');
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
                mostrarToast('Seu caminho atual é: ' + caminho.toUpperCase(), 'info');
            }
        }
    } catch (e) {
        console.error('Erro ao buscar caminho:', e);
    }
});
