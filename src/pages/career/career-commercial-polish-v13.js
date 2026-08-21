import { supabase } from '../../services/supabase-client.js';

let proposalState=null;
let refreshing=false;

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

function bonusText(policy={}){
  const threshold=Number(policy.rating_threshold||8);
  const multiplier=Number(policy.multiplier||1);
  const parts=[];
  if(policy.appearance!==false)parts.push('jogos');
  if(policy.goals!==false)parts.push('gols');
  if(policy.assists!==false)parts.push('assistências');
  parts.push(`nota ≥ ${threshold}`);
  if(policy.national_team!==false)parts.push('seleção');
  if(policy.title_bonus!==false)parts.push('títulos');
  return `${parts.join(', ')}${multiplier!==1?` · fator ${multiplier.toFixed(2).replace('.',',')}×`:''}`;
}

function penaltyText(policy={}){
  const first=Number(policy.first_miss_percent||25);
  const step=Number(policy.repeat_step_percent||25);
  const max=Number(policy.max_miss_percent||75);
  const strikes=Number(policy.termination_strikes||3);
  const trust=Number(policy.termination_trust||30);
  return `1ª falta ${first}% · reincidência +${step}% até ${max}% · rescisão em ${strikes} faltas ou confiança ≤ ${trust}%`;
}

function proposalKey(p){return `${p?.id||''}:${p?.negotiation_round||0}:${JSON.stringify(p?.terms||{})}`}

function termsHtml(p,key=proposalKey(p)){
  if(!p)return '';
  const t=p.terms||{};
  const exclusive=Boolean(t.exclusivity||p.exclusivity_category);
  const bonus=t.bonus_policy||{};
  const penalty=t.penalty_policy||{};
  return `<div class="sponsor-proposal-terms commercial-grid" data-sponsor-terms-key="${esc(key)}">
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
    <div style="grid-column:span 2"><span>Bônus por desempenho</span><strong>${esc(bonusText(bonus))}</strong></div>
    <div style="grid-column:span 2"><span>Penalidades por descumprimento</span><strong>${esc(penaltyText(penalty))}</strong></div>
  </div>`;
}

function decorateDeliverableImpacts(){
  const body=document.getElementById('careerSponsorModalBody');
  if(!body)return;
  for(const d of proposalState?.deliverables||[]){
    const btn=body.querySelector(`[data-complete-sponsor="${CSS.escape(String(d.id))}"]`);
    const card=btn?.closest('.commercial-card');
    if(!card)continue;
    const m=d.metadata||{};
    const fixed=Boolean(d.scheduled_on);
    const key=`${d.id}:${m.energy_cost||0}:${m.fatigue_gain||0}:${m.exposure_gain||0}:${fixed}`;
    let note=card.querySelector('.sponsor-delivery-impact');
    if(note?.dataset.impactKey===key)continue;
    if(!note){note=document.createElement('p');note.className='sponsor-delivery-impact';const actions=card.querySelector('.commercial-actions');if(actions)card.insertBefore(note,actions);else card.appendChild(note)}
    note.dataset.impactKey=key;
    note.innerHTML=`<strong>Impacto:</strong> energia −${Number(m.energy_cost||0)} · fadiga +${Number(m.fatigue_gain||0)} · exposição +${Number(m.exposure_gain||0)} · ${fixed?'ocupa o período agendado':'prazo flexível'}`;
  }
}

function decorateContractPolicies(){
  const body=document.getElementById('careerSponsorModalBody');
  if(!body)return;
  const sections=[...body.querySelectorAll('.commercial-section')];
  const section=sections.find(s=>s.querySelector('h3')?.textContent?.trim()==='Contratos');
  if(!section)return;
  const cards=[...section.querySelectorAll('.commercial-card')];
  const contracts=proposalState?.contracts||[];
  cards.forEach((card,index)=>{
    const c=contracts[index];
    if(!c)return;
    const penalty=c.metadata?.penalty_policy||c.metadata?.accepted_terms?.penalty_policy||{};
    const bonus=c.metadata?.bonus_policy||c.metadata?.accepted_terms?.bonus_policy||{};
    const key=`${c.id}:${c.total_penalties||0}:${c.strikes||0}:${JSON.stringify(penalty)}:${JSON.stringify(bonus)}`;
    let note=card.querySelector('.sponsor-contract-policy');
    if(note?.dataset.policyKey===key)return;
    if(!note){note=document.createElement('p');note.className='sponsor-contract-policy';card.appendChild(note)}
    note.dataset.policyKey=key;
    note.innerHTML=`<strong>Bônus:</strong> ${esc(bonusText(bonus))}. <strong>Penalidades registradas:</strong> ${money(c.total_penalties)}. <strong>Regra:</strong> ${esc(penaltyText(penalty))}.`;
  });
}

function decorateSponsorModal(){
  const body=document.getElementById('careerSponsorModalBody');
  const p=proposalState?.proposal;
  if(!body)return;
  if(p){
    const card=body.querySelector('[data-sponsor-proposal-main]')||body.querySelector('.commercial-section .commercial-card');
    if(card){
      const key=proposalKey(p);
      const current=card.querySelector('.sponsor-proposal-terms');
      if(current?.dataset.sponsorTermsKey!==key){
        current?.remove();
        const actions=card.querySelector('.sponsor-proposal-actions');
        if(actions)actions.insertAdjacentHTML('beforebegin',termsHtml(p,key));
        else card.insertAdjacentHTML('beforeend',termsHtml(p,key));
      }
    }
  }
  decorateDeliverableImpacts();
  decorateContractPolicies();
}

function decorateSponsorEmail(){
  const p=proposalState?.proposal;
  const detail=document.getElementById('careerInboxDetail');
  if(!detail||!p)return;
  const active=document.querySelector('#careerInboxList [data-mail-id].active');
  const current=detail.querySelector('.sponsor-proposal-email-terms');
  if(active?.dataset.mailId!==p.message_id){current?.remove();return}
  const key=proposalKey(p);
  if(current?.dataset.emailTermsKey===key)return;
  current?.remove();
  const wrap=document.createElement('section');
  wrap.className='sponsor-proposal-email-terms';
  wrap.dataset.emailTermsKey=key;
  wrap.style.marginTop='16px';
  wrap.innerHTML=`<div class="commercial-note"><strong>Termos atuais da proposta</strong><br>Esta é a versão válida para assinar. Se o empresário negociar, uma nova mensagem substituirá esta.</div>${termsHtml(p,key)}`;
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

syncCommercialUi();
document.addEventListener('career:hub-rendered',()=>{syncCommercialUi()});
document.addEventListener('career:mail-selected',()=>{decorateSponsorEmail()});
document.addEventListener('click',event=>{if(event.target.closest?.('#openSponsorCenter'))setTimeout(()=>decorateSponsorModal(),30)});
window.addEventListener('career:updated',async()=>{await refreshHubFromServer();await syncCommercialUi()});