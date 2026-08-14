import { supabase } from '../../services/supabase-client.js';
import { showToast } from '../../components/toast/toast.js';

const PATH = ['base','u15','u17','u18','u20','first_team'];
const LABEL = { base:'Base',u15:'Sub-15',u17:'Sub-17',u18:'Sub-18',u20:'Sub-20',first_team:'Profissional' };
let playerId=null;
let currentHub=null;
let offers=[];
let pendingMove=null;
let promotion=null;
let lastReviewedDate=null;
let reviewBusy=false;

function ensureStyle(){
  if(document.querySelector('link[data-club-path-v8]'))return;
  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href='src/pages/career/career-club-path-v8.css?v=20260813-1';
  link.dataset.clubPathV8='1';
  document.head.appendChild(link);
}

function esc(v){return String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;')}
function money(v){return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(Number(v||0))}
function dateLabel(v){if(!v)return '—';const d=new Date(`${v}T12:00:00`);return Number.isNaN(d.getTime())?'—':new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'}).format(d)}
function refreshIcons(){if(window.lucide)window.lucide.createIcons({strokeWidth:1.8})}

function windowState(value){
  const d=new Date(`${value}T12:00:00`);if(Number.isNaN(d.getTime()))return {open:false,label:'Janela —',next:null};
  const y=d.getFullYear();const key=n=>`${y}-${String(n[0]).padStart(2,'0')}-${String(n[1]).padStart(2,'0')}`;
  const iso=value;const a=key([1,5]),b=key([3,3]),c=key([7,20]),e=key([9,11]);
  if(iso>=a&&iso<=b)return {open:true,label:'Janela aberta',next:iso};
  if(iso>=c&&iso<=e)return {open:true,label:'Janela aberta',next:iso};
  if(iso<a)return {open:false,label:'Janela fechada',next:a};
  if(iso<c)return {open:false,label:'Janela fechada',next:c};
  return {open:false,label:'Janela fechada',next:`${y+1}-01-05`};
}

async function rpc(name,args){const {data,error}=await supabase.rpc(name,args);if(error)throw error;return data}
async function soft(name){try{return {ok:true,data:await rpc(name)}}catch(error){console.warn(`[Club path] ${name}:`,error?.message||error);return {ok:false,data:null,error}}}

async function reviewWorld(){
  if(reviewBusy)return null;reviewBusy=true;
  try{
    const pending=await soft('review_career_pending_move');
    const promo=await soft('review_career_promotion');
    await soft('review_career_offer_expiry');
    const interest=await soft('review_career_market_interest');
    return {pending,promo,interest};
  }finally{reviewBusy=false}
}

async function resolvePlayer(){
  if(playerId)return playerId;
  const {data:auth}=await supabase.auth.getUser();if(!auth?.user)return null;
  const {data,error}=await supabase.from('jogadores').select('id').eq('user_id',auth.user.id).maybeSingle();if(error)throw error;
  playerId=data?.id||null;return playerId;
}

async function loadData(){
  const id=await resolvePlayer();if(!id)return;
  try{promotion=await rpc('get_career_promotion_status')}catch(error){console.warn('[Club path] promoção:',error?.message||error);promotion=null}
  const {data:offerRows,error:offerError}=await supabase.from('player_offers')
    .select('id,offer_type,target_squad_level,effective_on,career_expires_on,status,current_terms,generated_reason,transfer_fee,created_at,club:base_clubs!player_offers_club_id_fkey(name,club_level,division_level,reputation)')
    .eq('player_id',id).neq('offer_type','initial').in('status',['new','reviewed','negotiating','countered']).order('created_at',{ascending:false});
  if(offerError){console.warn('[Club path] propostas:',offerError.message);offers=[]}else offers=offerRows||[];
  const {data:move,error:moveError}=await supabase.from('player_transfer_agreements')
    .select('id,offer_id,effective_on,target_squad_level,status,target:base_clubs!player_transfer_agreements_target_contract_club_id_fkey(name)')
    .eq('player_id',id).eq('status','pending').order('effective_on',{ascending:true}).limit(1).maybeSingle();
  if(moveError){console.warn('[Club path] acordo:',moveError.message);pendingMove=null}else pendingMove=move||null;
  renderPanel();renderModalBody();
}

function currentSquad(){return promotion?.current_squad||currentHub?.club?.squad_level||'base'}
function panelHost(){return document.querySelector('.agenda-column .objective-panel')}

function renderPanel(){
  const anchor=panelHost();if(!anchor)return;
  let card=document.getElementById('careerClubPathPanel');
  if(!card){card=document.createElement('article');card.id='careerClubPathPanel';card.className='career-panel card-shell club-path-panel';anchor.insertAdjacentElement('afterend',card)}
  const squad=currentSquad();const currentIndex=Math.max(0,PATH.indexOf(squad));const careerDate=currentHub?.state?.date;const win=windowState(careerDate);
  let statusTitle=promotion?.label||'Em desenvolvimento';let statusText=promotion?.recommended_squad?`Próximo passo observado: ${LABEL[promotion.recommended_squad]||promotion.recommended_squad}.`: 'Você já está no time profissional.';
  if(pendingMove){statusTitle=`Acordo com ${pendingMove.target?.name||'novo clube'}`;statusText=`Mudança prevista para ${dateLabel(pendingMove.effective_on)}. Você continua no clube atual até o registro.`}
  else if(offers.length){statusText=`${offers.length} proposta${offers.length===1?'':'s'} ativa${offers.length===1?'':'s'} para analisar. ${win.open?'O registro pode acontecer nesta janela.':`Próxima abertura: ${dateLabel(win.next)}.`}`}
  card.innerHTML=`<header class="panel-heading compact"><div><span class="panel-icon green"><i data-lucide="route"></i></span><div><h2>Carreira & mercado</h2><p>Seu caminho esportivo e o interesse de outros clubes</p></div></div><span class="club-path-window ${win.open?'open':''}">${esc(win.label)}</span></header>
    <div class="club-path-steps">${PATH.map((key,i)=>`<div class="club-path-step ${i<currentIndex?'done':''} ${i===currentIndex?'current':''}">${esc(LABEL[key])}</div>`).join('')}</div>
    <div class="club-path-status"><span>${pendingMove?'ACORDO ASSINADO':offers.length?'MERCADO':'COMISSÃO TÉCNICA'}</span><strong>${esc(statusTitle)}</strong><small>${esc(statusText)}</small></div>
    <button id="openClubOffers" class="secondary-action club-path-open" type="button"><i data-lucide="briefcase-business"></i><span>${offers.length?`Ver ${offers.length} proposta${offers.length===1?'':'s'}`:'Abrir carreira e mercado'}</span></button>`;
  document.getElementById('openClubOffers')?.addEventListener('click',openModal);refreshIcons();
}

function createModal(){
  if(document.getElementById('clubOfferModal'))return;
  const node=document.createElement('div');node.id='clubOfferModal';node.className='club-offer-overlay hidden';node.innerHTML=`<section class="club-offer-modal" role="dialog" aria-modal="true"><header class="club-offer-head"><div><span class="identity-kicker">CARREIRA PROFISSIONAL</span><h2>Clubes, promoção e propostas</h2></div><button class="club-offer-close" type="button" aria-label="Fechar"><i data-lucide="x"></i></button></header><div class="club-offer-body" id="clubOfferBody"></div></section>`;
  node.querySelector('.club-offer-close').addEventListener('click',closeModal);node.addEventListener('click',e=>{if(e.target===node)closeModal()});document.body.appendChild(node);refreshIcons();
}
function openModal(){createModal();renderModalBody();document.getElementById('clubOfferModal')?.classList.remove('hidden')}
function closeModal(){document.getElementById('clubOfferModal')?.classList.add('hidden')}

function renderModalBody(){
  const body=document.getElementById('clubOfferBody');if(!body)return;
  const careerDate=currentHub?.state?.date;const win=windowState(careerDate);const squad=currentSquad();
  const pendingHtml=pendingMove?`<div class="club-offer-note"><strong>Acordo já assinado:</strong> ${esc(pendingMove.target?.name||'novo clube')} · ${esc(LABEL[pendingMove.target_squad_level]||pendingMove.target_squad_level)} · registro em ${esc(dateLabel(pendingMove.effective_on))}. Até lá você segue normalmente na equipe atual.</div>`:'';
  const offerHtml=offers.length?offers.map(o=>{const t=o.current_terms||{};const external=['academy_transfer','professional_transfer'].includes(o.offer_type);const waits=external&&o.effective_on&&careerDate&&o.effective_on>careerDate;return `<article class="club-offer-card"><h3>${esc(o.club?.name||'Clube interessado')}</h3><p>${esc(o.generated_reason||'O clube acredita que você pode encaixar no projeto esportivo.')}</p><div class="club-offer-grid"><div><span>Destino</span><strong>${esc(LABEL[o.target_squad_level]||o.target_squad_level||'—')}</strong></div><div><span>Papel</span><strong>${esc(t.squad_role||'—')}</strong></div><div><span>Salário</span><strong>${esc(money(t.monthly_wage))}</strong></div><div><span>Contrato</span><strong>${Number(t.duration_seasons||0)} temporada${Number(t.duration_seasons||0)===1?'':'s'}</strong></div></div><p>${waits?`Você pode fechar o acordo agora; o registro fica para ${dateLabel(o.effective_on)}.`:`Registro disponível na data atual.`} Prazo da proposta: ${dateLabel(o.career_expires_on)}.</p><div class="club-offer-actions"><button class="club-offer-reject" data-reject-offer="${esc(o.id)}" type="button">Recusar</button><button class="club-offer-accept" data-accept-offer="${esc(o.id)}" type="button">Aceitar proposta</button></div></article>`}).join(''):'<div class="club-offer-empty">Nenhuma proposta ativa. O mercado observa desempenho, idade, nível do elenco, fama e momento recente — clube maior não aparece só por sorte.</div>';
  body.innerHTML=`<div class="club-offer-note"><strong>Categoria atual:</strong> ${esc(LABEL[squad]||squad)} · <strong>${esc(win.label)}.</strong> ${win.open?'Mudanças externas podem ser registradas agora.':`Próxima abertura: ${esc(dateLabel(win.next))}.`} Promoções dentro do mesmo clube não dependem dessa janela.</div>${pendingHtml}${offerHtml}`;
  body.querySelectorAll('[data-accept-offer]').forEach(b=>b.addEventListener('click',()=>acceptOffer(b.dataset.acceptOffer)));
  body.querySelectorAll('[data-reject-offer]').forEach(b=>b.addEventListener('click',()=>rejectOffer(b.dataset.rejectOffer)));
}

async function acceptOffer(id){
  try{const result=await rpc('accept_career_market_offer',{p_offer_id:id});showToast('Mercado',result?.status==='pending_registration'?`Acordo assinado. Registro em ${dateLabel(result.effective_on)}.`:'Contrato assinado e mudança concluída.','success');await loadData();if(result?.status==='completed')window.location.reload()}
  catch(error){showToast('Mercado',error?.message||'Não foi possível aceitar a proposta.','error')}
}
async function rejectOffer(id){
  try{await rpc('reject_career_market_offer',{p_offer_id:id});showToast('Mercado','Proposta recusada.','info');await loadData()}
  catch(error){showToast('Mercado',error?.message||'Não foi possível recusar a proposta.','error')}
}

async function handleHub(event){
  currentHub=event.detail||null;const date=currentHub?.state?.date;
  if(lastReviewedDate&&date&&date!==lastReviewedDate){
    const before=currentSquad();const review=await reviewWorld();const after=review?.promo?.data?.current_squad||before;
    if(review?.pending?.data?.status==='completed'||after!==before){window.location.reload();return}
  }
  lastReviewedDate=date||lastReviewedDate;await loadData();
}

async function bootstrapMarket(){
  ensureStyle();
  try{
    currentHub=await rpc('get_career_hub');
    lastReviewedDate=currentHub?.state?.date||null;
  }catch(error){
    console.warn('[Club path] estado inicial:',error?.message||error);
  }
  await reviewWorld();
  await loadData();
}

document.addEventListener('career:hub-rendered',handleHub);
document.addEventListener('career:open-club-offers',openModal);
window.addEventListener('career:updated',()=>loadData());
await bootstrapMarket();
