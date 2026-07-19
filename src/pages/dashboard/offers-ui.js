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

function renderDossierOverview() {
    const club = currentDossier.club;
    const cb = currentDossier.compatibility_breakdown;
    const coach = currentDossier.coach;
    const acad = currentDossier.academy;
    const imgUrl = getClubImage(club.name);
    const compat = cb.compatibility_total || cb.total || 0;
    
    const stars = Math.max(1, Math.min(5, club.reputation));
    const starsHtml = '★'.repeat(stars) + '☆'.repeat(5-stars);
    
    const competitors = currentDossier.competitors || [];
    let compTableHtml = competitors.slice(0, 3).map(c => `
        <tr>
            <td>${c.name}</td>
            <td>${c.primary_position}</td>
            <td><strong>${c.ovr}</strong></td>
            <td>${c.age}</td>
            <td style="color: ${c.is_starter ? 'var(--green)' : 'var(--muted)'}">${c.is_starter ? 'Titular' : 'Reserva'}</td>
        </tr>
    `).join('');
    if(competitors.length === 0) compTableHtml = `<tr><td colspan="5" style="text-align:center">Nenhum concorrente direto</td></tr>`;

    const coachSlug = coach.name ? coach.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_') : 'default';
    const coachImg = `img/coaches/${coachSlug}.png`;
    
    function translateImpact(key, val) {
        const map = {
            morale_initial_bonus: `Moral ${val>0?'+'+val:val} inicial`,
            recovery_pct_bonus: `Recuperação ${val>0?'+'+val:val}%`,
            discipline_penalty: `Disciplina ${val}`,
            physical_evolution_bonus: `Evolução física ${val>0?'+'+val:val}%`,
            tactical_evolution_bonus: `Evolução tática ${val>0?'+'+val:val}%`,
            morale_penalty_on_failure: `Moral ${val} após atuações ruins`,
            general_evolution_bonus: `Evolução geral ${val>0?'+'+val:val}%`,
            technical_evolution_bonus: `Evolução técnica ${val>0?'+'+val:val}%`,
            pass_control_dribble_bonus: `Passe, domínio e drible ${val>0?'+'+val:val}%`,
            physical_evolution_penalty: `Evolução física ${val}%`,
            positioning_vision_decision_bonus: `Visão, posicionamento e decisões ${val>0?'+'+val:val}%`,
            creative_freedom_penalty: `Liberdade criativa ${val}`
        };
        return map[key] || `${key}: ${val}`;
    }

    const roster = currentDossier.roster || [];
    let avgAge = "Dado indisponível";
    if (roster.length > 0) {
        avgAge = (roster.reduce((sum, p) => sum + p.age, 0) / roster.length).toFixed(1).replace('.', ',');
    }
    
    const snapshotData = currentDossier.snapshot_data || currentDossier.snapshot || {};
    const clubOvr = snapshotData.club_overall !== undefined ? snapshotData.club_overall : (club.ovr || "Dado indisponível");
    const clubStyle = club.style || "Dado indisponível";
    const clubFormation = club.formation || "Dado indisponível";
    
    let dotsHtml = '';
    if (clubFormation === '4-3-3') {
        dotsHtml = `
            <div class="fm-dot" style="position:absolute; left:10%; top:48%; background:var(--green)"></div>
            <div class="fm-dot" style="position:absolute; left:30%; top:20%; background:var(--green)"></div>
            <div class="fm-dot" style="position:absolute; left:30%; top:40%; background:var(--green)"></div>
            <div class="fm-dot" style="position:absolute; left:30%; top:60%; background:var(--green)"></div>
            <div class="fm-dot" style="position:absolute; left:30%; top:80%; background:var(--green)"></div>
            <div class="fm-dot" style="position:absolute; left:60%; top:30%; background:var(--green)"></div>
            <div class="fm-dot" style="position:absolute; left:60%; top:50%; background:var(--green)"></div>
            <div class="fm-dot" style="position:absolute; left:60%; top:70%; background:var(--green)"></div>
            <div class="fm-dot" style="position:absolute; left:85%; top:30%; background:#f59e0b"></div>
            <div class="fm-dot" style="position:absolute; left:85%; top:50%; background:#f59e0b"></div>
            <div class="fm-dot" style="position:absolute; left:85%; top:70%; background:#f59e0b"></div>
        `;
    } else if (clubFormation === '4-2-3-1') {
        dotsHtml = `
            <div class="fm-dot" style="position:absolute; left:10%; top:48%; background:var(--green)"></div>
            <div class="fm-dot" style="position:absolute; left:30%; top:20%; background:var(--green)"></div>
            <div class="fm-dot" style="position:absolute; left:30%; top:40%; background:var(--green)"></div>
            <div class="fm-dot" style="position:absolute; left:30%; top:60%; background:var(--green)"></div>
            <div class="fm-dot" style="position:absolute; left:30%; top:80%; background:var(--green)"></div>
            <div class="fm-dot" style="position:absolute; left:50%; top:35%; background:var(--green)"></div>
            <div class="fm-dot" style="position:absolute; left:50%; top:65%; background:var(--green)"></div>
            <div class="fm-dot" style="position:absolute; left:70%; top:20%; background:#f59e0b"></div>
            <div class="fm-dot" style="position:absolute; left:70%; top:50%; background:#f59e0b"></div>
            <div class="fm-dot" style="position:absolute; left:70%; top:80%; background:#f59e0b"></div>
            <div class="fm-dot" style="position:absolute; left:85%; top:48%; background:#f59e0b"></div>
        `;
    } else if (clubFormation === '4-4-2') {
        dotsHtml = `
            <div class="fm-dot" style="position:absolute; left:10%; top:48%; background:var(--green)"></div>
            <div class="fm-dot" style="position:absolute; left:30%; top:20%; background:var(--green)"></div>
            <div class="fm-dot" style="position:absolute; left:30%; top:40%; background:var(--green)"></div>
            <div class="fm-dot" style="position:absolute; left:30%; top:60%; background:var(--green)"></div>
            <div class="fm-dot" style="position:absolute; left:30%; top:80%; background:var(--green)"></div>
            <div class="fm-dot" style="position:absolute; left:60%; top:20%; background:var(--green)"></div>
            <div class="fm-dot" style="position:absolute; left:60%; top:40%; background:var(--green)"></div>
            <div class="fm-dot" style="position:absolute; left:60%; top:60%; background:var(--green)"></div>
            <div class="fm-dot" style="position:absolute; left:60%; top:80%; background:var(--green)"></div>
            <div class="fm-dot" style="position:absolute; left:85%; top:40%; background:#f59e0b"></div>
            <div class="fm-dot" style="position:absolute; left:85%; top:60%; background:#f59e0b"></div>
        `;
    } else {
        dotsHtml = '';
    }

    const acadAreas = [
        { key: 'Físico', val: acad?.physical },
        { key: 'Velocidade', val: acad?.speed },
        { key: 'Técnica', val: acad?.technical },
        { key: 'Recuperação', val: acad?.recovery },
        { key: 'Tática', val: acad?.tactical }
    ];
    const validAcadAreas = acadAreas.filter(a => a.val !== undefined);
    
    
    
    let bestAcad = { key: 'Dado indisponível', val: 0 };
    let secondAcad = { key: 'Dado indisponível', val: 0 };
    let worstAcad = { key: 'Dado indisponível', val: 0 };
    
    if (validAcadAreas.length > 0) {
        const maxVal = Math.max(...validAcadAreas.map(a => a.val));
        const minVal = Math.min(...validAcadAreas.map(a => a.val));
        
        const maxAreas = validAcadAreas.filter(a => a.val === maxVal).map(a => a.key).join(' / ');
        bestAcad = { key: maxAreas, val: maxVal };
        
        const worstAreas = validAcadAreas.filter(a => a.val === minVal).map(a => a.key).join(' / ');
        worstAcad = { key: worstAreas, val: minVal };
        
        const remainingForSecond = validAcadAreas.filter(a => a.val < maxVal);
        if (remainingForSecond.length > 0) {
            const secondMaxVal = Math.max(...remainingForSecond.map(a => a.val));
            const secondMaxAreas = remainingForSecond.filter(a => a.val === secondMaxVal).map(a => a.key).join(' / ');
            secondAcad = { key: secondMaxAreas, val: secondMaxVal };
        }
    }

    let acadBonusEffect = 'Dado indisponível';
    if (bestAcad.val > 0) {
        const isRec = bestAcad.key.includes('Recuperação');
        let pct = 0;
        if (isRec && !bestAcad.key.includes('/')) {
            if (bestAcad.val === 1) pct = -5;
            else if (bestAcad.val === 2) pct = 0;
            else if (bestAcad.val === 3) pct = 5;
            else if (bestAcad.val === 4) pct = 10;
            else if (bestAcad.val === 5) pct = 15;
            acadBonusEffect = `Recuperação ${pct > 0 ? '+'+pct : pct}%`;
        } else {
            if (bestAcad.val === 1) pct = -5;
            else if (bestAcad.val === 2) pct = 0;
            else if (bestAcad.val === 3) pct = 4;
            else if (bestAcad.val === 4) pct = 8;
            else if (bestAcad.val === 5) pct = 12;
            acadBonusEffect = `Evolução ${pct > 0 ? '+'+pct : pct}% mais rápida`;
        }
    }
    
    const coachProf = coach.profile !== undefined ? coach.profile : "Dado indisponível";
    
    const impacts = coach.impacts || {};
    const toleranceMap = { high: 'Alta', medium: 'Média', low: 'Baixa' };
    const toleranceVal = impacts.tolerance_to_bad_games !== undefined ? toleranceMap[impacts.tolerance_to_bad_games] : "Dado indisponível";
    
    
    
    let mainBonus = "Dado indisponível";
    let mainRisk = "Dado indisponível";
    
    const positiveImpacts = [];
    const negativeImpacts = [];
    
    for (let key in impacts) {
        if (key === 'tolerance_to_bad_games') continue;
        const val = impacts[key];
        if (val > 0) positiveImpacts.push({ key, val });
        else if (val < 0) negativeImpacts.push({ key, val });
    }
    
    if (positiveImpacts.length > 0) {
        positiveImpacts.sort((a, b) => b.val - a.val);
        mainBonus = translateImpact(positiveImpacts[0].key, positiveImpacts[0].val);
    }
    if (negativeImpacts.length > 0) {
        negativeImpacts.sort((a, b) => a.val - b.val);
        mainRisk = translateImpact(negativeImpacts[0].key, negativeImpacts[0].val);
    }

    document.getElementById('fmOverview').innerHTML = `
        <div class="fm-overview-grid">
            <div class="fm-box">
                <div class="fm-header-flex">
                    <img src="${imgUrl}" alt="${club.name}" onerror="this.outerHTML='<div class=\\'club-crest-fallback\\' style=\\'width:80px;height:80px\\'>${club.name.substring(0,3)}</div>'">
                    <div>
                        <h2>${club.name}</h2>
                        <p>${club.city ? club.city : 'Cidade indisponível'} • Categoria Sub-18</p>
                    </div>
                </div>
                <div class="fm-data-row"><span>Reputação</span><strong class="fm-stars">${starsHtml}</strong></div>
                <div class="fm-data-row"><span>Salário mensal</span><strong style="color:var(--green)">R$ ${currentDossier.offer?.current_terms?.monthly_wage || 'Dado indisponível'}</strong></div>
                <div class="fm-data-row"><span>Chance de jogo</span><strong>${(currentDossier.snapshot_data?.chance_of_play || currentDossier.snapshot?.chance_of_play) || 'Indisponível'}</strong></div>
                <div class="fm-data-row"><span>Função oferecida</span><strong>${currentDossier.offer?.current_terms?.squad_role || 'Dado indisponível'}</strong></div>
            </div>
            
            <div class="fm-box">
                <div style="display:flex; justify-content:space-between">
                    <div>
                        <div class="fm-box-title">Estilo de jogo</div>
                        <p style="font-size:0.8rem; margin:0">${clubStyle}</p>
                    </div>
                    <div style="text-align:right">
                        <div class="fm-box-title">Formação titular</div>
                        <p style="font-size:0.8rem; margin:0; font-weight:700">${clubFormation}</p>
                    </div>
                </div>
                <div class="fm-pitch">
                    <div class="fm-pitch-lines"></div>
                    <div class="fm-pitch-center"></div>
                    <div class="fm-pitch-line"></div>
                    <div style="position:absolute; width:100%; height:100%">
                        ${dotsHtml}
                    </div>
                </div>
            </div>
            
            <div class="fm-box" style="grid-column: span 2;">
                <div class="fm-box-title">Elenco e concorrência</div>
                <div style="display:flex; gap:2rem; margin-bottom:1rem">
                    <div>
                        <span style="font-size:0.75rem; color:var(--muted); display:block">Sua posição</span>
                        <strong style="font-size:0.9rem">${currentPlayer.posicao}</strong>
                    </div>
                    <div>
                        <span style="font-size:0.75rem; color:var(--muted); display:block">Geral do elenco</span>
                        <strong style="font-size:0.9rem">${clubOvr}</strong>
                    </div>
                    <div>
                        <span style="font-size:0.75rem; color:var(--muted); display:block">Idade média</span>
                        <strong style="font-size:0.9rem">${avgAge}</strong>
                    </div>
                </div>
                <div class="fm-box-title" style="font-size:0.75rem; margin-bottom:0.5rem">Concorrência direta</div>
                <table class="fm-table">
                    <thead><tr><th>Nome</th><th>Pos</th><th>OVR</th><th>Idade</th><th>Status</th></tr></thead>
                    <tbody>${compTableHtml}</tbody>
                </table>
            </div>
            
            <div class="fm-box">
                <div class="fm-box-title">Academia</div>
                <div class="fm-data-row"><span>Principal especialidade</span><strong class="fm-stars">${bestAcad.key} ${bestAcad.val > 0 ? '★'.repeat(bestAcad.val) + '☆'.repeat(5-bestAcad.val) : ''}</strong></div>
                <div class="fm-data-row"><span>Segunda força</span><strong style="color:var(--green)">${secondAcad.key} ${secondAcad.val > 0 ? '★'.repeat(secondAcad.val) + '☆'.repeat(5-secondAcad.val) : ''}</strong></div>
                <div class="fm-data-row"><span>Maior deficiência</span><strong style="color:var(--danger)">${worstAcad.key} ${worstAcad.val > 0 ? '★'.repeat(worstAcad.val) + '☆'.repeat(5-worstAcad.val) : ''}</strong></div>
                <div style="margin-top:1rem; padding-top:1rem; border-top:1px solid var(--line); display:flex; gap:0.5rem; font-size:0.75rem">
                    <i data-lucide="award" style="color:var(--green); width:16px"></i>
                    <div>
                        <strong style="display:block">Efeito de ${bestAcad.key}</strong>
                        <span style="color:var(--muted)">${acadBonusEffect}</span>
                    </div>
                </div>
            </div>
            
            <div class="fm-box">
                <div class="fm-box-title">Treinador</div>
                <div class="fm-coach-flex">
                    <img src="${coachImg}" alt="${coach.name}" onerror="this.src='img/avatar/avatar4.webp'">
                    <div style="flex:1">
                        <strong style="display:block; font-size:1.1rem; margin-bottom:2px">${coach.name}</strong>
                        <span style="font-size:0.75rem; color:var(--muted)">Perfil: ${coachProf}</span>
                    </div>
                </div>
                <div style="margin-top:1rem">
                    <div class="fm-data-row"><span>Tolerância</span><strong>${toleranceVal}</strong></div>
                    <div class="fm-data-row"><span>Principal bônus</span><strong class="fm-stars">${mainBonus}</strong></div>
                    <div class="fm-data-row"><span>Principal risco</span><strong class="fm-stars">${mainRisk}</strong></div>
                </div>
            </div>
        </div>
    `;
    if (window.lucide) lucide.createIcons();
    
    
    const squadTableRows = (currentDossier.roster || currentDossier.competitors || []).map(c => `
        <tr style="border-bottom: 1px solid var(--line);">
            <td style="padding: 1rem 0.5rem; color: var(--text)">${c.name}</td>
            <td style="padding: 1rem 0.5rem; color: var(--muted)">${c.primary_position}</td>
            <td style="padding: 1rem 0.5rem; color: var(--text)"><strong>${c.ovr}</strong></td>
            <td style="padding: 1rem 0.5rem; color: var(--muted)">${c.age}</td>
            <td style="padding: 1rem 0.5rem;"><span class="fm-badge" style="background: ${c.is_starter ? 'rgba(56,201,31,0.1)' : 'rgba(0,0,0,0.05)'}; color: ${c.is_starter ? 'var(--green)' : 'var(--muted)'}">${c.is_starter ? 'Titular' : 'Reserva'}</span></td>
        </tr>
    `).join('');

    document.getElementById('fmSquad').innerHTML = `
        <div style="padding:1.5rem">
            <h3 style="margin-bottom:1rem; font-size:1.1rem; font-weight:800; color:var(--text)">Análise do Elenco</h3>
            <p style="color:var(--muted); font-size:0.85rem; margin-bottom:1.5rem">Este é o elenco completo da equipe Sub-18.</p>
            <div class="fm-box">
                <table style="width:100%; border-collapse:collapse; font-size:0.85rem; text-align:left">
                    <thead>
                        <tr style="border-bottom: 2px solid var(--line); color: var(--muted)">
                            <th style="padding: 0.5rem">Jogador</th>
                            <th style="padding: 0.5rem">Posição</th>
                            <th style="padding: 0.5rem">Overall</th>
                            <th style="padding: 0.5rem">Idade</th>
                            <th style="padding: 0.5rem">Status</th>
                        </tr>
                    </thead>
                    <tbody>${squadTableRows || '<tr><td colspan="5" style="padding:1rem;text-align:center;color:var(--muted)">Sem concorrentes diretos.</td></tr>'}</tbody>
                </table>
            </div>
        </div>
    `;

    document.getElementById('fmAcademy').innerHTML = '';

    function getAcadBonusPct(val, key) {
        if (!val) return 'Dado indisponível';
        if (key === 'Recuperação') {
            const map = {1: '-5%', 2: '0%', 3: '+5%', 4: '+10%', 5: '+15%'};
            return map[val];
        } else {
            const map = {1: '-5%', 2: '0%', 3: '+4%', 4: '+8%', 5: '+12%'};
            return map[val];
        }
    }

    document.getElementById('fmAcademy').innerHTML = `
        <div style="padding:1.5rem">
            <h3 style="margin-bottom:1rem; font-size:1.1rem; font-weight:800; color:var(--text)">Estrutura da Academia</h3>
            <div class="fm-box" style="margin-bottom:1rem">
                <div class="fm-data-row" style="padding:0.75rem 0">
                    <span style="display:flex;flex-direction:column"><strong>Físico</strong><small style="color:var(--muted)">força e resistência</small></span>
                    <div style="text-align:right"><strong class="fm-stars">${'★'.repeat(acad?.physical||0)}${'☆'.repeat(5-(acad?.physical||0))}</strong><br><small style="color:var(--green)">${getAcadBonusPct(acad?.physical||0, 'Físico')}</small></div>
                </div>
                <div class="fm-data-row" style="padding:0.75rem 0">
                    <span style="display:flex;flex-direction:column"><strong>Velocidade</strong><small style="color:var(--muted)">velocidade, aceleração e agilidade</small></span>
                    <div style="text-align:right"><strong class="fm-stars">${'★'.repeat(acad?.speed||0)}${'☆'.repeat(5-(acad?.speed||0))}</strong><br><small style="color:var(--green)">${getAcadBonusPct(acad?.speed||0, 'Velocidade')}</small></div>
                </div>
                <div class="fm-data-row" style="padding:0.75rem 0">
                    <span style="display:flex;flex-direction:column"><strong>Técnica</strong><small style="color:var(--muted)">passe, domínio e drible</small></span>
                    <div style="text-align:right"><strong class="fm-stars">${'★'.repeat(acad?.technical||0)}${'☆'.repeat(5-(acad?.technical||0))}</strong><br><small style="color:var(--green)">${getAcadBonusPct(acad?.technical||0, 'Técnica')}</small></div>
                </div>
                <div class="fm-data-row" style="padding:0.75rem 0">
                    <span style="display:flex;flex-direction:column"><strong>Recuperação</strong><small style="color:var(--muted)">energia e recuperação futura</small></span>
                    <div style="text-align:right"><strong class="fm-stars">${'★'.repeat(acad?.recovery||0)}${'☆'.repeat(5-(acad?.recovery||0))}</strong><br><small style="color:var(--green)">${getAcadBonusPct(acad?.recovery||0, 'Recuperação')}</small></div>
                </div>
                <div class="fm-data-row" style="padding:0.75rem 0; border:none">
                    <span style="display:flex;flex-direction:column"><strong>Tática</strong><small style="color:var(--muted)">visão, posicionamento e decisões</small></span>
                    <div style="text-align:right"><strong class="fm-stars">${'★'.repeat(acad?.tactical||0)}${'☆'.repeat(5-(acad?.tactical||0))}</strong><br><small style="color:var(--green)">${getAcadBonusPct(acad?.tactical||0, 'Tática')}</small></div>
                </div>
            </div>
            
            <div class="fm-overview-grid" style="grid-template-columns:1fr 1fr; padding:0; gap:1rem; margin-bottom:1rem">
                <div class="fm-box" style="border-top: 3px solid var(--green)">
                    <div class="fm-box-title" style="color:var(--green)">Vantagem (Foco)</div>
                    <div style="font-size:1.1rem; font-weight:800; margin-bottom:0.25rem">${bestAcad.key}</div>
                    <p style="font-size:0.75rem; color:var(--muted)">Maior força na formação de jogadores desta base.</p>
                </div>
                <div class="fm-box" style="border-top: 3px solid var(--danger)">
                    <div class="fm-box-title" style="color:var(--danger)">Desvantagem (Déficit)</div>
                    <div style="font-size:1.1rem; font-weight:800; margin-bottom:0.25rem">${worstAcad.key}</div>
                    <p style="font-size:0.75rem; color:var(--muted)">Maior limitação na estrutura oferecida.</p>
                </div>
            </div>
        </div>
    `;

    document.getElementById('fmCoach').innerHTML = `
        <div style="padding:1.5rem">
            <h3 style="margin-bottom:1rem; font-size:1.1rem; font-weight:800; color:var(--text)">Relatório do Treinador</h3>
            <div class="fm-box" style="margin-bottom:1.5rem">
                <div class="fm-coach-flex" style="margin-bottom:1rem">
                    <img src="${coachImg}" alt="${coach.name}" onerror="this.src='img/avatar/avatar4.webp'" style="width:100px; height:100px;">
                    <div style="flex:1">
                        <strong style="display:block; font-size:1.4rem; margin-bottom:2px">${coach.name}</strong>
                        <span style="font-size:0.85rem; color:var(--muted)">Perfil: ${coachProf} | Estilo do Clube: ${clubStyle}</span>
                    </div>
                </div>
                <p style="font-size:0.8rem; color:var(--muted); line-height:1.5">O treinador ${coach.name} possui perfil <strong>${coachProf}</strong> e implementa no clube um estilo de jogo <strong>${clubStyle}</strong>.</p>
            </div>
            
            <div class="fm-overview-grid" style="grid-template-columns:1fr 1fr; padding:0; gap:1rem;">
                <div class="fm-box">
                    <div class="fm-box-title">Gestão e Tolerância</div>
                    <div style="font-size:1.5rem; font-weight:800; color:var(--text)">${toleranceVal}</div>
                    <p style="font-size:0.75rem; color:var(--muted); margin-top:0.5rem">Tolerância a atuações ruins da equipe.</p>
                </div>
                <div class="fm-box">
                    <div class="fm-box-title">Esquema Tático</div>
                    <div style="font-size:1.5rem; font-weight:800; color:var(--text)">${clubFormation}</div>
                    <p style="font-size:0.75rem; color:var(--muted); margin-top:0.5rem">Formação titular implementada pelo clube e treinador.</p>
                </div>
            </div>
            <div class="fm-box" style="margin-top:1rem">
                <div class="fm-box-title">Impactos do Treinador</div>
                ${positiveImpacts.map(i => `<div class="fm-data-row"><span style="color:var(--green)">Bônus</span><strong>${translateImpact(i.key, i.val)}</strong></div>`).join('')}
                ${negativeImpacts.map(i => `<div class="fm-data-row"><span style="color:var(--danger)">Penalidade</span><strong>${translateImpact(i.key, i.val)}</strong></div>`).join('')}
            </div>
        </div>
    `;

}

function renderContractPanel() {
    const terms = currentDossier.offer.current_terms;
    const offer = currentDossier.offer;
    const isClosed = ['accepted', 'rejected', 'withdrawn', 'expired'].includes(offer.status);
    
    const compat = currentDossier.compatibility_breakdown?.total || currentDossier.compatibility_breakdown?.compatibility_total || 0;
    
    let historyHtml = '';
    if (offer.history && offer.history.length > 0) {
        historyHtml = offer.history.map((h, i) => `
            <div class="fm-timeline-item">
                <div class="fm-dot"></div>
                <div class="fm-timeline-content">
                    <strong>Contraproposta #${i+1}</strong>
                    <span>R$ ${h.player_proposal.monthly_wage} / ${h.player_proposal.squad_role}</span>
                </div>
            </div>
        `).join('');
    }

    let actionsHtml = '';
    if (offer.status === 'accepted') {
        actionsHtml = `<button class="fm-btn-green" disabled style="opacity:0.6"><i data-lucide="check"></i> Contrato Assinado</button>`;
    } else if (isClosed) {
        actionsHtml = `<button class="fm-btn-red" disabled style="opacity:0.6"><i data-lucide="x"></i> Proposta Encerrada</button>`;
    } else {
        actionsHtml = `
            <button class="fm-btn-green" id="btnPreviewNegotiate">
                <i data-lucide="refresh-cw" style="margin-bottom:4px"></i> Negociar termos
                <span>Fazer contraproposta</span>
            </button>
            <div class="fm-btn-group">
                <button class="fm-btn-outline" id="btnAccept">
                    <i data-lucide="pen-tool" style="margin-bottom:4px"></i> Assinar contrato
                    <span>Aceitar proposta</span>
                </button>
                <button class="fm-btn-red" id="btnReject">
                    <i data-lucide="x" style="margin-bottom:4px"></i> Recusar proposta
                    <span>Explorar outras opções</span>
                </button>
            </div>
        `;
    }

    document.getElementById('contractPanel').innerHTML = `
        <div class="fm-contract-section">
            <h4>Resumo da proposta</h4>
            <div class="fm-data-row"><span>Salário mensal</span><strong>R$ ${terms.monthly_wage}</strong></div>
            <div class="fm-data-row"><span>Duração do contrato</span><strong>${terms.duration_seasons} anos</strong></div>
            <div class="fm-data-row"><span>Bônus de assinatura</span><strong>R$ ${terms.signing_bonus}</strong></div>
            <div class="fm-data-row"><span>Multa rescisória</span><strong>R$ ${terms.release_clause}</strong></div>
            <div class="fm-data-row"><span>Função prometida</span><strong>${terms.squad_role}</strong></div>
            <div class="fm-data-row"><span>Tempo de jogo</span><strong>Regular</strong></div>
            <div class="fm-data-row"><span>Início previsto</span><strong>Imediato</strong></div>
        </div>
        
        <div class="fm-contract-section">
            <div class="fm-data-row" style="border:none; padding-bottom:0">
                <span style="font-weight:700; color:var(--text)">Rodada de negociação</span>
                <strong style="color:var(--green)">${offer.round} / 3</strong>
            </div>
            ${historyHtml ? `<div style="margin-top:1rem"><h4 style="font-size:0.8rem; color:var(--muted)">Histórico da negociação</h4><div class="fm-timeline">${historyHtml}</div></div>` : ''}
        </div>
        
        <div class="fm-contract-section">
            <h4>Compatibilidade</h4>
            <div class="fm-compat-box">
                <div class="fm-donut"><span style="color:var(--text)">${compat}%</span></div>
                <ul class="fm-compat-list" style="list-style:none; margin:0; padding:0">
                    <li><i data-lucide="check"></i> Estilo de jogo combina</li>
                    <li><i data-lucide="check"></i> Chance real de atuar</li>
                    <li><i data-lucide="check"></i> Academia compatível</li>
                </ul>
            </div>
        </div>
        
        <div class="fm-actions">
            ${actionsHtml}
        </div>
    `;

    document.getElementById('btnPreviewNegotiate')?.addEventListener('click', openNegotiateModal);
    document.getElementById('btnAccept')?.addEventListener('click', openAcceptModal);
    document.getElementById('btnReject')?.addEventListener('click', openRejectModal);
    if (window.lucide) lucide.createIcons();
    
    let isHighestWage = false;
    if (activeOffers && activeOffers.length > 0) {
        const maxWage = Math.max(...activeOffers.map(o => o.current_terms?.monthly_wage || 0));
        if (terms.monthly_wage >= maxWage && terms.monthly_wage > 0) isHighestWage = true;
    }
    
    let tip = '';
    if (isHighestWage) {
        tip = `O salário é o maior entre as propostas, porém você chega como ${terms.squad_role || 'Dado indisponível'}. `;
    } else {
        tip = `Você chega como ${terms.squad_role || 'Dado indisponível'} e a chance inicial de jogo é ${(currentDossier.snapshot_data?.chance_of_play || currentDossier.snapshot?.chance_of_play) || 'Indisponível'}. `;
    }
    
    const acad = currentDossier.academy;
    let acadText = '';
    if (acad) {
        const acadAreas = [
            { key: 'Físico', val: acad.physical },
            { key: 'Velocidade', val: acad.speed },
            { key: 'Técnica', val: acad.technical },
            { key: 'Recuperação', val: acad.recovery },
            { key: 'Tática', val: acad.tactical }
        ].filter(a => a.val !== undefined);
        
        if (acadAreas.length > 0) {
            const maxVal = Math.max(...acadAreas.map(a => a.val));
            const minVal = Math.min(...acadAreas.map(a => a.val));
            const bestAcadKey = acadAreas.filter(a => a.val === maxVal).map(a => a.key).join(' / ');
            const worstAcadKey = acadAreas.filter(a => a.val === minVal).map(a => a.key).join(' / ');
            
            acadText = `A principal força da academia é ${bestAcadKey}`;
            if (worstAcadKey.includes('Tática')) {
                acadText += `, mas o desenvolvimento tático é limitado. `;
            } else {
                acadText += `. `;
            }
        }
    }
    
    const impacts = currentDossier.coach?.impacts || {};
    const positiveImpacts = [];
    const negativeImpacts = [];
    for (let key in impacts) {
        if (key === 'tolerance_to_bad_games') continue;
        const val = impacts[key];
        if (val > 0) positiveImpacts.push({ key, val });
        else if (val < 0) negativeImpacts.push({ key, val });
    }
    
    let coachText = '';
    if (positiveImpacts.length > 0 || negativeImpacts.length > 0) {
        let pTxt = '';
        if (positiveImpacts.length > 0) {
            positiveImpacts.sort((a,b) => b.val - a.val);
            const map = {
                morale_initial_bonus: 'bônus de moral',
                recovery_pct_bonus: 'bônus de recuperação',
                physical_evolution_bonus: 'bônus físico',
                tactical_evolution_bonus: 'bônus tático',
                general_evolution_bonus: 'bônus geral',
                technical_evolution_bonus: 'bônus técnico',
                pass_control_dribble_bonus: 'bônus de passe e drible',
                positioning_vision_decision_bonus: 'bônus de visão e decisão'
            };
            pTxt = map[positiveImpacts[0].key] || 'bônus extras';
        }
        
        let nTxt = '';
        if (negativeImpacts.length > 0) {
            negativeImpacts.sort((a,b) => a.val - b.val);
            const map = {
                discipline_penalty: 'disciplina rígida',
                morale_penalty_on_failure: 'pune atuações ruins na moral',
                physical_evolution_penalty: 'penalidade física',
                creative_freedom_penalty: 'limita a liberdade criativa'
            };
            nTxt = map[negativeImpacts[0].key] || 'riscos associados';
        }
        
        if (pTxt && nTxt) {
            coachText = `O treinador oferece ${pTxt}, mas ${nTxt}.`;
        } else if (pTxt) {
            coachText = `O treinador oferece ${pTxt}.`;
        } else if (nTxt) {
            coachText = `O treinador ${nTxt}.`;
        }
    }
    
    if (isHighestWage) {
        if (coachText) tip += coachText;
        else tip += acadText;
    } else {
        tip += acadText;
    }
    
    document.getElementById('scoutTipText').innerText = tip;
}

function bindTabs() {
    const tabs = document.querySelectorAll('.fm-tabs button');
    tabs.forEach(tab => {
        tab.onclick = () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.querySelectorAll('.fm-tab-content').forEach(p => p.style.display = 'none');
            document.getElementById(tab.dataset.target).style.display = 'block';
        };
    });
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
