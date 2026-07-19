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


function getOtherOffersMaxWage() {
    let max = 0;
    activeOffers.forEach(o => {
        if(o.id !== selectedOfferId && o.current_terms.monthly_wage > max) max = o.current_terms.monthly_wage;
    });
    return max;
}

function getOtherOffersMinClause() {
    let min = 999999999;
    activeOffers.forEach(o => {
        if(o.id !== selectedOfferId && o.current_terms.release_clause < min) min = o.current_terms.release_clause;
    });
    return min;
}

function generateProsCons() {
    const pros = [];
    const cons = [];
    const offer = currentDossier.offer;
    const terms = offer.current_terms;
    const ac = currentDossier.academy || { physical: 3, tactical: 3, technical: 3, speed: 3, recovery: 3 };
    const co = currentDossier.coach?.impacts || {};
    const comp = currentDossier.compatibility_breakdown || {};
    
    const maxWage = getOtherOffersMaxWage();
    if(terms.monthly_wage > maxWage) pros.push('Maior salário entre as propostas recebidas.');
    else if(terms.monthly_wage < maxWage * 0.8) cons.push('Menor salário entre as propostas.');
    
    const minClause = getOtherOffersMinClause();
    if(terms.release_clause > minClause * 1.5) cons.push('Multa rescisória muito elevada (dificulta transferência).');
    else if(terms.release_clause <= minClause) pros.push('Multa acessível (facilita saída).');
    
    if(terms.duration_seasons >= 3) cons.push('Contrato longo de '+terms.duration_seasons+' temporadas (preso ao clube).');
    else pros.push('Contrato mais curto (maior liberdade).');
    
    if(terms.squad_role === 'Titular' || terms.squad_role === 'Estrela') pros.push('Você chega como '+terms.squad_role+'.');
    if(terms.squad_role === 'Promessa' || terms.squad_role === 'Reserva') cons.push('Iniciará com poucos minutos garantidos ('+terms.squad_role+').');
    
    const myOvr = currentPlayer?.ovr || 50;
    let betterComps = 0;
    (currentDossier.competitors || []).forEach(c => { if(c.ovr > myOvr) betterComps++; });
    if(betterComps > 0) cons.push(`Concorrência alta (${betterComps} titular(es) com OVR superior).`);
    else pros.push('Baixa concorrência. Ninguém acima do seu nível (OVR).');
    
    const morale = co.morale_initial_bonus || 0;
    if(morale > 0) pros.push('Treinador amigável: tolera falhas e recupera confiança.');
    if(morale < 0) cons.push('Treinador rígido: pouca paciência para erros.');
    
    const acStats = [
        {name: 'Físico', val: ac.physical}, {name: 'Tática', val: ac.tactical},
        {name: 'Técnica', val: ac.technical}, {name: 'Velocidade', val: ac.speed},
        {name: 'Recuperação', val: ac.recovery}
    ];
    acStats.sort((a,b) => b.val - a.val);
    const bestStat = acStats[0];
    const worstStat = acStats[acStats.length - 1];
    if(bestStat.val >= 4) pros.push(`A estrutura acelerará fortemente o treino de ${bestStat.name}.`);
    if(worstStat.val <= 2) cons.push(`Déficit estrutural irá prejudicar evolução de ${worstStat.name}.`);
    
    if(comp.positive_factors && comp.positive_factors.length > 0) pros.push("Tática: " + comp.positive_factors[0]);
    if(comp.negative_factors && comp.negative_factors.length > 0) cons.push("Tática: " + comp.negative_factors[0]);
    
    return { pros, cons };
}

function calculateImpacts() {
    const terms = currentDossier.offer.current_terms;
    const ac = currentDossier.academy || { physical: 3, tactical: 3, technical: 3, speed: 3, recovery: 3 };
    const club = currentDossier.club || {};
    
    const myOvr = currentPlayer?.ovr || 50;
    let betterComps = 0;
    (currentDossier.competitors || []).forEach(c => { if(c.ovr > myOvr) betterComps++; });
    
    let minutos = 'Médio'; let minutosExp = 'Disputará vaga frequentemente.';
    if(terms.squad_role === 'Titular' && betterComps === 0) { minutos = 'Muito Alto'; minutosExp = 'Você chega como Titular e sem concorrentes superiores diretos.'; }
    else if(terms.squad_role === 'Titular') { minutos = 'Alto'; minutosExp = 'Titular, mas ainda possui concorrência no elenco.'; }
    else if(terms.squad_role === 'Promessa') { minutos = 'Muito Baixo'; minutosExp = 'Projetado apenas para compor elenco. Poucas oportunidades.'; }
    
    let dev = 'Médio'; let devExp = 'Estrutura padrão.';
    let avgAc = (ac.physical + ac.tactical + ac.technical + ac.speed + ac.recovery) / 5;
    if(avgAc >= 4) { dev = 'Alto'; devExp = 'Centro formador de elite. Desenvolvimento veloz.'; }
    if(avgAc <= 2.5) { dev = 'Baixo'; devExp = 'Instalações básicas. Prejudica a evolução.'; }
    
    let rec = 'Médio'; let recExp = 'Fator de lesões é equilibrado.';
    if(ac.recovery >= 4) { rec = 'Alto'; recExp = 'Redução direta no risco e duração de lesões.'; }
    if(ac.recovery <= 2) { rec = 'Baixo'; recExp = 'Maior risco físico durante temporadas intensas.'; }
    
    let pres = 'Média'; let presExp = 'Pressão tolerável por resultados.';
    const rep = club.reputation || 3;
    if(rep >= 4 && terms.squad_role === 'Titular') { pres = 'Muito Alta'; presExp = 'Você é titular em um clube de reputação alta. Cobrança imediata.'; }
    else if(rep >= 4) { pres = 'Alta'; presExp = 'A torcida é exigente.'; }
    else if(rep <= 2) { pres = 'Baixa'; presExp = 'Clube ideal para errar e evoluir sem pressão da mídia.'; }
    
    let fin = 'Médio'; let finExp = `Seu contrato oferece R$ ${terms.monthly_wage}.`;
    const maxWage = getOtherOffersMaxWage();
    if(terms.monthly_wage > maxWage) { fin = 'Alto'; finExp = 'Este é o maior salário e bônus entre as propostas disponíveis.'; }
    if(terms.monthly_wage < maxWage * 0.7) { fin = 'Baixo'; finExp = 'O retorno financeiro inicial é menor que suas outras propostas.'; }
    
    let lib = 'Média'; let libExp = 'Contrato de ' + terms.duration_seasons + ' temporada(s) com multa de R$ ' + terms.release_clause + '.';
    if(terms.duration_seasons >= 3 && terms.release_clause >= 800000) { lib = 'Baixa'; libExp = 'O clube exige compromisso longo e taxa alta.'; }
    if(terms.duration_seasons <= 2 && terms.release_clause <= 400000) { lib = 'Alta'; libExp = 'Fácil de ser negociado futuramente.'; }
    
    return [
        { title: 'Minutos em campo', val: minutos, exp: minutosExp, color: (minutos==='Muito Alto'||minutos==='Alto')?'var(--primary)':'#f59e0b' },
        { title: 'Desenvolvimento', val: dev, exp: devExp, color: (dev==='Alto')?'var(--primary)':'#f59e0b' },
        { title: 'Recuperação', val: rec, exp: recExp, color: (rec==='Alto')?'var(--primary)':'#f59e0b' },
        { title: 'Pressão', val: pres, exp: presExp, color: (pres==='Muito Alta'||pres==='Alta')?'#ef4444':'var(--primary)' },
        { title: 'Retorno financeiro', val: fin, exp: finExp, color: (fin==='Alto')?'var(--primary)':'#f59e0b' },
        { title: 'Liberdade futura', val: lib, exp: libExp, color: (lib==='Alta')?'var(--primary)':'#ef4444' }
    ];
}

function getAgentAdvice() {
    const impacts = calculateImpacts();
    const isBestWage = impacts.find(i => i.title === 'Retorno financeiro').val === 'Alto';
    const isTitular = currentDossier.offer.current_terms.squad_role === 'Titular';
    const isLong = currentDossier.offer.current_terms.duration_seasons >= 3;
    const isGreatDev = impacts.find(i => i.title === 'Desenvolvimento').val === 'Alto';
    const pres = impacts.find(i => i.title === 'Pressão').val;
    const isHighPres = pres === 'Muito Alta' || pres === 'Alta';
    
    if(isBestWage && isTitular && isHighPres) return "Esta é a proposta para jogar e faturar imediatamente. Você chega como Titular. Entretanto, você sofrerá enorme pressão no clube.";
    if(isGreatDev && isLong) return "É a melhor academia, mas o contrato longo e a multa elevada reduzem sua liberdade. Você terá que ter paciência para se desenvolver.";
    if(isTitular && !isGreatDev) return "A estrutura física é limitada, mas você terá titularidade imediata e vitrine. Uma ponte rápida para um clube maior.";
    return "É a escolha mais equilibrada. Você não terá a maior vantagem absoluta, mas também não enfrenta grandes riscos contratuais ou pressão esmagadora.";
}

function renderDossierOverview() {
    const club = currentDossier.club;
    const compat = currentDossier.compatibility_breakdown;
    const imgUrl = getClubImage(club.name);
    
    const { pros, cons } = generateProsCons();
    const impacts = calculateImpacts();
    
    let prosHtml = pros.map(p => `<li><strong style="color:var(--primary)">+</strong> ${p}</li>`).join('');
    let consHtml = cons.map(p => `<li><strong style="color:#ef4444">-</strong> ${p}</li>`).join('');
    
    let impactHtml = impacts.map(i => `
        <div class="compat-card" style="align-items:flex-start; text-align:left;">
            <span style="font-size:0.75rem; text-transform:uppercase">${i.title}</span>
            <strong style="color:${i.color}">${i.val}</strong>
            <p style="font-size:0.75rem; color:var(--text-secondary); margin-top:0.5rem">${i.exp}</p>
        </div>
    `).join('');

    document.getElementById('fmOverview').innerHTML = `
        <div class="dossier-header-grid">
            <img src="${imgUrl}" alt="${club.name}" onerror="this.outerHTML='<div class=\'club-crest-fallback\'>${club.name.substring(0,3)}</div>'">
            <div>
                <h2>${club.name}</h2>
                <div style="display:flex; gap: 1rem; margin-top: 1rem;">
                    <span style="padding: 0.5rem; background: var(--bg-page); border-radius: 4px; font-weight:600">OVR ${club.ovr}</span>
                    <span style="padding: 0.5rem; background: var(--bg-page); border-radius: 4px; font-weight:600">Formação ${club.formation}</span>
                    <span style="padding: 0.5rem; background: var(--bg-page); border-radius: 4px; font-weight:600">Estilo ${club.style}</span>
                </div>
            </div>
        </div>
        
        <div style="display:flex; gap:1rem; margin-bottom:2rem;">
            <div style="flex:1; background:var(--bg-page); padding:1rem; border-radius:8px; border-left:3px solid var(--primary)">
                <h4 style="margin-top:0; margin-bottom:0.5rem; color:var(--primary)">VANTAGENS PARA SUA CARREIRA</h4>
                <ul style="margin:0; padding-left:1rem; font-size:0.85rem; color:var(--text-secondary)">
                    ${prosHtml}
                </ul>
            </div>
            <div style="flex:1; background:var(--bg-page); padding:1rem; border-radius:8px; border-left:3px solid #ef4444">
                <h4 style="margin-top:0; margin-bottom:0.5rem; color:#ef4444">RISCOS E DESVANTAGENS</h4>
                <ul style="margin:0; padding-left:1rem; font-size:0.85rem; color:var(--text-secondary)">
                    ${consHtml}
                </ul>
            </div>
        </div>

        <h3 style="margin-bottom:1rem; border-bottom: 1px solid var(--border); padding-bottom:0.5rem">IMPACTO DESTA ESCOLHA</h3>
        <div class="compat-grid">
            ${impactHtml}
        </div>
    `;
}

function renderDossierSquad() {
    const roster = currentDossier.roster || [];
    const competitors = currentDossier.competitors || [];
    const myOvr = currentPlayer?.ovr || 50;
    const compat = currentDossier.compatibility_breakdown;
    
    let compHtml = `<p>Você não tem concorrência direta nesta posição.</p>`;
    let positionStr = competitors.length + 1;
    let rankNum = 1;
    competitors.forEach(c => { if(c.ovr > myOvr) rankNum++; });
    let chance = 100 - ((rankNum-1) * 25);
    if(chance < 10) chance = 10;

    if (competitors.length > 0) {
        compHtml = `<div class="squad-list">` + competitors.map(c => `
            <div class="squad-player competitor ${c.is_starter ? 'starter' : ''}" style="border-left: 3px solid ${c.ovr > myOvr ? '#ef4444' : 'var(--primary)'}">
                <div>
                    <strong>${c.name}</strong> ${c.is_starter ? '(Titular)' : '(Reserva)'}
                    <div style="font-size:0.75rem; color:var(--text-secondary)">OVR ${c.ovr}</div>
                </div>
            </div>
        `).join('') + `</div>`;
    }

    document.getElementById('fmSquad').innerHTML = `
        <h3 style="margin-bottom:1rem; border-bottom: 1px solid var(--border); padding-bottom:0.5rem">Concorrência na sua posição</h3>
        <div style="background:var(--bg-page); padding:1rem; border-radius:8px; margin-bottom:1rem; display:flex; justify-content:space-around; text-align:center">
            <div>
                <div style="font-size:0.8rem; color:var(--text-secondary)">Concorrentes</div>
                <strong style="font-size:1.2rem">${competitors.length}</strong>
            </div>
            <div>
                <div style="font-size:0.8rem; color:var(--text-secondary)">Sua Hierarquia Estimada</div>
                <strong style="font-size:1.2rem">${rankNum}º Opção</strong>
            </div>
            <div>
                <div style="font-size:0.8rem; color:var(--text-secondary)">Vagas (Formação)</div>
                <strong style="font-size:1.2rem">${compat.snapshot?.slots_needed || 'N/A'}</strong>
            </div>
            <div>
                <div style="font-size:0.8rem; color:var(--text-secondary)">Chance Inicial de Minutos</div>
                <strong style="font-size:1.2rem; color:${chance > 50 ? 'var(--primary)' : '#ef4444'}">${chance}%</strong>
            </div>
        </div>
        ${compHtml}
        <div class="squad-list" style="margin-top:1rem">
            <div class="squad-player" style="border-left: 3px solid var(--primary); background:rgba(37,99,235,0.1)">
                <div>
                    <strong style="color:var(--primary)">Seu Jogador</strong>
                    <div style="font-size:0.75rem; color:var(--text-secondary)">OVR ${myOvr}</div>
                </div>
            </div>
        </div>
    `;
}

function renderDossierAcademy() {
    const acad = currentDossier.academy;
    const acStats = [
        { name: 'Força Física e Resistência', val: acad.physical || 3, mod: (acad.physical-3)*5 },
        { name: 'Leitura e Inteligência Tática', val: acad.tactical || 3, mod: (acad.tactical-3)*5 },
        { name: 'Técnica, Drible e Passe', val: acad.technical || 3, mod: (acad.technical-3)*5 },
        { name: 'Aceleração e Velocidade', val: acad.speed || 3, mod: (acad.speed-3)*5 },
        { name: 'Recuperação e Risco de Lesão', val: acad.recovery || 3, mod: (acad.recovery-3)*5 }
    ];
    acStats.sort((a,b) => b.val - a.val);

    const formatMod = (m) => m > 0 ? `+${m}% de evolução` : (m < 0 ? `${m}% de evolução` : `Evolução Padrão`);

    const compHtml = acStats.map(s => `
        <div class="compat-card" style="align-items:flex-start; text-align:left;">
            <span style="font-weight:600">${s.name}</span>
            <strong style="color:${s.val >= 4 ? 'var(--primary)' : (s.val <= 2 ? '#ef4444' : 'var(--text)')}">${s.val} Estrelas</strong>
            <p style="font-size:0.75rem; color:var(--text-secondary); margin-top:0.5rem">${formatMod(s.mod)}</p>
        </div>
    `).join('');

    document.getElementById('fmAcademy').innerHTML = `
        <div class="dossier-header-grid" style="grid-template-columns: 1fr">
            <h2>Desenvolvimento de Carreira</h2>
            <p>Se você escolher este clube, em que seu jogador evoluirá mais? Em que ele ficará para trás?</p>
        </div>
        <div style="background:var(--bg-page); padding:1rem; border-radius:8px; margin-bottom:1.5rem">
            <strong>Maior Vantagem Estrutural:</strong> O clube foca em ${acStats[0].name}.<br>
            <strong>Pior Risco Estrutural:</strong> Déficit claro em ${acStats[acStats.length-1].name}.
        </div>
        <div class="compat-grid">
            ${compHtml}
        </div>
    `;
}

function renderDossierCoach() {
    const coach = currentDossier.coach;
    const club = currentDossier.club;
    const co = currentDossier.coach?.impacts || {};
    const moraleBonus = co.morale_initial_bonus || 0;
    const prefStyle = co.preferred_style || club.style;
    const prefForm = co.preferred_formation || club.formation;
    const prefArch = co.preferred_archetype || 'Qualquer';
    const comp = currentDossier.compatibility_breakdown || {};
    
    const myArch = currentPlayer?.arquetipo || 'Finalizador';

    document.getElementById('fmCoach').innerHTML = `
        <div class="dossier-header-grid" style="grid-template-columns: 1fr">
            <h2>Treinador: ${coach.name}</h2>
            <p>Este treinador ajudará ou dificultará minha carreira?</p>
        </div>
        <div class="compat-grid" style="margin-bottom:2rem">
            <div class="compat-card" style="align-items:flex-start; text-align:left">
                <span style="font-size:0.75rem; text-transform:uppercase">Tolerância a Erros</span>
                <strong style="color:${moraleBonus > 0 ? 'var(--primary)' : (moraleBonus < 0 ? '#ef4444' : 'var(--text)')}">${moraleBonus > 0 ? 'Alta (Motivador)' : (moraleBonus < 0 ? 'Baixa (Rígido)' : 'Normal')}</strong>
                <p style="font-size:0.75rem; color:var(--text-secondary); margin-top:0.5rem">Impacto no moral após erros em campo.</p>
            </div>
            <div class="compat-card" style="align-items:flex-start; text-align:left">
                <span style="font-size:0.75rem; text-transform:uppercase">Esquema Base</span>
                <strong>${prefForm}</strong>
                <p style="font-size:0.75rem; color:var(--text-secondary); margin-top:0.5rem">Tática fixa exigida por este técnico.</p>
            </div>
            <div class="compat-card" style="align-items:flex-start; text-align:left">
                <span style="font-size:0.75rem; text-transform:uppercase">Preferência de Perfil</span>
                <strong>${prefArch}</strong>
                <p style="font-size:0.75rem; color:var(--text-secondary); margin-top:0.5rem">Seu arquétipo é ${myArch}.</p>
            </div>
        </div>
        
        <h3 style="margin-bottom:1rem; border-bottom: 1px solid var(--border); padding-bottom:0.5rem">Efeito Tático na sua Carreira</h3>
        <div style="background:var(--bg-page); padding:1rem; border-radius:8px;">
            <p style="font-weight:600; margin-bottom:0.5rem">Como o estilo ${prefStyle} afeta você:</p>
            <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:0.25rem"><strong style="color:var(--primary)">+</strong> ${comp.positive_factors?.[0] || 'Se encaixa de forma razoável ao seu jogo.'}</p>
            <p style="font-size:0.85rem; color:var(--text-secondary)"><strong style="color:#ef4444">-</strong> ${comp.negative_factors?.[0] || 'Sem impactos negativos severos mapeados.'}</p>
        </div>
    `;
}

function renderContractPanel() {
    const terms = currentDossier.offer.current_terms;
    const offer = currentDossier.offer;
    const panel = document.getElementById('contractPanel');
    
    const isClosed = ['accepted', 'rejected', 'withdrawn', 'expired'].includes(offer.status);
    
    let actionsHtml = '';
    if (offer.status === 'accepted') {
        actionsHtml = `<button class="btn-primary" disabled style="opacity:0.6">Contrato Assinado</button>`;
    } else if (isClosed) {
        actionsHtml = `<button class="btn-danger" disabled style="opacity:0.6">Proposta Encerrada</button>`;
    } else {
        const remainingRounds = 3 - offer.round;
        actionsHtml = `
            <div style="text-align:center; font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.5rem; font-weight:600">Rodadas restantes: ${remainingRounds}</div>
            <button class="btn-secondary" id="btnPreviewNegotiate" onclick="openNegotiateModal()">Negociar (Ver Contraproposta)</button>
            <button class="btn-primary" id="btnAccept" onclick="openAcceptModal()">Assinar Contrato</button>
            <button class="btn-danger" id="btnReject" onclick="openRejectModal()" style="margin-top:0.5rem; background:transparent; border:1px solid #ef4444; color:#ef4444">Recusar Proposta</button>
        `;
    }
    
    let adviceHtml = getAgentAdvice();

    panel.innerHTML = `
        <div style="background:var(--bg-page); border-left:3px solid var(--primary); padding:1rem; margin-bottom:1.5rem; border-radius:4px">
            <strong style="color:var(--primary); font-size:0.8rem; text-transform:uppercase">Conselho do Agente</strong>
            <p style="font-size:0.85rem; margin-top:0.5rem; line-height:1.4">${adviceHtml}</p>
        </div>
        
        <h3>Termos do Contrato</h3>
        <div class="contract-grid" id="contractForm" style="margin-top:1rem; margin-bottom:1rem;">
            <div class="contract-row"><label>Salário Mensal</label><strong>R$ ${terms.monthly_wage}</strong></div>
            <div class="contract-row"><label>Duração</label><strong>${terms.duration_seasons} Temporada(s)</strong></div>
            <div class="contract-row"><label>Bônus Assinatura</label><strong>R$ ${terms.signing_bonus}</strong></div>
            <div class="contract-row"><label>Multa Rescisória</label><strong>R$ ${terms.release_clause}</strong></div>
            <div class="contract-row"><label>Função no Elenco</label><strong>${terms.squad_role}</strong></div>
        </div>
        ${actionsHtml}
    `;
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
        <p style="color:var(--text-secondary); margin-bottom:1rem">Você está solicitando as seguintes alterações. O clube avaliará o custo total dessas exigências com base na postura atual (${currentDossier.offer.internal_tolerance?.stance}).</p>
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
