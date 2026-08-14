let normalizing=false;
let observer=null;

function ensureStyle(){
  let style=document.getElementById('career-level-summary-v8-style');
  if(!style){style=document.createElement('style');style.id='career-level-summary-v8-style';document.head.appendChild(style)}
  if(style.dataset.version==='3')return;
  style.dataset.version='3';
  style.textContent=`
  #careerLevelBadge.career-level-badge{
    width:min(100%,300px)!important;min-height:0!important;height:auto!important;margin:8px 0 0!important;padding:0!important;
    display:flex!important;align-items:center!important;gap:10px!important;overflow:visible!important;box-sizing:border-box!important;
    border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;cursor:default!important;user-select:none!important
  }
  #careerLevelBadge .career-level-rank{
    flex:0 0 auto!important;width:auto!important;height:28px!important;min-height:28px!important;padding:0 10px!important;
    display:inline-flex!important;flex-direction:row!important;align-items:center!important;justify-content:center!important;gap:4px!important;
    border:1px solid color-mix(in srgb,var(--green-2) 35%,transparent)!important;border-radius:999px!important;
    background:color-mix(in srgb,var(--green-2) 10%,transparent)!important;color:var(--green-2)!important;box-shadow:none!important
  }
  #careerLevelBadge .career-level-rank span,#careerLevelBadge .career-level-rank strong,
  #careerLevelBadge .career-level-meter span,#careerLevelBadge .career-level-meter strong,
  #careerLevelBadge .career-level-meter small,#careerLevelBadge .career-level-meter b{
    grid-area:auto!important;margin:0!important;padding:0!important;min-height:0!important;height:auto!important;max-height:none!important;
    border:0!important;border-radius:0!important;background:none!important;box-shadow:none!important;display:block!important
  }
  #careerLevelBadge .career-level-rank span{font-size:8px!important;font-weight:900!important;letter-spacing:.08em!important;line-height:1!important;text-transform:uppercase!important;color:var(--green-2)!important}
  #careerLevelBadge .career-level-rank strong{font-size:13px!important;font-weight:950!important;line-height:1!important;color:var(--green-2)!important}
  #careerLevelBadge .career-level-meter{flex:1 1 auto!important;min-width:0!important;height:auto!important;min-height:0!important;max-height:none!important;padding:0!important;display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;grid-template-areas:'track value' 'caption value'!important;column-gap:9px!important;row-gap:4px!important;align-items:center!important;overflow:visible!important}
  #careerLevelBadge .career-level-meter-head{display:contents!important}
  #careerLevelBadge .career-level-meter-head>span{display:none!important}
  #careerLevelBadge .career-level-meter-head>strong{grid-area:value!important;align-self:center!important;color:var(--text)!important;font-size:10px!important;font-weight:950!important;line-height:1!important;white-space:nowrap!important}
  #careerLevelBadge .career-level-meter-head>strong small{display:inline!important;color:var(--muted)!important;font-size:8px!important;font-weight:800!important}
  #careerLevelBadge .career-level-track{grid-area:track!important;width:100%!important;height:4px!important;min-height:4px!important;max-height:4px!important;margin:0!important;overflow:hidden!important;border-radius:999px!important;background:color-mix(in srgb,var(--text) 10%,transparent)!important}
  #careerLevelBadge .career-level-track i{display:block!important;height:4px!important;min-height:4px!important;max-height:4px!important;border-radius:999px!important;background:var(--green-2)!important;box-shadow:none!important}
  #careerLevelBadge .career-level-meter-foot{grid-area:caption!important;margin:0!important;display:flex!important;align-items:center!important;justify-content:flex-start!important;gap:6px!important;min-height:0!important;overflow:visible!important}
  #careerLevelBadge .career-level-meter-foot>span{color:var(--muted)!important;font-size:7px!important;font-weight:800!important;line-height:1!important;white-space:nowrap!important}
  #careerLevelBadge .career-level-points{display:none!important}
  @media(max-width:560px){#careerLevelBadge.career-level-badge{width:min(100%,260px)!important;gap:8px!important}#careerLevelBadge .career-level-rank{height:26px!important;min-height:26px!important;padding:0 8px!important}}
  `;
}

function directLegacyValue(badge,selector){return [...badge.children].find(node=>node.matches?.(selector))?.textContent?.trim()||''}
function parseState(badge){
  const levelMatch=directLegacyValue(badge,'strong').match(/(\d+)/);
  const xpMatch=directLegacyValue(badge,'span').match(/(\d+)\s*\/\s*(\d+)/);
  const pointsMatch=directLegacyValue(badge,'b').match(/(\d+)/);
  if(levelMatch&&xpMatch)return{level:Number(levelMatch[1]),xp:Number(xpMatch[1]),need:Math.max(1,Number(xpMatch[2])),points:Number(pointsMatch?.[1]||0)};
  return{level:Number(badge.dataset.level||1),xp:Number(badge.dataset.xp||0),need:Math.max(1,Number(badge.dataset.need||400)),points:Number(badge.dataset.points||0)}
}
function renderBadge(badge,state){
  const level=Math.max(1,Number(state.level||1)),xp=Math.max(0,Number(state.xp||0)),need=Math.max(1,Number(state.need||400)),points=Math.max(0,Number(state.points||0));
  const percent=Math.max(0,Math.min(100,Math.round((xp/need)*100))),signature=`${level}:${xp}:${need}:${points}`;
  Object.assign(badge.dataset,{level:String(level),xp:String(xp),need:String(need),points:String(points),summaryReady:'1'});
  badge.setAttribute('aria-label',`Nível ${level}. ${xp} de ${need} XP. ${percent}% para o nível ${level+1}.`);
  if(badge.dataset.summarySignature===signature&&badge.querySelector('.career-level-meter'))return;
  badge.dataset.summarySignature=signature;
  badge.innerHTML=`<div class="career-level-rank"><span>Nível</span><strong>${level}</strong></div><div class="career-level-meter"><div class="career-level-meter-head"><span>XP</span><strong>${xp}<small> / ${need} XP</small></strong></div><div class="career-level-track" aria-hidden="true"><i style="width:${percent}%"></i></div><div class="career-level-meter-foot"><span>${percent}% para o nível ${level+1}</span></div></div>`
}
function normalizeBadge(){
  if(normalizing)return;
  const badge=document.getElementById('careerLevelBadge'),player=document.querySelector('.identity-player'),host=player?.children?.[1];
  if(!badge||!host)return;normalizing=true;
  try{ensureStyle();const state=parseState(badge);if(badge.parentElement!==host)host.appendChild(badge);renderBadge(badge,state);if(!badge.dataset.clickGuard){badge.dataset.clickGuard='1';badge.addEventListener('click',event=>event.stopPropagation());badge.addEventListener('dblclick',event=>event.stopPropagation())}}finally{normalizing=false}
}
function installObserver(){if(observer)return;const player=document.querySelector('.identity-player');if(!player)return;observer=new MutationObserver(()=>queueMicrotask(normalizeBadge));observer.observe(player,{childList:true,subtree:true,characterData:true})}
function init(){ensureStyle();installObserver();normalizeBadge();setTimeout(normalizeBadge,0);setTimeout(normalizeBadge,120)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
document.addEventListener('career:hub-rendered',()=>setTimeout(normalizeBadge,0));
window.addEventListener('career:updated',()=>{setTimeout(normalizeBadge,0);setTimeout(normalizeBadge,180)});
document.addEventListener('click',event=>{if(event.target.closest?.('.identity-player,[data-player-tab="development"]'))setTimeout(normalizeBadge,0)});
