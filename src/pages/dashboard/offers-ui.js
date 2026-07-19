import { generateInitialOffers, getOfferDetails, negotiateOffer, acceptOffer, rejectOffer, getActiveOffers, getPlayerProfile } from '../../services/offer-service.js';
import { showToast } from '../../components/toast/toast.js';

let activeOffers = [];
let currentDossier = null;
let selectedOfferId = null;
let currentPlayer = null;

const getClubImage = (name) => {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    return `img/clubs/${slug}.png`;
};

export async function initOffersPhase(state = {}) {
    document.querySelector('.creation-status')?.classList.remove('hidden');
    document.querySelector('.player-create')?.classList.add('hidden');
    document.querySelector('.player-offers')?.classList.remove('hidden');
    document.querySelector('.final-splash')?.classList.add('hidden');
    
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
                <img src="${imgUrl}" alt="${club.name}" onerror="this.outerHTML='<div class=\'club-crest-fallback\' style=\'margin:0 auto; width:80px; height:80px; font-size:2rem\'>${club.name.substring(0,3)}</div>'" style="width:100px; height:100px; margin:0 auto 1rem auto; display:block;">
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

function renderDossierSquad() {
    const roster = currentDossier.roster || [];
    const competitors = currentDossier.competitors || [];
    const compCount = competitors.length;
    const compat = currentDossier.compatibility_breakdown;
    
    let compHtml = `<p>Você não tem concorrência direta nesta posição.</p>`;
    if (compCount > 0) {
        compHtml = `<div class="squad-list">` + competitors.map(c => `
            <div class="squad-player competitor ${c.is_starter ? 'starter' : ''}">
                <div>
                    <strong>${c.name}</strong> ${c.is_starter ? '(Titular)' : '(Reserva)'}
                    <div style="font-size:0.75rem; color:var(--text-secondary)">Idade: ${c.age} | ${c.primary_position} ${c.secondary_position ? '('+c.secondary_position+')' : ''} | ${c.archetype} | ${c.squad_role}</div>
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
                <div style="font-size:0.75rem; color:var(--text-secondary)">Idade: ${c.age} | ${c.primary_position} ${c.secondary_position ? '('+c.secondary_position+')' : ''} | ${c.archetype} | ${c.squad_role}</div>
            </div>
            <div class="ovr-badge" style="font-size:1rem; padding:0.25rem 0.5rem">${c.ovr}</div>
        </div>
    `;

    document.getElementById('dossierSquad').innerHTML = `
        <h3 style="margin-bottom:1rem; border-bottom: 1px solid var(--border); padding-bottom:0.5rem">Concorrência na sua posição</h3>
        <div style="background:var(--bg-page); padding:1rem; border-radius:8px; margin-bottom:1rem; display:flex; justify-content:space-between">
            <div><strong>Vagas:</strong> ${compat.snapshot?.slots_needed || 'N/A'}</div>
            <div><strong>Titulares:</strong> ${compat.snapshot?.starters_competing || 0}</div>
            <div><strong>Reservas:</strong> ${compat.snapshot?.subs_competing || 0}</div>
            <div><strong>Nível:</strong> ${compat.snapshot?.competition_level || 'N/A'}</div>
            <div><strong>Chance:</strong> ${compat.snapshot?.chance_of_play || 'N/A'}</div>
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
    // Stars based on average of physical, speed, technical, tactical
    const total = (acad.physical + acad.speed + acad.technical + acad.tactical + acad.recovery);
    const avg = Math.round(total / 5) || 3;
    
    document.getElementById('dossierAcademy').innerHTML = `
        <div class="dossier-header-grid" style="grid-template-columns: 1fr">
            <h2>${acad.name}</h2>
            <p style="color:var(--muted)">Avaliação Geral: ${avg} Estrelas</p>
        </div>
        <div class="compat-grid" style="margin-bottom:2rem; margin-top:1rem;">
            <div class="compat-card"><i data-lucide="dumbbell"></i><span>Físico</span><strong>${acad.physical} pts</strong></div>
            <div class="compat-card"><i data-lucide="zap"></i><span>Velocidade</span><strong>${acad.speed} pts</strong></div>
            <div class="compat-card"><i data-lucide="star"></i><span>Técnica</span><strong>${acad.technical} pts</strong></div>
            <div class="compat-card"><i data-lucide="shield-alert"></i><span>Tática</span><strong>${acad.tactical} pts</strong></div>
            <div class="compat-card"><i data-lucide="heart-pulse"></i><span>Recuperação</span><strong>${acad.recovery} pts</strong></div>
        </div>
    `;
    if (window.lucide) lucide.createIcons();
}

function renderDossierCoach() {
    const coach = currentDossier.coach;
    const club = currentDossier.club;
    const profileText = coach.profile || 'Normal';
    
    let impactsHtml = '';
    if (coach.impacts) {
        Object.entries(coach.impacts).forEach(([key, val]) => {
            const num = parseInt(val);
            const color = num > 0 ? 'var(--green)' : (num < 0 ? '#ef4444' : 'var(--text)');
            const sign = num > 0 ? '+' : '';
            impactsHtml += `<div style="background:var(--bg-page); padding:1rem; border-radius:var(--radius); border:1px solid var(--line);">
                <div style="font-size:0.85rem; color:var(--muted)">${key.toUpperCase()}</div>
                <div style="font-size:1.2rem; font-weight:600; color:${color}">${sign}${num}</div>
            </div>`;
        });
    }

    document.getElementById('dossierCoach').innerHTML = `
        <div class="dossier-header-grid" style="grid-template-columns: 1fr">
            <h2>${coach.name}</h2>
            <p style="color:var(--muted)">Perfil do Treinador: <strong>${profileText}</strong></p>
        </div>
        <h3 style="margin-top:2rem; margin-bottom:1rem; border-bottom: 1px solid var(--line); padding-bottom:0.5rem">Impactos de Evolução</h3>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap:1rem;">
            ${impactsHtml}
        </div>
    `;
}
        </div>
        
        <h3 style="margin-top:2rem; margin-bottom:1rem; border-bottom: 1px solid var(--border); padding-bottom:0.5rem">Como você jogará neste clube</h3>
        <p style="color:var(--text-secondary)">A formação ${club.formation} e o estilo ${club.style} determinam a dinâmica do jogo e as chances de você obter minutos em campo.</p>
        <p style="color:var(--text-secondary); margin-top:0.5rem">Exemplo: Estilos ofensivos gastam mais energia mas geram mais ações de ataque. Estilos de contra-ataque valorizam velocidade e decisão.</p>
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
    if (offer.history && offer.history.length > 0) {
        historyHtml = `<div class="history-box"><h4>Histórico</h4>` + 
            offer.history.map((h, i) => {
                return `<div class="history-item ${h.club_response_action === 'rejected' ? 'rejected' : 'countered'}">
                    <strong>Rodada ${i+1}:</strong> Você pediu R$ ${h.player_proposal.monthly_wage} / ${h.player_proposal.squad_role}. 
                    <br>Clube respondeu com postura <strong>${h.club_new_stance}</strong>. Custo: ${h.calculated_cost} pts.
                </div>`;
            }).join('') + `</div>`;
    }

    // Determine role options up to +2 levels
    const roles = ['Promessa', 'Reserva', 'Rotação', 'Titular'];
    const currentRoleIdx = roles.indexOf(offer.initial_terms?.squad_role || terms.squad_role);
    const validRoles = roles.slice(currentRoleIdx, currentRoleIdx + 3);

    panel.innerHTML = `
        <h3>Termos do Contrato</h3>
        <div style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:1rem">Postura do Clube: <strong>${offer.internal_tolerance?.stance || 'N/A'}</strong></div>
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
    if(reqWage !== terms.monthly_wage) changes.push(`Salário: R$ ${terms.monthly_wage} → R$ ${reqWage}`);
    if(reqDur !== terms.duration_seasons) changes.push(`Duração: ${terms.duration_seasons} → ${reqDur} temp.`);
    if(reqClause !== terms.release_clause) changes.push(`Multa: R$ ${terms.release_clause} → R$ ${reqClause}`);
    if(reqRole !== terms.squad_role) changes.push(`Função: ${terms.squad_role} → ${reqRole}`);
    
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
    
    const body = document.getElementById('signModalBody');
    body.innerHTML = `
        <h3 style="margin-bottom:1rem">Resumo da Contraproposta</h3>
        <div style="display:flex; gap:1rem; margin-bottom:1rem; text-align:left;">
            <div style="flex:1; background:var(--card); padding:1rem; border-radius:var(--radius); border:1px solid var(--line);">
                <h4 style="margin-bottom:0.5rem; font-size:0.85rem; color:var(--muted)">Termos Atuais</h4>
                <div style="font-size:0.9rem">
                    <div>Salário: R$ ${terms.monthly_wage}</div>
                    <div>Duração: ${terms.duration_seasons} anos</div>
                    <div>Multa: R$ ${terms.release_clause}</div>
                    <div>Função: ${terms.squad_role}</div>
                </div>
            </div>
            <div style="flex:1; background:rgba(56, 201, 31, 0.1); padding:1rem; border-radius:var(--radius); border:1px solid rgba(56, 201, 31, 0.3);">
                <h4 style="margin-bottom:0.5rem; font-size:0.85rem; color:var(--green)">Termos Solicitados</h4>
                <div style="font-size:0.9rem">
                    <div style="color:${reqWage > terms.monthly_wage ? 'var(--green)' : 'inherit'}">Salário: R$ ${reqWage}</div>
                    <div style="color:${reqDur !== terms.duration_seasons ? 'var(--green)' : 'inherit'}">Duração: ${reqDur} anos</div>
                    <div style="color:${reqClause < terms.release_clause ? 'var(--green)' : 'inherit'}">Multa: R$ ${reqClause}</div>
                    <div style="color:${reqRole !== terms.squad_role ? 'var(--green)' : 'inherit'}">Função: ${reqRole}</div>
                </div>
            </div>
        </div>
        <div style="background:var(--bg-page); padding:1rem; border-radius:8px; text-align:center;">
            <strong>Custo estimado da exigência: <span style="color:${estCost > 40 ? '#ef4444' : (estCost > 20 ? '#eab308' : 'var(--green)')}">${estCost} pts</span></strong>
        </div>
        <p style="margin-top:1rem; font-size:0.85rem; color:var(--text-secondary)">Atenção: Você tem ${3 - currentDossier.offer.round} rodadas restantes.</p>
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
            <div class="contract-row"><strong>Salário:</strong> R$ ${terms.monthly_wage}</div>
            <div class="contract-row"><strong>Luvas:</strong> R$ ${terms.signing_bonus}</div>
            <div class="contract-row"><strong>Duração:</strong> ${terms.duration_seasons} Temporadas</div>
            <div class="contract-row"><strong>Multa:</strong> R$ ${terms.release_clause}</div>
            <div class="contract-row"><strong>Papel:</strong> ${terms.squad_role}</div>
        </div>
        <div style="background:rgba(16, 185, 129, 0.1); padding:1rem; border-radius:8px; margin-bottom:1rem; border-left:3px solid #10b981">
            <strong>Compatibilidade:</strong> ${currentDossier.compatibility_breakdown.total}%<br>
            <strong>Concorrência:</strong> ${currentDossier.compatibility_breakdown.snapshot?.chance_of_play || 'N/A'}
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
