let normalizing=false;
let observer=null;

function ensureStyle(){
  if(document.getElementById('career-level-summary-v8-style'))return;
  const style=document.createElement('style');
  style.id='career-level-summary-v8-style';
  style.textContent=`
  #careerLevelBadge.career-level-badge{width:min(100%,300px)!important;margin-top:10px!important;padding:0!important;display:grid!important;grid-template-columns:60px minmax(0,1fr)!important;grid-template-areas:none!important;gap:0!important;overflow:hidden!important;border:1px solid rgba(37,99,235,.24)!important;border-radius:14px!important;background:var(--card-solid)!important;box-shadow:0 8px 24px rgba(15,23,42,.07)!important;cursor:default!important;user-select:none!important}
  #careerLevelBadge .career-level-rank{min-height:64px;padding:8px 6px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:linear-gradient(155deg,#2563eb,#1d4ed8);color:#fff}
  #careerLevelBadge .career-level-rank span,#careerLevelBadge .career-level-rank strong,#careerLevelBadge .career-level-meter span,#careerLevelBadge .career-level-meter strong,#careerLevelBadge .career-level-meter small,#careerLevelBadge .career-level-meter b{grid-area:auto!important;margin:0!important;padding:0!important;min-height:0!important;border:0!important;border-radius:0!important;background:none!important;display:block!important}
  #careerLevelBadge .career-level-rank span{color:rgba(255,255,255,.78)!important;font-size:7px!important;font-weight:900!important;letter-spacing:.14em!important;line-height:1!important;text-transform:uppercase}
  #careerLevelBadge .career-level-rank strong{margin-top:4px!important;color:#fff!important;font-size:25px!important;font-weight:950!important;letter-spacing:-.05em!important;line-height:.95!important}
  #careerLevelBadge .career-level-meter{min-width:0;padding:9px 11px 8px;display:flex;flex-direction:column;justify-content:center}
  #careerLevelBadge .career-level-meter-head{display:flex;align-items:flex-end;justify-content:space-between;gap:10px}
  #careerLevelBadge .career-level-meter-head>span{color:var(--muted)!important;font-size:7px!important;font-weight:900!important;letter-spacing:.08em!important;text-transform:uppercase;white-space:nowrap}
  #careerLevelBadge .career-level-meter-head>strong{color:var(--text)!important;font-size:11px!important;font-weight:950!important;line-height:1!important;white-space:nowrap}
  #careerLevelBadge .career-level-meter-head>strong small{display:inline!important;color:var(--muted)!important;font-size:8px!important;font-weight:800!important}
  #careerLevelBadge .career-level-track{height:6px;margin-top:7px;overflow:hidden;border-radius:999px;background:rgba(127,127,127,.14)}
  #careerLevelBadge .career-level-track i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#2563eb,#60a5fa);box-shadow:0 0 10px rgba(37,99,235,.24)}
  #careerLevelBadge .career-level-meter-foot{margin-top:6px;display:flex;align-items:center;justify-content:space-between;gap:8px}
  #careerLevelBadge .career-level-meter-foot>span{color:var(--muted)!important;font-size:8px!important;font-weight:800!important;line-height:1.2!important}
  #careerLevelBadge .career-level-points{padding:3px 6px!important;border-radius:999px!important;background:rgba(56,201,31,.11)!important;color:var(--green-2)!important;font-size:7px!important;font-weight:950!important;white-space:nowrap}
  @media(max-width:560px){#careerLevelBadge.career-level-badge{width:min(100%,280px)!important;grid-template-columns:56px minmax(0,1fr)!important}#careerLevelBadge .career-level-rank{min-height:60px}#careerLevelBadge .career-level-rank strong{font-size:23px!important}}
  `;
  document.head.appendChild(style);
}

function directLegacyValue(badge,selector){
  return [...badge.children].find(node=>node.matches?.(selector))?.textContent?.trim()||'';
}

function parseState(badge){
  const legacyLevel=directLegacyValue(badge,'strong');
  const legacyXp=directLegacyValue(badge,'span');
  const legacyPoints=directLegacyValue(badge,'b');
  const levelMatch=legacyLevel.match(/(\d+)/);
  const xpMatch=legacyXp.match(/(\d+)\s*\/\s*(\d+)/);
  const pointsMatch=legacyPoints.match(/(\d+)/);
  if(levelMatch&&xpMatch){
    return {level:Number(levelMatch[1]),xp:Number(xpMatch[1]),need:Math.max(1,Number(xpMatch[2])),points:Number(pointsMatch?.[1]||0)};
  }
  return {
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
  badge.dataset.level=String(level);
  badge.dataset.xp=String(xp);
  badge.dataset.need=String(need);
  badge.dataset.points=String(points);
  badge.dataset.summaryReady='1';
  badge.setAttribute('aria-label',`Nível ${level}. ${xp} de ${need} XP. ${percent}% para o nível ${level+1}.`);
  if(badge.dataset.summarySignature===signature&&badge.querySelector('.career-level-meter'))return;
  badge.dataset.summarySignature=signature;
  badge.innerHTML=`<div class="career-level-rank"><span>Nível</span><strong>${level}</strong></div><div class="career-level-meter"><div class="career-level-meter-head"><span>Progresso da carreira</span><strong>${xp}<small> / ${need} XP</small></strong></div><div class="career-level-track" aria-hidden="true"><i style="width:${percent}%"></i></div><div class="career-level-meter-foot"><span>${percent}% para o nível ${level+1}</span>${points>0?`<b class="career-level-points">${points} pt${points===1?'':'s'} de evolução</b>`:''}</div></div>`;
}

function normalizeBadge(){
  if(normalizing)return;
  const badge=document.getElementById('careerLevelBadge');
  const player=document.querySelector('.identity-player');
  const host=player?.children?.[1];
  if(!badge||!host)return;
  normalizing=true;
  try{
    const state=parseState(badge);
    if(badge.parentElement!==host)host.appendChild(badge);
    renderBadge(badge,state);
    if(!badge.dataset.clickGuard){
      badge.dataset.clickGuard='1';
      badge.addEventListener('click',event=>event.stopPropagation());
      badge.addEventListener('dblclick',event=>event.stopPropagation());
    }
  }finally{
    normalizing=false;
  }
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
document.addEventListener('click',event=>{
  if(event.target.closest?.('.identity-player,[data-player-tab="development"]'))setTimeout(normalizeBadge,0);
});
