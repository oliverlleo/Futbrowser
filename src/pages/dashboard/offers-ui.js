import { getCareerOnboardingState, generateInitialOffers, getOfferDetails, negotiateOffer, acceptOffer, rejectOffer } from '../../services/offer-service.js';
import { showToast } from '../../components/toast/toast.js';

let activeOffers = [];
let currentDossier = null;
let selectedOfferId = null;

export async function initOffersPhase() {
    // Hide old sections
    document.querySelector('.creation-status')?.classList.add('hidden');
    document.querySelector('.player-create')?.classList.add('hidden');
    document.querySelector('.player-offers')?.classList.remove('hidden');
    document.querySelector('.final-splash')?.classList.add('hidden');

    try {
        // Try to generate (or get) offers
        activeOffers = await generateInitialOffers();
        if (!activeOffers || activeOffers.length === 0) {
            showToast(null, 'Nenhuma oferta encontrada. Contate o suporte.', 'error');
            return;
        }
        
        renderOffersSidebar(activeOffers);
        // Select the first one automatically
        if (activeOffers.length > 0) {
            await selectOffer(activeOffers[0].id);
        }

        bindTabs();
    } catch (e) {
        console.error(e);
        showToast(null, 'Erro ao carregar ofertas.', 'error');
    }
}

export function showFinalSplash() {
    document.querySelector('.creation-status')?.classList.add('hidden');
    document.querySelector('.player-create')?.classList.add('hidden');
    document.querySelector('.player-offers')?.classList.add('hidden');
    document.querySelector('.final-splash')?.classList.remove('hidden');
    
    document.getElementById('splashCard').innerHTML = `
        <i data-lucide="check-circle-2" style="color: var(--primary); width: 64px; height: 64px; margin-bottom: 1rem;"></i>
        <h2>Contrato Assinado!</h2>
        <p>Você concluiu a Etapa 2. Seu novo clube te aguarda na tela principal da carreira.</p>
        <button class="btn-primary" style="margin-top: 2rem;" onclick="window.location.reload()">Ir para Carreira</button>
    `;
    if (window.lucide) window.lucide.createIcons();
}

function renderOffersSidebar(offers) {
    const list = document.getElementById('offersList');
    list.innerHTML = '';
    
    offers.forEach(offer => {
        const card = document.createElement('div');
        card.className = `offer-card ${offer.id === selectedOfferId ? 'active' : ''}`;
        card.dataset.id = offer.id;
        card.innerHTML = `
            <div>
                <strong>Clube Fictício</strong>
                <div style="font-size: 0.85rem; color: var(--text-secondary)">Status: ${offer.status}</div>
            </div>
        `;
        card.onclick = () => selectOffer(offer.id);
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
        
        // Update Sidebar visual names since we only get full details here
        const cardTitle = document.querySelector(`.offer-card[data-id="${offerId}"] strong`);
        if (cardTitle) cardTitle.textContent = currentDossier.club.name;

        renderDossierOverview();
        renderContractPanel();
    } catch(e) {
        console.error(e);
        showToast(null, 'Erro ao ler detalhes da proposta.', 'error');
    }
}

function renderDossierOverview() {
    const club = currentDossier.club;
    const compat = currentDossier.offer.compatibility_breakdown;
    
    document.getElementById('dossierOverview').innerHTML = `
        <div style="display: flex; gap: 1.5rem; margin-bottom: 2rem;">
            <img src="${club.shield_url}" alt="Escudo" style="width: 100px; height: 100px; object-fit: contain;">
            <div>
                <h3>${club.name}</h3>
                <p>${club.city}</p>
                <div style="display:flex; gap: 1rem; margin-top: 1rem;">
                    <span style="padding: 0.5rem; background: var(--bg-page); border-radius: 4px;">Formação: ${club.formation}</span>
                    <span style="padding: 0.5rem; background: var(--bg-page); border-radius: 4px;">Estilo: ${club.play_style}</span>
                </div>
            </div>
        </div>
        
        <h4>Compatibilidade: ${compat.compatibility_total}%</h4>
        <div style="margin-top: 1rem; display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; font-size: 0.9rem;">
            <div>Necessidade de Posição: ${compat.position_need_score}</div>
            <div>Perfil do Treinador: ${compat.coach_score}</div>
            <div>Estilo de Jogo: ${compat.play_style_score}</div>
            <div>Concorrência OVR: ${compat.competition_score}</div>
        </div>
    `;

    document.getElementById('dossierSquad').innerHTML = `<p>Elenco detalhado será listado aqui.</p>`;
    document.getElementById('dossierAcademy').innerHTML = `<p>Físico: ${currentDossier.academy.physical}/5<br>Técnico: ${currentDossier.academy.technical}/5</p>`;
    document.getElementById('dossierCoach').innerHTML = `<p>${currentDossier.coach.name} (Perfil: ${currentDossier.coach.profile})</p>`;
}

function renderContractPanel() {
    const terms = currentDossier.offer.current_terms;
    const offer = currentDossier.offer;
    const panel = document.getElementById('contractPanel');
    
    let actionsHtml = '';
    if (offer.status === 'accepted') {
        actionsHtml = `<button class="btn-primary" disabled>Assinado</button>`;
    } else if (offer.status === 'rejected' || offer.status === 'withdrawn') {
        actionsHtml = `<button class="btn-danger" disabled>Proposta Encerrada</button>`;
    } else {
        const remainingRounds = 3 - offer.round;
        actionsHtml = `
            <div style="text-align:center; font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.5rem;">Rodadas restantes: ${remainingRounds}</div>
            <button class="btn-secondary" id="btnNegotiate">Negociar</button>
            <button class="btn-primary" id="btnAccept">Assinar Contrato</button>
            <button class="btn-danger" id="btnReject" style="margin-top:0.5rem">Recusar</button>
        `;
    }

    panel.innerHTML = `
        <h3>Termos do Contrato</h3>
        <div class="contract-item">
            <span>Duração (Temporadas)</span>
            <strong>${terms.duration_seasons}</strong>
        </div>
        <div class="contract-item">
            <span>Salário Mensal</span>
            <strong>R$ ${terms.monthly_wage}</strong>
        </div>
        <div class="contract-item">
            <span>Luvas (Bônus)</span>
            <strong>R$ ${terms.signing_bonus}</strong>
        </div>
        <div class="contract-item">
            <span>Multa Rescisória</span>
            <strong>R$ ${terms.release_clause}</strong>
        </div>
        <div class="contract-item">
            <span>Promessa de Elenco</span>
            <strong>${terms.squad_role}</strong>
        </div>

        <div class="contract-actions">
            ${actionsHtml}
        </div>
    `;

    // Bind actions
    document.getElementById('btnNegotiate')?.addEventListener('click', handleNegotiate);
    document.getElementById('btnAccept')?.addEventListener('click', handleAccept);
    document.getElementById('btnReject')?.addEventListener('click', handleReject);
}

async function handleNegotiate() {
    try {
        showToast(null, 'Simulando negociação (Aumentando salário em 10%)...', 'info');
        const terms = { ...currentDossier.offer.current_terms };
        terms.monthly_wage = Math.floor(terms.monthly_wage * 1.1); // Simulando a exigência
        const result = await negotiateOffer(selectedOfferId, terms);
        showToast(null, `Resposta do clube: ${result.result} (${result.stance})`, 'info');
        await selectOffer(selectedOfferId); // refresh
    } catch(e) {
        showToast(null, e.message, 'error');
    }
}

async function handleAccept() {
    try {
        await acceptOffer(selectedOfferId);
        showFinalSplash();
    } catch(e) {
        showToast(null, e.message, 'error');
    }
}

async function handleReject() {
    if(!confirm("Tem certeza que deseja recusar? A decisão é irreversível.")) return;
    try {
        await rejectOffer(selectedOfferId);
        await initOffersPhase(); // reload
    } catch(e) {
        showToast(null, e.message, 'error');
    }
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
