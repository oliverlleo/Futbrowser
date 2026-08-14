let normalizing=false;
let observer=null;

function ensureStyle(){
  let style=document.getElementById('career-level-summary-v8-style');
  if(!style){
    style=document.createElement('style');
    style.id='career-level-summary-v8-style';
    document.head.appendChild(style);
  }
  if(style.dataset.version==='2')return;
  style.dataset.version='2';
  style.textContent=`
  #careerLevelBadge.career-level-badge{
    width:min(100%,268px)!important;
    height:50px!important;min-height:50px!important;max-height:50px!important;
    margin:9px 0 0!important;padding:4px 8px 4px 4px!important;
    display:flex!important;align-items:center!important;gap:10px!important;
    overflow:hidden!important;box-sizing:border-box!important;
    border:1px solid rgba(37,99,235,.18)!important;border-radius:13px!important;
    background:linear-gradient(135deg,rgba(37,99,235,.055),rgba(255,255,255,.01))!important;
    box-shadow:none!important;cursor:default!important;user-select:none!important;align-self:flex-start!important;
  }
  #careerLevelBadge .career-level-rank{
    flex:0 0 42px!important;width:42px!important;height:42px!important;min-height:42px!important;max-height:42px!important;
    padding:0!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;
    border-radius:10px!important;background:linear-gradient(145deg,#2563eb,#1e40af)!important;color:#fff!important;
    box-shadow:0 4px 10px rgba(37,99,235,.18)!important;
  }
  #careerLevelBadge .career-level-rank span,#careerLevelBadge .career-level-rank strong,
  #careerLevelBadge .career-level-meter span,#careerLevelBadge .career-level-meter strong,
  #careerLevelBadge .career-level-meter small,#careerLevelBadge .career-level-meter b{
    grid-area:auto!important;margin:0!important;padding:0!important;min-height:0!important;height:auto!important;max-height:none!important;
    border:0!important;border-radius:0!important;background:none!important;box-shadow:none!important;display:block!important;
  }
  #careerLevelBadge .career-level-rank span{color:rgba(255,255,255,.78)!important;font-size:6px!important;font-weight:900!important;letter-spacing:.13em!important;line-height:1!important;text-transform:uppercase!important}
  #careerLevelBadge .career-level-rank strong{margin-top:2px!important;color:#fff!important;font-size:18px!important;font-weight:950!important;letter-spacing:-.04em!important;line-height:1!important}
  #careerLevelBadge .career-level-meter{flex:1 1 auto!important;min-width:0!important;height:40px!important;min-height:40px!important;max-height:40px!important;padding:1px 0!important;display:flex!important;flex-direction:column!important;justify-content:center!important;overflow:hidden!important}
  #careerLevelBadge .career-level-meter-head{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:8px!important;min-height:12px!important}
  #careerLevelBadge .career-level-meter-head>span{color:var(--muted)!important;font-size:7px!important;font-weight:900!important;letter-spacing:.07em!important;text-transform:uppercase!important;white-space:nowrap!important}
  #careerLevelBadge .career-level-meter-head>strong{color:var(--text)!important;font-size:11px!important;font-weight:950!important;line-height:1!important;white-space:nowrap!important}
  #careerLevelBadge .career-level-meter-head>strong small{display:inline!important;color:var(--muted)!important;font-size:8px!important;font-weight:800!important}
  #careerLevelBadge .career-level-track{width:100%!important;height:5px!important;min-height:5px!important;max-height:5px!important;margin:5px 0 0!important;overflow:hidden!important;border-radius:999px!important;background:rgba(100,116,139,.16)!important}
  #careerLevelBadge .career-level-track i{display:block!important;height:5px!important;min-height:5px!important;max-height:5px!important;border-radius:999px!important;background:linear-gradient(90deg,#2563eb,#60a5fa)!important;box-shadow:none!important}
  #careerLevelBadge .career-level-meter-foot{margin-top:4px!important;display:flex!important;align-items:center!important;justify-content:space-between!important;gap:6px!important;min-height:9px!important;overflow:hidden!important}
  #careerLevelBadge .career-level-meter-foot>span{color:var(--muted)!important;font-size:7px!important;font-weight:800!important;line-height:1!important;white-space:nowrap!important}
  #careerLevelBadge .career-level-points{padding:2px 5px!important;border-radius:999px!important;background:rgba(56,201,31,.10)!important;color:var(--green-2)!important;font-size:6px!important;font-weight:950!important;white-space:nowrap!important}
  @media(max-width:560px){#careerLevelBadge.career-level-badge{width:min(100%,250px)!important}}
  `;
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
  badge.innerHTML=`<div class="career-level-rank"><span>NV.</span><strong>${level}</strong></div><div class="career-level-meter"><div class="career-level-meter-head"><span>XP da carreira</span><strong>${xp}<small> / ${need}</small></strong></div><div class="career-level-track" aria-hidden="true"><i style="width:${percent}%"></i></div><div class="career-level-meter-foot"><span>${percent}% para o nível ${level+1}</span>${points>0?`<b class="career-level-points">${points} pt${points===1?'':'s'}</b>`:''}</div></div>`;
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
