import { supabase } from '../../services/supabase-client.js';
import { showToast } from '../../components/toast/toast.js';

const PATH=['base','u15','u17','u18','u20','first_team'];
const LABEL={base:'Base',u15:'Sub-15',u17:'Sub-17',u18:'Sub-18',u20:'Sub-20',first_team:'Profissional'};
const STAGE={
  none:{label:'Sem resposta',tone:'neutral'},watching:{label:'Monitorando',tone:'watching'},interested:{label:'Interesse',tone:'interested'},
  strong:{label:'Interesse forte',tone:'strong'},inquiry:{label:'Sondagem',tone:'inquiry'},negotiating:{label:'Negociando com seu clube',tone:'negotiating'},
  proposal:{label:'Proposta enviada',tone:'proposal'},agreement:{label:'Acordo assinado',tone:'agreement'},cooling:{label:'Interesse esfriou',tone:'neutral'}
};
let playerId=null,currentHub=null,offers=[],pendingMove=null,promotion=null,market=null,lastReviewedDate=null,reviewBusy=false;
let activeTab='overview',clubFilter='all',clubSearch='';

function ensureStyle(){
  if(document.querySelector('link[data-club-path-v8]'))return;
  const link=document.createElement('link');link.rel='stylesheet';link.href='src/pages/career/career-club-path-v8.css?v=20260814-2';link.dataset.clubPathV8='1';document.head.appendChild(link);
}
const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(Number(v||0));
const dateLabel=v=>{if(!v)return '—';const d=new Date(`${v}T12:00:00`);return Number.isNaN(d.getTime())?'—':new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'}).format(d)};
const normalize=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const refreshIcons=()=>window.lucide?.createIcons({strokeWidth:1.8});
const stageMeta=value=>STAGE[value]||STAGE.none;
const stageBadge=value=>{const s=stageMeta(value);return `<span class="market-stage ${s.tone}">${esc(s.label)}</span>`};
const shield=(url,name)=>url?`<img src="${esc(url)}" alt="Escudo de ${esc(name)}" loading="lazy">`:`<span>${esc(String(name||'?').slice(0,2).toUpperCase())}</span>`;

function windowState(value){
  const d=new Date(`${value}T12:00:00`);if(Number.isNaN(d.getTime()))return{open:false,label:'Janela —',next:null};
  const y=d.getFullYear(),key=n=>`${y}-${String(n[0]).padStart(2,'0')}-${String(n[1]).padStart(2,'0')}`;
  const iso=value,a=key([1,5]),b=key([3,3]),c=key([7,20]),e=key([9,11]);
  if(iso>=a&&iso<=b||iso>=c&&iso<=e)return{open:true,label:'Janela aberta',next:iso};
  if(iso<a)return{open:false,label:'Janela fechada',next:a};if(iso<c)return{open:false,label:'Janela fechada',next:c};return{open:false,label:'Janela fechada',next:`${y+1}-01-05`};
}
async function rpc(name,args){const{data,error}=await supabase.rpc(name,args);if(error)throw error;return data}
async function soft(name){try{return{ok:true,data:await rpc(name)}}catch(error){console.warn(`[Club path] ${name}:`,error?.message||error);return{ok:false,data:null,error}}}
async function reviewWorld(){
  if(reviewBusy)return null;reviewBusy=true;
  try{const pending=await soft('review_career_pending_move');const promo=await soft('review_career_promotion');await soft('review_career_offer_expiry');const interest=await soft('review_career_market_interest');return{pending,promo,interest}}finally{reviewBusy=false}
}
async function resolvePlayer(){
  if(playerId)return playerId;const{data:auth}=await supabase.auth.getUser();if(!auth?.user)return null;
  const{data,error}=await supabase.from('jogadores').select('id').eq('user_id',auth.user.id).maybeSingle();if(error)throw error;playerId=data?.id||null;return playerId;
}
async function loadData(){
  const id=await resolvePlayer();if(!id)return;
  try{promotion=await rpc('get_career_promotion_status')}catch(error){console.warn('[Club path] promoção:',error?.message||error);promotion=null}
  try{market=await rpc('get_career_market_dashboard')}catch(error){console.warn('[Club path] dashboard mercado:',error?.message||error);market=null}
  const{data:offerRows,error:offerError}=await supabase.from('player_offers').select('id,offer_type,target_squad_level,effective_on,career_expires_on,status,current_terms,generated_reason,transfer_fee,created_at,club:base_clubs!player_offers_club_id_fkey(name,club_level,division_level,reputation,shield_url)').eq('player_id',id).neq('offer_type','initial').in('status',['new','reviewed','negotiating','countered']).order('created_at',{ascending:false});
  offers=offerError?[]:offerRows||[];if(offerError)console.warn('[Club path] propostas:',offerError.message);
  const{data:move,error:moveError}=await supabase.from('player_transfer_agreements').select('id,offer_id,effective_on,target_squad_level,status,target:base_clubs!player_transfer_agreements_target_contract_club_id_fkey(name)').eq('player_id',id).eq('status','pending').order('effective_on',{ascending:true}).limit(1).maybeSingle();
  pendingMove=moveError?null:move||null;if(moveError)console.warn('[Club path] acordo:',moveError.message);
  renderPanel();renderModalBody();
}
function currentSquad(){return promotion?.current_squad||currentHub?.club?.squad_level||'base'}
function panelHost(){return document.querySelector('.agenda-column .objective-panel')}

function renderPanel(){
  const anchor=panelHost();if(!anchor)return;let card=document.getElementById('careerClubPathPanel');
  if(!card){card=document.createElement('article');card.id='careerClubPathPanel';card.className='career-panel card-shell club-path-panel';anchor.insertAdjacentElement('afterend',card)}
  const squad=currentSquad(),currentIndex=Math.max(0,PATH.indexOf(squad)),careerDate=market?.career_date||currentHub?.state?.date,win=windowState(careerDate);
  const interested=market?.club_interests?.length||0,declared=market?.used_player_interests||0;
  let statusTitle=promotion?.label||'Em desenvolvimento',statusText=promotion?.recommended_squad?`Próximo passo observado: ${LABEL[promotion.recommended_squad]||promotion.recommended_squad}.`:'Você já está no time profissional.',kicker='COMISSÃO TÉCNICA';
  if(pendingMove){kicker='ACORDO ASSINADO';statusTitle=`Acordo com ${pendingMove.target?.name||'novo clube'}`;statusText=`Mudança prevista para ${dateLabel(pendingMove.effective_on)}. Você continua no clube atual até o registro.`}
  else if(offers.length){kicker='PROPOSTAS';statusTitle=`${offers.length} proposta${offers.length===1?'':'s'} aguardando você`;statusText='Os clubes já chegaram a um acordo. Agora você decide os termos da sua carreira.'}
  else if(interested){kicker='RADAR DO MERCADO';statusTitle=`${interested} clube${interested===1?'':'s'} acompanha${interested===1?'':'m'} você`;statusText=`Acompanhe o interesse e escolha até 3 destinos para seu empresário sinalizar. ${declared}/3 marcados.`}
  card.innerHTML=`<header class="panel-heading compact"><div><span class="panel-icon green"><i data-lucide="route"></i></span><div><h2>Carreira & mercado</h2><p>Clubes interessados, destinos e propostas</p></div></div><span class="club-path-window ${win.open?'open':''}">${esc(win.label)}</span></header>
    <div class="club-path-steps">${PATH.map((key,i)=>`<div class="club-path-step ${i<currentIndex?'done':''} ${i===currentIndex?'current':''}">${esc(LABEL[key])}</div>`).join('')}</div>
    <div class="club-path-status"><span>${esc(kicker)}</span><strong>${esc(statusTitle)}</strong><small>${esc(statusText)}</small></div>
    <button id="openClubOffers" class="secondary-action club-path-open" type="button"><i data-lucide="briefcase-business"></i><span>Abrir carreira e mercado</span>${offers.length?`<b>${offers.length}</b>`:''}</button>`;
  document.getElementById('openClubOffers')?.addEventListener('click',openModal);refreshIcons();
}

function createModal(){
  if(document.getElementById('clubOfferModal'))return;
  const node=document.createElement('div');node.id='clubOfferModal';node.className='club-offer-overlay hidden';
  node.innerHTML=`<section class="club-offer-modal" role="dialog" aria-modal="true" aria-label="Carreira e mercado"><header class="club-offer-head"><div class="club-offer-head-copy"><span class="identity-kicker">CARREIRA & MERCADO</span><h2>Seu futuro no futebol</h2><p>Acompanhe quem está de olho em você, sinalize destinos e negocie quando uma proposta chegar.</p></div><button class="club-offer-close" type="button" aria-label="Fechar"><i data-lucide="x"></i></button></header><nav class="market-tabs" id="marketTabs"></nav><div class="club-offer-body" id="clubOfferBody"></div></section>`;
  node.querySelector('.club-offer-close').addEventListener('click',closeModal);node.addEventListener('click',e=>{if(e.target===node)closeModal()});document.body.appendChild(node);refreshIcons();
}
function openModal(){createModal();activeTab='overview';renderModalBody();document.getElementById('clubOfferModal')?.classList.remove('hidden')}
function closeModal(){document.getElementById('clubOfferModal')?.classList.add('hidden')}

function tabsHtml(){
  const interestCount=market?.club_interests?.length||0,myCount=market?.used_player_interests||0;
  return [{key:'overview',label:'Visão geral',icon:'layout-dashboard'},{key:'interest',label:'Interesse em você',icon:'radar',count:interestCount},{key:'mine',label:'Meus interesses',icon:'heart-handshake',count:myCount},{key:'explore',label:'Explorar clubes',icon:'search'},{key:'offers',label:'Propostas',icon:'file-signature',count:offers.length}]
    .map(t=>`<button type="button" class="market-tab ${activeTab===t.key?'active':''}" data-market-tab="${t.key}"><i data-lucide="${t.icon}"></i><span>${t.label}</span>${t.count?`<b>${t.count}</b>`:''}</button>`).join('');
}
function summaryStrip(){
  const win=windowState(market?.career_date||currentHub?.state?.date),squad=currentSquad();
  return `<div class="market-summary-strip"><div><span>Categoria</span><strong>${esc(LABEL[squad]||squad)}</strong></div><div><span>Valor de mercado</span><strong>${money(market?.market_value||0)}</strong></div><div><span>Clubes no radar</span><strong>${market?.club_interests?.length||0}</strong></div><div><span>Destinos marcados</span><strong>${market?.used_player_interests||0}/3</strong></div><div><span>Transferências</span><strong class="${win.open?'green':''}">${esc(win.label)}</strong></div></div>`;
}
function emptyState(icon,title,text){return `<div class="market-empty"><span><i data-lucide="${icon}"></i></span><strong>${esc(title)}</strong><p>${esc(text)}</p></div>`}
function clubIdentity(item){return `<div class="market-club-id"><div class="market-club-shield">${shield(item.shield_url,item.club_name)}</div><div><strong>${esc(item.club_name||'Clube')}</strong><span>${esc(LABEL[item.target_squad_level]||item.target_squad_level||'—')}${item.city?` · ${esc(item.city)}`:''}</span></div></div>`}
function insightChips(item){return `<div class="market-insights"><span><small>Encaixe</small><b>${esc(item.fit_label||'—')}</b></span><span><small>Necessidade</small><b>${esc(item.need_label||'—')}</b></span><span><small>Espaço</small><b>${esc(item.space_label||'—')}</b></span></div>`}
function reactionText(stage){
  return {none:'Seu empresário sinalizou abertura, mas o clube ainda não demonstrou interesse.',watching:'O clube começou a acompanhar sua evolução.',interested:'O interesse foi correspondido e seu nome está no radar.',strong:'O clube acompanha você de perto e pode avançar.',inquiry:'O clube já faz sondagens sobre sua situação.',negotiating:'O clube está negociando primeiro com sua equipe atual.',proposal:'Os clubes chegaram a um acordo e existe proposta para você.',agreement:'O acordo foi assinado.',cooling:'O clube diminuiu o ritmo de acompanhamento.'}[stage]||'Aguardando evolução do mercado.';
}

function renderOverview(){
  const interests=market?.club_interests||[],mine=market?.my_interests||[];
  const topInterest=interests.slice(0,3).map(i=>`<button class="market-overview-club" type="button" data-go-tab="interest">${clubIdentity(i)}${stageBadge(i.stage)}</button>`).join('');
  const my=mine.slice(0,3).map(i=>`<button class="market-overview-club" type="button" data-go-tab="mine">${clubIdentity(i)}<span class="market-mini-state">${esc(stageMeta(i.stage).label)}</span></button>`).join('');
  const win=windowState(market?.career_date||currentHub?.state?.date);
  return `${summaryStrip()}<div class="market-overview-grid"><section class="market-surface market-moment"><span class="market-section-kicker">SEU MOMENTO</span><h3>${esc(promotion?.label||'Carreira em desenvolvimento')}</h3><p>${pendingMove?`Você já assinou com ${pendingMove.target?.name||'outro clube'} e aguarda o registro em ${dateLabel(pendingMove.effective_on)}.`:offers.length?`Você tem ${offers.length} proposta${offers.length===1?'':'s'} concreta${offers.length===1?'':'s'} para decidir.`:interests.length?`${interests.length} clube${interests.length===1?' está':'s estão'} acompanhando sua carreira neste momento.`:'Seu desempenho ainda está formando seu mercado. Continue jogando e evoluindo.'}</p><div class="market-moment-tags"><span>${esc(win.label)}</span><span>${esc(LABEL[currentSquad()]||currentSquad())}</span></div></section>
  <section class="market-surface"><div class="market-section-head"><div><span class="market-section-kicker">CLUBES INTERESSADOS</span><h3>Quem está olhando para você</h3></div><button type="button" data-go-tab="interest">Ver todos</button></div>${topInterest||emptyState('radar','Nenhum clube visível ainda','O mercado é revisado conforme você joga, evolui e muda seu momento esportivo.')}</section>
  <section class="market-surface"><div class="market-section-head"><div><span class="market-section-kicker">SEUS DESTINOS</span><h3>Interesses enviados pelo empresário</h3></div><button type="button" data-go-tab="explore">Explorar</button></div>${my||emptyState('heart-handshake','Nenhum destino marcado','Você pode sinalizar até 3 clubes. Isso não cria proposta automática.')}</section>
  <section class="market-surface market-flow"><span class="market-section-kicker">COMO O MERCADO AVANÇA</span><h3>Interesse não é proposta</h3><div class="market-flow-row"><span>Monitorando</span><i></i><span>Interesse</span><i></i><span>Sondagem</span><i></i><span>Clubes negociam</span><i></i><span>Proposta</span></div><p>Quando um clube decide avançar, ele negocia primeiro com sua equipe atual. Só depois de um acordo a proposta contratual chega até você.</p></section></div>`;
}
function renderClubInterests(){
  const items=market?.club_interests||[];
  if(!items.length)return `${summaryStrip()}${emptyState('radar','Nenhum clube demonstrou interesse ainda','Isso não significa que o mercado esteja parado. Os clubes avaliam seu desempenho e podem começar a acompanhar você nas próximas revisões.')}`;
  return `${summaryStrip()}<div class="market-page-intro"><div><span class="market-section-kicker">INTERESSE EM VOCÊ</span><h3>Clubes que acompanham sua carreira</h3><p>Os estágios abaixo são reais no mercado. Um clube pode esfriar, crescer de interesse ou avançar para negociação.</p></div></div><div class="market-interest-list">${items.map(i=>`<article class="market-interest-card"><div class="market-interest-top">${clubIdentity(i)}${stageBadge(i.stage)}</div><p>${esc(i.reason||reactionText(i.stage))}</p>${insightChips(i)}<div class="market-interest-foot"><span>${esc(reactionText(i.stage))}</span>${i.player_declared?'<b>Você também demonstrou interesse</b>':''}</div></article>`).join('')}</div>`;
}
function renderMyInterests(){
  const items=market?.my_interests||[],remaining=market?.remaining_player_interests??3;
  const slots=Array.from({length:3},(_,idx)=>items[idx]?`<article class="market-my-card">${clubIdentity(items[idx])}<div class="market-my-reaction">${stageBadge(items[idx].stage)}<p>${esc(reactionText(items[idx].stage))}</p></div>${insightChips(items[idx])}<div class="market-my-footer"><span>Enviado em ${dateLabel(items[idx].declared_on)}</span><button type="button" data-withdraw-interest="${esc(items[idx].club_id)}">Retirar interesse</button></div></article>`:`<button type="button" class="market-empty-slot" data-go-tab="explore"><span>${idx+1}</span><div><strong>Espaço disponível</strong><small>Escolha um clube para seu empresário sinalizar.</small></div><i data-lucide="plus"></i></button>`).join('');
  return `${summaryStrip()}<div class="market-page-intro"><div><span class="market-section-kicker">MEUS INTERESSES</span><h3>Clubes que você gostaria de ouvir</h3><p>Seu empresário pode avisar discretamente até 3 clubes. Isso melhora a chance de contato, mas não obriga ninguém a fazer proposta.</p></div><span class="market-slot-count">${remaining} espaço${remaining===1?'':'s'} livre${remaining===1?'':'s'}</span></div><div class="market-my-grid">${slots}</div>`;
}
function availableClubs(){
  let list=[...(market?.available_clubs||[])];
  if(clubFilter!=='all')list=list.filter(i=>i.market_path===clubFilter);
  const q=normalize(clubSearch);if(q)list=list.filter(i=>normalize(`${i.club_name} ${i.city} ${i.fit_label}`).includes(q));
  return list;
}
function renderExplore(){
  const list=availableClubs(),used=market?.used_player_interests||0,full=used>=3;
  return `${summaryStrip()}<div class="market-explore-head"><div><span class="market-section-kicker">EXPLORAR CLUBES</span><h3>Escolha destinos para sinalizar</h3><p>Os indicadores mostram encaixe esportivo, não chance garantida de proposta.</p></div><div class="market-search"><i data-lucide="search"></i><input id="marketClubSearch" type="search" placeholder="Buscar clube ou cidade" value="${esc(clubSearch)}"></div></div><div class="market-filter-row"><button class="${clubFilter==='all'?'active':''}" data-club-filter="all">Todos</button><button class="${clubFilter==='academy'?'active':''}" data-club-filter="academy">Base</button><button class="${clubFilter==='professional'?'active':''}" data-club-filter="professional">Profissional</button><span>${used}/3 destinos marcados</span></div><div class="market-club-grid">${list.map(i=>{const declared=Boolean(i.declared);return `<article class="market-club-card"><div class="market-club-card-top">${clubIdentity(i)}<span class="market-fit-pill">${esc(i.fit_label||'—')}</span></div>${insightChips(i)}<p>${esc(i.reason||'O empresário avalia o encaixe do projeto para sua carreira.')}</p><div class="market-club-card-foot"><span>${i.club_stage&&i.club_stage!=='none'?`${esc(stageMeta(i.club_stage).label)} em você`:'Sem interesse visível do clube'}</span><button type="button" ${declared||full?'disabled':''} data-declare-interest="${esc(i.club_id)}">${declared?'Interesse enviado':full?'Limite 3/3':'Demonstrar interesse'}</button></div></article>`}).join('')||emptyState('search-x','Nenhum clube encontrado','Tente outro nome ou altere o filtro.')}</div>`;
}
function renderOffers(){
  const careerDate=market?.career_date||currentHub?.state?.date;
  const pendingHtml=pendingMove?`<div class="market-signed-note"><i data-lucide="badge-check"></i><div><strong>Acordo já assinado com ${esc(pendingMove.target?.name||'novo clube')}</strong><span>Registro em ${esc(dateLabel(pendingMove.effective_on))}. Até lá você continua normalmente na equipe atual.</span></div></div>`:'';
  if(!offers.length)return `${summaryStrip()}${pendingHtml}${emptyState('file-clock','Nenhuma proposta contratual ativa','Interesse e sondagem aparecem antes daqui. Uma proposta só chega depois que o clube interessado fecha o acordo com sua equipe atual.')}`;
  return `${summaryStrip()}${pendingHtml}<div class="market-page-intro"><div><span class="market-section-kicker">PROPOSTAS</span><h3>Decisões que chegaram até você</h3><p>A transferência entre os clubes já foi resolvida. Agora você decide se aceita os termos pessoais.</p></div></div><div class="market-offer-list">${offers.map(o=>{const t=o.current_terms||{},waits=['academy_transfer','professional_transfer'].includes(o.offer_type)&&o.effective_on&&careerDate&&o.effective_on>careerDate;return `<article class="club-offer-card"><div class="market-interest-top">${clubIdentity({club_name:o.club?.name,shield_url:o.club?.shield_url,target_squad_level:o.target_squad_level})}<span class="market-stage proposal">Proposta</span></div><p>${esc(o.generated_reason||'O clube acredita que você pode encaixar no projeto esportivo.')}</p><div class="club-offer-grid"><div><span>Papel</span><strong>${esc(t.squad_role||'—')}</strong></div><div><span>Salário</span><strong>${esc(money(t.monthly_wage))}</strong></div><div><span>Contrato</span><strong>${Number(t.duration_seasons||0)} temp.</strong></div><div><span>Cláusula</span><strong>${esc(money(t.release_clause))}</strong></div></div><div class="market-offer-note">${waits?`Se assinar, o registro acontece em ${dateLabel(o.effective_on)}.`:'Registro disponível na data atual.'} Prazo: ${dateLabel(o.career_expires_on)}.</div><div class="club-offer-actions"><button class="club-offer-reject" data-reject-offer="${esc(o.id)}" type="button">Recusar</button><button class="club-offer-accept" data-accept-offer="${esc(o.id)}" type="button">Aceitar proposta</button></div></article>`}).join('')}</div>`;
}

function bindModal(){
  const body=document.getElementById('clubOfferBody'),tabs=document.getElementById('marketTabs');if(!body||!tabs)return;
  tabs.querySelectorAll('[data-market-tab]').forEach(b=>b.addEventListener('click',()=>{activeTab=b.dataset.marketTab;renderModalBody()}));
  body.querySelectorAll('[data-go-tab]').forEach(b=>b.addEventListener('click',()=>{activeTab=b.dataset.goTab;renderModalBody()}));
  body.querySelectorAll('[data-club-filter]').forEach(b=>b.addEventListener('click',()=>{clubFilter=b.dataset.clubFilter;renderModalBody()}));
  const search=body.querySelector('#marketClubSearch');if(search)search.addEventListener('input',e=>{clubSearch=e.target.value;renderExploreResultsOnly()});
  body.querySelectorAll('[data-declare-interest]').forEach(b=>b.addEventListener('click',()=>setPlayerInterest(b.dataset.declareInterest,true,b)));
  body.querySelectorAll('[data-withdraw-interest]').forEach(b=>b.addEventListener('click',()=>setPlayerInterest(b.dataset.withdrawInterest,false,b)));
  body.querySelectorAll('[data-accept-offer]').forEach(b=>b.addEventListener('click',()=>acceptOffer(b.dataset.acceptOffer)));
  body.querySelectorAll('[data-reject-offer]').forEach(b=>b.addEventListener('click',()=>rejectOffer(b.dataset.rejectOffer)));
}
function renderExploreResultsOnly(){
  if(activeTab!=='explore')return;const body=document.getElementById('clubOfferBody'),grid=body?.querySelector('.market-club-grid');if(!grid)return;
  const list=availableClubs(),used=market?.used_player_interests||0,full=used>=3;
  grid.innerHTML=list.map(i=>{const declared=Boolean(i.declared);return `<article class="market-club-card"><div class="market-club-card-top">${clubIdentity(i)}<span class="market-fit-pill">${esc(i.fit_label||'—')}</span></div>${insightChips(i)}<p>${esc(i.reason||'O empresário avalia o encaixe do projeto para sua carreira.')}</p><div class="market-club-card-foot"><span>${i.club_stage&&i.club_stage!=='none'?`${esc(stageMeta(i.club_stage).label)} em você`:'Sem interesse visível do clube'}</span><button type="button" ${declared||full?'disabled':''} data-declare-interest="${esc(i.club_id)}">${declared?'Interesse enviado':full?'Limite 3/3':'Demonstrar interesse'}</button></div></article>`}).join('')||emptyState('search-x','Nenhum clube encontrado','Tente outro nome ou altere o filtro.');
  grid.querySelectorAll('[data-declare-interest]').forEach(b=>b.addEventListener('click',()=>setPlayerInterest(b.dataset.declareInterest,true,b)));refreshIcons();
}
function renderModalBody(){
  const body=document.getElementById('clubOfferBody'),tabs=document.getElementById('marketTabs');if(!body||!tabs)return;
  tabs.innerHTML=tabsHtml();body.innerHTML=activeTab==='interest'?renderClubInterests():activeTab==='mine'?renderMyInterests():activeTab==='explore'?renderExplore():activeTab==='offers'?renderOffers():renderOverview();bindModal();refreshIcons();
}

async function setPlayerInterest(clubId,active,button){
  if(button)button.disabled=true;
  try{
    const result=await rpc('set_career_club_interest',{p_club_id:clubId,p_active:active});
    if(active)showToast('Mercado',result?.status==='already_declared'?'Esse clube já está na sua lista.':`Seu empresário sinalizou interesse em ${result?.club||'esse clube'}. Agora a reação depende do mercado.`,'success');
    else showToast('Mercado',`Interesse em ${result?.club||'esse clube'} retirado.`, 'info');
    await loadData();
  }catch(error){showToast('Mercado',error?.message||'Não foi possível atualizar seu interesse.','error');if(button)button.disabled=false}
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
  if(lastReviewedDate&&date&&date!==lastReviewedDate){const before=currentSquad(),review=await reviewWorld(),after=review?.promo?.data?.current_squad||before;if(review?.pending?.data?.status==='completed'||after!==before){window.location.reload();return}}
  lastReviewedDate=date||lastReviewedDate;await loadData();
}
async function bootstrapMarket(){
  ensureStyle();try{currentHub=await rpc('get_career_hub');lastReviewedDate=currentHub?.state?.date||null}catch(error){console.warn('[Club path] estado inicial:',error?.message||error)}
  await reviewWorld();await loadData();
}

document.addEventListener('career:hub-rendered',handleHub);
document.addEventListener('career:open-club-offers',openModal);
window.addEventListener('career:updated',()=>loadData());
await bootstrapMarket();
