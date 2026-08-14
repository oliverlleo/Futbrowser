let normalizing=false;
let observer=null;

function ensureStyle(){
  let style=document.getElementById('career-level-summary-v8-style');
  if(!style){style=document.createElement('style');style.id='career-level-summary-v8-style';document.head.appendChild(style)}
  if(style.dataset.version==='4')return;
  style.dataset.version='4';
  style.textContent=`
  #careerLevelBadge.career-level-summary-strip{
    width:min(100%,276px)!important;
    margin:9px 0 0!important;
    padding:0!important;
    display:grid!important;
    grid-template-columns:auto minmax(0,1fr)!important;
    align-items:center!important;
    gap:10px!important;
    border:0!important;
    border-radius:0!important;
    background:transparent!important;
    box-shadow:none!important;
    overflow:visible!important;
    cursor:default!important;
    user-select:none!important;
    box-sizing:border-box!important;
  }
  #careerLevelBadge.career-level-summary-strip::before,
  #careerLevelBadge.career-level-summary-strip::after,
  #careerLevelBadge.career-level-summary-strip *::before,
  #careerLevelBadge.career-level-summary-strip *::after{content:none!important;display:none!important}
  #careerLevelBadge .career-level-rank{
    width:58px!important;
    height:30px!important;
    min-width:58px!important;
    min-height:30px!important;
    padding:0 9px!important;
    display:flex!important;
    align-items:center!important;
    justify-content:center!important;
    gap:5px!important;
    border:1px solid rgba(56,201,31,.28)!important;
    border-radius:999px!important;
    background:rgba(56,201,31,.075)!important;
    box-shadow:none!important;
    color:var(--green-2)!important;
    box-sizing:border-box!important;
  }
  #careerLevelBadge .career-level-rank span,
  #careerLevelBadge .career-level-rank strong,
  #careerLevelBadge .career-level-meter span,
  #careerLevelBadge .career-level-meter strong,
  #careerLevelBadge .career-level-meter small{
    margin:0!important;
    padding:0!important;
    min-width:0!important;
    min-height:0!important;
    width:auto!important;
    height:auto!important;
    display:inline!important;
    border:0!important;
    border-radius:0!important;
    background:transparent!important;
    box-shadow:none!important;
    line-height:1!important;
  }
  #careerLevelBadge .career-level-rank span{
    color:var(--green-2)!important;
    font-size:7px!important;
    font-weight:900!important;
    letter-spacing:.08em!important;
    text-transform:uppercase!important;
  }
  #careerLevelBadge .career-level-rank strong{
    color:var(--green-2)!important;
    font-size:15px!important;
    font-weight:950!important;
    letter-spacing:-.04em!important;
  }
  #careerLevelBadge .career-level-meter{
    min-width:0!important;
    display:grid!important;
    grid-template-rows:auto 5px!important;
    gap:6px!important;
    align-items:center!important;
    overflow:visible!important;
  }
  #careerLevelBadge .career-level-meter-head{
    min-width:0!important;
    display:flex!important;
    align-items:baseline!important;
    justify-content:space-between!important;
    gap:10px!important;
  }
  #careerLevelBadge .career-level-meter-head>span{
    color:var(--muted)!important;
    font-size:7px!important;
    font-weight:900!important;
    letter-spacing:.065em!important;
    text-transform:uppercase!important;
    white-space:nowrap!important;
  }
  #careerLevelBadge .career-level-meter-head>strong{
    color:var(--text)!important;
    font-size:10px!important;
    font-weight:950!important;
    white-space:nowrap!important;
  }
  #careerLevelBadge .career-level-meter-head>strong small{
    color:var(--muted)!important;
    font-size:8px!important;
    font-weight:850!important;
  }
  #careerLevelBadge .career-level-track{
    width:100%!important;
    height:5px!important;
    min-height:5px!important;
    margin:0!important;
    padding:0!important;
    overflow:hidden!important;
    border:0!important;
    border-radius:999px!important;
    background:rgba(100,116,139,.14)!important;
    box-shadow:none!important;
  }
  #careerLevelBadge .career-level-track i{
    display:block!important;
    height:100%!important;
    min-height:5px!important;
    margin:0!important;
    border-radius:999px!important;
    background:linear-gradient(90deg,var(--green-2),#7dde62)!important;
    box-shadow:none!important;
  }
  @media(max-width:560px){
    #careerLevelBadge.career-level-summary-strip{width:min(100%,250px)!important;gap:8px!important}
    #careerLevelBadge .career-level-rank{width:54px!important;min-width:54px!important}
  }
  `;
}

function directLegacyValue(badge,selector){return [...badge.children].find(node=>node.matches?.(selector))?.textContent?.trim()||''}

function parseState(badge){
  const legacyLevel=directLegacyValue(badge,'strong');
  const legacyXp=directLegacyValue(badge,'span');
  const legacyPoints=directLegacyValue(badge,'b');
  const levelMatch=legacyLevel.match(/(\d+)/);
  const xpMatch=legacyXp.match(/(\d+)\s*\/\s*(\d+)/);
  const pointsMatch=legacyPoints.match(/(\d+)/);
  if(levelMatch&&xpMatch){
    return{level:Number(levelMatch[1]),xp:Number(xpMatch[1]),need:Math.max(1,Number(xpMatch[2])),points:Number(pointsMatch?.[1]||0)};
  }
  return{
    level:Number(badge.dataset.level||1),
    xp:Number(badge.dataset.xp||0),
    need:Math.max(1,Number(badge.dataset.need||400)),
    points:Number(badge.dataset.points||0)
  };
}

function renderBadge(badge,state){
  const level=Math.max(1,Number(state.level||1));
  const xp=Math.max(0,Number(state.xp||0));
  const need=Math.max(1,Number(state.need||400));
  const points=Math.max(0,Number(state.points||0));
  const percent=Math.max(0,Math.min(100,Math.round((xp/need)*100)));
  const signature=`${level}:${xp}:${need}:${points}`;

  Object.assign(badge.dataset,{level:String(level),xp:String(xp),need:String(need),points:String(points),summaryReady:'1'});
  badge.classList.remove('career-level-badge');
  badge.classList.add('career-level-summary-strip');
  badge.setAttribute('aria-label',`Nível ${level}. ${xp} de ${need} XP. ${percent}% para o nível ${level+1}.`);

  if(badge.dataset.summarySignature===signature&&badge.querySelector('.career-level-meter'))return;
  badge.dataset.summarySignature=signature;
  badge.innerHTML=`<div class="career-level-rank"><span>NV</span><strong>${level}</strong></div><div class="career-level-meter"><div class="career-level-meter-head"><span>Progresso</span><strong>${xp}<small> / ${need} XP</small></strong></div><div class="career-level-track" aria-hidden="true"><i style="width:${percent}%"></i></div></div>`;
}

function normalizeBadge(){
  if(normalizing)return;
  const badge=document.getElementById('careerLevelBadge');
  const player=document.querySelector('.identity-player');
  const host=player?.children?.[1];
  if(!badge||!host)return;
  normalizing=true;
  try{
    ensureStyle();
    const state=parseState(badge);
    if(badge.parentElement!==host)host.appendChild(badge);
    renderBadge(badge,state);
    if(!badge.dataset.clickGuard){
      badge.dataset.clickGuard='1';
      badge.addEventListener('click',event=>event.stopPropagation());
      badge.addEventListener('dblclick',event=>event.stopPropagation());
    }
  }finally{normalizing=false}
}

function installObserver(){
  if(observer)return;
  const player=document.querySelector('.identity-player');
  if(!player)return;
  observer=new MutationObserver(()=>queueMicrotask(normalizeBadge));
  observer.observe(player,{childList:true,subtree:true,characterData:true});
}

function init(){
  ensureStyle();
  installObserver();
  normalizeBadge();
  setTimeout(normalizeBadge,0);
  setTimeout(normalizeBadge,120);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
else init();
document.addEventListener('career:hub-rendered',()=>setTimeout(normalizeBadge,0));
window.addEventListener('career:updated',()=>{setTimeout(normalizeBadge,0);setTimeout(normalizeBadge,180)});
document.addEventListener('click',event=>{if(event.target.closest?.('.identity-player,[data-player-tab="development"]'))setTimeout(normalizeBadge,0)});
