import './career-club-path-v8.js?v=20260813-1';
import './career-commercial-market-v12.js?v=20260813-1';
import { supabase } from '../../services/supabase-client.js';

let cachedProgression=null;
let pendingProgression=null;
let toastTimer=null;

function ensureStyle(){
  if(document.querySelector('link[data-career-ui-usability-v6]'))return;
  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href='src/pages/career/career-ui-usability-v6.css?v=20260814-1';
  link.dataset.careerUiUsabilityV6='1';
  document.head.appendChild(link);
}

async function loadProgression(force=false){
  if(cachedProgression&&!force)return cachedProgression;
  if(pendingProgression)return pendingProgression;
  pendingProgression=supabase.rpc('get_career_progression').then(({data,error})=>{
    if(error)throw error;
    cachedProgression=data||null;
    return cachedProgression;
  }).finally(()=>{pendingProgression=null;});
  return pendingProgression;
}

function renderAvatarAlert(points){
  const wrap=document.querySelector('.player-avatar-wrap');
  if(!wrap)return;
  let alert=wrap.querySelector('.career-upgrade-alert');
  if(points<=0){
    alert?.remove();
    wrap.classList.remove('has-evolution-alert');
    wrap.removeAttribute('title');
    return;
  }
  wrap.classList.add('has-evolution-alert');
  wrap.title=`${points} ponto${points===1?'':'s'} de evolução ${points===1?'disponível':'disponíveis'}. Abra Desenvolvimento.`;
  if(!alert){
    alert=document.createElement('span');
    alert.className='career-upgrade-alert';
    alert.setAttribute('aria-label','Pontos de evolução disponíveis');
    wrap.appendChild(alert);
  }
  alert.textContent=String(points);
}

function renderDevelopmentTabAlert(points){
  const tab=document.querySelector('#playerProfileContent [data-player-tab="development"]');
  if(!tab)return;
  let alert=tab.querySelector('.development-tab-alert');
  if(points<=0){alert?.remove();return;}
  if(!alert){
    alert=document.createElement('span');
    alert.className='development-tab-alert';
    alert.setAttribute('aria-label','Pontos de evolução disponíveis');
    tab.appendChild(alert);
  }
  alert.textContent=String(points);
  tab.title=`Você tem ${points} ponto${points===1?'':'s'} de evolução para distribuir`;
}

function showLevelUpToast(level,points){
  document.querySelector('.career-level-up-toast')?.remove();
  const node=document.createElement('aside');
  node.className='career-level-up-toast';
  node.setAttribute('role','status');
  node.innerHTML=`<div class="level-up-icon">↑</div><div><span>NOVO NÍVEL DE CARREIRA</span><strong>Você chegou ao nível ${level}</strong><p>${points>0?`Você tem ${points} ponto${points===1?'':'s'} de evolução ${points===1?'disponível':'disponíveis'}. Abra Desenvolvimento para escolher onde usar.`:'Sua progressão de carreira avançou.'}</p></div>`;
  document.body.appendChild(node);
  requestAnimationFrame(()=>node.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>{
    node.classList.remove('show');
    setTimeout(()=>node.remove(),280);
  },6200);
}

function maybeNotifyLevelUp(progression){
  const level=Number(progression?.level||1);
  const points=Number(progression?.evolution_points||0);
  const key='futbrowser:career:last-seen-level';
  let previous=0;
  try{previous=Number(localStorage.getItem(key)||0);}catch{}
  if(previous<=0){
    try{localStorage.setItem(key,String(level));}catch{}
    return;
  }
  if(level>previous)showLevelUpToast(level,points);
  if(level!==previous){try{localStorage.setItem(key,String(level));}catch{}}
}

function renderProgressionSignals(progression,{notifyLevel=false}={}){
  if(!progression)return;
  const points=Number(progression.evolution_points||0);
  renderAvatarAlert(points);
  renderDevelopmentTabAlert(points);
  if(notifyLevel)maybeNotifyLevelUp(progression);
}

async function syncProgression({force=false,notifyLevel=false}={}){
  try{
    const progression=await loadProgression(force);
    renderProgressionSignals(progression,{notifyLevel});
  }catch(error){
    console.warn('[Career UI] sinalização de evolução indisponível:',error?.message||error);
  }
}

ensureStyle();
syncProgression({notifyLevel:true});

document.addEventListener('career:hub-rendered',()=>syncProgression());
window.addEventListener('career:updated',()=>{
  cachedProgression=null;
  syncProgression({force:true,notifyLevel:true});
});
document.addEventListener('click',event=>{
  if(!event.target.closest?.('.identity-player,[data-player-tab="development"]'))return;
  setTimeout(()=>renderProgressionSignals(cachedProgression||{}),0);
});