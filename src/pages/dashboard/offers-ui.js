import { generateInitialOffers, getOfferDetails, negotiateOffer, acceptOffer, rejectOffer, getActiveOffers, getPlayerProfile } from '../../services/offer-service.js';
import { showToast } from '../../components/toast/toast.js';

let activeOffers = [];
let currentDossier = null;
let selectedOfferId = null;
let currentPlayer = null;

const getClubImage = (name) => {
    if (!name) return 'img/clubs/default.png';
    const slug = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_');
    return `img/clubs/${slug}.png`;
};

export async function initOffersPhase(state = {}) {
    document.querySelector('.creation-status')?.classList.remove('hidden');
    document.querySelector('.player-create')?.classList.add('hidden');
    document.querySelector('.player-offers')?.classList.remove('hidden');
    document.querySelector('.final-splash')?.classList.add('hidden');
    
    // Hide role selection paths if coming from F5
    document.querySelector('.world-status')?.classList.add('hidden');
    document.querySelector('.paths')?.classList.add('hidden');
    document.querySelector('.notice')?.classList.add('hidden');
    document.querySelector('.details')?.classList.add('hidden');
    document.querySelector('.bottom-message')?.classList.add('hidden');
    
    // Highlight Etapa 2 and mark Etapa 1 as completed
    const statusItems = document.querySelectorAll('.creation-status .status-item');
    if (statusItems.length > 0) {
        statusItems[0].classList.remove('active');
        statusItems[0].classList.add('completed');
    }
    document.getElementById('stage2Indicator')?.classList.add('active');

    try {
        if (!state.offers_generated) {
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

export async function showFinalSplash() {
    document.querySelector('.creation-status')?.classList.add('hidden');
    document.querySelector('.player-create')?.classList.add('hidden');
    document.querySelector('.player-offers')?.classList.add('hidden');
    document.querySelector('.final-splash')?.classList.remove('hidden');
    
    document.querySelector('.world-status')?.classList.add('hidden');
    document.querySelector('.paths')?.classList.add('hidden');
    document.querySelector('.notice')?.classList.add('hidden');
    document.querySelector('.details')?.classList.add('hidden');
    document.querySelector('.bottom-message')?.classList.add('hidden');
    
    try {
        const { supabase } = await import('../../services/supabase-client.js');
        const { data: { user } } = await supabase.auth.getUser();
        const { data: player } = await supabase.from('jogadores').select('id').eq('user_id', user.id).single();
        
        const { data: contract } = await supabase.from('player_contracts').select('*').eq('player_id', player.id).eq('status', 'active').single();
        if (!contract) return;

        const { data: club } = await supabase.from('base_clubs').select('*').eq('id', contract.club_id).single();
        const { data: coach } = await supabase.from('base_coaches').select('*').eq('id', club.coach_id).single();
        const { data: state } = await supabase.from('player_career_state').select('*').eq('player_id', player.id).single();

        const imgUrl = getClubImage(club.name);
        
        document.getElementById('splashCard').innerHTML = `
            <div class="final-splash-card" style="background:var(--card); padding:2rem; border-radius:var(--radius); border:1px solid var(--line); box-shadow:var(--shadow);">
                <img src="${imgUrl}" alt="${club.name}" onerror="this.outerHTML='<div class=\\'club-crest-fallback\\' style=\\'margin:0 auto; width:80px; height:80px; font-size:2rem\\'>${club.name.substring(0,3)}</div>'" style="width:100px; height:100px; margin:0 auto 1rem auto; display:block;">
                <h2>Contrato assinado</h2>
                <h3 style="color:var(--text); margin-bottom:1rem">Bem-vindo ao ${club.name} Sub-18</h3>
                <p style="margin-bottom:2rem; color:var(--text-secondary)">
                    O treinador <strong>${coach.name}</strong> espera você para sua primeira apresentação. Você chega como <strong>${contract.squad_role}</strong> e terá de disputar espaço para conquistar uma vaga entre os titulares.
                </p>
                <div style="background:rgba(0,0,0,0.03); padding:1rem; border-radius:8px; margin-bottom:2rem; display:grid; grid-template-columns:1fr 1fr; gap:1rem; text-align:left; font-size:0.9rem">
                    <div><strong>Salário:</strong> R$ ${contract.monthly_wage}</div>
                    <div><strong>Duração:</strong> ${contract.duration_seasons} temp.</div>
                    <div><strong>Bônus:</strong> R$ ${contract.signing_bonus}</div>
                    <div><strong>Multa:</strong> R$ ${contract.release_clause}</div>
                    <div><strong>Confiança:</strong> ${state.trust}%</div>
                    <div><strong>Moral:</strong> ${state.morale}%</div>
                    <div><strong>Energia:</strong> ${state.energy}%</div>
                    <div><strong>Compatibilidade:</strong> ${state.compatibility}%</div>
                </div>
                <button class="btn-primary" onclick="window.location.href='career.html'" style="padding: 1rem 2rem; font-size:1.1rem; width:100%">Iniciar carreira</button>
            </div>
        `;
    } catch (e) {
        console.error(e);
        showToast(null, 'Erro ao carregar os dados finais.', 'error');
    }
}

function renderCompactPlayer() {
    const compactCard = document.getElementById('playerCompactCard');
    if(!currentPlayer) return;
    
    compactCard.innerHTML = `
        <div class="player-compact-card gamified-card">
            <img src="img/avatar/${currentPlayer.avatar || 'avatar1'}.webp" alt="Avatar">
            <div class="info">
                <h3>${currentPlayer.nome}</h3>
                <p><i data-lucide="user"></i> ${currentPlayer.idade} anos &nbsp;|&nbsp; <i data-lucide="crosshair"></i> ${currentPlayer.posicao} ${currentPlayer.posicao_secundaria ? '('+currentPlayer.posicao_secundaria+')' : ''} &nbsp;|&nbsp; <i data-lucide="activity"></i> ${currentPlayer.arquetipo}</p>
            </div>
            <div class="ovr-badge">
                <span>Overall Rating</span>
                ${currentPlayer.ovr}
            </div>
        </div>
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
    const cb = currentDossier.compatibility_breakdown;
    const imgUrl = getClubImage(club.name);
    
    document.getElementById('dossierOverview').innerHTML = `
        <div class="dossier-hero">
            <img src="${imgUrl}" alt="${club.name}" onerror="this.outerHTML='<div class=\'club-crest-fallback\'>${club.name.substring(0,3)}</div>'">
            <div class="dossier-hero-info">
                <h2>${club.name}</h2>
                <p><i data-lucide="map-pin"></i> ${club.city} &nbsp;&bull;&nbsp; Reputação: ${club.reputation}</p>
            </div>
        </div>

        <h3 class="section-title"><i data-lucide="bar-chart-2"></i> Sumário de Oportunidade</h3>
        <div class="hud-grid">
            <div class="hud-box">
                <div class="hud-label">Compatibilidade</div>
                <div class="hud-value highlight">${cb.compatibility_total || cb.total}%</div>
            </div>
            <div class="hud-box">
                <div class="hud-label">Vagas no Elenco</div>
                <div class="hud-value">${currentDossier.snapshot?.slots_needed || 'N/A'}</div>
            </div>
            <div class="hud-box">
                <div class="hud-label">Tempo de Jogo</div>
                <div class="hud-value" style="font-size:1.5rem">${currentDossier.snapshot?.chance_of_play || 'N/A'}</div>
            </div>
            <div class="hud-box">
                <div class="hud-label">Função Proposta</div>
                <div class="hud-value" style="font-size:1.5rem">${currentDossier.offer.current_terms.squad_role}</div>
            </div>
        </div>

        <h3 class="section-title"><i data-lucide="crosshair"></i> Detalhamento de Compatibilidade</h3>
        <div style="background: rgba(0,0,0,0.2); padding: 1.5rem; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);">
            <div class="hud-attribute-row"><span>Posição</span><strong>${cb.position_score || cb.position_need_score || 0}</strong><em><b style="width:${((cb.position_score || cb.position_need_score || 0)/30)*100}%"></b></em></div>
            <div class="hud-attribute-row"><span>Estilo</span><strong>${cb.style_score || cb.play_style_score || 0}</strong><em><b style="width:${((cb.style_score || cb.play_style_score || 0)/25)*100}%"></b></em></div>
            <div class="hud-attribute-row"><span>Arquétipo</span><strong>${cb.archetype_score || 0}</strong><em><b style="width:${((cb.archetype_score || 0)/20)*100}%"></b></em></div>
            <div class="hud-attribute-row"><span>Concorrência</span><strong>${cb.competition_score || 0}</strong><em><b style="width:${((cb.competition_score || 0)/15)*100}%"></b></em></div>
            <div class="hud-attribute-row"><span>Treinador</span><strong>${cb.coach_score || 0}</strong><em><b style="width:${((cb.coach_score || 0)/10)*100}%"></b></em></div>
        </div>
    `;
    if (window.lucide) lucide.createIcons();
}

function renderDossierSquad() {
    const roster = currentDossier.roster || [];
    const competitors = currentDossier.competitors || [];
    
    const formatPlayer = (c, isComp = false) => `
        <div class="squad-player-card ${isComp ? 'competitor' : ''}">
            <div class="player-ovr-circle">${c.ovr}</div>
            <div class="player-info">
                <h4>${c.name} ${isComp && c.is_starter ? '<span style="color:#f59e0b">(Titular)</span>' : ''}</h4>
                <p>${c.primary_position} &bull; ${c.age} anos</p>
                <p style="margin-top:0.25rem"><i data-lucide="crosshair"></i> ${c.archetype}</p>
            </div>
        </div>
    `;

    let compHtml = `<p style="color:var(--muted); font-weight:600; margin-bottom:2rem;">Nenhum jogador na sua posição. Você tem o caminho livre.</p>`;
    if (competitors.length > 0) {
        compHtml = `<div class="squad-list-modern">` + competitors.map(c => formatPlayer(c, true)).join('') + `</div>`;
    }

    const starters = roster.filter(r => r.is_starter);
    const bench = roster.filter(r => !r.is_starter);

    document.getElementById('dossierSquad').innerHTML = `
        <h3 class="section-title"><i data-lucide="swords"></i> Sua Concorrência Direta</h3>
        ${compHtml}
        
        <h3 class="section-title"><i data-lucide="users"></i> Titulares do Clube</h3>
        <div class="squad-list-modern">${starters.map(c => formatPlayer(c)).join('')}</div>
        
        <h3 class="section-title"><i data-lucide="users-2"></i> Opções de Banco</h3>
        <div class="squad-list-modern">${bench.map(c => formatPlayer(c)).join('')}</div>
    `;
    if (window.lucide) lucide.createIcons();
}

function renderDossierAcademy() {
    const acad = currentDossier.academy;
    const total = (acad.physical + acad.speed + acad.technical + acad.tactical + acad.recovery);
    const avg = Math.round(total / 5) || 3;
    const mods = acad.modifiers || {};
    
    document.getElementById('dossierAcademy').innerHTML = `
        <div class="dossier-hero" style="margin-bottom:1.5rem;">
            <div class="dossier-hero-info">
                <h2 style="font-size:2rem"><i data-lucide="building"></i> ${acad.name}</h2>
                <p style="color:var(--green)">Qualidade Geral: ${avg} Estrelas</p>
            </div>
        </div>
        
        <h3 class="section-title"><i data-lucide="dumbbell"></i> Instalações e Qualidade Base</h3>
        <div style="background: rgba(0,0,0,0.2); padding: 1.5rem; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); margin-bottom:2rem;">
            <div class="hud-attribute-row"><span>Físico</span><strong>${acad.physical}</strong><em><b style="width:${(acad.physical/5)*100}%"></b></em></div>
            <div class="hud-attribute-row"><span>Velocidade</span><strong>${acad.speed}</strong><em><b style="width:${(acad.speed/5)*100}%"></b></em></div>
            <div class="hud-attribute-row"><span>Técnica</span><strong>${acad.technical}</strong><em><b style="width:${(acad.technical/5)*100}%"></b></em></div>
            <div class="hud-attribute-row"><span>Tática</span><strong>${acad.tactical}</strong><em><b style="width:${(acad.tactical/5)*100}%"></b></em></div>
            <div class="hud-attribute-row"><span>Recuperação</span><strong>${acad.recovery}</strong><em><b style="width:${(acad.recovery/5)*100}%"></b></em></div>
        </div>

        <h3 class="section-title"><i data-lucide="zap"></i> Boost de Evolução Acelerada</h3>
        <div class="hud-grid">
            <div class="hud-box">
                <div class="hud-label">Força / Resis.</div>
                <div class="hud-value highlight">+${mods.strength || 0}%</div>
            </div>
            <div class="hud-box">
                <div class="hud-label">Velocidade</div>
                <div class="hud-value highlight">+${mods.sprint_speed || 0}%</div>
            </div>
            <div class="hud-box">
                <div class="hud-label">Fundamentos</div>
                <div class="hud-value highlight">+${mods.passing || mods.ball_control || 0}%</div>
            </div>
            <div class="hud-box">
                <div class="hud-label">Posicionamento</div>
                <div class="hud-value highlight">+${mods.positioning || 0}%</div>
            </div>
        </div>
    `;
    if (window.lucide) lucide.createIcons();
}

function renderDossierCoach() {
    const coach = currentDossier.coach;
    const club = currentDossier.club;
    
    let impactsHtml = '';
    if (coach.impacts) {
        const impactIcons = {
            "moral": "smile",
            "evolução": "trending-up",
            "minutos": "clock",
            "titularidade": "shield",
            "desenvolvimento": "zap"
        };
        
        Object.entries(coach.impacts).forEach(([key, val]) => {
            const num = parseInt(val);
            const color = num > 0 ? 'var(--green)' : (num < 0 ? '#ef4444' : 'var(--text)');
            const sign = num > 0 ? '+' : '';
            const iconName = impactIcons[key.toLowerCase()] || "activity";
            impactsHtml += `<div class="hud-box">
                <div class="hud-label"><i data-lucide="${iconName}" style="width:14px; margin-right:4px; color:${color}"></i> ${key.toUpperCase()}</div>
                <div class="hud-value" style="color:${color}; text-shadow: 0 0 10px ${color}">${sign}${num}</div>
            </div>`;
        });
    }

    const coachSlug = coach.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_');
    const coachImg = `img/coaches/${coachSlug}.png`;

    document.getElementById('dossierCoach').innerHTML = `
        <div class="dossier-hero" style="margin-bottom:1.5rem;">
            <img src="${coachImg}" alt="${coach.name}" style="border-radius:12px; border:2px solid var(--green); box-shadow:0 0 15px rgba(56,201,31,0.4);" onerror="this.src='img/avatar/avatar4.webp'">
            <div class="dossier-hero-info">
                <h2 style="font-size:2rem"><i data-lucide="clipboard-list"></i> ${coach.name}</h2>
                <p><i data-lucide="crosshair"></i> Perfil Tático: ${coach.profile || 'Equilibrado'}</p>
            </div>
        </div>

        <h3 class="section-title"><i data-lucide="layout"></i> Filosofia Tática</h3>
        <div class="hud-grid" style="grid-template-columns: 1fr 1fr;">
            <div class="hud-box">
                <div class="hud-label"><i data-lucide="scan-line" style="margin-right:4px;"></i> Formação Base</div>
                <div class="hud-value">${coach.preferred_formation || club.formation}</div>
            </div>
            <div class="hud-box">
                <div class="hud-label"><i data-lucide="swords" style="margin-right:4px;"></i> Estilo de Jogo</div>
                <div class="hud-value">${coach.preferred_style || club.style}</div>
            </div>
        </div>

        <h3 class="section-title"><i data-lucide="trending-up"></i> Modificadores de Desempenho</h3>
        <div class="hud-grid" style="grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));">
            ${impactsHtml}
        </div>
    `;
    if (window.lucide) lucide.createIcons();
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
            <div style="text-align:center; font-size: 0.85rem; color: var(--text); font-weight:700; margin-bottom: 0.75rem;">Rodadas restantes: ${remainingRounds}</div>
            <button class="btn-secondary" id="btnPreviewNegotiate"><i data-lucide="pencil"></i> Ver Contraproposta</button>
            <button class="btn-primary" id="btnAccept"><i data-lucide="pen-tool"></i> Assinar Contrato</button>
            <button class="btn-danger" id="btnReject" style="background:transparent; border:1px solid #ef4444; color:#ef4444"><i data-lucide="trash-2"></i> Recusar Proposta</button>
        `;
    }
    
    let historyHtml = '';
    if (offer.history && offer.history.length > 0) {
        historyHtml = `<div class="history-box"><h4 style="margin:0 0 1rem 0; font-weight:950; font-size:1.1rem;"><i data-lucide="clock" style="width:16px; margin-right:5px; color:var(--muted);"></i> Histórico de Rodadas</h4>` + 
            offer.history.map((h, i) => {
                return `<div class="history-item ${h.club_response_action === 'rejected' ? 'rejected' : 'countered'}">
                    <strong>Rodada ${i+1}:</strong> Solicitou R$ ${h.player_proposal.monthly_wage} e função de ${h.player_proposal.squad_role}. 
                    <div style="margin-top:0.5rem; color:var(--muted); font-size:0.8rem;">Clube mudou postura para <strong>${h.club_new_stance}</strong>. Custo exigido: ${h.calculated_cost} pts.</div>
                </div>`;
            }).join('') + `</div>`;
    }

    panel.innerHTML = `
        <h3><i data-lucide="file-text"></i> Termos do Contrato</h3>
        
        <div class="contract-term-box">
            <div class="contract-term-info">
                <span>Salário Mensal</span>
                <strong>R$ ${terms.monthly_wage}</strong>
            </div>
            <i data-lucide="coins" style="color:var(--muted)"></i>
        </div>
        
        <div class="contract-term-box">
            <div class="contract-term-info">
                <span>Duração</span>
                <strong>${terms.duration_seasons} Temporadas</strong>
            </div>
            <i data-lucide="calendar" style="color:var(--muted)"></i>
        </div>
        
        <div class="contract-term-box">
            <div class="contract-term-info">
                <span>Multa Rescisória</span>
                <strong>R$ ${terms.release_clause}</strong>
            </div>
            <i data-lucide="lock" style="color:var(--muted)"></i>
        </div>
        
        <div class="contract-term-box">
            <div class="contract-term-info">
                <span>Função no Elenco</span>
                <strong>${terms.squad_role}</strong>
            </div>
            <i data-lucide="shield" style="color:var(--muted)"></i>
        </div>

        <div class="contract-actions">
            ${actionsHtml}
        </div>
        ${historyHtml}
    `;

    document.getElementById('btnPreviewNegotiate')?.addEventListener('click', openNegotiateModal);
    document.getElementById('btnAccept')?.addEventListener('click', openAcceptModal);
    document.getElementById('btnReject')?.addEventListener('click', openRejectModal);
    if (window.lucide) lucide.createIcons();
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
        showToast(null, 'Você não alterou nenhum termo para negociar.', 'warning');
        return;
    }
    
    // Calcular custo estimado
    let estCost = 0;
    const wageRatio = reqWage / terms.monthly_wage;
    if (wageRatio >= 1.2) estCost += 22;
    else if (wageRatio > 1.0) estCost += 10;
    
    const releaseRatio = reqClause / terms.release_clause;
    if (releaseRatio <= 0.5) estCost += 35;
    else if (releaseRatio <= 0.75) estCost += 15;
    else if (releaseRatio > 1.0) estCost -= 10;
    
    const roleLevels = {"Reserva": 1, "Rotação": 2, "Titular": 3, "Estrela": 4, "Promessa": 0};
    const roleDiff = roleLevels[reqRole] - roleLevels[terms.squad_role];
    if (roleDiff === 1) estCost += 20;
    if (roleDiff === 2) estCost += 45;
    
    if (reqDur < terms.duration_seasons) estCost += 12;
    if (reqDur > terms.duration_seasons) estCost -= 8;
    
    let riskClass = 'risk-low';
    let riskText = 'Baixo Risco';
    let fillWidth = Math.min((estCost / 60) * 100, 100);
    
    if (estCost > 40) { riskClass = 'risk-high'; riskText = 'Risco Crítico (Chances de rejeição)'; }
    else if (estCost > 20) { riskClass = 'risk-med'; riskText = 'Risco Moderado'; }
    
    const body = document.getElementById('signModalBody');
    body.innerHTML = `
        <div class="modal-comparison-grid">
            <div class="modal-comparison-box">
                <h4>OFERTA ATUAL</h4>
                <div class="modal-comparison-item"><span>Salário:</span> <span>R$ ${terms.monthly_wage}</span></div>
                <div class="modal-comparison-item"><span>Duração:</span> <span>${terms.duration_seasons} anos</span></div>
                <div class="modal-comparison-item"><span>Multa:</span> <span>R$ ${terms.release_clause}</span></div>
                <div class="modal-comparison-item"><span>Função:</span> <span>${terms.squad_role}</span></div>
            </div>
            <div class="modal-comparison-box highlight">
                <h4>NOVOS TERMOS</h4>
                <div class="modal-comparison-item" style="color:${reqWage > terms.monthly_wage ? 'var(--green)' : 'inherit'}"><span>Salário:</span> <span>R$ ${reqWage}</span></div>
                <div class="modal-comparison-item" style="color:${reqDur !== terms.duration_seasons ? 'var(--green)' : 'inherit'}"><span>Duração:</span> <span>${reqDur} anos</span></div>
                <div class="modal-comparison-item" style="color:${reqClause < terms.release_clause ? 'var(--green)' : 'inherit'}"><span>Multa:</span> <span>R$ ${reqClause}</span></div>
                <div class="modal-comparison-item" style="color:${reqRole !== terms.squad_role ? 'var(--green)' : 'inherit'}"><span>Função:</span> <span>${reqRole}</span></div>
            </div>
        </div>
        <div class="risk-meter-container">
            <div class="risk-meter-title">Tensão da Negociação</div>
            <div class="risk-bar-bg">
                <div class="risk-bar-fill" style="width: ${fillWidth}%"></div>
            </div>
            <div class="risk-status-text ${riskClass}">${riskText} <span style="font-size:0.8rem">(${estCost} pts)</span></div>
        </div>
    `;
    
    document.querySelector('#signModal .modal-header h2').innerText = 'ENVIAR CONTRAPROPOSTA';
    document.querySelector('#signModal .modal-warning').classList.add('hidden');
    document.getElementById('btnConfirmSign').innerText = 'ENVIAR EXIGÊNCIAS';
    
    modal.classList.remove('hidden');
    
    document.getElementById('btnConfirmSign').onclick = async () => {
        const btn = document.getElementById('btnConfirmSign');
        btn.disabled = true;
        btn.innerHTML = 'PROCESSANDO...';
        try {
            const res = await negotiateOffer(selectedOfferId, {
                monthly_wage: reqWage,
                duration_seasons: reqDur,
                release_clause: reqClause,
                squad_role: reqRole,
                signing_bonus: terms.signing_bonus
            });
            
            if (res.action === 'accepted') {
                showToast(null, 'O clube aceitou todas as suas exigências!', 'success');
            } else if (res.action === 'countered') {
                showToast(null, 'O clube fez uma contraproposta com termos intermediários.', 'warning');
            } else {
                showToast(null, 'O clube recusou suas exigências e retirou a oferta.', 'error');
            }
            
            modal.classList.add('hidden');
            await loadOffers(); // Refresh UI
        } catch(e) {
            showToast(null, e.message, 'error');
            btn.disabled = false;
            btn.innerHTML = 'ENVIAR EXIGÊNCIAS';
        }
    };
    document.getElementById('btnCancelSign').onclick = () => modal.classList.add('hidden');
}

function openAcceptModal() {
    const modal = document.getElementById('signModal');
    const terms = currentDossier.offer.current_terms;
    const body = document.getElementById('signModalBody');
    
    body.innerHTML = `
        <div class="modal-comparison-box highlight" style="margin-bottom:1.5rem">
            <h4>Assinar Contrato Definitivo</h4>
            <div class="modal-comparison-item"><span>Salário Mensal:</span> <span>R$ ${terms.monthly_wage}</span></div>
            <div class="modal-comparison-item"><span>Duração:</span> <span>${terms.duration_seasons} Temporadas</span></div>
            <div class="modal-comparison-item"><span>Bônus de Assinatura:</span> <span>R$ ${terms.signing_bonus}</span></div>
            <div class="modal-comparison-item"><span>Multa Rescisória:</span> <span>R$ ${terms.release_clause}</span></div>
            <div class="modal-comparison-item"><span>Função:</span> <span>${terms.squad_role}</span></div>
        </div>
    `;
    document.querySelector('#signModal .modal-header h2').innerText = 'Assinar Contrato';
    document.querySelector('#signModal .modal-warning').classList.remove('hidden');
    document.getElementById('btnConfirmSign').innerText = 'Assinar e Iniciar Carreira';
    
    modal.classList.remove('hidden');
    
    document.getElementById('btnConfirmSign').onclick = async () => {
        const btn = document.getElementById('btnConfirmSign');
        btn.disabled = true;
        btn.innerHTML = 'Assinando...';
        try {
            await acceptOffer(selectedOfferId);
            showToast(null, 'Contrato Assinado! Bem-vindo ao clube.', 'success');
            modal.classList.add('hidden');
            showFinalSplash();
        } catch(e) {
            showToast(null, e.message, 'error');
            btn.disabled = false;
            btn.innerHTML = 'Assinar e Iniciar Carreira';
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

