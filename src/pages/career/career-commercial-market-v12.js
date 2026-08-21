import { supabase } from '../../services/supabase-client.js';
import { showToast } from '../../components/toast/toast.js';

let hub=null;
let sponsorState=null;
let sponsorBusy=false;

const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(Number(v||0));
const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const date=v=>{if(!v)return '—';const d=new Date(`${v}T12:00:00`);return Number.isNaN(d.getTime())?'—':new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'}).format(d)};
const period=n=>['Manhã','Tarde','Noite'][Number(n)]||'—';
const icons=()=>window.lucide?.createIcons?.({strokeWidth:1.8});

function ensureStyles(){
  if(document.getElementById('career-commercial-market-v12-style'))return;
  const style=document.createElement('style');
  style.id='career-commercial-market-v12-style';
  style.textContent=`
  .career-sponsor-panel .sponsor-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:12px}.sponsor-summary div{padding:10px;border:1px solid var(--line);border-radius:10px;background:rgba(127,127,127,.03)}.sponsor-summary span{display:block;color:var(--muted);font-size:9px;font-weight:850;text-transform:uppercase}.sponsor-summary strong{display:block;margin-top:4px;font-size:14px;font-weight:950}.sponsor-open{margin-top:11px;width:100%}
  .commercial-overlay{position:fixed;inset:0;z-index:180000;display:grid;place-items:center;padding:18px;background:rgba(5,12,22,.72);backdrop-filter:blur(9px)}.commercial-overlay.hidden{display:none!important}.commercial-modal{width:min(880px,calc(100vw - 28px));max-height:min(790px,calc(100vh - 30px));display:grid;grid-template-rows:auto minmax(0,1fr);overflow:hidden;border:1px solid var(--line);border-radius:20px;background:var(--card-solid);box-shadow:0 34px 100px rgba(0,0,0,.46)}.commercial-head{display:flex;align-items:center;justify-content:space-between;padding:18px 22px;border-bottom:1px solid var(--line);background:linear-gradient(135deg,rgba(56,201,31,.08),transparent 58%)}.commercial-head h2{margin-top:2px;font-size:21px;font-weight:950;letter-spacing:-.02em}.commercial-close{width:38px;height:38px;border:1px solid var(--line);border-radius:10px;background:transparent;color:var(--text);cursor:pointer}.commercial-body{min-height:0;overflow:auto;padding:20px 22px 24px}.commercial-section+ .commercial-section{margin-top:22px}.commercial-section>h3{margin-bottom:10px;color:var(--muted);font-size:10px;font-weight:950;text-transform:uppercase;letter-spacing:.08em}.commercial-card{padding:15px;border:1px solid var(--line);border-radius:13px;background:rgba(127,127,127,.025)}.commercial-card+.commercial-card{margin-top:9px}.commercial-card-head{display:flex;justify-content:space-between;gap:12px}.commercial-card h4{font-size:14px;font-weight:950}.commercial-card p{margin-top:5px;color:var(--muted);font-size:10px;line-height:1.55}.commercial-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:12px}.commercial-grid div{padding:9px;border:1px solid rgba(127,127,127,.08);border-radius:9px;background:rgba(127,127,127,.045)}.commercial-grid span{display:block;color:var(--muted);font-size:8px;font-weight:850;text-transform:uppercase;letter-spacing:.03em}.commercial-grid strong{display:block;margin-top:4px;font-size:11px;font-weight:950;line-height:1.35}.commercial-actions{display:flex;flex-wrap:wrap;gap:7px;margin-top:12px}.commercial-actions button{min-height:36px;padding:0 13px;border-radius:9px;border:1px solid var(--line);font-size:10px;font-weight:900;cursor:pointer}.commercial-primary{background:var(--green-2);color:#07130a;border-color:transparent!important}.commercial-danger{background:transparent;color:#ef4444}.commercial-note{padding:11px 13px;border-radius:10px;background:rgba(56,201,31,.07);color:var(--muted);font-size:10px;line-height:1.5}.sponsor-mail-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}.sponsor-mail-actions button{min-height:38px;padding:0 14px;border-radius:9px;border:1px solid var(--line);font-size:10px;font-weight:950;cursor:pointer}.sponsor-delivery-chip{display:inline-flex;padding:5px 8px;border-radius:999px;background:rgba(56,201,31,.08);color:var(--green-2);font-size:8px;font-weight:950;text-transform:uppercase;letter-spacing:.04em}.sponsor-week-marker{display:block;margin-top:4px;color:var(--green-2);font-size:7px;font-weight:950}.sponsor-activity-card{border-color:rgba(56,201,31,.45)!important}.market-negotiate-btn{background:rgba(56,201,31,.08)!important;color:var(--green-2)!important}.market-neg-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.market-neg-form label{display:grid;gap:5px;color:var(--muted);font-size:9px;font-weight:850}.market-neg-form input,.market-neg-form select{width:100%;height:38px;padding:0 10px;border:1px solid var(--line);border-radius:8px;background:var(--card-solid);color:var(--text);font:inherit}.market-neg-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}
  .sponsor-proposal-section>h3{margin-bottom:9px;color:var(--green-2)}.sponsor-proposal-card{padding:0;overflow:hidden;border-color:rgba(56,201,31,.38);background:linear-gradient(145deg,rgba(56,201,31,.055),rgba(127,127,127,.018) 48%)}.sponsor-proposal-top{display:flex;justify-content:space-between;gap:24px;padding:22px 22px 17px}.sponsor-proposal-brand{min-width:0}.sponsor-proposal-brand .sponsor-delivery-chip{margin-bottom:10px}.sponsor-proposal-brand h4{font-size:25px;line-height:1.05;letter-spacing:-.035em}.sponsor-proposal-brand p{max-width:500px;margin-top:8px;font-size:11px;line-height:1.6}.sponsor-proposal-value{flex:0 0 auto;min-width:155px;padding:13px 14px;border:1px solid rgba(56,201,31,.18);border-radius:12px;background:rgba(56,201,31,.075);text-align:right}.sponsor-proposal-value span{display:block;color:var(--muted);font-size:8px;font-weight:900;text-transform:uppercase}.sponsor-proposal-value strong{display:block;margin-top:5px;color:var(--green-2);font-size:23px;font-weight:950;letter-spacing:-.04em}.sponsor-proposal-value small{display:block;margin-top:3px;color:var(--muted);font-size:9px;font-weight:800}.sponsor-proposal-quick{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;padding:0 22px 16px}.sponsor-proposal-quick>div{padding:10px 11px;border:1px solid var(--line);border-radius:10px;background:var(--card-solid)}.sponsor-proposal-quick span{display:block;color:var(--muted);font-size:8px;font-weight:850;text-transform:uppercase}.sponsor-proposal-quick strong{display:block;margin-top:4px;font-size:11px;font-weight:950}.sponsor-decision-copy{margin:0 22px 16px;padding:10px 12px;border-left:3px solid var(--green-2);border-radius:0 9px 9px 0;background:rgba(56,201,31,.055);color:var(--muted);font-size:10px;line-height:1.55}.sponsor-proposal-card>.sponsor-proposal-terms{margin:0 22px 16px}.sponsor-proposal-actions{display:grid;grid-template-columns:auto minmax(170px,1fr) minmax(180px,1.25fr);gap:9px;padding:16px 22px 20px;border-top:1px solid var(--line);background:rgba(127,127,127,.02)}.sponsor-proposal-actions button{min-height:44px;padding:0 16px;border:1px solid var(--line);border-radius:10px;background:transparent;color:var(--text);font-size:11px;font-weight:950;cursor:pointer}.sponsor-proposal-actions .sponsor-reject{color:#ef4444}.sponsor-proposal-actions .sponsor-negotiate{background:rgba(56,201,31,.07);color:var(--green-2)}.sponsor-proposal-actions .sponsor-accept{border-color:transparent;background:var(--green-2);color:#07130a}.sponsor-proposal-actions button:disabled{opacity:.45;cursor:not-allowed}
  @media(max-width:700px){.sponsor-summary,.commercial-grid,.market-neg-form,.sponsor-proposal-quick{grid-template-columns:1fr 1fr!important}.commercial-body{padding:14px}.commercial-modal{max-height:calc(100vh - 18px)}.sponsor-proposal-top{display:grid;padding:18px}.sponsor-proposal-value{text-align:left}.sponsor-proposal-quick{padding:0 18px 14px}.sponsor-decision-copy{margin:0 18px 14px}.sponsor-proposal-card>.sponsor-proposal-terms{margin:0 18px 14px}.sponsor-proposal-actions{grid-template-columns:1fr;padding:14px 18px 18px}.sponsor-proposal-brand h4{font-size:22px}}
  `;
  document.head.appendChild(style);
}

async function rpc(name,args={}){const {data,error}=await supabase.rpc(name,args);if(error)throw error;return data}

async function loadSponsorState(){
  if(sponsorBusy)return sponsorState;
  sponsorBusy=true;
  try{sponsorState=await rpc('get_career_sponsorship_state');renderSponsorPanel();renderSponsorModal();decorateInbox();decorateWeek();decorateProfessionalActivities();return sponsorState}
  catch(error){console.warn('[Sponsorship]',error?.message||error);return sponsorState}
  finally{sponsorBusy=false}
}

function sponsorHost(){return document.getElementById('careerClubPathPanel')||document.querySelector('.agenda-column .objective-panel')}
function renderSponsorPanel(){
  const host=sponsorHost();if(!host)return;
  let card=document.getElementById('careerSponsorPanel');
  if(!card){card=document.createElement('article');card.id='careerSponsorPanel';card.className='career-panel card-shell career-sponsor-panel';host.insertAdjacentElement('afterend',card)}
  const contracts=(sponsorState?.contracts||[]).filter(c=>c.status==='active');
  const deliveries=sponsorState?.deliverables||[];
  const proposal=sponsorState?.proposal;
  card.innerHTML=`<header class="panel-heading compact"><div><span class="panel-icon green"><i data-lucide="badge-dollar-sign"></i></span><div><h2>Patrocínios</h2><p>Contratos, campanhas e compromissos comerciais</p></div></div>${proposal?'<span class="load-chip">PROPOSTA</span>':''}</header><div class="sponsor-summary"><div><span>Ativos</span><strong>${contracts.length}</strong></div><div><span>Pendências</span><strong>${deliveries.length}</strong></div><div><span>Nível comercial</span><strong>${Number(sponsorState?.tier_cap||1)}</strong></div></div><button id="openSponsorCenter" class="secondary-action sponsor-open" type="button"><i data-lucide="briefcase-business"></i><span>${proposal?'Ver proposta comercial':'Abrir patrocínios'}</span></button>`;
  document.getElementById('openSponsorCenter')?.addEventListener('click',openSponsorModal);icons();
}

function ensureSponsorModal(){
  if(document.getElementById('careerSponsorModal'))return;
  const node=document.createElement('div');node.id='careerSponsorModal';node.className='commercial-overlay hidden';node.innerHTML=`<section class="commercial-modal"><header class="commercial-head"><div><span class="identity-kicker">CARREIRA COMERCIAL</span><h2 id="careerSponsorModalTitle">Patrocínios</h2></div><button class="commercial-close" type="button" aria-label="Fechar"><i data-lucide="x"></i></button></header><div id="careerSponsorModalBody" class="commercial-body"></div></section>`;
  node.querySelector('.commercial-close').addEventListener('click',()=>node.classList.add('hidden'));node.addEventListener('click',e=>{if(e.target===node)node.classList.add('hidden')});document.body.appendChild(node);icons();
}
function openSponsorModal(){ensureSponsorModal();renderSponsorModal();document.getElementById('careerSponsorModal')?.classList.remove('hidden')}

function contractCard(c){return `<article class="commercial-card"><div class="commercial-card-head"><div><span class="sponsor-delivery-chip">${esc(c.contract_kind==='main'?'Contrato principal':'Campanha')}</span><h4>${esc(c.brand)}</h4></div><strong>${esc(String(c.trust))}% confiança</strong></div><div class="commercial-grid"><div><span>Início</span><strong>${date(c.started_on)}</strong></div><div><span>Fim</span><strong>${date(c.ends_on)}</strong></div><div><span>Mensal</span><strong>${money(c.monthly_fee)}</strong></div><div><span>Por ação</span><strong>${money(c.per_delivery_fee)}</strong></div></div><p>${c.exclusivity?`Exclusividade: ${esc(c.exclusivity_category||c.category)}. `:''}${Number(c.strikes||0)} falta${Number(c.strikes||0)===1?'':'s'} registrada${Number(c.strikes||0)===1?'':'s'}.</p></article>`}
function deliveryCard(d){
  const fixed=Boolean(d.scheduled_on);const now=sponsorState?.career_date;const currentPeriod=Number(hub?.state?.period||0);const can=!fixed||(d.scheduled_on===now&&Number(d.scheduled_period)===currentPeriod);
  return `<article class="commercial-card"><div class="commercial-card-head"><div><span class="sponsor-delivery-chip">${fixed?'Horário marcado':'Até o prazo'}</span><h4>${esc(d.title)}</h4></div><strong>${money(d.payout)}</strong></div><p>${esc(d.description)} · ${fixed?`${date(d.scheduled_on)} · ${period(d.scheduled_period)}`:`até ${date(d.due_on)}`}.</p><div class="commercial-actions"><button class="commercial-primary" data-complete-sponsor="${esc(d.id)}" type="button" ${can?'':'disabled'}>${can?'Cumprir compromisso':'Aguardando horário'}</button></div></article>`}

function proposalCard(proposal){
  const mainValue=Number(proposal.monthly_fee||0)>0?money(proposal.monthly_fee):money(proposal.per_delivery_fee);
  const valueLabel=Number(proposal.monthly_fee||0)>0?'por mês':'por ação';
  const exclusive=proposal.exclusivity_category?esc(proposal.exclusivity_category):'Sem exclusividade';
  const negotiationRound=Number(proposal.negotiation_round||0);
  return `<section class="commercial-section sponsor-proposal-section"><h3>Proposta comercial pendente</h3><article class="commercial-card sponsor-proposal-card" data-sponsor-proposal-main="${esc(proposal.id)}"><div class="sponsor-proposal-top"><div class="sponsor-proposal-brand"><span class="sponsor-delivery-chip">${proposal.offer_kind==='main'?'Contrato principal':'Campanha'} · Tier ${Number(proposal.brand_tier||1)}</span><h4>${esc(proposal.brand)}</h4><p>Confira o que a marca oferece e o que ela espera de você. Nada vira obrigação até você aceitar.</p></div><div class="sponsor-proposal-value"><span>Valor principal</span><strong>${mainValue}</strong><small>${valueLabel}</small></div></div><div class="sponsor-proposal-quick"><div><span>Duração</span><strong>${Number(proposal.contract_days||0)} dias</strong></div><div><span>Máximo semanal</span><strong>${Number(proposal.max_weekly_deliveries||1)} ação${Number(proposal.max_weekly_deliveries||1)===1?'':'ões'}</strong></div><div><span>Responder até</span><strong>${date(proposal.response_deadline)}</strong></div><div><span>Exclusividade</span><strong>${exclusive}</strong></div></div><div class="sponsor-decision-copy">Você pode aceitar agora, recusar sem punição ou pedir ao empresário uma nova negociação. Rodada atual: ${negotiationRound}/2.</div><div class="sponsor-proposal-actions"><button class="sponsor-reject" data-sponsor-modal-response="decline" type="button">Recusar proposta</button><button class="sponsor-negotiate" data-sponsor-modal-response="negotiate" type="button" ${negotiationRound>=2?'disabled':''}>Negociar com empresário</button><button class="sponsor-accept" data-sponsor-modal-response="accept" type="button">Aceitar proposta</button></div></article></section>`;
}

function renderSponsorModal(){
  const body=document.getElementById('careerSponsorModalBody');if(!body)return;
  const proposal=sponsorState?.proposal;const contracts=sponsorState?.contracts||[];const deliveries=sponsorState?.deliverables||[];
  const title=document.getElementById('careerSponsorModalTitle');if(title)title.textContent=proposal?'Proposta comercial':'Patrocínios';
  body.innerHTML=`${proposal?proposalCard(proposal):''}<section class="commercial-section"><h3>Contratos</h3>${contracts.length?contracts.map(contractCard).join(''):'<div class="commercial-note">Nenhum contrato de patrocínio ativo ou encerrado ainda.</div>'}</section><section class="commercial-section"><h3>Compromissos</h3>${deliveries.length?deliveries.map(deliveryCard).join(''):'<div class="commercial-note">Nenhuma entrega pendente.</div>'}</section>`;
  body.querySelectorAll('[data-complete-sponsor]').forEach(btn=>btn.addEventListener('click',()=>completeSponsor(btn.dataset.completeSponsor)));
  body.querySelectorAll('[data-sponsor-modal-response]').forEach(btn=>btn.addEventListener('click',()=>respondSponsor(btn.dataset.sponsorModalResponse)));
  icons();
}

async function completeSponsor(id){try{const r=await rpc('complete_career_sponsor_deliverable',{p_deliverable_id:id});showToast('Patrocínio',`Compromisso concluído · ${money(r?.payout)}`,'success');await loadSponsorState();window.dispatchEvent(new CustomEvent('career:updated'))}catch(e){showToast('Patrocínio',e?.message||'Não foi possível concluir o compromisso.','error')}}

async function respondSponsor(action){
  const p=sponsorState?.proposal;if(!p)return;
  const buttons=[...document.querySelectorAll('[data-sponsor-response],[data-sponsor-modal-response]')];buttons.forEach(button=>button.disabled=true);
  try{
    const r=await rpc('respond_career_sponsor_proposal',{p_opportunity_id:p.id,p_action:action,p_message_id:p.message_id});
    showToast('Patrocínio',action==='accept'?'Contrato assinado.':action==='decline'?'Proposta recusada.':'Seu empresário voltou com uma contraproposta.','success');
    await loadSponsorState();
    window.dispatchEvent(new CustomEvent('career:updated'));
    if(action!=='negotiate')document.getElementById('careerSponsorModal')?.classList.add('hidden');
    if(r?.message_id)document.getElementById('careerInboxDetail')?.scrollTo?.({top:0,behavior:'smooth'});
  }catch(e){showToast('Patrocínio',e?.message||'Não foi possível responder à proposta.','error');buttons.forEach(button=>button.disabled=false)}
}

function decorateInbox(){
  const detail=document.getElementById('careerInboxDetail');if(!detail)return;
  detail.querySelector('.sponsor-mail-actions')?.remove();
  const p=sponsorState?.proposal;if(!p)return;
  const active=document.querySelector('#careerInboxList [data-mail-id].active');if(active?.dataset.mailId!==p.message_id)return;
  const box=document.createElement('div');box.className='sponsor-mail-actions';box.innerHTML=`<button class="commercial-danger" data-sponsor-response="decline" type="button">Recusar</button><button class="market-negotiate-btn" data-sponsor-response="negotiate" type="button" ${Number(p.negotiation_round)>=2?'disabled':''}>Negociar com empresário</button><button class="commercial-primary" data-sponsor-response="accept" type="button">Aceitar proposta</button>`;detail.appendChild(box);box.querySelectorAll('[data-sponsor-response]').forEach(b=>b.addEventListener('click',()=>respondSponsor(b.dataset.sponsorResponse)));
}

function decorateWeek(){
  const days=[...document.querySelectorAll('#weekStrip .week-day')];if(!days.length)return;days.forEach(d=>d.querySelector('.sponsor-week-marker')?.remove());
  const week=hub?.week||[];for(const del of sponsorState?.deliverables||[]){const key=del.scheduled_on||del.due_on;const idx=week.findIndex(w=>w.date===key);if(idx<0||!days[idx])continue;let marker=days[idx].querySelector('.sponsor-week-marker');if(!marker){marker=document.createElement('small');marker.className='sponsor-week-marker';marker.textContent='PATROCÍNIO';days[idx].appendChild(marker)}}
}

function decorateProfessionalActivities(){
  const active=document.querySelector('.activity-tab.active')?.dataset.category;if(active!=='professional')return;
  const grid=document.getElementById('activityGrid');if(!grid)return;grid.querySelectorAll('[data-sponsor-delivery-card]').forEach(n=>n.remove());
  const now=sponsorState?.career_date;const per=Number(hub?.state?.period||0);
  for(const d of sponsorState?.deliverables||[]){const fixed=Boolean(d.scheduled_on);const can=!fixed||(d.scheduled_on===now&&Number(d.scheduled_period)===per);const btn=document.createElement('button');btn.type='button';btn.className='activity-card sponsor-activity-card';btn.dataset.sponsorDeliveryCard=d.id;btn.disabled=!can;btn.innerHTML=`<div class="activity-card-head"><span class="activity-card-icon"><i data-lucide="badge-dollar-sign"></i></span><span class="activity-load">${fixed?'Agendado':'Prazo'}</span></div><strong>${esc(d.title)}</strong><p>${esc(d.brand)} · ${fixed?`${date(d.scheduled_on)} ${period(d.scheduled_period)}`:`até ${date(d.due_on)}`} · ${money(d.payout)}</p>${can?'':'<p class="activity-disabled">Este compromisso tem outro horário marcado.</p>'}`;btn.addEventListener('click',()=>completeSponsor(d.id));grid.prepend(btn)}icons();
}

function ensureMarketNegModal(){
  if(document.getElementById('marketNegModal'))return;
  const node=document.createElement('div');node.id='marketNegModal';node.className='commercial-overlay hidden';node.innerHTML=`<section class="commercial-modal" style="width:min(620px,calc(100vw - 28px))"><header class="commercial-head"><div><span class="identity-kicker">NEGOCIAÇÃO CONTRATUAL</span><h2>Contraproposta ao clube</h2></div><button class="commercial-close" type="button"><i data-lucide="x"></i></button></header><div id="marketNegBody" class="commercial-body"></div></section>`;node.querySelector('.commercial-close').addEventListener('click',()=>node.classList.add('hidden'));node.addEventListener('click',e=>{if(e.target===node)node.classList.add('hidden')});document.body.appendChild(node);icons();
}
async function openMarketNegotiation(id){
  ensureMarketNegModal();const {data:o,error}=await supabase.from('player_offers').select('id,round,current_terms,club:base_clubs!player_offers_club_id_fkey(name)').eq('id',id).single();if(error){showToast('Mercado',error.message,'error');return}const t=o.current_terms||{};const body=document.getElementById('marketNegBody');body.innerHTML=`<div class="commercial-note">Rodada ${Number(o.round||0)+1} de 3. O clube pode aceitar, contrapropor ou encerrar a negociação.</div><form id="marketNegForm" class="market-neg-form" style="margin-top:14px"><label>Salário mensal<input name="monthly_wage" type="number" min="1" step="50" value="${Number(t.monthly_wage||0)}"></label><label>Duração<select name="duration_seasons"><option value="1">1 temporada</option><option value="2">2 temporadas</option><option value="3">3 temporadas</option></select></label><label>Cláusula<input name="release_clause" type="number" min="1" step="1000" value="${Number(t.release_clause||0)}"></label><label>Papel no elenco<select name="squad_role"><option>Promessa</option><option>Reserva</option><option>Rotação</option><option>Titular</option><option>Estrela</option></select></label></form><div class="market-neg-actions"><button class="commercial-primary" id="sendMarketNeg" type="button">Enviar contraproposta</button></div>`;body.querySelector('[name="duration_seasons"]').value=String(t.duration_seasons||2);body.querySelector('[name="squad_role"]').value=t.squad_role||'Promessa';document.getElementById('marketNegModal').classList.remove('hidden');document.getElementById('sendMarketNeg').onclick=()=>sendMarketNegotiation(id,t.signing_bonus||0);icons();
}
async function sendMarketNegotiation(id,signingBonus){
  const f=new FormData(document.getElementById('marketNegForm'));const terms={monthly_wage:Number(f.get('monthly_wage')),duration_seasons:Number(f.get('duration_seasons')),release_clause:Number(f.get('release_clause')),squad_role:String(f.get('squad_role')),signing_bonus:Number(signingBonus||0)};try{const r=await rpc('negotiate_offer',{p_offer_id:id,p_requested_terms:terms});showToast('Mercado',r?.message||'Resposta recebida.','success');document.getElementById('marketNegModal').classList.add('hidden');window.dispatchEvent(new CustomEvent('career:updated'))}catch(e){showToast('Mercado',e?.message||'Não foi possível negociar.','error')}
}

function decorateMarketOffers(){
  document.querySelectorAll('.club-offer-card').forEach(card=>{if(card.querySelector('[data-market-negotiate]'))return;const reject=card.querySelector('[data-reject-offer]');const accept=card.querySelector('[data-accept-offer]');if(!reject||!accept)return;const id=reject.dataset.rejectOffer;const b=document.createElement('button');b.type='button';b.className='market-negotiate-btn';b.dataset.marketNegotiate=id;b.textContent='Negociar contrato';b.addEventListener('click',()=>openMarketNegotiation(id));accept.parentElement.insertBefore(b,accept)})
}

ensureStyles();
document.addEventListener('career:hub-rendered',async e=>{hub=e.detail||null;await loadSponsorState();setTimeout(decorateMarketOffers,0)});
document.addEventListener('career:activities-rendered',()=>decorateProfessionalActivities());
document.addEventListener('career:mail-selected',()=>decorateInbox());
document.addEventListener('click',e=>{if(e.target.closest?.('#openClubOffers'))setTimeout(decorateMarketOffers,0)});
window.addEventListener('career:updated',()=>{loadSponsorState();setTimeout(decorateMarketOffers,100)});