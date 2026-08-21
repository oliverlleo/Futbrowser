import { supabase } from '../../services/supabase-client.js';
import { showToast } from '../../components/toast/toast.js';

let observer=null;
let busy=false;
let lastKey='';

const ACTIVE=new Set(['new','reviewed','negotiating','countered']);
const MARKET_TYPES=new Set(['academy_transfer','professional_transfer','professional_promotion']);
const esc=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const money=value=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(Number(value||0));
const fmtDate=value=>{if(!value)return '—';const d=new Date(`${value}T12:00:00`);return Number.isNaN(d.getTime())?'—':new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'}).format(d)};
const squadLabel=value=>({base:'Base',u15:'Sub-15',u17:'Sub-17',u18:'Sub-18',u20:'Sub-20',first_team:'Profissional'}[value]||value||'—');

function ensureStyle(){
  if(document.getElementById('career-market-inbox-v14-style'))return;
  const style=document.createElement('style');
  style.id='career-market-inbox-v14-style';
  style.textContent=`
  .market-mail-flow{margin-top:20px;padding-top:18px;border-top:1px solid var(--line)}
  .market-mail-flow h4{font-size:13px;font-weight:950}.market-mail-flow>p{margin-top:5px;color:var(--muted);font-size:10px;line-height:1.5}
  .market-mail-terms{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px;margin-top:11px}.market-mail-terms>div{padding:9px;border:1px solid var(--line);border-radius:9px;background:rgba(127,127,127,.025)}.market-mail-terms span{display:block;color:var(--muted);font-size:7px;font-weight:850;text-transform:uppercase}.market-mail-terms strong{display:block;margin-top:3px;font-size:10px;font-weight:950}
  .market-mail-compare{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:12px}.market-mail-side{padding:12px;border:1px solid var(--line);border-radius:11px;background:rgba(127,127,127,.02)}.market-mail-side.club{border-color:rgba(56,201,31,.25);background:rgba(56,201,31,.035)}.market-mail-side h5{font-size:9px;font-weight:950;text-transform:uppercase;letter-spacing:.05em}.market-mail-side .market-mail-terms{grid-template-columns:repeat(2,minmax(0,1fr))}
  .market-mail-state{margin-top:11px;padding:9px 11px;border-radius:9px;background:rgba(56,201,31,.07);font-size:9px;font-weight:800;line-height:1.45}.market-mail-state.ended{background:rgba(239,68,68,.07);color:#ef4444}
  .market-mail-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:13px}.market-mail-actions button{min-height:36px;padding:0 13px;border:1px solid var(--line);border-radius:9px;background:transparent;color:var(--text);font-size:10px;font-weight:950;cursor:pointer}.market-mail-actions .primary{background:var(--green-2);border-color:transparent;color:#07130a}.market-mail-actions .danger{color:#ef4444}.market-mail-actions button:disabled{opacity:.45;cursor:not-allowed}
  .market-contract-overlay{position:fixed;inset:0;z-index:190000;display:grid;place-items:center;padding:18px;background:rgba(5,12,22,.72);backdrop-filter:blur(8px)}.market-contract-overlay.hidden{display:none!important}.market-contract-modal{width:min(720px,calc(100vw - 28px));max-height:calc(100vh - 30px);overflow:auto;border:1px solid var(--line);border-radius:17px;background:var(--card-solid);box-shadow:0 30px 90px rgba(0,0,0,.42)}.market-contract-head{display:flex;align-items:center;justify-content:space-between;padding:17px 19px;border-bottom:1px solid var(--line)}.market-contract-head span{color:var(--green-2);font-size:8px;font-weight:950;letter-spacing:.08em}.market-contract-head h3{margin-top:3px;font-size:19px}.market-contract-close{width:35px;height:35px;border:1px solid var(--line);border-radius:9px;background:transparent;color:var(--text);cursor:pointer}.market-contract-body{padding:18px 19px}.market-contract-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}.market-contract-actions button{min-height:38px;padding:0 14px;border:1px solid var(--line);border-radius:9px;background:transparent;color:var(--text);font-size:10px;font-weight:950;cursor:pointer}.market-contract-actions .primary{background:var(--green-2);border-color:transparent;color:#07130a}
  .market-inbox-neg-form{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}.market-inbox-neg-form label{display:grid;gap:5px;color:var(--muted);font-size:9px;font-weight:850}.market-inbox-neg-form input,.market-inbox-neg-form select{height:39px;padding:0 10px;border:1px solid var(--line);border-radius:8px;background:var(--card-solid);color:var(--text);font:inherit}
  @media(max-width:720px){.market-mail-terms{grid-template-columns:1fr 1fr}.market-mail-compare,.market-inbox-neg-form{grid-template-columns:1fr}.market-mail-side .market-mail-terms{grid-template-columns:1fr 1fr}}
  `;
  document.head.appendChild(style);
}

function termsHtml(terms={}){
  return `<div class="market-mail-terms"><div><span>Salário</span><strong>${money(terms.monthly_wage)}</strong></div><div><span>Papel</span><strong>${esc(terms.squad_role||'—')}</strong></div><div><span>Duração</span><strong>${Number(terms.duration_seasons||0)} temp.</strong></div><div><span>Cláusula</span><strong>${money(terms.release_clause)}</strong></div><div><span>Bônus</span><strong>${money(terms.signing_bonus)}</strong></div></div>`;
}

async function loadContext(messageId){
  const {data:message,error:messageError}=await supabase.from('player_messages').select('id,offer_id,message_type,metadata').eq('id',messageId).maybeSingle();
  if(messageError||!message?.offer_id)return null;
  const kind=message.metadata?.kind;
  if(!['offer','negotiation_response'].includes(message.message_type)&&!['career_market_offer','career_market_negotiation_response'].includes(kind))return null;
  const {data:offer,error:offerError}=await supabase.from('player_offers').select('id,status,offer_type,round,current_terms,initial_terms,target_squad_level,effective_on,transfer_fee,career_expires_on,club:base_clubs!player_offers_club_id_fkey(name)').eq('id',message.offer_id).maybeSingle();
  if(offerError||!offer||!MARKET_TYPES.has(offer.offer_type))return null;
  const {data:history,error:historyError}=await supabase.from('player_offer_history').select('round,previous_terms,requested_terms,club_response_terms,response_action,created_at').eq('offer_id',offer.id).order('round',{ascending:false}).limit(1).maybeSingle();
  if(historyError)console.warn('[Market inbox] histórico:',historyError.message);
  return {message,offer,history:history||null};
}

async function decorateSelectedMarketMail(force=false){
  if(busy)return;
  const active=document.querySelector('#careerInboxList [data-mail-id].active');
  const detail=document.getElementById('careerInboxDetail');
  if(!active||!detail)return;
  const messageId=active.dataset.mailId;
  if(!messageId)return;
  busy=true;
  try{
    const ctx=await loadContext(messageId);
    detail.querySelector('.market-mail-flow')?.remove();
    if(!ctx){lastKey='';return;}
    const {offer,history}=ctx;
    const key=[messageId,offer.status,offer.round,history?.round,history?.response_action].join(':');
    if(!force&&key===lastKey&&detail.querySelector('.market-mail-flow'))return;
    lastKey=key;
    const activeOffer=ACTIVE.has(offer.status);
    const ended=!activeOffer||history?.response_action==='withdrawn';
    const acceptedTerms=history?.response_action==='accepted';
    const canNegotiate=activeOffer&&!acceptedTerms&&Number(offer.round||0)<3;
    const canSign=activeOffer&&!ended;
    const flow=document.createElement('section');
    flow.className='market-mail-flow';
    let comparison='';
    if(history){
      comparison=`<div class="market-mail-compare"><div class="market-mail-side"><h5>Sua contraproposta</h5>${termsHtml(history.requested_terms||{})}</div><div class="market-mail-side club"><h5>Resposta do clube</h5>${termsHtml(history.club_response_terms||offer.current_terms||{})}</div></div>`;
    }
    const stateText=ended?'Esta negociação foi encerrada e não pode mais ser assinada.':acceptedTerms?'O clube aceitou exatamente os termos pedidos. Revise o contrato final antes de assinar.':history?.response_action==='countered'?'O clube fez uma contraproposta. Você pode aceitá-la, recusar ou usar outra rodada de negociação.':'Os clubes já resolveram a transferência. Agora a decisão contratual é sua.';
    flow.innerHTML=`<h4>${esc(offer.club?.name||'Clube interessado')} · ${squadLabel(offer.target_squad_level)}</h4><p>Prazo: ${fmtDate(offer.career_expires_on)}${Number(offer.transfer_fee||0)>0?` · acordo entre clubes: ${money(offer.transfer_fee)}`:''}</p>${history?comparison:termsHtml(offer.current_terms||{})}<div class="market-mail-state ${ended?'ended':''}">${esc(stateText)}</div><div class="market-mail-actions">${canNegotiate?`<button type="button" data-market-mail-negotiate="${esc(offer.id)}">${history?'Negociar novamente':'Negociar contrato'}</button>`:''}${canSign?`<button class="primary" type="button" data-market-mail-review="${esc(offer.id)}">Revisar e assinar</button>`:''}${activeOffer?`<button class="danger" type="button" data-market-mail-reject="${esc(offer.id)}">Recusar</button>`:''}</div>`;
    detail.appendChild(flow);
    flow.querySelector('[data-market-mail-negotiate]')?.addEventListener('click',e=>openNegotiation(e.currentTarget.dataset.marketMailNegotiate));
    flow.querySelector('[data-market-mail-review]')?.addEventListener('click',e=>openReview(e.currentTarget.dataset.marketMailReview));
    flow.querySelector('[data-market-mail-reject]')?.addEventListener('click',e=>rejectOffer(e.currentTarget.dataset.marketMailReject));
  }catch(error){console.warn('[Market inbox]',error?.message||error)}finally{busy=false}
}

function ensureReviewModal(){
  if(document.getElementById('marketContractReviewModal'))return;
  const node=document.createElement('div');node.id='marketContractReviewModal';node.className='market-contract-overlay hidden';node.innerHTML=`<section class="market-contract-modal"><header class="market-contract-head"><div><span>CONTRATO FINAL</span><h3>Revisar e assinar</h3></div><button class="market-contract-close" type="button">×</button></header><div id="marketContractReviewBody" class="market-contract-body"></div></section>`;node.querySelector('.market-contract-close').addEventListener('click',()=>node.classList.add('hidden'));node.addEventListener('click',e=>{if(e.target===node)node.classList.add('hidden')});document.body.appendChild(node);
}

async function openReview(id){
  ensureReviewModal();
  const {data:offer,error}=await supabase.from('player_offers').select('id,status,offer_type,current_terms,target_squad_level,effective_on,transfer_fee,club:base_clubs!player_offers_club_id_fkey(name)').eq('id',id).maybeSingle();
  if(error||!offer){showToast('Mercado',error?.message||'Proposta não encontrada.','error');return}
  const body=document.getElementById('marketContractReviewBody');
  body.innerHTML=`<div class="market-mail-state">Confira tudo antes de assinar. A assinatura é a decisão final do jogador.</div><h4 style="margin-top:14px;font-size:15px">${esc(offer.club?.name||'Clube')}</h4><p style="margin-top:4px;color:var(--muted);font-size:10px">Destino: ${squadLabel(offer.target_squad_level)}${offer.effective_on?` · registro ${fmtDate(offer.effective_on)}`:''}${Number(offer.transfer_fee||0)>0?` · transferência ${money(offer.transfer_fee)}`:''}</p>${termsHtml(offer.current_terms||{})}<div class="market-contract-actions"><button type="button" data-close-market-review>Voltar</button><button class="primary" type="button" data-sign-market-offer="${esc(offer.id)}">Assinar contrato</button></div>`;
  body.querySelector('[data-close-market-review]').addEventListener('click',()=>document.getElementById('marketContractReviewModal').classList.add('hidden'));
  body.querySelector('[data-sign-market-offer]').addEventListener('click',e=>signOffer(e.currentTarget.dataset.signMarketOffer));
  document.getElementById('marketContractReviewModal').classList.remove('hidden');
}

async function signOffer(id){
  try{
    const result=await supabase.rpc('accept_career_market_offer',{p_offer_id:id});
    if(result.error)throw result.error;
    document.getElementById('marketContractReviewModal')?.classList.add('hidden');
    const payload=result.data;
    showToast('Mercado',payload?.status==='pending_registration'?`Contrato assinado. Registro em ${fmtDate(payload.effective_on)}.`:'Contrato assinado e mudança concluída.','success');
    window.dispatchEvent(new CustomEvent('career:updated'));
    if(payload?.status==='completed')setTimeout(()=>window.location.reload(),250);
  }catch(error){showToast('Mercado',error?.message||'Não foi possível assinar o contrato.','error')}
}

async function rejectOffer(id){
  try{
    const {error}=await supabase.rpc('reject_career_market_offer',{p_offer_id:id});
    if(error)throw error;
    showToast('Mercado','Proposta recusada.','info');
    lastKey='';
    window.dispatchEvent(new CustomEvent('career:updated'));
    setTimeout(()=>decorateSelectedMarketMail(true),80);
  }catch(error){showToast('Mercado',error?.message||'Não foi possível recusar a proposta.','error')}
}

function ensureNegotiationModal(){
  if(document.getElementById('marketInboxNegotiationModal'))return;
  const node=document.createElement('div');node.id='marketInboxNegotiationModal';node.className='market-contract-overlay hidden';node.innerHTML=`<section class="market-contract-modal"><header class="market-contract-head"><div><span>NEGOCIAÇÃO CONTRATUAL</span><h3>Enviar contraproposta</h3></div><button class="market-contract-close" type="button">×</button></header><div id="marketInboxNegotiationBody" class="market-contract-body"></div></section>`;node.querySelector('.market-contract-close').addEventListener('click',()=>node.classList.add('hidden'));node.addEventListener('click',e=>{if(e.target===node)node.classList.add('hidden')});document.body.appendChild(node);
}

async function openNegotiation(id){
  ensureNegotiationModal();
  const {data:offer,error}=await supabase.from('player_offers').select('id,round,current_terms,club:base_clubs!player_offers_club_id_fkey(name)').eq('id',id).maybeSingle();
  if(error||!offer){showToast('Mercado',error?.message||'Proposta não encontrada.','error');return}
  const t=offer.current_terms||{};
  const body=document.getElementById('marketInboxNegotiationBody');
  body.innerHTML=`<div class="market-mail-state">Rodada ${Number(offer.round||0)+1} de 3. O clube pode aceitar, contrapropor ou encerrar a negociação.</div><form id="marketInboxNegForm" class="market-inbox-neg-form"><label>Salário mensal<input name="monthly_wage" type="number" min="1" step="50" value="${Number(t.monthly_wage||0)}"></label><label>Duração<select name="duration_seasons"><option value="1">1 temporada</option><option value="2">2 temporadas</option><option value="3">3 temporadas</option></select></label><label>Cláusula rescisória<input name="release_clause" type="number" min="1" step="1000" value="${Number(t.release_clause||0)}"></label><label>Papel no elenco<select name="squad_role"><option>Promessa</option><option>Reserva</option><option>Rotação</option><option>Titular</option><option>Estrela</option></select></label></form><div class="market-contract-actions"><button type="button" data-close-market-neg>Cancelar</button><button class="primary" type="button" data-send-market-neg="${esc(offer.id)}">Enviar contraproposta</button></div>`;
  body.querySelector('[name="duration_seasons"]').value=String(t.duration_seasons||2);
  body.querySelector('[name="squad_role"]').value=t.squad_role||'Promessa';
  body.querySelector('[data-close-market-neg]').addEventListener('click',()=>document.getElementById('marketInboxNegotiationModal').classList.add('hidden'));
  body.querySelector('[data-send-market-neg]').addEventListener('click',e=>sendNegotiation(e.currentTarget.dataset.sendMarketNeg,Number(t.signing_bonus||0)));
  document.getElementById('marketInboxNegotiationModal').classList.remove('hidden');
}

async function sendNegotiation(id,signingBonus){
  const form=document.getElementById('marketInboxNegForm');if(!form)return;
  const f=new FormData(form);
  const terms={monthly_wage:Number(f.get('monthly_wage')),duration_seasons:Number(f.get('duration_seasons')),release_clause:Number(f.get('release_clause')),squad_role:String(f.get('squad_role')),signing_bonus:Number(signingBonus||0)};
  try{
    const {data,error}=await supabase.rpc('negotiate_offer',{p_offer_id:id,p_requested_terms:terms});
    if(error)throw error;
    document.getElementById('marketInboxNegotiationModal')?.classList.add('hidden');
    showToast('Mercado',data?.message||'O clube respondeu à contraproposta.','success');
    lastKey='';
    window.dispatchEvent(new CustomEvent('career:updated'));
    setTimeout(()=>decorateSelectedMarketMail(true),100);
  }catch(error){showToast('Mercado',error?.message||'Não foi possível negociar.','error')}
}

function installObserver(){
  if(observer)return;
  observer=new MutationObserver(()=>{if(document.getElementById('careerInboxDetail'))decorateSelectedMarketMail()});
  observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
}

ensureStyle();
installObserver();
document.addEventListener('click',event=>{if(event.target.closest?.('[data-mail-id]'))setTimeout(()=>decorateSelectedMarketMail(true),30)});
document.addEventListener('career:hub-rendered',()=>setTimeout(()=>decorateSelectedMarketMail(),50));
window.addEventListener('career:updated',()=>{lastKey='';setTimeout(()=>decorateSelectedMarketMail(true),80)});
