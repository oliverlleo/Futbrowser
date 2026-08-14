import { supabase } from '../../services/supabase-client.js';

let proposalState=null;
let refreshing=false;
let observer=null;

const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(Number(v||0));
const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const date=v=>{if(!v)return '—';const d=new Date(`${v}T12:00:00`);return Number.isNaN(d.getTime())?'—':new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'}).format(d)};

function setText(id,value){const el=document.getElementById(id);if(el)el.textContent=value}
function setBar(id,value){const el=document.getElementById(id);if(el)el.style.width=`${Math.max(0,Math.min(100,Number(value||0)))}%`}

async function getSponsorState(){
  const {data,error}=await supabase.rpc('get_career_sponsorship_state');
  if(error)throw error;
  proposalState=data||null;
  return proposalState;
}

function termsHtml(p){
  if(!p)return '';
  const t=p.terms||{};
  const exclusive=Boolean(t.exclusivity||p.exclusivity_category);
  return `<div class="sponsor-proposal-terms commercial-grid">
    <div><span>Tipo</span><strong>${p.offer_kind==='main'?'Contrato principal':'Campanha'}</strong></div>
    <div><span>Tier da marca</span><strong>${Number(p.brand_tier||1)}</strong></div>
    <div><span>Duração</span><strong>${Number(p.contract_days||0)} dias</strong></div>
    <div><span>Prazo de resposta</span><strong>${date(p.response_deadline)}</strong></div>
    <div><span>Mensalidade</span><strong>${money(p.monthly_fee)}</strong></div>
    <div><span>Luvas</span><strong>${money(p.signing_bonus)}</strong></div>
    <div><span>Por ação</span><strong>${money(p.per_delivery_fee)}</strong></div>
    <div><span>Máximo semanal</span><strong>${Number(p.max_weekly_deliveries||1)} ação${Number(p.max_weekly_deliveries||1)===1?'':'ões'}</strong></div>
    <div><span>Exclusividade</span><strong>${exclusive?esc(p.exclusivity_category||t.category||'Sim'):'Não'}</strong></div>
    <div><span>Negociação</span><strong>${Number(p.negotiation_round||0)}/2 rodada${Number(p.negotiation_round||0)===1?'':'s'}</strong></div>
  </div>`;
}

function decorateSponsorModal(){
  const body=document.getElementById('careerSponsorModalBody');
  const p=proposalState?.proposal;
  if(!body||!p)return;
  const section=body.querySelector('.commercial-section');
  const card=section?.querySelector('.commercial-card');
  if(!card)return;
  card.querySelector('.sponsor-proposal-terms')?.remove();
  card.insertAdjacentHTML('beforeend',termsHtml(p));
}

function decorateSponsorEmail(){
  const p=proposalState?.proposal;
  const detail=document.getElementById('careerInboxDetail');
  if(!detail||!p)return;
  const active=document.querySelector('#careerInboxList [data-mail-id].active');
  detail.querySelector('.sponsor-proposal-email-terms')?.remove();
  if(active?.dataset.mailId!==p.message_id)return;
  const wrap=document.createElement('section');
  wrap.className='sponsor-proposal-email-terms';
  wrap.style.marginTop='16px';
  wrap.innerHTML=`<div class="commercial-note"><strong>Termos atuais da proposta</strong><br>Esta é a versão válida para assinar. Se o empresário negociar, uma nova mensagem substituirá esta.</div>${termsHtml(p)}`;
  const actions=detail.querySelector('.sponsor-mail-actions');
  if(actions)detail.insertBefore(wrap,actions);else detail.appendChild(wrap);
}

async function syncCommercialUi(){
  try{await getSponsorState();decorateSponsorModal();decorateSponsorEmail()}catch(error){console.warn('[Commercial polish] sponsor state:',error?.message||error)}
}

async function refreshHubFromServer(){
  if(refreshing)return;
  refreshing=true;
  try{
    const {data,error}=await supabase.rpc('get_career_hub');
    if(error)throw error;
    if(!data)return;
    const state=data.state||{};
    setText('topCash',money(state.cash));
    setText('energyValue',`${Number(state.energy||0)}%`);
    setText('fatigueValue',`${Number(state.fatigue||0)}%`);
    setBar('energyBar',state.energy);setBar('fatigueBar',state.fatigue);setBar('readinessBar',state.readiness);
    if(state.readiness!=null)setText('readinessValue',String(state.readiness));
    document.dispatchEvent(new CustomEvent('career:hub-rendered',{detail:data}));
  }catch(error){console.warn('[Commercial polish] hub refresh:',error?.message||error)}
  finally{refreshing=false}
}

function startObserver(){
  if(observer)return;
  observer=new MutationObserver(()=>{decorateSponsorModal();decorateSponsorEmail()});
  observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
}

startObserver();
syncCommercialUi();
document.addEventListener('career:hub-rendered',()=>{syncCommercialUi()});
document.addEventListener('click',event=>{if(event.target.closest?.('[data-mail-id],#openSponsorCenter'))setTimeout(()=>{decorateSponsorModal();decorateSponsorEmail()},30)});
window.addEventListener('career:updated',async()=>{await refreshHubFromServer();await syncCommercialUi()});
