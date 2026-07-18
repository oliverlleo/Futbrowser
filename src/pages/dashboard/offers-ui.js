import { generateInitialOffers, getOfferDetails, negotiateOffer, acceptOffer, rejectOffer, getActiveOffers, getPlayerProfile } from '../../services/offer-service.js';
import { showToast } from '../../components/toast/toast.js';

let activeOffers = [];
let currentDossier = null;
let selectedOfferId = null;
let currentPlayer = null;

const getClubImage = (name) => {
    const slug = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    return `img/clubs/${slug}.png`;
};

export async function initOffersPhase(state) {
    document.querySelector('.creation-status')?.classList.add('hidden');
    document.querySelector('.player-create')?.classList.add('hidden');
    document.querySelector('.player-offers')?.classList.remove('hidden');
    document.querySelector('.final-splash')?.classList.add('hidden');
    
    // Highlight Etapa 2 
    document.getElementById('stage2Indicator')?.classList.add('active');

    try {
        if (!state.has_offers) {
            await generateInitialOffers();
        }
        
        currentPlayer = await getPlayerProfile();
        renderCompactPlayer();
        
        await loadOffers();
        bindTabs();
    } catch (e) {
        console.error(e);
        showToast(null, 'Erro ao carregar ofertas.', 'error');
    }
}

async function loadOffers() {
    activeOffers = await getActiveOffers();
    if (!activeOffers || activeOffers.length === 0) {
        showToast(null, 'Nenhuma oferta encontrada.', 'error');
        return;
    }
    
    renderOffersSidebar(activeOffers);
    
    if (!selectedOfferId || !activeOffers.find(o => o.id === selectedOfferId)) {
        const firstActive = activeOffers.find(o => !['accepted', 'rejected', 'withdrawn', 'expired'].includes(o.status)) || activeOffers[0];
        await selectOffer(firstActive.id);
    } else {
        await selectOffer(selectedOfferId);
    }
}

export function showFinalSplash() {
    document.querySelector('.creation-status')?.classList.add('hidden');
    document.querySelector('.player-create')?.classList.add('hidden');
    document.querySelector('.player-offers')?.classList.add('hidden');
    document.querySelector('.final-splash')?.classList.remove('hidden');
    
    // As per requirement 14: Tela de contrato assinado
    const clubName = currentDossier ? currentDossier.club.name : 'seu novo clube';
    const coachName = currentDossier ? currentDossier.coach.name : 'O treinador';
    const role = currentDossier ? currentDossier.offer.current_terms.squad_role : 'o elenco';
    const imgUrl = currentDossier ? getClubImage(currentDossier.club.name) : '';
    
    document.getElementById('splashCard').innerHTML = `
        <div class="final-splash-card">
            <img src="${imgUrl}" alt="${clubName}" onerror="this.outerHTML='<div class=\\'club-crest-fallback\\' style=\\'margin:0 auto; width:80px; height:80px; font-size:2rem\\'>${clubName.substring(0,3)}</div>'" style="width:100px; height:100px; margin:0 auto 1rem auto; display:block;">
            <h2>Contrato assinado</h2>
            <h3 style="color:var(--text); margin-bottom:1rem">Bem-vindo ao ${clubName} Sub-18</h3>
            <p style="margin-bottom:2rem; color:var(--text-secondary)">
                ${coachName} espera você para sua primeira apresentação. Você chega como ${role} e terá de disputar espaço para conquistar uma vaga entre os titulares.
            </p>
            <div style="background:var(--bg-page); padding:1rem; border-radius:8px; margin-bottom:2rem; display:grid; grid-template-columns:1fr 1fr; gap:1rem; text-align:left; font-size:0.9rem">
                <div><strong>Salário:</strong> R$ ${currentDossier?.offer.current_terms.monthly_wage}</div>
                <div><strong>Duração:</strong> ${currentDossier?.offer.current_terms.duration_seasons} temp.</div>
                <div><strong>Bônus:</strong> R$ ${currentDossier?.offer.current_terms.signing_bonus}</div>
                <div><strong>Multa:</strong> R$ ${currentDossier?.offer.current_terms.release_clause}</div>
                <div><strong>Confiança:</strong> 50%</div>
                <div><strong>Moral:</strong> 100%</div>
                <div><strong>Energia:</strong> 100%</div>
            </div>
            <button class="btn-primary" onclick="window.location.reload()" style="padding: 1rem 2rem; font-size:1.1rem">Iniciar carreira</button>
        </div>
    `;
    if (window.lucide) window.lucide.createIcons();
}

function renderCompactPlayer() {
    const compactCard = document.getElementById('playerCompactCard');
    if(!currentPlayer) return;
    
    compactCard.innerHTML = `
        <img src="img/avatar/${currentPlayer.avatar}" alt="Avatar">
        <div class="info">
            <h3>${currentPlayer.nome}</h3>
            <p>
                <i data-lucide="user"></i> ${currentPlayer.idade} anos &nbsp;|&nbsp;
                <i data-lucide="map-pin"></i> ${currentPlayer.posicao} ${currentPlayer.posicao_secundaria ? '('+currentPlayer.posicao_secundaria+')' : ''} &nbsp;|&nbsp;
                <i data-lucide="crosshair"></i> ${currentPlayer.arquetipo}
            </p>
        </div>
        <div class="ovr-badge" title="Overall Rating">${currentPlayer.ovr}</div>
    `;
    if (window.lucide) window.lucide.createIcons();
}

function renderOffersSidebar(offers) {
    const list = document.getElementById('offersList');
    list.innerHTML = '';
    
    const statusMap = {
        'new': { label: 'Nova', class: 'status-new' },
        'reviewed': { label: 'Analisada', class: 'status-new' },
        'negotiating': { label: 'Negociando', class: 'status-negotiating' },
        'countered': { label: 'Contraproposta', class: 'status-countered' },
        'accepted': { label: 'Aceita', class: 'status-accepted' },
        'rejected': { label: 'Recusada', class: 'status-rejected' },
        'withdrawn': { label: 'Retirada', class: 'status-withdrawn' },
        'expired': { label: 'Expirada', class: 'status-withdrawn' }
    };

    offers.forEach(offer => {
        const club = offer.base_clubs;
        if (!club) return;
        const imgUrl = getClubImage(club.name);
        const statusInfo = offer.is_emergency ? { label: 'Emergencial', class: 'status-emergency' } : (statusMap[offer.status] || { label: offer.status, class: 'status-withdrawn' });
        
        const isClosed = ['accepted', 'rejected', 'withdrawn', 'expired'].includes(offer.status);
        
        // Req 6: escudo, nome, cidade, OVR real, reputação, compatibilidade, função, salário, postura, status
        const compat = offer.compatibility_breakdown?.compatibility_total || offer.compatibility_breakdown?.total || 0;
        
        const card = document.createElement('div');
        card.className = `offer-card ${offer.id === selectedOfferId ? 'active' : ''} ${isClosed ? 'closed' : ''}`;
        card.dataset.id = offer.id;
        
        card.innerHTML = `
            <img src="${imgUrl}" alt="${club.name}" onerror="this.outerHTML='<div class=\\'club-crest-fallback\\'>${club.name.substring(0,3)}</div>'">
            <div class="offer-card-info" style="flex:1">
                <h4 style="display:flex; justify-content:space-between">
                    <span>${club.name}</span>
                    <span style="color:var(--primary); font-weight:800">${club.ovr} OVR</span>
                </h4>
                <p style="margin-bottom:0.25rem">${club.city} | Rep: ${club.reputation} | Compat: ${compat}%</p>
                <p><strong>R$ ${offer.current_terms.monthly_wage}</strong> / ${offer.current_terms.squad_role}</p>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.25rem">
                    <span class="offer-status ${statusInfo.class}">${statusInfo.label}</span>
                    <span style="font-size:0.7rem; color:var(--text-secondary)">Postura: ${offer.internal_tolerance?.stance || 'N/A'}</span>
                </div>
            </div>
        `;
        card.onclick = async () => {
            if (!isClosed || offer.id === selectedOfferId) {
                await selectOffer(offer.id);
            } else {
                await selectOffer(offer.id); // Allows viewing but contract actions disabled
            }
        };
        list.appendChild(card);
    });
}

async function selectOffer(offerId) {
    selectedOfferId = offerId;
    document.querySelectorAll('.offer-card').forEach(c => c.classList.remove('active'));
    document.querySelector(`.offer-card[data-id="${offerId}"]`)?.classList.add('active');

    document.getElementById('offerDossier').classList.remove('hidden');
    document.getElementById('contractSidebar').classList.remove('hidden');

    try {
        currentDossier = await getOfferDetails(offerId);
        // Enrich club info from sidebar data
        const sidebarOffer = activeOffers.find(o => o.id === offerId);
        if (sidebarOffer?.base_clubs) {
            currentDossier.club.city = sidebarOffer.base_clubs.city || '';
            currentDossier.club.reputation = sidebarOffer.base_clubs.reputation || 0;
        }
        renderDossierOverview();
        renderDossierSquad();
        renderDossierAcademy();
        renderDossierCoach();
        renderContractPanel();
        if (window.lucide) window.lucide.createIcons();
    } catch(e) {
        console.error(e);
        showToast(null, 'Erro ao ler detalhes da proposta.', 'error');
    }
}

function renderDossierOverview() {
    const club = currentDossier.club;
    const compat = currentDossier.compatibility_breakdown;
    const snap = currentDossier.snapshot;
    const imgUrl = getClubImage(club.name);
    
    // Req 7: Visão Geral
    document.getElementById('dossierOverview').innerHTML = `
        <div class="dossier-header-grid">
            <img src="${imgUrl}" alt="${club.name}" onerror="this.outerHTML='<div class=\\'club-crest-fallback\\'>${club.name.substring(0,3)}</div>'">
            <div>
                <h2>${club.name}</h2>
                <p><i data-lucide="map-pin"></i> ${club.city} &nbsp;|&nbsp; Reputação: ${club.reputation}</p>
                <div style="display:flex; gap: 1rem; margin-top: 1rem;">
                    <span style="padding: 0.5rem; background: var(--bg-page); border-radius: 4px; font-weight:600"><i data-lucide="shield"></i> OVR ${club.ovr}</span>
                    <span style="padding: 0.5rem; background: var(--bg-page); border-radius: 4px; font-weight:600"><i data-lucide="scan-line"></i> Formação ${club.formation}</span>
                    <span style="padding: 0.5rem; background: var(--bg-page); border-radius: 4px; font-weight:600"><i data-lucide="activity"></i> Estilo ${club.style}</span>
                </div>
            </div>
        </div>
        
        <div style="background:var(--bg-page); padding:1rem; border-radius:8px; margin-bottom:2rem; display:flex; justify-content:space-around; text-align:center">
            <div>
                <div style="font-size:0.8rem; color:var(--text-secondary)">Compatibilidade</div>
                <strong style="font-size:1.2rem; color:var(--primary)">${compat.compatibility_total || 0}%</strong>
            </div>
            <div>
                <div style="font-size:0.8rem; color:var(--text-secondary)">Chance Estimada</div>
                <strong style="font-size:1.2rem">${snap?.chance_of_play || 'N/A'}</strong>
            </div>
            <div>
                <div style="font-size:0.8rem; color:var(--text-secondary)">Hierarquia Inicial</div>
                <strong style="font-size:1.2rem">${snap?.estimated_hierarchy || 'N/A'}</strong>
            </div>
            <div>
                <div style="font-size:0.8rem; color:var(--text-secondary)">Função Oferecida</div>
                <strong style="font-size:1.2rem">${currentDossier.offer.current_terms.squad_role}</strong>
            </div>
        </div>
        
        <h3 style="margin-bottom:1rem; border-bottom: 1px solid var(--border); padding-bottom:0.5rem">Por que este clube combina com você?</h3>
        
        <div class="compat-grid">
            <div class="compat-card">
                <i data-lucide="star"></i>
                <span>Posição (30%)</span>
                <strong>${compat.position_need_score || compat.breakdown?.position || 0} pts</strong>
                <p style="font-size:0.75rem; color:var(--text-secondary); margin-top:0.5rem">Fator: Vagas vs Concorrência</p>
            </div>
            <div class="compat-card">
                <i data-lucide="activity"></i>
                <span>Estilo de Jogo (25%)</span>
                <strong>${compat.play_style_score || compat.breakdown?.play_style || 0} pts</strong>
                <p style="font-size:0.75rem; color:var(--text-secondary); margin-top:0.5rem">Fator: Adequação Tática</p>
            </div>
            <div class="compat-card">
                <i data-lucide="crosshair"></i>
                <span>Arquétipo (20%)</span>
                <strong>${compat.archetype_score || compat.breakdown?.archetype || 0} pts</strong>
                <p style="font-size:0.75rem; color:var(--text-secondary); margin-top:0.5rem">Fator: Perfil do Jogador</p>
            </div>
            <div class="compat-card">
                <i data-lucide="users"></i>
                <span>Concorrência (15%)</span>
                <strong>${compat.competition_score || compat.breakdown?.competition || 0} pts</strong>
                <p style="font-size:0.75rem; color:var(--text-secondary); margin-top:0.5rem">Fator: OVR vs Elenco</p>
            </div>
            <div class="compat-card">
                <i data-lucide="user-check"></i>
                <span>Treinador (10%)</span>
                <strong>${compat.coach_score || compat.breakdown?.coach || 0} pts</strong>
                <p style="font-size:0.75rem; color:var(--text-secondary); margin-top:0.5rem">Fator: Preferências</p>
            </div>
        </div>
    `;
}

function renderDossierSquad() {
    const roster = currentDossier.roster || [];
    const competitors = currentDossier.competitors || [];
    const compCount = competitors.length;
    const snap = currentDossier.snapshot;
    
    let compHtml = `<p>Você não tem concorrência direta nesta posição.</p>`;
    if (compCount > 0) {
        compHtml = `<div class="squad-list">` + competitors.map(c => `
            <div class="squad-player competitor ${c.is_starter ? 'starter' : ''}">
                <div>
                    <strong>${c.name}</strong> ${c.is_starter ? '(Titular)' : '(Reserva)'}
                    <div style="font-size:0.75rem; color:var(--text-secondary)">Idade: ${c.age} | ${c.primary_position}</div>
                </div>
                <div class="ovr-badge" style="font-size:1rem; padding:0.25rem 0.5rem; background: #f59e0b" title="Diferença OVR: ${c.ovr - (currentPlayer?.ovr || 50)}">${c.ovr}</div>
            </div>
        `).join('') + `</div>`;
    }

    const starters = roster.filter(r => r.is_starter);
    const bench = roster.filter(r => !r.is_starter);

    const formatPlayer = c => `
        <div class="squad-player ${c.is_starter ? 'starter' : ''}">
            <div>
                <strong>${c.name}</strong>
                <div style="font-size:0.75rem; color:var(--text-secondary)">Idade: ${c.age} | ${c.primary_position}</div>
            </div>
            <div class="ovr-badge" style="font-size:1rem; padding:0.25rem 0.5rem">${c.ovr}</div>
        </div>
    `;

    document.getElementById('dossierSquad').innerHTML = `
        <h3 style="margin-bottom:1rem; border-bottom: 1px solid var(--border); padding-bottom:0.5rem">Concorrência na sua posição</h3>
        <div style="background:var(--bg-page); padding:1rem; border-radius:8px; margin-bottom:1rem; display:flex; justify-content:space-between">
            <div><strong>Vagas:</strong> ${snap?.slots_needed || 'N/A'}</div>
            <div><strong>Titulares:</strong> ${snap?.starters_competing || 0}</div>
            <div><strong>Reservas:</strong> ${snap?.subs_competing || 0}</div>
            <div><strong>Nível:</strong> ${snap?.competition_level || 'N/A'}</div>
            <div><strong>Chance:</strong> ${snap?.chance_of_play || 'N/A'}</div>
        </div>
        ${compHtml}
        
        <h3 style="margin-top:2rem; margin-bottom:1rem; border-bottom: 1px solid var(--border); padding-bottom:0.5rem">Titulares</h3>
        <div class="squad-list">${starters.map(formatPlayer).join('')}</div>
        
        <h3 style="margin-top:2rem; margin-bottom:1rem; border-bottom: 1px solid var(--border); padding-bottom:0.5rem">Reservas</h3>
        <div class="squad-list">${bench.map(formatPlayer).join('')}</div>
    `;
}

function renderDossierAcademy() {
    const acad = currentDossier.academy;
    // Show stars and specific modifiers
    const mods = acad.modifiers || {};
    document.getElementById('dossierAcademy').innerHTML = `
        <div class="dossier-header-grid" style="grid-template-columns: 1fr">
            <h2>Academia Nível ${acad.level_stars} Estrelas</h2>
            <p>A base dita o ritmo da sua evolução física e técnica a longo prazo.</p>
        </div>
        <div class="compat-grid" style="margin-bottom:2rem">
            <div class="compat-card"><i data-lucide="dumbbell"></i><span>Físico</span><strong>${acad.physical || acad.level_stars} ★</strong></div>
            <div class="compat-card"><i data-lucide="zap"></i><span>Velocidade</span><strong>${acad.speed || acad.level_stars} ★</strong></div>
            <div class="compat-card"><i data-lucide="star"></i><span>Técnica</span><strong>${acad.technical || acad.level_stars} ★</strong></div>
            <div class="compat-card"><i data-lucide="shield-alert"></i><span>Tática</span><strong>${acad.tactical || acad.level_stars} ★</strong></div>
            <div class="compat-card"><i data-lucide="heart-pulse"></i><span>Recuperação</span><strong>${acad.recovery || acad.level_stars} ★</strong></div>
        </div>
        
        <h3 style="margin-bottom:1rem; border-bottom: 1px solid var(--border); padding-bottom:0.5rem">Bônus de Desenvolvimento</h3>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; font-size:0.9rem">
            <div style="background:var(--bg-page); padding:1rem; border-radius:8px;">
                <strong>Força:</strong> +${mods.strength || 0}%<br>
                <strong>Resistência:</strong> +${mods.stamina || 0}%<br>
                <strong>Velocidade:</strong> +${mods.sprint_speed || 0}%<br>
                <strong>Aceleração:</strong> +${mods.acceleration || 0}%<br>
                <strong>Agilidade:</strong> +${mods.agility || 0}%<br>
            </div>
            <div style="background:var(--bg-page); padding:1rem; border-radius:8px;">
                <strong>Passe:</strong> +${mods.passing || 0}%<br>
                <strong>Domínio:</strong> +${mods.ball_control || 0}%<br>
                <strong>Drible:</strong> +${mods.dribbling || 0}%<br>
                <strong>Visão:</strong> +${mods.vision || 0}%<br>
                <strong>Posicionamento:</strong> +${mods.positioning || 0}%<br>
                <strong>Recuperação Energia:</strong> +${mods.energy_recovery || 0}%
            </div>
        </div>
    `;
}

function renderDossierCoach() {
    const coach = currentDossier.coach;
    const impacts = coach.impacts || {};
    const club = currentDossier.club;
    
    const styleDescriptions = {
        'Ofensivo': 'Mais ações de ataque e maior gasto de energia. Favorece atacantes e meias criativos.',
        'Pelas alas': 'Mais participação de pontas e laterais. Valoriza velocidade e cruzamento.',
        'Contra-ataque': 'Valorização de velocidade e decisão. Transições rápidas e poucos toques.',
        'Posse': 'Mais passe, domínio e visão. Valoriza jogadores técnicos.',
        'Recuado': 'Menos ações ofensivas. Favorece marcação e disciplina tática.',
        'Equilibrado': 'Participação mais estável. Adaptável a diferentes perfis de jogadores.'
    };
    const styleDesc = styleDescriptions[club.style] || styleDescriptions['Equilibrado'];
    
    document.getElementById('dossierCoach').innerHTML = `
        <div class="dossier-header-grid" style="grid-template-columns: 1fr">
            <h2>Treinador: ${coach.name}</h2>
            <p>Seu desenvolvimento dependerá de quão bem você se encaixa nas táticas dele.</p>
        </div>
        <div class="compat-grid">
            <div class="compat-card">
                <i data-lucide="user"></i>
                <span>Perfil</span>
                <strong>${impacts.profile || 'Equilibrado'}</strong>
            </div>
            <div class="compat-card">
                <i data-lucide="scan-line"></i>
                <span>Formação Favorita</span>
                <strong>${impacts.preferred_formation || club.formation}</strong>
            </div>
            <div class="compat-card">
                <i data-lucide="activity"></i>
                <span>Estilo Favorito</span>
                <strong>${impacts.preferred_style || club.style}</strong>
            </div>
        </div>
        
        <div style="margin-top:2rem; background:var(--bg-page); padding:1rem; border-radius:8px;">
            <strong>Impactos do Treinador:</strong><br>
            - Tolerância a falhas: ${impacts.tolerance || 'Média'}<br>
            - Impacto na Moral: ${impacts.morale_impact || 'Normal'}<br>
            - Recuperação de Confiança: ${impacts.trust_recovery || 'Normal'}<br>
            - Bônus arquétipo: ${impacts.preferred_archetype || 'Flexível'}
        </div>
        
        <h3 style="margin-top:2rem; margin-bottom:1rem; border-bottom: 1px solid var(--border); padding-bottom:0.5rem">Como você jogará neste clube</h3>
        <p style="color:var(--text-secondary)">A formação <strong>${club.formation}</strong> e o estilo <strong>${club.style}</strong> determinam a dinâmica do jogo.</p>
        <p style="color:var(--text-secondary); margin-top:0.5rem">${styleDesc}</p>
    `;
}

function renderContractPanel() {
    const terms = currentDossier.offer.current_terms;
    const offer = currentDossier.offer;
    const panel = document.getElementById('contractPanel');
    
    const isClosed = ['accepted', 'rejected', 'withdrawn', 'expired'].includes(offer.status);
    
    let actionsHtml = '';
    if (offer.status === 'accepted') {
        actionsHtml = `<button class="btn-primary" disabled style="opacity:0.6"><i data-lucide="check"></i> Contrato Assinado</button>`;
    } else if (isClosed) {
        actionsHtml = `<button class="btn-danger" disabled style="opacity:0.6"><i data-lucide="x"></i> Proposta Encerrada</button>`;
    } else {
        const remainingRounds = 3 - offer.round;
        actionsHtml = `
            <div style="text-align:center; font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.5rem; font-weight:600">Rodadas restantes: ${remainingRounds}</div>
            <button class="btn-secondary" id="btnPreviewNegotiate">Negociar (Ver Contraproposta)</button>
            <button class="btn-primary" id="btnAccept">Assinar Contrato</button>
            <button class="btn-danger" id="btnReject" style="margin-top:0.5rem; background:transparent; border:1px solid #ef4444; color:#ef4444">Recusar Proposta</button>
        `;
    }
    
    let historyHtml = '';
    const history = currentDossier.history || [];
    if (history.length > 0) {
        historyHtml = `<div class="history-box"><h4>Histórico de Negociação</h4>` + 
            history.map((h) => {
                const reqTerms = h.requested_terms || {};
                const clubTerms = h.club_response_terms || {};
                const prevTerms = h.previous_terms || {};
                return `<div class="history-item ${h.response_action === 'withdrawn' ? 'rejected' : 'countered'}">
                    <strong>Rodada ${h.round}:</strong>
                    <div style="margin-top:0.5rem; display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; font-size:0.8rem">
                        <div><strong>Sua solicitação:</strong><br>Salário: R$ ${reqTerms.monthly_wage || '?'}<br>Função: ${reqTerms.squad_role || '?'}<br>Multa: R$ ${reqTerms.release_clause || '?'}</div>
                        <div><strong>Proposta do clube:</strong><br>Salário: R$ ${clubTerms.monthly_wage || prevTerms.monthly_wage || '?'}<br>Função: ${clubTerms.squad_role || prevTerms.squad_role || '?'}<br>Multa: R$ ${clubTerms.release_clause || prevTerms.release_clause || '?'}</div>
                    </div>
                    <div style="margin-top:0.5rem; font-size:0.8rem">Resultado: <strong>${h.response_action}</strong> | Postura: <strong>${h.after_stance}</strong> | Custo: ${h.negotiation_cost} pts</div>
                </div>`;
            }).join('') + `</div>`;
    }

    // Determine role options up to +2 levels
    const roles = ['Promessa', 'Reserva', 'Rotação', 'Titular'];
    const currentRoleIdx = roles.indexOf(offer.initial_terms?.squad_role || terms.squad_role);
    const validRoles = roles.slice(currentRoleIdx, currentRoleIdx + 3);

    const sidebarOffer = activeOffers.find(o => o.id === selectedOfferId);
    const stance = sidebarOffer?.internal_tolerance?.stance || 'N/A';

    panel.innerHTML = `
        <h3>Termos do Contrato</h3>
        <div style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:1rem">Postura do Clube: <strong>${stance}</strong></div>
        <div class="contract-grid" id="contractForm">
            <div class="contract-row">
                <label>Salário Mensal</label>
                <select id="inputWage" ${isClosed ? 'disabled' : ''}>
                    <option value="${terms.monthly_wage}" selected>Manter R$ ${terms.monthly_wage}</option>
                    <option value="${Math.floor(terms.monthly_wage * 1.1)}">Aumentar 10% (R$ ${Math.floor(terms.monthly_wage * 1.1)})</option>
                    <option value="${Math.floor(terms.monthly_wage * 1.2)}">Aumentar 20% (R$ ${Math.floor(terms.monthly_wage * 1.2)})</option>
                </select>
            </div>
            
            <div class="contract-row">
                <label>Duração</label>
                <select id="inputDuration" ${isClosed ? 'disabled' : ''}>
                    <option value="1" ${terms.duration_seasons===1?'selected':''}>1 temporada</option>
                    <option value="2" ${terms.duration_seasons===2?'selected':''}>2 temporadas</option>
                    <option value="3" ${terms.duration_seasons===3?'selected':''}>3 temporadas</option>
                </select>
            </div>
            
            <div class="contract-row">
                <label>Multa Rescisória</label>
                <select id="inputClause" ${isClosed ? 'disabled' : ''}>
                    <option value="${terms.release_clause}" selected>Manter R$ ${terms.release_clause}</option>
                    <option value="${Math.floor(terms.release_clause * 0.75)}">Reduzir 25% (R$ ${Math.floor(terms.release_clause * 0.75)})</option>
                    <option value="${Math.floor(terms.release_clause * 0.50)}">Reduzir 50% (R$ ${Math.floor(terms.release_clause * 0.50)})</option>
                </select>
            </div>
            
            <div class="contract-row">
                <label>Função no Elenco</label>
                <select id="inputRole" ${isClosed ? 'disabled' : ''}>
                    ${validRoles.map(r => `<option value="${r}" ${terms.squad_role === r ? 'selected' : ''}>${r}</option>`).join('')}
                </select>
            </div>
            
            <div class="contract-row">
                <label>Luvas (Não Negociável)</label>
                <input type="text" value="R$ ${terms.signing_bonus}" disabled style="padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px; background: var(--bg-page); color: var(--text-secondary); font-family: inherit; font-size: 0.95rem;">
            </div>
        </div>

        <div class="contract-actions">
            ${actionsHtml}
        </div>
        ${historyHtml}
    `;

    document.getElementById('btnPreviewNegotiate')?.addEventListener('click', openNegotiateModal);
    document.getElementById('btnAccept')?.addEventListener('click', openAcceptModal);
    document.getElementById('btnReject')?.addEventListener('click', openRejectModal);
}

function openNegotiateModal() {
    const modal = document.getElementById('signModal');
    const terms = currentDossier.offer.current_terms;
    
    const reqWage = parseInt(document.getElementById('inputWage').value);
    const reqDur = parseInt(document.getElementById('inputDuration').value);
    const reqClause = parseInt(document.getElementById('inputClause').value);
    const reqRole = document.getElementById('inputRole').value;
    
    let changes = [];
    if(reqWage !== terms.monthly_wage) changes.push(`Salário: R$ ${terms.monthly_wage} ➔ R$ ${reqWage}`);
    if(reqDur !== terms.duration_seasons) changes.push(`Duração: ${terms.duration_seasons} ➔ ${reqDur} temp.`);
    if(reqClause !== terms.release_clause) changes.push(`Multa: R$ ${terms.release_clause} ➔ R$ ${reqClause}`);
    if(reqRole !== terms.squad_role) changes.push(`Função: ${terms.squad_role} ➔ ${reqRole}`);
    
    if(changes.length === 0) {
        showToast(null, 'Altere algum termo antes de negociar.', 'warning');
        return;
    }

    const body = document.getElementById('signModalBody');
    body.innerHTML = `
        <h3 style="margin-bottom:1rem">Resumo da Contraproposta</h3>
        <p style="color:var(--text-secondary); margin-bottom:1rem">Você está solicitando as seguintes alterações. O clube avaliará o custo total dessas exigências com base na postura atual (${activeOffers.find(o => o.id === selectedOfferId)?.internal_tolerance?.stance || 'N/A'}).</p>
        <ul style="background:var(--bg-page); padding:1rem 2rem; border-radius:8px;">
            ${changes.map(c => `<li style="margin-bottom:0.5rem"><strong>${c}</strong></li>`).join('')}
        </ul>
        <p style="margin-top:1rem; font-size:0.85rem; color:var(--text-secondary)">Atenção: Você tem ${3 - currentDossier.offer.round} rodadas restantes. Se o clube rejeitar, a oferta pode ser encerrada.</p>
    `;
    
    document.querySelector('#signModal .modal-header h2').innerText = 'Enviar Contraproposta';
    document.querySelector('#signModal .modal-warning').classList.add('hidden');
    document.getElementById('btnConfirmSign').innerText = 'Enviar';
    
    modal.classList.remove('hidden');
    
    document.getElementById('btnConfirmSign').onclick = async () => {
        const btn = document.getElementById('btnConfirmSign');
        btn.disabled = true;
        btn.innerHTML = 'Enviando...';
        try {
            await negotiateOffer(selectedOfferId, {
                monthly_wage: reqWage,
                duration_seasons: reqDur,
                release_clause: reqClause,
                squad_role: reqRole,
                signing_bonus: terms.signing_bonus
            });
            showToast(null, `Contraproposta enviada!`, 'success');
            modal.classList.add('hidden');
            await loadOffers(); // Refresh
        } catch(e) {
            showToast(null, e.message, 'error');
            btn.disabled = false;
            btn.innerHTML = 'Enviar';
        }
    };
    document.getElementById('btnCancelSign').onclick = () => modal.classList.add('hidden');
}

function openAcceptModal() {
    const modal = document.getElementById('signModal');
    const terms = currentDossier.offer.current_terms;
    const body = document.getElementById('signModalBody');
    
    body.innerHTML = `
        <div class="contract-grid" style="margin-bottom:1rem">
            <div class="contract-row"><strong>Clube:</strong> ${currentDossier.club.name}</div>
            <div class="contract-row"><strong>Salário:</strong> R$ ${terms.monthly_wage}</div>
            <div class="contract-row"><strong>Luvas:</strong> R$ ${terms.signing_bonus}</div>
            <div class="contract-row"><strong>Duração:</strong> ${terms.duration_seasons} Temporadas</div>
            <div class="contract-row"><strong>Multa:</strong> R$ ${terms.release_clause}</div>
            <div class="contract-row"><strong>Papel:</strong> ${terms.squad_role}</div>
        </div>
        <div style="background:rgba(16, 185, 129, 0.1); padding:1rem; border-radius:8px; margin-bottom:1rem; border-left:3px solid #10b981">
            <strong>Compatibilidade:</strong> ${currentDossier.compatibility_breakdown?.compatibility_total || 0}%<br>
            <strong>Concorrência:</strong> ${currentDossier.snapshot?.chance_of_play || 'N/A'}<br>
            <strong>Hierarquia:</strong> ${currentDossier.snapshot?.estimated_hierarchy || 'N/A'}
        </div>
    `;
    
    document.querySelector('#signModal .modal-header h2').innerText = 'Assinar Contrato';
    document.querySelector('#signModal .modal-warning').classList.remove('hidden');
    document.getElementById('btnConfirmSign').innerText = 'Assinar e Iniciar';
    
    modal.classList.remove('hidden');
    
    document.getElementById('btnConfirmSign').onclick = async () => {
        const btn = document.getElementById('btnConfirmSign');
        btn.disabled = true;
        btn.innerHTML = 'Assinando...';
        try {
            await acceptOffer(selectedOfferId);
            modal.classList.add('hidden');
            showFinalSplash();
        } catch(e) {
            showToast(null, e.message, 'error');
            btn.disabled = false;
            btn.innerHTML = 'Assinar e Iniciar';
        }
    };
    document.getElementById('btnCancelSign').onclick = () => modal.classList.add('hidden');
}

function openRejectModal() {
    const modal = document.getElementById('rejectModal');
    const body = document.getElementById('rejectModalBody');
    body.innerHTML = `<p>Você está prestes a recusar a proposta do <strong>${currentDossier.club.name}</strong>. Esta ação não poderá ser desfeita.</p>
    <p style="font-size:0.85rem; color:var(--text-secondary); margin-top:1rem">Se esta for sua última proposta ativa, o sistema poderá gerar uma oferta emergencial em um clube de menor expressão.</p>`;
    modal.classList.remove('hidden');
    
    document.getElementById('btnConfirmReject').onclick = async () => {
        const btn = document.getElementById('btnConfirmReject');
        btn.disabled = true;
        btn.innerHTML = 'Recusando...';
        try {
            await rejectOffer(selectedOfferId);
            modal.classList.add('hidden');
            showToast(null, 'Proposta recusada com sucesso.', 'info');
            await loadOffers();
        } catch(e) {
            showToast(null, e.message, 'error');
            btn.disabled = false;
            btn.innerHTML = 'Sim, Recusar';
        }
    };
    document.getElementById('btnCancelReject').onclick = () => modal.classList.add('hidden');
}

function bindTabs() {
    const tabs = document.querySelectorAll('.dossier-tabs button');
    tabs.forEach(tab => {
        tab.onclick = () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            document.querySelectorAll('.tab-pane').forEach(p => p.classList.add('hidden'));
            document.getElementById(tab.dataset.target).classList.remove('hidden');
        };
    });
}
