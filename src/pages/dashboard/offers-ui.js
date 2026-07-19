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
    if(!compactCard) return;
    if(!currentPlayer) return;
    
    const avatarFile = currentPlayer.avatar ? (currentPlayer.avatar.includes('.') ? currentPlayer.avatar : currentPlayer.avatar + '.webp') : 'avatar1.webp';
    compactCard.innerHTML = `
        <div class="player-compact-card gamified-card">
            <img src="img/avatar/${avatarFile}" alt="Avatar">
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



async function selectOffer(offerId) {
    try {
        selectedOfferId = offerId;
        const dossier = await getOfferDetails(offerId);
        currentDossier = dossier;
        
        // Render UI
        renderOffersSidebar(activeOffers);
        renderDossierOverview();
        renderContractPanel();
        
        // Hide fallback/loading if any, though we don't strictly need it in FM layout since panels are always there
    } catch(e) {
        showToast(null, "Erro ao carregar dossiê: " + e.message, "error");
    }
}

function renderOffersSidebar(offers) {
    const list = document.getElementById('offersList');
    document.getElementById('offersCount').innerText = offers.length;
    list.innerHTML = '';
    
    offers.forEach(offer => {
        const club = offer.base_clubs;
        if (!club) return;
        const imgUrl = getClubImage(club.name);
        
        let statusText = 'Interessado';
        let statusClass = 'fm-status-med';
        if (offer.status === 'accepted') { statusText = 'Aceita'; statusClass = 'fm-status-high'; }
        else if (offer.status === 'rejected' || offer.status === 'withdrawn' || offer.status === 'expired') { statusText = 'Encerrada'; statusClass = 'fm-status-low'; }
        else if (offer.status === 'countered') { statusText = 'Em Negociação'; statusClass = 'fm-status-med'; }
        else if (offer.is_emergency) { statusText = 'Emergencial'; statusClass = 'fm-status-low'; }
        else {
            const compat = offer.compatibility_breakdown?.compatibility_total || offer.compatibility_breakdown?.total || 0;
            if (compat >= 85) { statusText = 'Muito Interessado'; statusClass = 'fm-status-high'; }
            else if (compat >= 60) { statusText = 'Interessado'; statusClass = 'fm-status-med'; }
            else { statusText = 'Pouco Interesse'; statusClass = 'fm-status-low'; }
        }

        const isClosed = ['accepted', 'rejected', 'withdrawn', 'expired'].includes(offer.status);
        
        const card = document.createElement('div');
        card.className = `fm-offer-card ${offer.id === selectedOfferId ? 'active' : ''}`;
        card.dataset.id = offer.id;
        
        const stars = Math.max(1, Math.min(5, club.reputation));
        const starsHtml = '★'.repeat(stars) + '☆'.repeat(5-stars);
        
        card.innerHTML = `
            <img src="${imgUrl}" alt="${club.name}" onerror="this.outerHTML='<div class=\'club-crest-fallback\' style=\'width:48px;height:48px\'>${club.name.substring(0,3)}</div>'">
            <div class="fm-offer-info">
                <h4>${club.name}</h4>
                <div class="fm-stars">${starsHtml}</div>
                <p>Função: ${offer.current_terms.squad_role}</p>
                <p>Status: <span class="${statusClass}">${statusText}</span></p>
            </div>
            <span class="fm-offer-status ${statusClass}">${statusClass === 'fm-status-high' ? 'Alta' : (statusClass === 'fm-status-med' ? 'Média' : 'Baixa')}</span>
        `;
        card.onclick = async () => {
            await selectOffer(offer.id);
        };
        list.appendChild(card);
    });
}


// --------------------------------------------------------------------------------------
// DATA CALCULATION ENGINE
// --------------------------------------------------------------------------------------

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
    const club = currentDossier.club || {};
    const comp = currentDossier.compatibility_breakdown || {};
    
    // Wage
    const maxWage = getOtherOffersMaxWage();
    if(terms.monthly_wage > maxWage) pros.push('Maior salário entre as propostas.');
    else if(terms.monthly_wage < maxWage * 0.8) cons.push('Menor salário entre as propostas principais.');
    
    // Clause
    const minClause = getOtherOffersMinClause();
    if(terms.release_clause > minClause * 1.5) cons.push('Multa elevada (dificulta saída).');
    else if(terms.release_clause <= minClause) pros.push('Multa acessível (facilita transferência).');
    
    // Duration
    if(terms.duration_seasons >= 3) cons.push('Contrato longo (menor liberdade futura).');
    else pros.push('Contrato curto (mais liberdade).');
    
    // Role & Competitors
    if(terms.squad_role === 'Titular' || terms.squad_role === 'Estrela') pros.push(`Chance alta de titularidade inicial (${terms.squad_role}).`);
    if(terms.squad_role === 'Promessa' || terms.squad_role === 'Reserva') cons.push(`Poucos minutos iniciais garantidos (${terms.squad_role}).`);
    
    const myOvr = currentPlayer?.ovr || 50;
    let betterComps = 0;
    (currentDossier.competitors || []).forEach(c => { if(c.ovr > myOvr) betterComps++; });
    if(betterComps > 0) cons.push(`Concorrência alta (${betterComps} jogador(es) com OVR superior).`);
    else pros.push('Baixa concorrência direta no elenco.');
    
    // Coach
    const morale = co.morale_initial_bonus || 0;
    if(morale > 0) pros.push('Treinador tolerante a erros (Motivador).');
    if(morale < 0) cons.push('Treinador não tolerante (Rígido/Duro).');
    
    // Academy
    const acStats = [
        {name: 'Força Física', val: ac.physical}, {name: 'Tática', val: ac.tactical},
        {name: 'Técnica', val: ac.technical}, {name: 'Velocidade', val: ac.speed},
        {name: 'Recuperação', val: ac.recovery}
    ];
    acStats.sort((a,b) => b.val - a.val);
    const bestStat = acStats[0];
    const worstStat = acStats[acStats.length - 1];
    if(bestStat.val >= 4) pros.push(`Evolução superior em ${bestStat.name} (${bestStat.val}★).`);
    if(worstStat.val <= 2) cons.push(`Evolução inferior em ${worstStat.name} (${worstStat.val}★).`);
    
    // Tactical
    if(comp.positive_factors && comp.positive_factors.length > 0) pros.push(comp.positive_factors[0]);
    if(comp.negative_factors && comp.negative_factors.length > 0) cons.push(comp.negative_factors[0]);
    
    return { pros, cons };
}

function calculateImpacts() {
    const terms = currentDossier.offer.current_terms;
    const ac = currentDossier.academy || { physical: 3, tactical: 3, technical: 3, speed: 3, recovery: 3 };
    const co = currentDossier.coach?.impacts || {};
    const club = currentDossier.club || {};
    
    const myOvr = currentPlayer?.ovr || 50;
    let betterComps = 0;
    (currentDossier.competitors || []).forEach(c => { if(c.ovr > myOvr) betterComps++; });
    
    // 1. Minutos
    let minutos = 'Médio';
    let minutosExp = 'Você lutará por espaço na rotação.';
    if(terms.squad_role === 'Titular' && betterComps === 0) { minutos = 'Muito Alto'; minutosExp = 'Chega para assumir a posição de imediato.'; }
    else if(terms.squad_role === 'Titular') { minutos = 'Alto'; minutosExp = 'Titular, mas há concorrência no elenco.'; }
    else if(terms.squad_role === 'Promessa') { minutos = 'Muito Baixo'; minutosExp = 'Projetado apenas para compor elenco no futuro.'; }
    
    // 2. Desenvolvimento
    let dev = 'Médio';
    let avgAc = (ac.physical + ac.tactical + ac.technical + ac.speed + ac.recovery) / 5;
    let devExp = 'Estrutura na média nacional.';
    if(avgAc >= 4) { dev = 'Alto'; devExp = 'Excelente centro formador (Garante +XP).'; }
    if(avgAc <= 2.5) { dev = 'Baixo'; devExp = 'Instalações básicas (Risco de estagnação).'; }
    
    // 3. Recuperação
    let rec = 'Médio'; let recExp = 'Recuperação de lesões no tempo padrão.';
    if(ac.recovery >= 4) { rec = 'Alto'; recExp = 'Departamento médico moderno (-30% dias de lesão).'; }
    if(ac.recovery <= 2) { rec = 'Baixo'; recExp = 'Infraestrutura precária (+20% dias de lesão).'; }
    
    // 4. Pressão
    let pres = 'Média'; let presExp = 'Cobrança padrão por resultados.';
    const rep = club.reputation || 3;
    if(rep >= 4 && terms.squad_role === 'Titular') { pres = 'Muito Alta'; presExp = 'Clube grande e você é titular. Erros não serão perdoados.'; }
    else if(rep >= 4) { pres = 'Alta'; presExp = 'A torcida exige resultados imediatos.'; }
    else if(rep <= 2) { pres = 'Baixa'; presExp = 'Clube com pouca exposição. Ideal para errar e aprender.'; }
    
    // 5. Retorno Financeiro
    let fin = 'Médio'; let finExp = `Salário base de R$ ${terms.monthly_wage}.`;
    const maxWage = getOtherOffersMaxWage();
    if(terms.monthly_wage > maxWage) { fin = 'Alto'; finExp = 'Maior proposta salarial recebida.'; }
    if(terms.monthly_wage < maxWage * 0.7) { fin = 'Baixo'; finExp = 'Proposta inferior financeiramente.'; }
    
    // 6. Liberdade Futura
    let lib = 'Média'; let libExp = 'Contrato padrão de 2 anos.';
    if(terms.duration_seasons >= 3 && terms.release_clause >= 800000) { lib = 'Baixa'; libExp = 'Contrato longo e multa pesada. Preso ao clube.'; }
    if(terms.duration_seasons <= 2 && terms.release_clause <= 400000) { lib = 'Alta'; libExp = 'Fácil transferência se você se destacar.'; }
    
    const colors = { 'Muito Alto': '#38c91f', 'Alto': '#84cc16', 'Médio': '#f59e0b', 'Média': '#f59e0b', 'Baixa': '#ef4444', 'Baixo': '#ef4444', 'Muito Baixo': '#dc2626', 'Muito Alta': '#dc2626' };
    
    return [
        { title: 'Minutos em campo', val: minutos, exp: minutosExp, color: colors[minutos] },
        { title: 'Desenvolvimento', val: dev, exp: devExp, color: colors[dev] },
        { title: 'Recuperação', val: rec, exp: recExp, color: colors[rec] },
        { title: 'Pressão', val: pres, exp: presExp, color: colors[pres] },
        { title: 'Retorno financeiro', val: fin, exp: finExp, color: colors[fin] },
        { title: 'Liberdade futura', val: lib, exp: libExp, color: colors[lib] }
    ];
}

function getAgentAdvice() {
    const impacts = calculateImpacts();
    const isBestWage = impacts.find(i => i.title === 'Retorno financeiro').val === 'Alto';
    const isTitular = currentDossier.offer.current_terms.squad_role === 'Titular';
    const isLong = currentDossier.offer.current_terms.duration_seasons >= 3;
    const isGreatDev = impacts.find(i => i.title === 'Desenvolvimento').val === 'Alto';
    const isHighPres = impacts.find(i => i.title === 'Pressão').val === 'Muito Alta' || impacts.find(i => i.title === 'Pressão').val === 'Alta';
    
    if(isBestWage && isTitular && isHighPres) return "Esta proposta oferece o maior salário e a titularidade imediata. É a escolha de maior risco e maior recompensa; você vai sofrer enorme pressão e os erros serão punidos, mas o retorno financeiro é imediato.";
    if(isGreatDev && isLong) return "É a melhor academia técnica, mas o contrato longo e a multa elevada reduzem muito sua liberdade futura. Se você escolher este clube, deve ter paciência para se desenvolver no banco antes de jogar.";
    if(isTitular && !isGreatDev) return "A estrutura é inferior, mas você terá tempo de jogo imediato e uma multa baixa. É a escolha perfeita para ser uma vitrine e sair rápido para um clube maior em 1 ano.";
    return "É uma escolha equilibrada. Você não terá o maior salário nem a garantia absoluta de jogar, mas a estrutura oferece segurança e a pressão não é extrema. Um passo seguro na carreira.";
}

// --------------------------------------------------------------------------------------
// RENDERERS
// --------------------------------------------------------------------------------------

function renderDossierOverview() {
    if (!currentDossier) return;
    const club = currentDossier.club;
    const offer = currentDossier.offer;
    
    // Overview Panel (Decision Comparator)
    const { pros, cons } = generateProsCons();
    const impacts = calculateImpacts();
    
    let prosHtml = pros.map(p => `<li style="margin-bottom:8px; display:flex; align-items:flex-start; gap:8px"><i data-lucide="check-circle-2" style="width:16px;height:16px;color:var(--green);flex-shrink:0;margin-top:2px"></i> <span>${p}</span></li>`).join('');
    let consHtml = cons.map(p => `<li style="margin-bottom:8px; display:flex; align-items:flex-start; gap:8px"><i data-lucide="x-circle" style="width:16px;height:16px;color:var(--danger);flex-shrink:0;margin-top:2px"></i> <span>${p}</span></li>`).join('');
    
    let impactHtml = impacts.map(i => `
        <div style="background:var(--bg-app); border:1px solid var(--line); border-radius:8px; padding:12px;">
            <div style="font-size:0.75rem; font-weight:800; color:var(--muted); text-transform:uppercase; margin-bottom:4px">${i.title}</div>
            <div style="font-size:1.1rem; font-weight:900; color:${i.color}; margin-bottom:6px">${i.val}</div>
            <p style="font-size:0.75rem; color:var(--text); line-height:1.4">${i.exp}</p>
        </div>
    `).join('');

    document.getElementById('fmOverview').innerHTML = `
        <div style="padding:1.5rem">
            <div style="background:rgba(56,201,31,0.05); border:1px solid rgba(56,201,31,0.2); border-radius:12px; padding:1.25rem; margin-bottom:1.5rem">
                <h3 style="font-size:1rem; font-weight:900; color:var(--green); margin-bottom:1rem; display:flex; align-items:center; gap:8px"><i data-lucide="trending-up" style="width:20px;height:20px"></i> POR QUE ACEITAR?</h3>
                <ul style="list-style:none; padding:0; margin:0; font-size:0.85rem; font-weight:600; color:var(--text)">
                    ${prosHtml}
                </ul>
            </div>
            <div style="background:rgba(239,68,68,0.05); border:1px solid rgba(239,68,68,0.2); border-radius:12px; padding:1.25rem; margin-bottom:2rem">
                <h3 style="font-size:1rem; font-weight:900; color:var(--danger); margin-bottom:1rem; display:flex; align-items:center; gap:8px"><i data-lucide="alert-triangle" style="width:20px;height:20px"></i> POR QUE PENSAR DUAS VEZES?</h3>
                <ul style="list-style:none; padding:0; margin:0; font-size:0.85rem; font-weight:600; color:var(--text)">
                    ${consHtml}
                </ul>
            </div>
            
            <h3 style="font-size:1.2rem; font-weight:900; color:var(--text); margin-bottom:1rem">IMPACTO DESTA ESCOLHA</h3>
            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px">
                ${impactHtml}
            </div>
        </div>
    `;

    // Academy Panel
    const ac = currentDossier.academy || { physical: 3, tactical: 3, technical: 3, speed: 3, recovery: 3 };
    const acStats = [
        { name: 'Força Física', val: ac.physical || 3, color: '#38c91f' },
        { name: 'Leitura Tática', val: ac.tactical || 3, color: '#0ea5e9' },
        { name: 'Técnica/Domínio', val: ac.technical || 3, color: '#8b5cf6' },
        { name: 'Velocidade', val: ac.speed || 3, color: '#f59e0b' },
        { name: 'Prevenção Médica', val: ac.recovery || 3, color: '#ec4899' }
    ];
    acStats.sort((a,b) => b.val - a.val);
    const bestStat = acStats[0];
    const worstStat = acStats[acStats.length - 1];
    const avgStars = Math.round(((ac.physical||3) + (ac.tactical||3) + (ac.technical||3) + (ac.speed||3) + (ac.recovery||3)) / 5);

    const barsHtml = acStats.map(s => `
        <div class="premium-stat-row">
            <div class="premium-stat-label">${s.name}</div>
            <div class="premium-stat-bar-bg">
                <div class="premium-stat-bar-fill" style="width: ${s.val * 20}%; background: ${s.color};"></div>
            </div>
            <div class="premium-stat-val">${s.val * 20}</div>
        </div>
    `).join('');

    document.getElementById('fmAcademy').innerHTML = `
        <div style="padding:1.5rem">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem">
                <h3 style="font-size:1.2rem; font-weight:900; color:var(--text); margin:0">Estrutura de Base</h3>
                <div style="display:flex; gap:0.5rem; align-items:center">
                    <span style="font-size:0.8rem; font-weight:800; color:var(--muted)">NÍVEL GERAL</span>
                    <strong class="fm-stars" style="font-size:1.1rem">${'★'.repeat(avgStars)}${'☆'.repeat(5-avgStars)}</strong>
                </div>
            </div>
            <div class="fm-box" style="margin-bottom:1.5rem; padding: 1.25rem">
                <div style="margin-bottom:1rem; display:flex; align-items:center; gap:0.5rem">
                    <i data-lucide="bar-chart-2" style="width:18px;height:18px;color:var(--text)"></i>
                    <strong style="font-size:0.95rem; font-weight:900">Análise de Atributos</strong>
                </div>
                ${barsHtml}
            </div>
            <div class="fm-overview-grid" style="grid-template-columns:1fr 1fr; padding:0; gap:1.25rem;">
                <div class="fm-box" style="background:rgba(56, 201, 31, 0.05); border:1px solid rgba(56, 201, 31, 0.2)">
                    <div style="margin-bottom:0.75rem"><span class="badge-focus"><i data-lucide="trending-up" style="width:12px;height:12px"></i> Especialidade</span></div>
                    <div style="font-size:1.15rem; font-weight:900; color:var(--text); margin-bottom:0.4rem">${bestStat.name}</div>
                    <p style="font-size:0.75rem; color:var(--muted); line-height:1.4">Ganho de XP em ${bestStat.name.toLowerCase()} é <strong>+${(bestStat.val-2)*10}%</strong> mais rápido devido aos equipamentos de ponta.</p>
                </div>
                <div class="fm-box" style="background:rgba(239, 68, 68, 0.05); border:1px solid rgba(239, 68, 68, 0.2)">
                    <div style="margin-bottom:0.75rem"><span class="badge-deficit"><i data-lucide="alert-triangle" style="width:12px;height:12px"></i> Deficiência</span></div>
                    <div style="font-size:1.15rem; font-weight:900; color:var(--text); margin-bottom:0.4rem">${worstStat.name}</div>
                    <p style="font-size:0.75rem; color:var(--muted); line-height:1.4">Risco de estagnação. O déficit fará a evolução ser <strong>-${(5-worstStat.val)*10}%</strong> mais lenta.</p>
                </div>
            </div>
        </div>
    `;

    // Coach Panel
    const co = currentDossier.coach?.impacts || {};
    const coachImg = getClubImage(club.name).replace('clubs', 'avatar'); // Dummy for coach image
    const moraleBonus = co.morale_initial_bonus || 0;
    const prefStyle = co.preferred_style || 'Equilibrado';
    const prefForm = co.preferred_formation || '4-3-3';
    const prefArch = co.preferred_archetype || 'Qualquer';
    
    const moralePct = Math.max(0, Math.min(100, 50 + (moraleBonus * 10)));
    let moraleColor = '#f59e0b';
    if (moraleBonus > 0) moraleColor = 'var(--green)';
    if (moraleBonus < 0) moraleColor = 'var(--danger)';

    const coachNameStr = currentDossier.coach?.name || 'Treinador';

    document.getElementById('fmCoach').innerHTML = `
        <div style="padding:1.5rem">
            <h3 style="margin-bottom:1.5rem; font-size:1.2rem; font-weight:900; color:var(--text); margin-top:0">Comando Técnico</h3>
            <div class="coach-premium-card" style="margin-bottom:1.5rem">
                <img class="coach-premium-avatar" src="${coachImg}" alt="${coachNameStr}" onerror="this.src='img/avatar/avatar4.webp'">
                <div class="coach-premium-info">
                    <div class="coach-premium-name">${coachNameStr}</div>
                    <div class="coach-premium-tagline">
                        <i data-lucide="shield-check" style="width:16px;height:16px;color:var(--green)"></i> Treinador Principal
                    </div>
                    <div class="coach-premium-stats">
                        <div class="coach-stat-block"><span>Formação</span><strong>${prefForm}</strong></div>
                        <div class="coach-stat-block"><span>Estilo</span><strong>${prefStyle}</strong></div>
                        <div class="coach-stat-block"><span>Preferência</span><strong style="color:var(--green)">${prefArch}</strong></div>
                    </div>
                </div>
            </div>
            <div class="fm-overview-grid" style="grid-template-columns:1fr; padding:0; gap:1rem;">
                <div class="fm-box">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start">
                        <div>
                            <div class="fm-box-title">Gestão de Vestiário</div>
                            <div style="font-size:1.3rem; font-weight:900; color:${moraleColor}">${moraleBonus > 0 ? 'Motivador' : (moraleBonus < 0 ? 'Rígido' : 'Equilibrado')}</div>
                            <p style="font-size:0.8rem; color:var(--muted); margin-top:0.25rem; max-width:80%">O treinador ${moraleBonus > 0 ? 'tem facilidade em elevar a moral dos jogadores.' : (moraleBonus < 0 ? 'é duro e pune severamente atuações ruins.' : 'mantém um ambiente neutro sem grandes oscilações.')}</p>
                        </div>
                        <div style="width: 100px; text-align:right">
                            <span style="font-size:0.75rem; font-weight:800; color:var(--muted)">IMPACTO</span>
                            <div style="font-size:1.2rem; font-weight:900; color:${moraleColor}">${moraleBonus > 0 ? '+'+moraleBonus : moraleBonus} Moral</div>
                            <div class="morale-meter"><div class="morale-meter-fill" style="width: ${moralePct}%; background: ${moraleColor}"></div></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Roster Panel (Concorrência)
    const roster = currentDossier.roster || [];
    const comps = currentDossier.competitors || [];
    const myOvr = currentPlayer?.ovr || 50;
    
    let compHtml = comps.length > 0 ? comps.map(c => `
        <div class="fm-roster-item" style="border-left: 3px solid ${c.ovr > myOvr ? 'var(--danger)' : 'var(--green)'}; background:var(--bg-app); border-radius:8px; padding:10px 14px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
            <div>
                <strong style="font-size:0.95rem; display:block">${c.name}</strong>
                <span style="font-size:0.75rem; color:var(--muted)">${c.age} anos • ${c.is_starter ? 'Titular' : 'Reserva'}</span>
            </div>
            <div style="font-size:1.2rem; font-weight:900; color:var(--text)">${c.ovr}</div>
        </div>
    `).join('') : '<p style="font-size:0.85rem; color:var(--muted)">Não há concorrência direta no elenco. Vaga garantida.</p>';

    let vagas = prefForm.includes('4-3-3') ? 3 : 2; // Simples estimativa baseada na formacao
    let positionStr = comps.length + 1;
    let rankHtml = '';
    let rankNum = 1;
    comps.forEach(c => { if(c.ovr > myOvr) rankNum++; });
    
    let chance = 100 - ((rankNum-1) * 25);
    if(chance < 10) chance = 10;
    
    document.getElementById('fmRoster').innerHTML = `
        <div style="padding:1.5rem">
            <h3 style="margin-bottom:1rem; font-size:1.2rem; font-weight:900; color:var(--text)">Análise de Concorrência</h3>
            <div style="background:var(--bg-card); border:1px solid var(--line); border-radius:12px; padding:1.25rem; margin-bottom:1.5rem">
                <div style="display:flex; justify-content:space-between; align-items:center">
                    <div>
                        <div style="font-size:0.8rem; font-weight:800; color:var(--muted); text-transform:uppercase">Hierarquia Estimada</div>
                        <div style="font-size:1.5rem; font-weight:900; color:var(--text)">${rankNum}º Opção</div>
                    </div>
                    <div style="text-align:right">
                        <div style="font-size:0.8rem; font-weight:800; color:var(--muted); text-transform:uppercase">Chance de Minutos</div>
                        <div style="font-size:1.5rem; font-weight:900; color:${chance > 50 ? 'var(--green)' : 'var(--danger)'}">${chance}%</div>
                    </div>
                </div>
            </div>
            <h4 style="font-size:0.9rem; font-weight:800; color:var(--muted); margin-bottom:0.75rem; text-transform:uppercase">Concorrentes Diretos (${comps.length})</h4>
            ${compHtml}
            <div class="fm-roster-item" style="border-left: 3px solid var(--primary); background:rgba(21,99,235,0.05); border-radius:8px; padding:10px 14px; margin-top:8px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <strong style="font-size:0.95rem; display:block; color:var(--primary)">Seu Jogador</strong>
                    <span style="font-size:0.75rem; color:var(--muted)">A chegar • ${currentDossier.offer.current_terms.squad_role}</span>
                </div>
                <div style="font-size:1.2rem; font-weight:900; color:var(--primary)">${myOvr}</div>
            </div>
        </div>
    `;

    // Comparison Tab
    const compOptionsHtml = activeOffers.map(o => `
        <div style="display:flex; justify-content:space-between; border-bottom:1px solid var(--line); padding:10px 0">
            <span style="font-weight:700; color:var(--text)">${o.base_clubs.name}</span>
            <strong style="color:var(--green)">R$ ${o.current_terms.monthly_wage} / ${o.current_terms.squad_role}</strong>
        </div>
    `).join('');

    const elComp = document.getElementById('fmComparison');
    if (elComp) {
        elComp.innerHTML = `
            <div style="padding:1.5rem">
                <h3 style="margin-bottom:1rem; font-size:1.2rem; font-weight:900; color:var(--text)">Comparativo Rápido (Todas Ofertas)</h3>
                <div style="background:var(--bg-app); border:1px solid var(--line); border-radius:12px; padding:1.25rem;">
                    ${compOptionsHtml}
                </div>
                <p style="font-size:0.8rem; color:var(--muted); margin-top:1rem">A análise detalhada de prós, contras e impactos foca nesta proposta selecionada em relação a estas concorrentes acima.</p>
            </div>
        `;
    }

    if (window.lucide) window.lucide.createIcons();
}

function renderContractPanel() {
    const terms = currentDossier.offer.current_terms;
    const offer = currentDossier.offer;
    const isClosed = ['accepted', 'rejected', 'withdrawn', 'expired'].includes(offer.status);
    
    const advice = getAgentAdvice();
    
    let actionsHtml = '';
    if (offer.status === 'accepted') {
        actionsHtml = `<div style="text-align:center; padding:1.5rem; background:rgba(56, 201, 31, 0.1); border:1px solid var(--green); border-radius:12px;"><h4 style="color:var(--green); font-size:1.2rem; font-weight:900; margin-bottom:0.5rem">Proposta Aceita!</h4><p style="color:var(--text); font-size:0.9rem; font-weight:600">Este é o seu novo clube. Aguardando assinatura formal e apresentação.</p></div>`;
    } else if (isClosed) {
        actionsHtml = `<div style="text-align:center; padding:1.5rem; background:var(--bg-app); border:1px solid var(--line); border-radius:12px;"><h4 style="color:var(--muted); font-size:1.2rem; font-weight:900; margin-bottom:0.5rem">Oferta ${offer.status === 'withdrawn' ? 'Retirada' : 'Encerrada'}</h4><p style="color:var(--muted); font-size:0.9rem; font-weight:600">A negociação com este clube foi encerrada.</p></div>`;
    } else {
        actionsHtml = `
            <div class="fm-action-bar">
                <button class="btn-fm btn-fm-accept" onclick="openAcceptModal()"><i data-lucide="check" style="width:18px;height:18px"></i> Assinar Contrato</button>
                <button class="btn-fm btn-fm-negotiate" onclick="openNegotiateModal()"><i data-lucide="arrow-left-right" style="width:18px;height:18px"></i> Negociar Termos</button>
            </div>
        `;
    }

    document.getElementById('fmContract').innerHTML = `
        <div style="padding:1.5rem">
            
            <div style="background:linear-gradient(135deg, rgba(20,20,20,1) 0%, rgba(30,40,60,1) 100%); border:1px solid #3b82f6; border-radius:12px; padding:1.25rem; margin-bottom:1.5rem; position:relative; overflow:hidden">
                <div style="position:absolute; right:-20px; top:-20px; opacity:0.1"><i data-lucide="messages-square" style="width:100px;height:100px;color:#3b82f6"></i></div>
                <h4 style="font-size:0.8rem; font-weight:900; color:#60a5fa; text-transform:uppercase; margin-bottom:0.5rem; display:flex; align-items:center; gap:6px"><i data-lucide="user" style="width:14px;height:14px"></i> CONSELHO DO SEU AGENTE</h4>
                <p style="font-size:0.9rem; color:#f8fafc; line-height:1.5; font-weight:600; position:relative; z-index:1">${advice}</p>
            </div>

            <h3 style="margin-bottom:1rem; font-size:1.1rem; font-weight:800; color:var(--text)">Termos da Oferta (Rodada ${offer.round})</h3>
            <div class="fm-box" style="margin-bottom:1.5rem">
                <div class="fm-data-row" style="padding:0.75rem 0"><span>Salário Mensal</span><strong style="font-size:1.1rem; color:var(--green)">R$ ${terms.monthly_wage.toLocaleString('pt-BR')}</strong></div>
                <div class="fm-data-row" style="padding:0.75rem 0"><span>Duração</span><strong style="font-size:1.1rem">${terms.duration_seasons} Temporada(s)</strong></div>
                <div class="fm-data-row" style="padding:0.75rem 0"><span>Multa Rescisória</span><strong style="font-size:1.1rem">R$ ${terms.release_clause.toLocaleString('pt-BR')}</strong></div>
                <div class="fm-data-row" style="padding:0.75rem 0; border:none"><span>Função no Elenco</span><strong style="font-size:1.1rem">${terms.squad_role}</strong></div>
            </div>
            
            ${actionsHtml}
        </div>
    `;

    if (window.lucide) window.lucide.createIcons();
}
function openNegotiateModal() {
    const modal = document.getElementById('signModal');
    const terms = currentDossier.offer.current_terms;
    const tolerance = currentDossier.offer.internal_tolerance || 100;
    
    let toleranceColor = 'var(--green)';
    if (tolerance < 60) toleranceColor = '#f59e0b';
    if (tolerance < 30) toleranceColor = 'var(--danger)';
    
    const body = document.getElementById('signModalBody');
    
    // Add lucide icons script to run after innerHTML
    setTimeout(() => {
        if(window.lucide) window.lucide.createIcons();
    }, 50);

    body.innerHTML = `
        <div class="negotiation-premium-ui" style="display:flex; flex-direction:column; gap:1.5rem; animation: slideUp 0.3s ease-out">
            <div class="patience-meter" style="background: rgba(0,0,0,0.15); border: 1px solid var(--line); border-radius: 12px; padding: 1.25rem;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem">
                    <span style="font-weight:800; color:var(--text); display:flex; align-items:center; gap:0.5rem">
                        <i data-lucide="activity" style="color:${toleranceColor}; width:18px; height:18px"></i> Paciência do Clube
                    </span>
                    <span style="font-weight:900; color:${toleranceColor}; font-size:1.1rem">${tolerance}%</span>
                </div>
                <div class="fm-progress" style="height:14px; border-radius:8px; background:rgba(0,0,0,0.3); overflow:hidden; box-shadow: inset 0 2px 4px rgba(0,0,0,0.2)">
                    <div style="width:${tolerance}%; background: linear-gradient(90deg, ${toleranceColor}, ${toleranceColor}dd); height:100%; border-radius:8px; transition:width 0.5s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 0 10px ${toleranceColor}88"></div>
                </div>
                <p style="font-size:0.8rem; color:var(--muted); margin:0.75rem 0 0 0; line-height:1.4"><i data-lucide="alert-circle" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:4px"></i> Cuidado: exagerar nas exigências reduzirá a paciência. A zero, eles encerram as tratativas.</p>
            </div>

            <div class="premium-inputs-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div class="fm-box" style="position:relative; overflow:hidden; transition: all 0.2s; border-radius: 10px; border: 1px solid var(--line); background: rgba(30, 42, 60, 0.03);">
                    <div style="padding: 1rem;">
                        <label style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.5rem; color:var(--muted); font-weight:700; font-size:0.85rem">
                            <i data-lucide="coins" style="width:16px;height:16px"></i> Salário Mensal
                        </label>
                        <div style="display:flex; align-items:center; background:var(--bg-app); border:1px solid var(--line); border-radius:6px; padding:0 0.75rem">
                            <span style="color:var(--muted); font-weight:800; padding-right:0.5rem">R$</span>
                            <input type="number" id="inputWage" value="${terms.monthly_wage}" style="width:100%; padding:0.75rem 0; background:transparent; border:none; color:var(--text); font-weight:800; font-size:1.1rem; outline:none">
                        </div>
                    </div>
                </div>

                <div class="fm-box" style="position:relative; overflow:hidden; transition: all 0.2s; border-radius: 10px; border: 1px solid var(--line); background: rgba(30, 42, 60, 0.03);">
                    <div style="padding: 1rem;">
                        <label style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.5rem; color:var(--muted); font-weight:700; font-size:0.85rem">
                            <i data-lucide="calendar" style="width:16px;height:16px"></i> Duração
                        </label>
                        <div style="display:flex; align-items:center; background:var(--bg-app); border:1px solid var(--line); border-radius:6px; padding:0 0.75rem">
                            <input type="number" id="inputDuration" value="${terms.duration_seasons}" style="width:100%; padding:0.75rem 0; background:transparent; border:none; color:var(--text); font-weight:800; font-size:1.1rem; outline:none">
                            <span style="color:var(--muted); font-weight:800; padding-left:0.5rem">Anos</span>
                        </div>
                    </div>
                </div>

                <div class="fm-box" style="position:relative; overflow:hidden; transition: all 0.2s; border-radius: 10px; border: 1px solid var(--line); background: rgba(30, 42, 60, 0.03);">
                    <div style="padding: 1rem;">
                        <label style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.5rem; color:var(--muted); font-weight:700; font-size:0.85rem">
                            <i data-lucide="shield" style="width:16px;height:16px"></i> Multa Rescisória
                        </label>
                        <div style="display:flex; align-items:center; background:var(--bg-app); border:1px solid var(--line); border-radius:6px; padding:0 0.75rem">
                            <span style="color:var(--muted); font-weight:800; padding-right:0.5rem">R$</span>
                            <input type="number" id="inputClause" value="${terms.release_clause}" style="width:100%; padding:0.75rem 0; background:transparent; border:none; color:var(--text); font-weight:800; font-size:1.1rem; outline:none">
                        </div>
                    </div>
                </div>

                <div class="fm-box" style="position:relative; overflow:hidden; transition: all 0.2s; border-radius: 10px; border: 1px solid var(--line); background: rgba(30, 42, 60, 0.03);">
                    <div style="padding: 1rem;">
                        <label style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.5rem; color:var(--muted); font-weight:700; font-size:0.85rem">
                            <i data-lucide="users" style="width:16px;height:16px"></i> Papel no Elenco
                        </label>
                        <div style="display:flex; align-items:center; background:var(--bg-app); border:1px solid var(--line); border-radius:6px; padding:0 0.75rem">
                            <select id="inputRole" style="width:100%; padding:0.75rem 0; background:transparent; border:none; color:var(--text); font-weight:800; font-size:1.1rem; outline:none; cursor:pointer">
                                <option value="Promessa" ${terms.squad_role === 'Promessa' ? 'selected' : ''}>Promessa</option>
                                <option value="Reserva" ${terms.squad_role === 'Reserva' ? 'selected' : ''}>Reserva</option>
                                <option value="Rotação" ${terms.squad_role === 'Rotação' ? 'selected' : ''}>Rotação</option>
                                <option value="Titular" ${terms.squad_role === 'Titular' ? 'selected' : ''}>Titular</option>
                                <option value="Estrela" ${terms.squad_role === 'Estrela' ? 'selected' : ''}>Estrela</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
            <style>
                .premium-inputs-grid .fm-box:hover { border-color: var(--green); transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
                .premium-inputs-grid input:focus, .premium-inputs-grid select:focus { color: var(--green) !important; }
                @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            </style>
        </div>
    `;
    
    document.querySelector('#signModal .modal-header h2').innerHTML = '<i data-lucide="file-pen" style="color:var(--green); margin-right:0.5rem; width:24px; height:24px; vertical-align:middle"></i><span style="vertical-align:middle">Contraproposta Oficial</span>';
    
    const btn = document.getElementById('btnConfirmSign');
    btn.innerHTML = '<i data-lucide="send" style="width:18px;height:18px;margin-right:8px;vertical-align:middle"></i><span style="vertical-align:middle">Enviar Exigências</span>';
    btn.style.background = 'linear-gradient(135deg, var(--green), #2da116)';
    btn.style.color = '#fff';
    btn.style.fontWeight = '800';
    btn.style.border = 'none';
    btn.style.borderRadius = '8px';
    btn.style.boxShadow = '0 4px 15px rgba(56, 201, 31, 0.3)';
    btn.style.transition = 'all 0.2s';
    btn.onmouseover = () => btn.style.transform = 'translateY(-2px)';
    btn.onmouseout = () => btn.style.transform = 'translateY(0)';
    
    modal.classList.remove('hidden');
    
    btn.onclick = async () => {
        btn.disabled = true;
        btn.innerHTML = '<i data-lucide="loader-2" class="spin" style="width:18px;height:18px;margin-right:8px;vertical-align:middle;animation:spin 1s linear infinite"></i><span style="vertical-align:middle">Enviando...</span>';
        
        const reqWage = parseInt(document.getElementById('inputWage').value);
        const reqDur = parseInt(document.getElementById('inputDuration').value);
        const reqClause = parseInt(document.getElementById('inputClause').value);
        const reqRole = document.getElementById('inputRole').value;

        try {
            const res = await negotiateOffer(selectedOfferId, {
                monthly_wage: reqWage,
                duration_seasons: reqDur,
                release_clause: reqClause,
                squad_role: reqRole,
                signing_bonus: terms.signing_bonus
            });
            modal.classList.add('hidden');
            await loadOffers(); // Refresh UI
            showToast(null, res.message || 'O clube recebeu a sua contraproposta!', res.status === 'withdrawn' ? 'error' : 'success');
        } catch(e) {
            showToast(null, e.message, 'error');
            btn.disabled = false;
            btn.innerHTML = '<i data-lucide="send" style="width:18px;height:18px;margin-right:8px;vertical-align:middle"></i><span style="vertical-align:middle">Enviar Exigências</span>';
        }
    };
    
    // Bind cancel btn specifically to remove hidden
    const cancelBtn = document.getElementById('btnCancelSign');
    if(cancelBtn) cancelBtn.onclick = () => modal.classList.add('hidden');
}

function openAcceptModal() {
    const modal = document.getElementById('signModal');
    const terms = currentDossier.offer.current_terms;
    const body = document.getElementById('signModalBody');
    
    body.innerHTML = `
        <div class="fm-box" style="margin-bottom:1.5rem">
            <h4 style="margin-top:0">Confirmar Assinatura</h4>
            <div class="fm-data-row"><span>Salário Mensal:</span> <strong>R$ ${terms.monthly_wage}</strong></div>
            <div class="fm-data-row"><span>Duração:</span> <strong>${terms.duration_seasons} Temporadas</strong></div>
            <div class="fm-data-row"><span>Bônus de Assinatura:</span> <strong>R$ ${terms.signing_bonus}</strong></div>
            <div class="fm-data-row"><span>Multa Rescisória:</span> <strong>R$ ${terms.release_clause}</strong></div>
            <div class="fm-data-row" style="border:none"><span>Função:</span> <strong>${terms.squad_role}</strong></div>
        </div>
    `;
    document.querySelector('#signModal .modal-header h2').innerText = 'Assinar Contrato';
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
    const modal = document.getElementById('signModal');
    const body = document.getElementById('signModalBody');
    body.innerHTML = `<p style="color:var(--text)">Você está prestes a recusar a proposta do <strong>${currentDossier.club.name}</strong>. Esta ação não poderá ser desfeita.</p>
    <p style="font-size:0.85rem; color:var(--muted); margin-top:1rem">Se esta for sua última proposta ativa, o sistema poderá gerar uma oferta emergencial em um clube de menor expressão.</p>`;
    
    document.querySelector('#signModal .modal-header h2').innerText = 'Recusar Oferta';
    document.getElementById('btnConfirmSign').innerText = 'Sim, Recusar';
    document.getElementById('btnConfirmSign').className = 'fm-btn-red';
    
    modal.classList.remove('hidden');
    
    document.getElementById('btnConfirmSign').onclick = async () => {
        const btn = document.getElementById('btnConfirmSign');
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
    document.getElementById('btnCancelSign').onclick = () => modal.classList.add('hidden');
}


window.openNegotiateModal = openNegotiateModal;
window.openAcceptModal = openAcceptModal;

function bindTabs() {
    const tabs = document.querySelectorAll('.fm-tabs button');
    tabs.forEach(t => {
        t.addEventListener('click', () => {
            tabs.forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.fm-tab-content').forEach(c => {
                if(c.id !== 'fmOffersSidebar') c.style.display = 'none';
            });
            
            t.classList.add('active');
            const target = t.getAttribute('data-target');
            if (document.getElementById(target)) {
                document.getElementById(target).style.display = 'block';
            }
        });
    });
}
